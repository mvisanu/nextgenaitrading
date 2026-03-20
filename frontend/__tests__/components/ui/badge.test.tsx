/**
 * Tests for components/ui/badge.tsx
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge component", () => {
  it("renders children text", () => {
    render(<Badge>Hello</Badge>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders as a div", () => {
    render(<Badge>Test</Badge>);
    expect(screen.getByText("Test").tagName).toBe("DIV");
  });

  it("applies default variant classes", () => {
    const { container } = render(<Badge>Default</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("bg-primary");
  });

  it("applies secondary variant classes", () => {
    const { container } = render(<Badge variant="secondary">Sec</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("bg-secondary");
  });

  it("applies destructive variant classes", () => {
    const { container } = render(<Badge variant="destructive">Dest</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("bg-destructive");
  });

  it("applies alpaca variant classes", () => {
    const { container } = render(<Badge variant="alpaca">Alpaca</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("bg-green-500/20");
  });

  it("applies robinhood variant classes", () => {
    const { container } = render(<Badge variant="robinhood">Robin</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("bg-amber-500/20");
  });

  it("applies custom className", () => {
    const { container } = render(<Badge className="text-xs">Custom</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("text-xs");
  });
});
