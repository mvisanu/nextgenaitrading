import { ApiError, decodeResponse } from "@/lib/http";
test("FastAPI field errors remain readable and retain their HTTP status", async () => {
  const response = { ok: false, status: 422, json: async () => ({ detail: [{ loc: ["body", "notional_usd"], msg: "must be positive" }] }) } as Response;
  await expect(decodeResponse(response)).rejects.toMatchObject({ message: "notional_usd: must be positive", status: 422 });
});
test("non-JSON errors preserve their status", async () => {
  const response = { ok: false, status: 502, json: async () => { throw new Error("HTML"); } } as unknown as Response;
  await expect(decodeResponse(response)).rejects.toEqual(new ApiError("HTTP 502", 502));
});
