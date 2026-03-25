"""
Conservative Strategy
- Leverage: 2.5x
- Min confirmations: 7 out of 8 indicators
- Trailing stop: disabled
- Uses HMM (GaussianHMM 2-state) for regime detection
- Confirmation gate: RSI, MACD, EMA cross, Bollinger, ADX, OBV, ATR, Volume
"""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd
import ta
from hmmlearn.hmm import GaussianHMM
from sklearn.preprocessing import StandardScaler

from app.strategies.base import BaseStrategy, SignalResult

logger = logging.getLogger(__name__)


def _safe_fit_hmm(features: np.ndarray, n_components: int = 2) -> tuple[GaussianHMM, StandardScaler]:
    scaler = StandardScaler()
    scaled = scaler.fit_transform(features)
    model = GaussianHMM(
        n_components=n_components,
        covariance_type="diag",
        n_iter=200,
        random_state=42,
    )
    model.fit(scaled)
    return model, scaler


def _identify_bull_bear(model: GaussianHMM, features_scaled: np.ndarray) -> tuple[int, int]:
    """
    Identify which HMM state is 'bull' and which is 'bear'
    based on mean returns (higher mean return = bull state).
    """
    means = model.means_[:, 0]  # First feature is returns
    bull_state = int(np.argmax(means))
    bear_state = int(np.argmin(means))
    return bull_state, bear_state


CONFIRMATION_LABELS = [
    "RSI < 70 (not overbought)",
    "MACD > Signal line",
    "EMA 20 > EMA 50 (uptrend)",
    "Price > lower Bollinger",
    "ADX > 20 (trending)",
    "OBV increasing",
    "ATR > 0 (market active)",
    "Volume > 80% of 20-bar avg",
]


def _compute_confirmations(df: pd.DataFrame, row_idx: int) -> tuple[int, list[bool]]:
    """
    Compute 8 binary confirmation signals at a given bar index.
    Returns (count_true, list_of_booleans).
    """
    row = df.iloc[row_idx]
    confirms = []

    # 1. RSI < 70 (not overbought for buy signal)
    rsi_val = row.get("rsi", 50.0)
    confirms.append(bool(rsi_val < 70))

    # 2. MACD > Signal line
    macd_val = row.get("macd", 0.0)
    macd_sig = row.get("macd_signal", 0.0)
    confirms.append(bool(macd_val > macd_sig))

    # 3. EMA_20 > EMA_50 (short above long = uptrend)
    ema20 = row.get("ema_20", row["Close"])
    ema50 = row.get("ema_50", row["Close"])
    confirms.append(bool(ema20 > ema50))

    # 4. Price above lower Bollinger band
    bb_lower = row.get("bb_lower", 0.0)
    confirms.append(bool(row["Close"] > bb_lower))

    # 5. ADX > 20 (trending market)
    adx_val = row.get("adx", 0.0)
    confirms.append(bool(adx_val > 20))

    # 6. OBV increasing (proxy: OBV > OBV_prev)
    obv_diff = row.get("obv_diff", 0.0)
    confirms.append(bool(obv_diff > 0))

    # 7. ATR > 0 (market active)
    atr_val = row.get("atr", 0.0)
    confirms.append(bool(atr_val > 0))

    # 8. Volume above 20-bar average
    vol_ratio = row.get("vol_ratio", 1.0)
    confirms.append(bool(vol_ratio > 0.8))

    return sum(confirms), confirms


def compute_confirmation_details(df: pd.DataFrame, row_idx: int) -> list[dict]:
    """Return detailed per-indicator confirmation results for the signal check UI."""
    row = df.iloc[row_idx]
    details = []

    rsi_val = row.get("rsi", 50.0)
    details.append({"name": CONFIRMATION_LABELS[0], "met": bool(rsi_val < 70), "value": f"RSI = {rsi_val:.1f}"})

    macd_val = row.get("macd", 0.0)
    macd_sig = row.get("macd_signal", 0.0)
    details.append({"name": CONFIRMATION_LABELS[1], "met": bool(macd_val > macd_sig), "value": f"MACD = {macd_val:.4f}, Signal = {macd_sig:.4f}"})

    ema20 = row.get("ema_20", row["Close"])
    ema50 = row.get("ema_50", row["Close"])
    details.append({"name": CONFIRMATION_LABELS[2], "met": bool(ema20 > ema50), "value": f"EMA20 = {ema20:.2f}, EMA50 = {ema50:.2f}"})

    bb_lower = row.get("bb_lower", 0.0)
    details.append({"name": CONFIRMATION_LABELS[3], "met": bool(row["Close"] > bb_lower), "value": f"Close = {row['Close']:.2f}, BB Lower = {bb_lower:.2f}"})

    adx_val = row.get("adx", 0.0)
    details.append({"name": CONFIRMATION_LABELS[4], "met": bool(adx_val > 20), "value": f"ADX = {adx_val:.1f}"})

    obv_diff = row.get("obv_diff", 0.0)
    details.append({"name": CONFIRMATION_LABELS[5], "met": bool(obv_diff > 0), "value": f"OBV diff = {obv_diff:,.0f}"})

    atr_val = row.get("atr", 0.0)
    details.append({"name": CONFIRMATION_LABELS[6], "met": bool(atr_val > 0), "value": f"ATR = {atr_val:.4f}"})

    vol_ratio = row.get("vol_ratio", 1.0)
    details.append({"name": CONFIRMATION_LABELS[7], "met": bool(vol_ratio > 0.8), "value": f"Vol ratio = {vol_ratio:.2f}x"})

    return details


def _add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    close = df["Close"]
    volume = df["Volume"]

    # RSI
    df["rsi"] = ta.momentum.RSIIndicator(close, window=14).rsi()

    # MACD
    macd_ind = ta.trend.MACD(close)
    df["macd"] = macd_ind.macd()
    df["macd_signal"] = macd_ind.macd_signal()

    # EMA
    df["ema_20"] = ta.trend.EMAIndicator(close, window=20).ema_indicator()
    df["ema_50"] = ta.trend.EMAIndicator(close, window=50).ema_indicator()

    # Bollinger
    bb = ta.volatility.BollingerBands(close, window=20)
    df["bb_upper"] = bb.bollinger_hband()
    df["bb_lower"] = bb.bollinger_lband()

    # ADX
    adx = ta.trend.ADXIndicator(df["High"], df["Low"], close, window=14)
    df["adx"] = adx.adx()

    # OBV diff
    obv = ta.volume.OnBalanceVolumeIndicator(close, volume).on_balance_volume()
    df["obv_diff"] = obv.diff()

    # ATR
    df["atr"] = ta.volatility.AverageTrueRange(df["High"], df["Low"], close, window=14).average_true_range()

    # Volume ratio
    df["vol_ratio"] = volume / volume.rolling(20).mean()

    # Returns for HMM
    df["returns"] = close.pct_change()
    df["log_returns"] = np.log1p(df["returns"].clip(-0.5, 0.5))

    df.dropna(inplace=True)
    return df


class ConservativeStrategy(BaseStrategy):
    leverage = 2.5
    min_confirmations = 7
    trailing_stop_pct = None

    def generate_signals(self, df: pd.DataFrame) -> SignalResult:
        df = _add_indicators(df)

        if len(df) < 60:
            return SignalResult(
                regime="unknown",
                signal="hold",
                confirmation_count=0,
                entry_eligible=False,
                cooldown_active=False,
                reason_summary="Insufficient data for HMM fitting",
            )

        features = df[["log_returns", "atr", "vol_ratio"]].values
        try:
            model, scaler = _safe_fit_hmm(features)
        except Exception as exc:
            logger.warning("HMM fit failed: %s", exc)
            return SignalResult(
                regime="unknown",
                signal="hold",
                confirmation_count=0,
                entry_eligible=False,
                cooldown_active=False,
                reason_summary=f"HMM fitting error: {exc}",
            )

        scaled_features = scaler.transform(features)
        states = model.predict(scaled_features)
        bull_state, bear_state = _identify_bull_bear(model, scaled_features)

        # Current bar
        current_state = int(states[-1])
        regime = "bull" if current_state == bull_state else "bear"

        conf_count, conf_list = _compute_confirmations(df, -1)
        conf_details = compute_confirmation_details(df, -1)
        entry_eligible = regime == "bull" and conf_count >= self.min_confirmations

        signal: str
        if entry_eligible:
            signal = "buy"
        elif regime == "bear":
            signal = "sell"
        else:
            signal = "hold"

        # Build per-bar signal list for saving TradeDecision records
        bar_timestamps = []
        signals_per_bar = []
        for i, (state, ts) in enumerate(zip(states, df.index)):
            r = "bull" if state == bull_state else "bear"
            cc, _ = _compute_confirmations(df, i)
            s = "buy" if (r == "bull" and cc >= self.min_confirmations) else ("sell" if r == "bear" else "hold")
            bar_timestamps.append(ts)
            signals_per_bar.append({"regime": r, "signal": s, "confirmation_count": cc})

        return SignalResult(
            regime=regime,
            signal=signal,
            confirmation_count=conf_count,
            entry_eligible=entry_eligible,
            cooldown_active=False,
            reason_summary=f"HMM regime={regime}, confirmations={conf_count}/{len(conf_list)}",
            confirmation_details=conf_details,
            bull_state_id=bull_state,
            bear_state_id=bear_state,
            current_state_id=current_state,
            bar_timestamps=bar_timestamps,
            signals_per_bar=signals_per_bar,
        )
