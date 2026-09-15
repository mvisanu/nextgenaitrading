import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderTicket } from "@/components/trading/OrderTicket";
import { DEFAULT_SELECTION } from "@/lib/trading-selection";

const props = () => ({ selection: { ...DEFAULT_SELECTION, symbol: "NVDA" }, onSelection: jest.fn(), tradingMode: "paper" as const, onMode: jest.fn(), credentials: [], credentialId: null, onCredential: jest.fn(), loadingCredentials: false, cash: 100_000, busy: false, blocked: false, onSubmit: jest.fn(), children: null });

test("the order review and submission use the stock carried from Research", async () => {
  const p = props(); render(<OrderTicket {...p} />);
  await userEvent.type(screen.getByLabelText("Order amount in dollars"), "250");
  expect(screen.getByLabelText("Order review")).toHaveTextContent("Buy NVDA");
  await userEvent.click(screen.getByRole("button", { name: "Place paper order" }));
  expect(p.onSubmit).toHaveBeenCalledWith({ side: "buy", amount: 250 });
});
test("editing the symbol cannot accidentally submit against the previous stock", async () => {
  const p = props(); render(<OrderTicket {...p} />);
  await userEvent.clear(screen.getByLabelText("Stock symbol"));
  await userEvent.type(screen.getByLabelText("Stock symbol"), "MSFT");
  fireEvent.blur(screen.getByLabelText("Stock symbol"));
  expect(p.onSelection).toHaveBeenCalledWith({ symbol: "MSFT" });
  expect(screen.getByRole("button", { name: "Place paper order" })).toBeDisabled();
  expect(p.onSubmit).not.toHaveBeenCalled();
});
test("pending orders block submission and preview mode cannot bypass missing credentials", () => {
  const p = props(); const { rerender } = render(<OrderTicket {...p} blocked />);
  expect(screen.getByRole("button", { name: "Place paper order" })).toBeDisabled();
  rerender(<OrderTicket {...p} tradingMode="dry-run" />);
  expect(screen.getByRole("button", { name: "Preview order" })).toBeDisabled();
  expect(screen.getByText(/without sending it to the broker/)).toBeVisible();
});
