"use client";

import React from "react";
import { Moon, Sun, Bell, Settings } from "lucide-react";

interface TopNavProps {
  title: string;
  actions?: React.ReactNode;
}

export function TopNav({ title, actions }: TopNavProps) {
  return (
    <div className="flex flex-1 items-center justify-between min-w-0">
      {/* Left: Brand + page title + nav tabs */}
      <div className="flex items-center gap-4 h-full min-w-0">
        <h1
          data-testid="page-title"
          className="text-sm font-bold tracking-tight text-primary truncate"
        >
          {title}
        </h1>
      </div>

      {/* Right: Indices + controls */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Real-time indices — desktop only */}
        <div className="hidden xl:flex items-center gap-4 text-2xs tabular-nums pr-3 border-r border-border/15">
          <div className="flex gap-1.5">
            <span className="text-muted-foreground uppercase">SPX</span>
            <span className="text-primary">5,432</span>
            <span className="text-primary text-3xs">+0.45%</span>
          </div>
          <div className="flex gap-1.5">
            <span className="text-muted-foreground uppercase">NDQ</span>
            <span className="text-primary">18,675</span>
            <span className="text-primary text-3xs">+1.12%</span>
          </div>
          <div className="flex gap-1.5">
            <span className="text-muted-foreground uppercase">BTC</span>
            <span className="text-foreground">65,432</span>
            <span className="text-destructive text-3xs">-0.08%</span>
          </div>
        </div>

        {/* Live/Paper toggle */}
        <div className="hidden sm:flex bg-surface-lowest p-0.5 rounded-sm border border-border/15">
          <button className="px-2.5 py-1 text-3xs font-bold uppercase tracking-widest bg-primary text-primary-foreground">
            Live
          </button>
          <button className="px-2.5 py-1 text-3xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
            Paper
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {actions}
          <button className="p-1.5 hover:bg-surface-high/50 transition-colors rounded-sm relative" title="Notifications">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full" />
          </button>
          <button className="p-1.5 hover:bg-surface-high/50 transition-colors rounded-sm" title="Settings">
            <Settings className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
