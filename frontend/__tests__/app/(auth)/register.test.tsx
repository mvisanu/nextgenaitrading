/**
 * Tests for app/(auth)/register/page.tsx (rebuilt auth UI).
 *
 * Covers: live password rules, confirm-password matching, the in-place
 * "check your email" success state, immediate sign-in when confirmation
 * is disabled, and duplicate-email handling.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterPage from "@/app/(auth)/register/page";

jest.mock("next/link", () => {
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

const mockSignUp = jest.fn();

jest.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { signUp: (...a: unknown[]) => mockSignUp(...a) },
  }),
}));

// jsdom forbids real navigation, so the page routes through lib/navigate.
const hrefSpy: string[] = [];

jest.mock("@/lib/navigate", () => ({
  hardNavigate: (url: string) => hrefSpy.push(url),
}));

beforeEach(() => {
  jest.clearAllMocks();
  hrefSpy.length = 0;
  // Default: confirmation enabled — user created, no session yet.
  mockSignUp.mockResolvedValue({
    data: { user: { identities: [{ id: "1" }] }, session: null },
    error: null,
  });
});

async function fillForm(
  email: string,
  password: string,
  confirm = password
) {
  await userEvent.type(screen.getByLabelText(/^email$/i), email);
  await userEvent.type(screen.getByLabelText(/^password$/i), password);
  await userEvent.type(screen.getByLabelText(/confirm password/i), confirm);
}

describe("RegisterPage — rendering", () => {
  it("renders the create-account form", () => {
    render(<RegisterPage />);
    expect(
      screen.getByRole("heading", { name: /create account/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create account/i })
    ).toBeInTheDocument();
  });

  it("links back to sign in", () => {
    render(<RegisterPage />);
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login"
    );
  });

  it("shows password rules as a live checklist", () => {
    render(<RegisterPage />);
    const list = screen.getByRole("list", { name: /password requirements/i });
    expect(list).toBeInTheDocument();
    expect(list).toHaveTextContent(/at least 8 characters/i);
    expect(list).toHaveTextContent(/one letter/i);
    expect(list).toHaveTextContent(/one number/i);
  });
});

describe("RegisterPage — validation", () => {
  it("rejects an invalid email", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "bad-email" },
    });
    await userEvent.type(screen.getByLabelText(/^password$/i), "password1");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "password1");
    fireEvent.submit(
      screen.getByRole("button", { name: /create account/i }).closest("form")!
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Please enter a valid email address/i)
      ).toBeInTheDocument();
    });
  });

  it("rejects a password that fails the rules", async () => {
    render(<RegisterPage />);
    await fillForm("a@b.com", "short");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Password doesn't meet the rules below/i)
      ).toBeInTheDocument();
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords", async () => {
    render(<RegisterPage />);
    await fillForm("a@b.com", "password1", "different2");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });
});

describe("RegisterPage — submission", () => {
  it("calls signUp with a normalised email and a callback redirect", async () => {
    render(<RegisterPage />);
    await fillForm(" User@Example.com ", "password1");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password1",
        options: { emailRedirectTo: "http://localhost:3000/auth/callback" },
      });
    });
  });

  it("shows the confirm-email state in place, without navigating", async () => {
    render(<RegisterPage />);
    await fillForm("user@example.com", "password1");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByRole("heading", { name: /check your email/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/user@example.com/)).toBeInTheDocument();
    expect(hrefSpy).toHaveLength(0);
  });

  it("goes straight to the dashboard when a session is returned", async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { identities: [{ id: "1" }] },
        session: { access_token: "t" },
      },
      error: null,
    });
    render(<RegisterPage />);
    await fillForm("user@example.com", "password1");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(hrefSpy).toContain("/dashboard"));
  });

  it("reports a duplicate email even though Supabase returns no error", async () => {
    // Supabase hides enumeration by returning a user with no identities.
    mockSignUp.mockResolvedValue({
      data: { user: { identities: [] }, session: null },
      error: null,
    });
    render(<RegisterPage />);
    await fillForm("taken@example.com", "password1");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/An account with that email already exists/i)
      ).toBeInTheDocument();
    });
  });

  it("maps an unreachable backend to plain language", async () => {
    mockSignUp.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<RegisterPage />);
    await fillForm("user@example.com", "password1");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Can't reach the server\./i)
      ).toBeInTheDocument();
    });
  });
});
