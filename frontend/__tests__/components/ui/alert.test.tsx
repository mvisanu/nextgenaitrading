/**
 * Tests for components/ui/alert.tsx
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

describe("Alert component", () => {
  it("renders with role='alert'", () => {
    render(<Alert>Content</Alert>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders children", () => {
    render(<Alert>Test message</Alert>);
    expect(screen.getByText("Test message")).toBeInTheDocument();
  });

  it("applies default variant classes", () => {
    const { container } = render(<Alert>Default</Alert>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("bg-background");
  });

  it("applies destructive variant classes", () => {
    const { container } = render(<Alert variant="destructive">Error</Alert>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("border-destructive");
  });

  it("applies warning variant classes", () => {
    const { container } = render(<Alert variant="warning">Warning</Alert>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("border-amber-500/50");
  });

  it("renders AlertTitle as h5", () => {
    render(<AlertTitle>Title</AlertTitle>);
    expect(screen.getByText("Title").tagName).toBe("H5");
  });

  it("renders AlertDescription", () => {
    render(<AlertDescription>Details here</AlertDescription>);
    expect(screen.getByText("Details here")).toBeInTheDocument();
  });

  it("composes Alert, AlertTitle, AlertDescription correctly", () => {
    render(
      <Alert variant="warning">
        <AlertTitle>Warning Title</AlertTitle>
        <AlertDescription>Warning body text</AlertDescription>
      </Alert>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Warning Title")).toBeInTheDocument();
    expect(screen.getByText("Warning body text")).toBeInTheDocument();
  });
});
