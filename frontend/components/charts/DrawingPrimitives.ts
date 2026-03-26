/**
 * Custom Lightweight Charts v5 drawing primitives.
 *
 * TrendLinePrimitive  — user-drawn line between two price/time points
 * FVGBoxPrimitive     — shaded rectangle for Fair Value Gap zones
 *
 * Both implement ISeriesPrimitive and attach via series.attachPrimitive().
 */
import type {
  ISeriesApi,
  SeriesType,
  IChartApi,
  Time,
  Logical,
  AutoscaleInfo,
} from "lightweight-charts";

// ─── Shared types ────────────────────────────────────────────────────────────

export interface DrawingPoint {
  time: string | number; // "YYYY-MM-DD" for daily+, Unix seconds for intraday
  price: number;
}

export interface TrendLineData {
  id: string;
  type: "trendline";
  p1: DrawingPoint;
  p2: DrawingPoint;
  color: string;
  lineWidth: number;
}

export interface FVGData {
  id: string;
  type: "fvg";
  startTime: string | number;
  endTime: string | number;
  highPrice: number;
  lowPrice: number;
  direction: "bullish" | "bearish";
}

export type DrawingData = TrendLineData | FVGData;

// ─── Stored references from attached() ───────────────────────────────────────

interface AttachedParams {
  chart: IChartApi;
  series: ISeriesApi<SeriesType>;
  requestUpdate: () => void;
}

// ─── TrendLinePrimitive ──────────────────────────────────────────────────────

export class TrendLinePrimitive {
  private _data: TrendLineData;
  private _params: AttachedParams | null = null;
  private _paneViews: TrendLinePaneView[];

  constructor(data: TrendLineData) {
    this._data = data;
    this._paneViews = [new TrendLinePaneView(this)];
  }

  get data() {
    return this._data;
  }

  get params() {
    return this._params;
  }

  updateData(data: TrendLineData) {
    this._data = data;
    this._params?.requestUpdate();
  }

  attached(param: { chart: IChartApi; series: ISeriesApi<SeriesType>; requestUpdate: () => void }) {
    this._params = param;
  }

  detached() {
    this._params = null;
  }

  updateAllViews() {
    // Views recalculate on each draw
  }

  paneViews() {
    return this._paneViews;
  }

  autoscaleInfo(_start: Logical, _end: Logical): AutoscaleInfo | null {
    return null;
  }
}

class TrendLinePaneView {
  private _source: TrendLinePrimitive;

  constructor(source: TrendLinePrimitive) {
    this._source = source;
  }

  zOrder(): "normal" {
    return "normal";
  }

  renderer() {
    return new TrendLineRenderer(this._source);
  }
}

class TrendLineRenderer {
  private _source: TrendLinePrimitive;

  constructor(source: TrendLinePrimitive) {
    this._source = source;
  }

  draw(target: { useBitmapCoordinateSpace: (cb: (scope: { context: CanvasRenderingContext2D; horizontalPixelRatio: number; verticalPixelRatio: number }) => void) => void }) {
    const params = this._source.params;
    if (!params) return;

    const { series, chart } = params;
    const data = this._source.data;
    const ts = chart.timeScale();

    // Convert time strings to coordinates
    const x1 = ts.timeToCoordinate(data.p1.time as Time);
    const x2 = ts.timeToCoordinate(data.p2.time as Time);
    const y1 = series.priceToCoordinate(data.p1.price);
    const y2 = series.priceToCoordinate(data.p2.price);

    if (x1 === null || x2 === null || y1 === null || y2 === null) return;

    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
      ctx.beginPath();
      ctx.strokeStyle = data.color;
      ctx.lineWidth = data.lineWidth * hpr;
      ctx.moveTo(x1 * hpr, y1 * vpr);
      ctx.lineTo(x2 * hpr, y2 * vpr);
      ctx.stroke();

      // Draw small circles at endpoints
      const radius = 3 * hpr;
      ctx.fillStyle = data.color;
      ctx.beginPath();
      ctx.arc(x1 * hpr, y1 * vpr, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x2 * hpr, y2 * vpr, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

// ─── FVGBoxPrimitive ─────────────────────────────────────────────────────────

export class FVGBoxPrimitive {
  private _data: FVGData;
  private _params: AttachedParams | null = null;
  private _paneViews: FVGBoxPaneView[];

  constructor(data: FVGData) {
    this._data = data;
    this._paneViews = [new FVGBoxPaneView(this)];
  }

  get data() {
    return this._data;
  }

  get params() {
    return this._params;
  }

  updateData(data: FVGData) {
    this._data = data;
    this._params?.requestUpdate();
  }

  attached(param: { chart: IChartApi; series: ISeriesApi<SeriesType>; requestUpdate: () => void }) {
    this._params = param;
  }

  detached() {
    this._params = null;
  }

  updateAllViews() {
    // Views recalculate on each draw
  }

  paneViews() {
    return this._paneViews;
  }

  autoscaleInfo(_start: Logical, _end: Logical): AutoscaleInfo | null {
    return null;
  }
}

class FVGBoxPaneView {
  private _source: FVGBoxPrimitive;

  constructor(source: FVGBoxPrimitive) {
    this._source = source;
  }

  zOrder(): "bottom" {
    return "bottom";
  }

  renderer() {
    return new FVGBoxRenderer(this._source);
  }
}

class FVGBoxRenderer {
  private _source: FVGBoxPrimitive;

  constructor(source: FVGBoxPrimitive) {
    this._source = source;
  }

  draw(target: { useBitmapCoordinateSpace: (cb: (scope: { context: CanvasRenderingContext2D; horizontalPixelRatio: number; verticalPixelRatio: number }) => void) => void }) {
    const params = this._source.params;
    if (!params) return;

    const { series, chart } = params;
    const data = this._source.data;
    const ts = chart.timeScale();

    const x1 = ts.timeToCoordinate(data.startTime as Time);
    const x2 = ts.timeToCoordinate(data.endTime as Time);
    const y1 = series.priceToCoordinate(data.highPrice);
    const y2 = series.priceToCoordinate(data.lowPrice);

    if (x1 === null || x2 === null || y1 === null || y2 === null) return;

    const isBullish = data.direction === "bullish";

    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
      const left = Math.min(x1, x2) * hpr;
      const right = Math.max(x1, x2) * hpr;
      const top = Math.min(y1, y2) * vpr;
      const bottom = Math.max(y1, y2) * vpr;
      const width = right - left;
      const height = bottom - top;

      // Filled rectangle — higher opacity for visibility
      ctx.fillStyle = isBullish ? "rgba(38, 166, 154, 0.35)" : "rgba(239, 83, 80, 0.35)";
      ctx.fillRect(left, top, width, height);

      // Solid border
      ctx.strokeStyle = isBullish ? "rgba(38, 166, 154, 0.85)" : "rgba(239, 83, 80, 0.85)";
      ctx.lineWidth = 2 * hpr;
      ctx.setLineDash([]);
      ctx.strokeRect(left, top, width, height);

      // Label
      ctx.fillStyle = isBullish ? "rgba(38, 166, 154, 1)" : "rgba(239, 83, 80, 1)";
      ctx.font = `bold ${11 * hpr}px monospace`;
      ctx.fillText("FVG", left + 4 * hpr, top + 14 * vpr);
    });
  }
}

// ─── Auto-detect FVGs from candle data ───────────────────────────────────────

export interface CandleInput {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function detectFVGs(candles: CandleInput[]): FVGData[] {
  const fvgs: FVGData[] = [];
  if (candles.length < 3) return fvgs;

  for (let i = 2; i < candles.length; i++) {
    const c0 = candles[i - 2]; // two bars ago
    const c1 = candles[i - 1]; // gap bar
    const c2 = candles[i];     // current bar

    // Bullish FVG: gap between candle[i-2] high and candle[i] low
    // The middle candle's body creates a gap that hasn't been filled
    if (c2.low > c0.high) {
      fvgs.push({
        id: `fvg-bull-${c1.time}`,
        type: "fvg",
        startTime: c0.time,
        endTime: c2.time,
        highPrice: c2.low,
        lowPrice: c0.high,
        direction: "bullish",
      });
    }

    // Bearish FVG: gap between candle[i-2] low and candle[i] high
    if (c2.high < c0.low) {
      fvgs.push({
        id: `fvg-bear-${c1.time}`,
        type: "fvg",
        startTime: c0.time,
        endTime: c2.time,
        highPrice: c0.low,
        lowPrice: c2.high,
        direction: "bearish",
      });
    }
  }

  return fvgs;
}
