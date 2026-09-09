import { PRIMARY_NAV, isNavActive } from "@/lib/navigation";
import routes from "@/lib/legacy-routes.json";

test("desktop and mobile share five workspaces", () => {
  expect(PRIMARY_NAV.map((item) => item.href)).toEqual(["/dashboard", "/research", "/strategies", "/trade", "/portfolio"]);
});
test("detail pages retain their parent navigation context", () => {
  expect(isNavActive("/stock/AAPL", "/research")).toBe(true);
  expect(isNavActive("/backtests/12", "/strategies")).toBe(true);
  expect(isNavActive("/artifacts/12", "/strategies")).toBe(true);
  expect(isNavActive("/trade-log", "/trade")).toBe(false);
});
test("legacy links lead to retained tools without redirect loops", () => {
  expect(routes["/live-trading"]).toBe("/trade?view=order");
  expect(routes["/btc-bot"]).toBe("/trade?view=btc");
  for (const target of Object.values(routes)) expect(Object.keys(routes)).not.toContain(target.split("?")[0]);
});
