"use client";

import React from "react";

interface TopNavProps {
  title: string;
  actions?: React.ReactNode;
}

export function TopNav({ title, actions }: TopNavProps) {
  return (
    <div className="flex flex-1 items-center justify-between min-w-0">
      {/* Page title — small, muted, left-aligned */}
      <span className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider truncate">
        {title}
      </span>

      {/* Compact action buttons */}
      {actions && (
        <div className="flex items-center gap-1 shrink-0">{actions}</div>
      )}
    </div>
  );
}
