/**
 * Tests for components/ui/input.tsx
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/ui/input";

describe("Input component", () => {
  it("renders an input element", () => {
    render(<Input />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("passes type attribute", () => {
    render(<Input type="email" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("type", "email");
  });

  it("accepts user input", async () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "hello");
    expect(input).toHaveValue("hello");
  });

  it("shows placeholder", () => {
    render(<Input placeholder="Enter value" />);
    expect(screen.getByPlaceholderText("Enter value")).toBeInTheDocument();
  });

  it("is disabled when disabled prop is set", () => {
    render(<Input disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("applies custom className", () => {
    const { container } = render(<Input className="custom-class" />);
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("renders password type input (no textbox role)", () => {
    const { container } = render(<Input type="password" />);
    const input = container.querySelector("input");
    expect(input).toHaveAttribute("type", "password");
  });
});
