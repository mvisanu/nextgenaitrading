/**
 * Tests for app/(auth)/login/page.tsx (rebuilt auth UI).
 *
 * Covers: the single primary path, the in-place magic-link swap, removal
 * of the PIN / access-code entry points, dev-login gating, validation,
 * and plain-language error mapping.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/(auth)/login/page";

jest.mock("next/link", () => {
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

const mockSignInWithPassword = jest.fn();
const mockSignInWithOtp = jest.fn();

jest.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      signInWithPassword: (...a: unknown[]) => mockSignInWithPassword(...a),
      signInWithOtp: (...a: unknown[]) => mockSignInWithOtp(...a),
    },
  }),
}));

// jsdom forbids real navigation, so the page routes through lib/navigate.
const hrefSpy: string[] = [];

jest.mock("@/lib/navigate", () => ({
  hardNavigate: (url: string) => hrefSpy.push(url),
  safeInternalPath: (raw: string | null, fallback = "/dashboard") =>
    !raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")
      ? fallback
      : raw,
}));

beforeEach(() => {
  hrefSpy.length = 0;
  jest.clearAllMocks();
  mockSignInWithPassword.mockResolvedValue({ error: null });
  mockSignInWithOtp.mockResolvedValue({ error: null });
});

describe("LoginPage — rendering", () => {
  it("renders the sign-in form", () => {
    render(<LoginPage />);
    expect(
      screen.getByRole("heading", { name: /^sign in$/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
  });

  it("renders no tagline or explanatory paragraph", () => {
    render(<LoginPage />);
    expect(
      screen.queryByText(/use another option below/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/sign in with your email and password/i)
    ).not.toBeInTheDocument();
  });

  it("offers the magic link as a single small text link", () => {
    render(<LoginPage />);
    expect(
      screen.getByRole("button", { name: /email me a sign-in link instead/i })
    ).toBeInTheDocument();
  });

  it("links to forgot-password and register", () => {
    render(<LoginPage />);
    expect(screen.getByRole("link", { name: /forgot password/i })).toHaveAttribute(
      "href",
      "/forgot-password"
    );
    expect(screen.getByRole("link", { name: /create one/i })).toHaveAttribute(
      "href",
      "/register"
    );
  });

  it("shows the educational disclaimer", () => {
    render(<LoginPage />);
    expect(screen.getByText(/Educational software only/i)).toBeInTheDocument();
  });
});

describe("LoginPage — removed auth paths", () => {
  it("renders no PIN entry point", () => {
    render(<LoginPage />);
    expect(screen.queryByText(/pin/i)).not.toBeInTheDocument();
  });

  it("renders no access-code entry point", () => {
    render(<LoginPage />);
    expect(screen.queryByText(/access code/i)).not.toBeInTheDocument();
  });

  it("renders no dev login button outside development", () => {
    // NEXT_PUBLIC_ENV is unset in the test env, matching a production build.
    render(<LoginPage />);
    expect(screen.queryByText(/dev login/i)).not.toBeInTheDocument();
  });
});

describe("LoginPage — validation", () => {
  it("rejects an invalid email", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "not-an-email" },
    });
    await userEvent.type(screen.getByLabelText(/^password$/i), "secret123");
    fireEvent.submit(
      screen.getByRole("button", { name: /^sign in$/i }).closest("form")!
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Please enter a valid email address/i)
      ).toBeInTheDocument();
    });
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it("requires a password", async () => {
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
    });
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });
});

describe("LoginPage — password sign-in", () => {
  it("calls Supabase with a normalised email and redirects on success", async () => {
    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText(/email/i), "  User@Example.com ");
    await userEvent.type(screen.getByLabelText(/^password$/i), "mypassword");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "mypassword",
      });
    });
    await waitFor(() => expect(hrefSpy).toContain("/dashboard"));
  });

  it("renders a plain-language message for bad credentials", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: new Error("Invalid login credentials"),
    });
    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/That email or password isn't right\./i)
      ).toBeInTheDocument();
    });
  });

  it("never renders a raw Supabase error string", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: new Error("AuthApiError: unexpected_failure"),
    });
    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "whatever1");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByText(/AuthApiError/)).not.toBeInTheDocument();
  });
});

describe("LoginPage — magic link swaps in place", () => {
  it("replaces the form without navigating away", async () => {
    render(<LoginPage />);
    await userEvent.click(
      screen.getByRole("button", { name: /email me a sign-in link instead/i })
    );

    expect(screen.getByRole("button", { name: /send link/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /back to password sign-in/i })
    ).toBeInTheDocument();
    expect(hrefSpy).toHaveLength(0);
  });

  it("returns to the password form", async () => {
    render(<LoginPage />);
    await userEvent.click(
      screen.getByRole("button", { name: /email me a sign-in link instead/i })
    );
    await userEvent.click(
      screen.getByRole("button", { name: /back to password sign-in/i })
    );

    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it("sends the link and shows the confirmation state", async () => {
    render(<LoginPage />);
    await userEvent.click(
      screen.getByRole("button", { name: /email me a sign-in link instead/i })
    );
    await userEvent.type(screen.getByLabelText(/email/i), "user@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send link/i }));

    await waitFor(() => {
      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        email: "user@example.com",
        options: {
          emailRedirectTo: "http://localhost:3000/auth/callback",
        },
      });
    });
    expect(
      await screen.findByRole("heading", { name: /check your email/i })
    ).toBeInTheDocument();
  });
});
