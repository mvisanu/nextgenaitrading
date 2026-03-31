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

# Attempt to import py_vollib_vectorized; fall back gracefully
try:
    import py_vollib_vectorized as pv  # type: ignore

    _HAS_VOLLIB = True
except ImportError:
    _HAS_VOLLIB = False
    logger.warning("py_vollib_vectorized not installed — Greeks will use Black-Scholes fallback")


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
    """
    r = risk_free_rate if risk_free_rate is not None else getattr(settings, "risk_free_rate", 0.05)
    today = date.today()

    for c in contracts:
        # Mark illiquid
        if c.mid > 0:
            spread_pct = (c.ask - c.bid) / c.mid
            c.illiquid = spread_pct > 0.10

        # Time to expiry in years
        days = max((c.expiration - today).days, 0)
        t = days / 365.0
        iv = c.implied_volatility if c.implied_volatility > 0 else 0.30
        flag = "c" if c.option_type == "call" else "p"

        if _HAS_VOLLIB and t > 0:
            try:
                import numpy as np
                res = pv.greeks.analytical(
                    flag,
                    np.array([underlying_price]),
                    np.array([c.strike]),
                    np.array([t]),
                    np.array([r]),
                    np.array([iv]),
                )
                c.delta = float(res["delta"][0])
                c.gamma = float(res["gamma"][0])
                c.theta = float(res["theta"][0]) / 365
                c.vega = float(res["vega"][0]) / 100
            except Exception:
                c.delta, c.gamma, c.theta, c.vega = _bs_greeks(flag, underlying_price, c.strike, t, r, iv)
        else:
            c.delta, c.gamma, c.theta, c.vega = _bs_greeks(flag, underlying_price, c.strike, t, r, iv)

    return contracts
