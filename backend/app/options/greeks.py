"""Greeks computation for options contracts.

Uses py_vollib_vectorized for batch calculation.
Falls back to a simple Black-Scholes approximation when py_vollib is unavailable.
"""
from __future__ import annotations

import logging
import math
from datetime import date

from app.core.config import settings
from .broker.base import OptionContract

logger = logging.getLogger(__name__)

# Attempt to import py_vollib_vectorized; fall back gracefully.
# RuntimeError is caught in addition to ImportError because numba (a transitive
# dependency) tries to cache JIT-compiled functions to the site-packages directory
# at import time, which fails on Render's read-only container filesystem with:
#   RuntimeError: cannot cache function '_is_zero': no locator available for ...
try:
    import py_vollib_vectorized as pv  # type: ignore

    _HAS_VOLLIB = True
except Exception:
    _HAS_VOLLIB = False
    logger.warning(
        "py_vollib_vectorized unavailable (import failed) — Greeks will use Black-Scholes fallback"
    )


# ─── Black-Scholes fallback ───────────────────────────────────────────────────

def _norm_cdf(x: float) -> float:
    return (1.0 + math.erf(x / math.sqrt(2.0))) / 2.0


def _bs_greeks(
    flag: str,
    S: float,
    K: float,
    t: float,
    r: float,
    sigma: float,
) -> tuple[float, float, float, float]:
    """Return (delta, gamma, theta, vega) via analytic Black-Scholes."""
    if t <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return 0.0, 0.0, 0.0, 0.0
    sqrt_t = math.sqrt(t)
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * t) / (sigma * sqrt_t)
    d2 = d1 - sigma * sqrt_t
    nd1 = _norm_cdf(d1)
    nd2 = _norm_cdf(d2)
    n_pdf_d1 = math.exp(-0.5 * d1 ** 2) / math.sqrt(2 * math.pi)

    gamma = n_pdf_d1 / (S * sigma * sqrt_t)
    vega = S * n_pdf_d1 * sqrt_t / 100  # per 1% IV move

    if flag == "c":
        delta = nd1
        theta = (
            -(S * n_pdf_d1 * sigma) / (2 * sqrt_t)
            - r * K * math.exp(-r * t) * nd2
        ) / 365
    else:
        delta = nd1 - 1
        theta = (
            -(S * n_pdf_d1 * sigma) / (2 * sqrt_t)
            + r * K * math.exp(-r * t) * (1 - nd2)
        ) / 365

    return round(delta, 4), round(gamma, 6), round(theta, 4), round(vega, 4)


# ─── Public API ───────────────────────────────────────────────────────────────

def compute_greeks(
    contracts: list[OptionContract],
    underlying_price: float,
    risk_free_rate: float | None = None,
) -> list[OptionContract]:
    """Enrich each OptionContract with computed Greeks.

    Uses py_vollib_vectorized when available; falls back to analytic B-S.
    Marks contracts illiquid when bid/ask spread > 10% of mid.

    When py_vollib_vectorized is available the full chain is evaluated in ONE
    vectorized call (one numpy array per flag type) rather than 400 single-
    element allocations per 100-contract chain.
    """
    import numpy as np

    r = risk_free_rate if risk_free_rate is not None else getattr(settings, "risk_free_rate", 0.05)
    today = date.today()

    # ── Pre-pass: mark illiquid + build per-contract t/iv arrays ─────────────
    for c in contracts:
        if c.mid > 0:
            spread_pct = (c.ask - c.bid) / c.mid
            c.illiquid = spread_pct > 0.10

    if not contracts:
        return contracts

    if _HAS_VOLLIB:
        # Split into calls and puts for separate vectorized calls
        for flag_char, flag_contracts in (("c", [c for c in contracts if c.option_type == "call"]),
                                          ("p", [c for c in contracts if c.option_type != "call"])):
            if not flag_contracts:
                continue
            days_arr = np.array(
                [max((c.expiration - today).days, 0) for c in flag_contracts], dtype=np.float64
            )
            t_arr = days_arr / 365.0
            S_arr = np.full(len(flag_contracts), underlying_price, dtype=np.float64)
            K_arr = np.array([c.strike for c in flag_contracts], dtype=np.float64)
            r_arr = np.full(len(flag_contracts), r, dtype=np.float64)
            iv_arr = np.array(
                [c.implied_volatility if c.implied_volatility > 0 else 0.30 for c in flag_contracts],
                dtype=np.float64,
            )

            # Identify valid contracts (t > 0); use B-S scalar fallback for expired ones
            valid_mask = t_arr > 0
            if valid_mask.any():
                try:
                    res = pv.greeks.analytical(flag_char, S_arr, K_arr, t_arr, r_arr, iv_arr)
                    for i, c in enumerate(flag_contracts):
                        if valid_mask[i]:
                            c.delta = float(res["delta"][i])
                            c.gamma = float(res["gamma"][i])
                            c.theta = float(res["theta"][i]) / 365
                            c.vega = float(res["vega"][i]) / 100
                        else:
                            c.delta, c.gamma, c.theta, c.vega = _bs_greeks(
                                flag_char, underlying_price, c.strike, 0.0, r,
                                c.implied_volatility if c.implied_volatility > 0 else 0.30,
                            )
                    continue
                except Exception:
                    pass

            # Fallback: scalar B-S for each contract in this flag group
            for c in flag_contracts:
                days = max((c.expiration - today).days, 0)
                t = days / 365.0
                iv = c.implied_volatility if c.implied_volatility > 0 else 0.30
                c.delta, c.gamma, c.theta, c.vega = _bs_greeks(
                    flag_char, underlying_price, c.strike, t, r, iv
                )
    else:
        # No vectorized library — scalar B-S fallback for every contract
        for c in contracts:
            days = max((c.expiration - today).days, 0)
            t = days / 365.0
            iv = c.implied_volatility if c.implied_volatility > 0 else 0.30
            flag = "c" if c.option_type == "call" else "p"
            c.delta, c.gamma, c.theta, c.vega = _bs_greeks(flag, underlying_price, c.strike, t, r, iv)

    return contracts
