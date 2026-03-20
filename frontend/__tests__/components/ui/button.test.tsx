/**
 * Tests for components/ui/button.tsx
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button component", () => {
  it("renders with text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("renders as button element by default", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("calls onClick handler when clicked", async () => {
    const handler = jest.fn();
    render(<Button onClick={handler}>Press</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("is disabled when disabled prop is set", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("does not call onClick when disabled", async () => {
    const handler = jest.fn();
    render(<Button disabled onClick={handler}>Disabled</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("applies destructive variant class", () => {
    const { container } = render(<Button variant="destructive">Delete</Button>);
    const btn = container.firstChild as HTMLElement;
    expect(btn.className).toContain("bg-destructive");
  });

  it("applies outline variant class", () => {
    const { container } = render(<Button variant="outline">Outline</Button>);
    const btn = container.firstChild as HTMLElement;
    expect(btn.className).toContain("border");
  });

  it("applies sm size class", () => {
    const { container } = render(<Button size="sm">Small</Button>);
    const btn = container.firstChild as HTMLElement;
    expect(btn.className).toContain("h-9");
  });

  it("renders a child element when asChild is true", () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    const link = screen.getByRole("link", { name: "Link Button" });
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe("A");
  });
});
