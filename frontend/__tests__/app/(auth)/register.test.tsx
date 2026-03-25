/**
 * Tests for app/(auth)/register/page.tsx
 * Covers: renders form, Zod validation including password-confirm mismatch,
 *         min length validation, onSuccess redirect to /login, onError toast.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterPage from "@/app/(auth)/register/page";

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
let mockOnSuccess: ((data: unknown) => void) | null = null;
let mockOnError: ((err: Error) => void) | null = null;

jest.mock("@tanstack/react-query", () => ({
  useMutation: ({ onSuccess, onError }: any) => {
    mockOnSuccess = onSuccess;
    mockOnError = onError;
    return { mutate: mockMutate, isPending: false };
  },
}));

// Mock sonner toast
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    success: (msg: string) => mockToastSuccess(msg),
    error: (msg: string) => mockToastError(msg),
  },
}));

// Mock authApi
jest.mock("@/lib/api", () => ({
  authApi: {
    register: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPush.mockClear();
  mockToastSuccess.mockClear();
  mockToastError.mockClear();
});

describe("RegisterPage — rendering", () => {
  it("renders the create account form", () => {
    render(<RegisterPage />);
    expect(screen.getByRole("heading", { name: /Create account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create account/i })).toBeInTheDocument();
  });

  it("renders link back to sign in", () => {
    render(<RegisterPage />);
    const link = screen.getByRole("link", { name: /sign in/i });
    expect(link).toHaveAttribute("href", "/login");
  });
});

describe("RegisterPage — Zod schema validation", () => {
  it("shows email validation error for invalid email", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(<RegisterPage />);

    const emailInput = screen.getByLabelText(/^email$/i);
    fireEvent.change(emailInput, { target: { value: "bad-email" } });
    await userEvent.type(screen.getByLabelText(/^password$/i), "password123");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "password123");

    const form = screen.getByRole("button", { name: /Create account/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(/Please enter a valid email address/i)
      ).toBeInTheDocument();
    });
  });

  it("shows error when password is too short (< 8 characters)", async () => {
    render(<RegisterPage />);

    await userEvent.type(screen.getByLabelText(/^email$/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "short");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "short");
    await userEvent.click(screen.getByRole("button", { name: /Create account/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Password must be at least 8 characters/i)
      ).toBeInTheDocument();
    });
  });

  it("shows 'Passwords do not match' error when passwords differ", async () => {
    render(<RegisterPage />);

    await userEvent.type(screen.getByLabelText(/^email$/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "password123");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "different456");
    await userEvent.click(screen.getByRole("button", { name: /Create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
    });
  });

  it("does not call mutate when validation fails", async () => {
    render(<RegisterPage />);

    await userEvent.type(screen.getByLabelText(/^email$/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "password123");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "mismatch");
    await userEvent.click(screen.getByRole("button", { name: /Create account/i }));

    await waitFor(() => {
      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  it("calls mutate with only email and password (not confirm_password)", async () => {
    render(<RegisterPage />);

    await userEvent.type(screen.getByLabelText(/^email$/i), "user@test.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "securepass");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "securepass");
    await userEvent.click(screen.getByRole("button", { name: /Create account/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({
        email: "user@test.com",
        password: "securepass",
      });
    });
  });
});

describe("RegisterPage — mutation behaviour", () => {
  it("shows success toast and redirects to /dashboard on success", () => {
    render(<RegisterPage />);
    mockOnSuccess?.({});

    expect(mockToastSuccess).toHaveBeenCalledWith("Account created! Welcome to NextGenStock.");
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("shows error toast on registration failure", () => {
    render(<RegisterPage />);
    mockOnError?.(new Error("Email already registered"));

    expect(mockToastError).toHaveBeenCalledWith("Email already registered");
  });

  it("shows fallback message when error.message is empty string (BUG-001 fix)", () => {
    // FIXED: getErrorMessage() returns the fallback when err.message is falsy,
    // so an empty-string message correctly shows the fallback text.
    render(<RegisterPage />);
    const err = new Error("");
    err.message = "";
    mockOnError?.(err);
    expect(mockToastError).toHaveBeenCalledWith("Registration failed. Please try again.");
  });
});
