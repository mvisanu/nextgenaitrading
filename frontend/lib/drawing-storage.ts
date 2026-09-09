import { z } from "zod";
const time = z.union([z.string().min(1), z.number().finite()]);
const point = z.object({ time, price: z.number().finite() });
export const drawingSchema = z.array(z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("trendline"), p1: point, p2: point, color: z.string(), lineWidth: z.number().finite().positive() }),
  z.object({ id: z.string(), type: z.literal("fvg"), startTime: time, endTime: time, highPrice: z.number().finite(), lowPrice: z.number().finite(), direction: z.enum(["bullish", "bearish"]) }),
]));
export const emptyDrawings: z.infer<typeof drawingSchema> = [];
