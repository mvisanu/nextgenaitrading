"""
FastAPI dependencies for authenticated routes.

Supabase JWT authentication: reads the Authorization header (Bearer token),
decodes the Supabase-issued JWT, and loads/creates the corresponding User
from the database.

Supports two JWT signing schemes Supabase uses:
  - **Asymmetric (ES256/RS256)** — current Supabase projects. JWTs carry a
    `kid` in the header; public key is fetched from the project's JWKS
    endpoint (`/auth/v1/.well-known/jwks.json`). Used for user tokens issued
    via magic-link, OAuth, password, etc.
  - **Symmetric (HS256)** — legacy projects and the anon_key/service_role_key
    artefacts. Uses `settings.supabase_jwt_secret` as the shared HMAC secret.

Algorithm detection is based on the JWT header; only the allow-listed algs
are accepted to prevent "alg=none" confusion attacks.
"""
from __future__ import annotations

import logging
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import PyJWTError as JWTError
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

_credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated.",
    headers={"WWW-Authenticate": "Bearer"},
)

# HTTPBearer extracts the token from the Authorization: Bearer <token> header
_bearer_scheme = HTTPBearer(auto_error=False)

# JWKS client is cached per project URL so we don't refetch the key on every
# request. PyJWKClient internally caches keys for ~1h (see lifespan arg).
_jwks_client_cache: dict[str, jwt.PyJWKClient] = {}

# Algorithms we accept. Supabase only ever signs with these — rejecting anything
# else (including "none") prevents alg-confusion attacks if an attacker supplies
# a token with a forged header.
_ASYMMETRIC_ALGS = {"ES256", "RS256", "ES384", "RS384", "ES512", "RS512"}
_SYMMETRIC_ALGS = {"HS256", "HS384", "HS512"}


def _get_jwks_client(supabase_url: str) -> jwt.PyJWKClient:
    """Return a cached PyJWKClient for the given Supabase project URL."""
    jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    client = _jwks_client_cache.get(jwks_url)
    if client is None:
        # lifespan=3600 → keys cached for 1 hour; Supabase rotates rarely so this is safe
        client = jwt.PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)
        _jwks_client_cache[jwks_url] = client
    return client


def _decode_supabase_token(token: str) -> dict:
    """
    Decode and validate a Supabase-issued JWT.
    Picks the verification method (JWKS vs. shared secret) based on the header
    algorithm, and restricts accepted algorithms to prevent alg-confusion.
    """
    # Peek at the header to choose verification path. Header is untrusted user
    # input — only used to look up the correct key; the signature check below
    # still fails if the attacker lied about alg.
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as e:
        logger.warning("Malformed JWT header: %s", e)
        raise
    alg = header.get("alg", "")

    # ── Asymmetric path (current Supabase user tokens: ES256/RS256) ──────────
    if alg in _ASYMMETRIC_ALGS:
        if not settings.supabase_url:
            logger.warning(
                "Received asymmetric JWT (alg=%s) but supabase_url is not configured — cannot fetch JWKS",
                alg,
            )
            raise JWTError("supabase_url not configured for JWKS verification")
        try:
            jwks_client = _get_jwks_client(settings.supabase_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=[alg],
                audience="authenticated",
                options={"verify_aud": True},
                # Small leeway to tolerate minor clock skew between local box and Supabase.
                leeway=10,
            )
        except JWTError as err:
            _log_decode_failure(token, err, alg)
            raise

    # ── Symmetric path (legacy HS256: anon_key, service_role_key, old projects) ──
    if alg in _SYMMETRIC_ALGS:
        secret = settings.supabase_jwt_secret or settings.secret_key
        try:
            return jwt.decode(
                token,
                secret,
                algorithms=[alg],
                audience="authenticated",
                options={"verify_aud": True},
                leeway=10,
            )
        except JWTError as primary_err:
            # Fallback to legacy secret_key only when supabase_jwt_secret is set
            # and the primary decode failed (useful during key rotation).
            if settings.supabase_jwt_secret and settings.secret_key:
                try:
                    return jwt.decode(
                        token,
                        settings.secret_key,
                        algorithms=[alg],
                        audience="authenticated",
                        options={"verify_aud": True},
                        leeway=10,
                    )
                except JWTError:
                    pass
            _log_decode_failure(token, primary_err, alg)
            raise

    logger.warning("JWT uses unsupported algorithm %r — rejecting", alg)
    raise JWTError(f"Unsupported JWT algorithm: {alg!r}")


def _log_decode_failure(token: str, err: Exception, alg: str) -> None:
    """Emit a single warning line with the key diagnostic fields from a failed decode."""
    try:
        payload_unverified = jwt.decode(
            token,
            options={"verify_signature": False, "verify_aud": False, "verify_exp": False},
        )
        iss = payload_unverified.get("iss", "?")
        aud = payload_unverified.get("aud", "?")
        exp = payload_unverified.get("exp", "?")
        role = payload_unverified.get("role", "?")
    except Exception:
        iss = aud = exp = role = "<parse-failed>"
    logger.warning(
        "JWT decode FAILED: err=%r | alg=%s | iss=%s aud=%s exp=%s role=%s | supabase_url=%s jwt_secret_set=%s",
        err,
        alg,
        iss,
        aud,
        exp,
        role,
        bool(settings.supabase_url),
        bool(settings.supabase_jwt_secret),
    )


async def get_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    credentials: Annotated[
        Optional[HTTPAuthorizationCredentials], Depends(_bearer_scheme)
    ] = None,
) -> User:
    """
    Validate the Bearer token and return the authenticated User.
    Raises HTTP 401 if the token is missing, invalid, or expired.

    For Supabase tokens, the `sub` claim contains the Supabase user UUID.
    We look up the user by email from the token, creating one if needed
    (auto-provisioning on first API call after Supabase auth).

    In debug mode, also accepts a `dev_token` cookie as a fallback Bearer token
    (used by Playwright E2E tests to avoid the Supabase magic-link flow).
    """
    # Resolve the token: prefer Authorization header, fall back to dev_token cookie (debug only)
    raw_token: Optional[str] = None
    if credentials:
        raw_token = credentials.credentials
    elif settings.debug:
        raw_token = request.cookies.get("dev_token")

    if not raw_token:
        raise _credentials_exception

    try:
        payload = _decode_supabase_token(raw_token)
        # Supabase tokens have `sub` (user UUID) and `email` in the payload
        user_email = payload.get("email")
        user_sub = payload.get("sub")
        if not user_email and not user_sub:
            raise _credentials_exception
    except (JWTError, KeyError, ValueError):
        raise _credentials_exception

    # Look up user by email (Supabase tokens always include email)
    if user_email:
        result = await db.execute(
            select(User).where(User.email == user_email, User.is_active.is_(True))
        )
        user = result.scalar_one_or_none()

        # Auto-provision user on first API call if they authenticated via Supabase
        if user is None and user_email:
            user = User(
                email=user_email,
                password_hash="supabase_managed",  # No local password — Supabase handles auth
                is_active=True,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            logger.info("Auto-provisioned user %s from Supabase token", user_email)
    else:
        # Fallback: look up by legacy integer ID (for old tokens during migration)
        try:
            user_id = int(user_sub)
            result = await db.execute(
                select(User).where(User.id == user_id, User.is_active.is_(True))
            )
            user = result.scalar_one_or_none()
        except (ValueError, TypeError):
            user = None

    if user is None:
        raise _credentials_exception

    return user


async def optional_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    credentials: Annotated[
        Optional[HTTPAuthorizationCredentials], Depends(_bearer_scheme)
    ] = None,
) -> User | None:
    """
    Like get_current_user but returns None instead of raising on missing/invalid token.
    """
    if not credentials and not (settings.debug and request.cookies.get("dev_token")):
        return None

    try:
        return await get_current_user(request, db, credentials)
    except HTTPException:
        return None
