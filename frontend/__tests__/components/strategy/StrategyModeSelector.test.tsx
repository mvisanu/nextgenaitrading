/**
 * Tests for components/strategy/StrategyModeSelector.tsx
 * Covers: renders all 4 tabs, default tab, tab switching calls children with correct mode.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock @radix-ui/react-tabs BEFORE importing StrategyModeSelector
// tabs.tsx references TabsPrimitive.List.displayName — our mock must satisfy that
jest.mock("@radix-ui/react-tabs", () => {
  const React = require("react");

  const Root = ({ children, defaultValue, ...props }: any) => {
    const [value, setValue] = React.useState(defaultValue || "conservative");
    // Pass value down via data attribute and context
    return (
      <div data-tabs-root="true" data-value={value} {...props}>
        {React.Children.map(children, (child: any) =>
          child ? React.cloneElement(child, { _tabsValue: value, _setTabsValue: setValue }) : null
        )}
      </div>
    );
  };

  const List = React.forwardRef(({ children, _tabsValue, _setTabsValue, ...props }: any, ref: any) => (
    <div role="tablist" ref={ref} {...props}>
      {React.Children.map(children, (child: any) =>
        child ? React.cloneElement(child, { _tabsValue, _setTabsValue }) : null
      )}
    </div>
  ));
  List.displayName = "TabsList";

  const Trigger = React.forwardRef(({ children, value, _tabsValue, _setTabsValue, ...props }: any, ref: any) => (
    <button
      role="tab"
      ref={ref}
      aria-selected={_tabsValue === value}
      onClick={() => _setTabsValue?.(value)}
      {...props}
    >
      {children}
    </button>
  ));
  Trigger.displayName = "TabsTrigger";

  const Content = React.forwardRef(({ children, value, _tabsValue, ...props }: any, ref: any) =>
    _tabsValue === value ? (
      <div role="tabpanel" ref={ref} data-value={value} {...props}>
        {typeof children === "function" ? children(value) : children}
      </div>
    ) : null
  );
  Content.displayName = "TabsContent";

  return { Root, List, Trigger, Content };
});

import { StrategyModeSelector } from "@/components/strategy/StrategyModeSelector";

describe("StrategyModeSelector", () => {
  it("renders all 4 mode tabs", () => {
    render(
      <StrategyModeSelector>
        {(mode) => <span>Mode: {mode}</span>}
      </StrategyModeSelector>
    );
    expect(screen.getByRole("tab", { name: "Conservative" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Aggressive" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "AI Pick" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Buy Low / Sell High" })).toBeInTheDocument();
  });

  it("shows conservative content by default", () => {
    render(
      <StrategyModeSelector>
        {(mode) => <span>Active: {mode}</span>}
      </StrategyModeSelector>
    );
    expect(screen.getByText("Active: conservative")).toBeInTheDocument();
  });

  it("respects defaultMode prop", () => {
    render(
      <StrategyModeSelector defaultMode="aggressive">
        {(mode) => <span>Active: {mode}</span>}
      </StrategyModeSelector>
    );
    expect(screen.getByText("Active: aggressive")).toBeInTheDocument();
  });

  it("switches to aggressive tab on click", async () => {
    render(
      <StrategyModeSelector>
        {(mode) => <span>Mode: {mode}</span>}
      </StrategyModeSelector>
    );

    await userEvent.click(screen.getByRole("tab", { name: "Aggressive" }));
    expect(screen.getByText("Mode: aggressive")).toBeInTheDocument();
  });

  it("switches to ai-pick tab on click", async () => {
    render(
      <StrategyModeSelector>
        {(mode) => <span>Mode: {mode}</span>}
      </StrategyModeSelector>
    );

    await userEvent.click(screen.getByRole("tab", { name: "AI Pick" }));
    expect(screen.getByText("Mode: ai-pick")).toBeInTheDocument();
  });

  it("switches to buy-low-sell-high tab on click", async () => {
    render(
      <StrategyModeSelector>
        {(mode) => <span>Mode: {mode}</span>}
      </StrategyModeSelector>
    );

    await userEvent.click(screen.getByRole("tab", { name: "Buy Low / Sell High" }));
    expect(screen.getByText("Mode: buy-low-sell-high")).toBeInTheDocument();
  });

  it("conservative tab is aria-selected by default", () => {
    render(
      <StrategyModeSelector>
        {() => null}
      </StrategyModeSelector>
    );
    expect(screen.getByRole("tab", { name: "Conservative" })).toHaveAttribute("aria-selected", "true");
  });

  it("non-default tabs are aria-selected=false by default", () => {
    render(
      <StrategyModeSelector>
        {() => null}
      </StrategyModeSelector>
    );
    expect(screen.getByRole("tab", { name: "Aggressive" })).toHaveAttribute("aria-selected", "false");
  });
});
