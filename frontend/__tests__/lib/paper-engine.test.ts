import { applyPaperOrder, createPaperPortfolio } from "@/lib/paper-engine";
const trade = (p: ReturnType<typeof createPaperPortfolio>, side: "buy" | "sell", amount: number, price: number) =>
  applyPaperOrder(p, { symbol: "AAPL", side, notionalUsd: amount, currentPrice: price }, "test", "2026-09-09");

test.each([["buy", "sell", 120, 1040], ["buy", "sell", 80, 960], ["sell", "buy", 80, 1040], ["sell", "buy", 120, 960]] as const)("%s then %s at %s accounts for gains and losses", (open, close, price, cash) => {
  const initial = createPaperPortfolio(1000);
  const opened = trade(initial, open, 200, 100);
  const closed = trade(opened.portfolio, close, 2 * price, price);
  expect(initial.cashBalance).toBe(1000);
  expect(initial.positions).toEqual([]);
  expect(closed.portfolio.positions).toEqual([]);
  expect(closed.portfolio.cashBalance).toBe(cash);
  expect(closed.trade.realizedPnl).toBe(cash - 1000);
});
test("a short can be covered with all cash reserved as collateral", () => {
  const opened = trade(createPaperPortfolio(1000), "sell", 1000, 100);
  const closed = trade(opened.portfolio, "buy", 900, 90);
  expect(closed.portfolio.cashBalance).toBe(1100);
});
test("partial short close releases only its collateral and profit", () => {
  const opened = trade(createPaperPortfolio(1000), "sell", 200, 100);
  const closed = trade(opened.portfolio, "buy", 80, 80);
  expect(closed.portfolio.cashBalance).toBe(920);
  expect(closed.portfolio.positions[0].quantity).toBe(1);
});
test("oversized closes return the actual fill and never flip", () => {
  const opened = trade(createPaperPortfolio(1000), "buy", 200, 100);
  const closed = trade(opened.portfolio, "sell", 500, 125);
  expect(closed.trade).toMatchObject({ quantity: 2, notionalUsd: 250 });
  expect(closed.portfolio.cashBalance).toBe(1050);
  expect(closed.portfolio.positions).toEqual([]);
});
test.each([0, -1, NaN, Infinity])("invalid price %s leaves portfolio untouched", price => {
  const p = createPaperPortfolio();
  expect(() => trade(p, "buy", 200, price)).toThrow();
  expect(p.cashBalance).toBe(100000);
});
test("insufficient funds and invalid reset are rejected", () => {
  expect(() => trade(createPaperPortfolio(100), "buy", 200, 100)).toThrow("Insufficient");
  expect(() => createPaperPortfolio(-1)).toThrow();
});
