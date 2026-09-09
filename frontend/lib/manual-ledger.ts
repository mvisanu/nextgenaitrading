import { z } from "zod";
export interface Holding {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  tag: string;
  tagColor: "primary" | "crypto" | "energy" | "consumer";
  quantity: number;
  avgCost: number;
  lastPrice: number;
  dayPnlPct: number; // manually entered day % change
}

export interface ActivityEntry {
  id: string;
  type: "BUY" | "SELL" | "DIVIDEND";
  symbol: string;
  description: string;
  amount: number;
  timestamp: string;
}




// ─── localStorage hook ────────────────────────────────────────────────────

export const holdingSchema = z.array(z.object({ id: z.string(), symbol: z.string().min(1), name: z.string(), sector: z.string(), tag: z.string(), tagColor: z.enum(["primary", "crypto", "energy", "consumer"]), quantity: z.number().finite().positive(), avgCost: z.number().finite().nonnegative(), lastPrice: z.number().finite().nonnegative(), dayPnlPct: z.number().finite() }));
export const activitySchema = z.array(z.object({ id: z.string(), type: z.enum(["BUY", "SELL", "DIVIDEND"]), symbol: z.string(), description: z.string(), amount: z.number().finite(), timestamp: z.string() }));
