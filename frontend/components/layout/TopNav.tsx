"use client";

import React from "react";

interface TopNavProps {
  title: string;
  actions?: React.ReactNode;
}

export function TopNav({ title, actions }: TopNavProps) {
  return (
    <div className="flex flex-1 items-center justify-between">
      <h1 className="text-base font-semibold text-foreground">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
