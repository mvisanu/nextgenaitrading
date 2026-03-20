/**
 * Tests for components/ui/card.tsx
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";

describe("Card components", () => {
  it("Card renders children", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("Card renders as a div", () => {
    const { container } = render(<Card>Test</Card>);
    expect(container.firstChild?.nodeName).toBe("DIV");
  });

  it("CardHeader renders children", () => {
    render(<CardHeader>Header</CardHeader>);
    expect(screen.getByText("Header")).toBeInTheDocument();
  });

  it("CardTitle renders as h3", () => {
    render(<CardTitle>Title</CardTitle>);
    const el = screen.getByText("Title");
    expect(el.tagName).toBe("H3");
  });

  it("CardDescription renders as p", () => {
    render(<CardDescription>Description</CardDescription>);
    const el = screen.getByText("Description");
    expect(el.tagName).toBe("P");
  });

  it("CardContent renders children", () => {
    render(<CardContent>Content</CardContent>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("CardFooter renders children", () => {
    render(<CardFooter>Footer</CardFooter>);
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("Full card composition renders all sections", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>My Title</CardTitle>
          <CardDescription>My description</CardDescription>
        </CardHeader>
        <CardContent>Body content</CardContent>
        <CardFooter>Footer area</CardFooter>
      </Card>
    );
    expect(screen.getByText("My Title")).toBeInTheDocument();
    expect(screen.getByText("My description")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
    expect(screen.getByText("Footer area")).toBeInTheDocument();
  });
});
