import { z } from "zod";

export interface PaperPosition {
  symbol: string;
  side: "long" | "short";
  quantity: number;
  avgEntry: number;
  openedAt: string;
}

export interface PaperTrade {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  notionalUsd: number;
  timestamp: string;
  /** "open" = opened a position, "close" = closed a position */
  action: "open" | "close";
  realizedPnl: number | null;
}

export interface PaperPortfolio {
  cashBalance: number;
  startingBalance: number;
  positions: PaperPosition[];
  trades: PaperTrade[];
  createdAt: string;
}

const positive = z.number().finite().positive();
export const paperPortfolioSchema = z.object({
  cashBalance: z.number().finite(), startingBalance: positive, createdAt: z.string(),
  positions: z.array(z.object({ symbol: z.string().min(1), side: z.enum(["long", "short"]), quantity: positive, avgEntry: positive, openedAt: z.string() })),
  trades: z.array(z.object({ id: z.string(), symbol: z.string().min(1), side: z.enum(["buy", "sell"]), quantity: positive, price: positive, notionalUsd: positive, timestamp: z.string(), action: z.enum(["open", "close"]), realizedPnl: z.number().finite().nullable() })),
});

export function createPaperPortfolio(startingBalance = 100_000, now = new Date().toISOString()): PaperPortfolio {
  positive.parse(startingBalance);
  return { cashBalance: startingBalance, startingBalance, positions: [], trades: [], createdAt: now };
}

export interface PaperOrder { symbol: string; side: "buy" | "sell"; notionalUsd: number; currentPrice: number }

/** Fully collateralized simulation. Opposite-side orders close up to the held quantity; they never flip a position. */
export function applyPaperOrder(portfolio: PaperPortfolio, order: PaperOrder, id: string, timestamp: string) {
  paperPortfolioSchema.parse(portfolio);
  const { symbol, side, notionalUsd, currentPrice } = z.object({
    symbol: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9./-]{0,14}$/),
    side: z.enum(["buy", "sell"]), notionalUsd: positive, currentPrice: positive,
  }).parse(order);
  const next = { ...portfolio, positions: portfolio.positions.map(p => ({ ...p })), trades: [...portfolio.trades] };
  const position = next.positions.find(p => p.symbol === symbol);
  const closing = !!position && (side === "buy" ? position.side === "short" : position.side === "long");
  const quantity = closing ? Math.min(position.quantity, notionalUsd / currentPrice) : notionalUsd / currentPrice;
  positive.parse(quantity);
  const actualNotional = quantity * currentPrice;
  let realizedPnl: number | null = null;
  if (closing && position) {
    realizedPnl = quantity * (currentPrice - position.avgEntry) * (position.side === "long" ? 1 : -1);
    // Covering a short releases its entry collateral plus realized P&L.
    next.cashBalance += position.side === "long" ? actualNotional : quantity * position.avgEntry + realizedPnl;
    position.quantity -= quantity;
    next.positions = next.positions.filter(p => p.quantity > 0);
  } else {
    if (next.cashBalance < actualNotional) throw new Error("Insufficient paper balance");
    next.cashBalance -= actualNotional;
    if (position) {
      position.avgEntry = (position.avgEntry * position.quantity + actualNotional) / (position.quantity + quantity);
      position.quantity += quantity;
    } else next.positions.push({ symbol, side: side === "buy" ? "long" : "short", quantity, avgEntry: currentPrice, openedAt: timestamp });
  }
  const trade: PaperTrade = { id, symbol, side, quantity, price: currentPrice, notionalUsd: actualNotional, timestamp, action: closing ? "close" : "open", realizedPnl };
  next.trades.push(trade);
  paperPortfolioSchema.parse(next);
  return { portfolio: next, trade };
}
