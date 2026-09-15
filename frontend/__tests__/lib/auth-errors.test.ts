/**
 * Tests for lib/auth-errors.ts — Supabase message → plain language.
 */

import { mapAuthError } from "@/lib/auth-errors";

describe("mapAuthError", () => {
  it("translates invalid credentials", () => {
    expect(mapAuthError(new Error("Invalid login credentials"))).toBe(
      "That email or password isn't right."
    );
  });

  it("translates unconfirmed email", () => {
    expect(mapAuthError(new Error("Email not confirmed"))).toBe(
      "Please confirm your email first — check your inbox for the link."
    );
  });

  it("translates duplicate registration", () => {
    expect(mapAuthError(new Error("User already registered"))).toBe(
      "An account with that email already exists. Try signing in instead."
    );
  });

  it("translates rate limiting", () => {
    expect(
      mapAuthError(
        new Error("For security purposes, you can only request this after 51 seconds")
      )
    ).toBe("Too many attempts. Please wait a minute and try again.");
  });

  it("translates an expired recovery link", () => {
    expect(mapAuthError(new Error("Token has expired or is invalid"))).toBe(
      "That link has expired. Please request a new one."
    );
  });

  it("translates an unreachable Supabase host", () => {
    // This is what a paused/deleted Supabase project produces in the browser.
    expect(mapAuthError(new TypeError("Failed to fetch"))).toBe(
      "Can't reach the server. Check your connection and try again."
    );
  });

  it("accepts a bare string", () => {
    expect(mapAuthError("Invalid login credentials")).toBe(
      "That email or password isn't right."
    );
  });

  it("accepts a plain object carrying a message", () => {
    expect(mapAuthError({ message: "User not found" })).toBe(
      "We couldn't find an account with that email."
    );
  });

  it("falls back for an empty message", () => {
    expect(mapAuthError(new Error(""))).toBe(
      "Something went wrong. Please try again."
    );
  });

  it("falls back for null", () => {
    expect(mapAuthError(null)).toBe("Something went wrong. Please try again.");
  });

  it("never returns a raw unrecognised Supabase string", () => {
    const raw = "AuthApiError: unexpected_failure at /token";
    expect(mapAuthError(new Error(raw))).not.toContain("AuthApiError");
  });
});
