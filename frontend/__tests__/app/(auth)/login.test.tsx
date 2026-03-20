/**
 * Tests for app/(auth)/login/page.tsx
 * Covers: renders form, email/password validation, onError toast, onSuccess redirect.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/(auth)/login/page";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock next/link
jest.mock("next/link", () => {
  const React = require("react");
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

// Mock TanStack Query
const mockMutate = jest.fn();
let mockIsPending = false;
let mockOnSuccess: (() => void) | null = null;
let mockOnError: ((err: Error) => void) | null = null;

jest.mock("@tanstack/react-query", () => ({
  useMutation: ({ onSuccess, onError }: any) => {
    mockOnSuccess = onSuccess;
    mockOnError = onError;
    return {
      mutate: mockMutate,
      isPending: mockIsPending,
    };
  },
}));

// Mock sonner toast
const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    error: (msg: string) => mockToastError(msg),
    success: jest.fn(),
  },
}));

// Mock authApi
jest.mock("@/lib/api", () => ({
  authApi: {
    login: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockIsPending = false;
  mockPush.mockClear();
  mockToastError.mockClear();
});

describe("LoginPage — rendering", () => {
  it("renders the sign-in form", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders the NextGenStock logo text", () => {
    render(<LoginPage />);
    expect(screen.getByText("NextGenStock")).toBeInTheDocument();
  });

  it("renders the create account link", () => {
    render(<LoginPage />);
    const link = screen.getByRole("link", { name: /create one/i });
    expect(link).toHaveAttribute("href", "/register");
  });

  it("shows educational disclaimer", () => {
    render(<LoginPage />);
    expect(
      screen.getByText(/Educational software only/i)
    ).toBeInTheDocument();
  });
});

describe("LoginPage — form validation", () => {
  it("shows email validation error for invalid email", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    // fireEvent.change sets value without HTML5 type validation interference
    fireEvent.change(emailInput, { target: { value: "not-an-email" } });

    await userEvent.type(screen.getByLabelText(/password/i), "pass");

    const form = screen.getByRole("button", { name: /sign in/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(/Please enter a valid email address/i)
      ).toBeInTheDocument();
    });
  });

  it("shows password required error when password is empty", async () => {
    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
    });
  });

  it("does not call login when form is invalid", async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockMutate).not.toHaveBeenCalled();
    });
  });
});

describe("LoginPage — mutation behaviour", () => {
  it("calls mutate with email and password on valid submit", async () => {
    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText(/email/i), "user@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "mypassword");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "mypassword",
      });
    });
  });

  it("redirects to /dashboard on successful login", () => {
    render(<LoginPage />);
    // Simulate onSuccess callback
    mockOnSuccess?.();
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("shows toast error on login failure", () => {
    render(<LoginPage />);
    mockOnError?.(new Error("Invalid credentials"));
    expect(mockToastError).toHaveBeenCalledWith("Invalid credentials");
  });

  it("shows fallback message when error.message is empty string (BUG-001 fix)", () => {
    // FIXED: getErrorMessage() returns the fallback when err.message is falsy,
    // so an empty-string message correctly shows the fallback text.
    render(<LoginPage />);
    const err = new Error("");
    err.message = "";
    mockOnError?.(err);
    expect(mockToastError).toHaveBeenCalledWith("Login failed. Please try again.");
  });
});
