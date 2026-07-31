/**
 * Shared chrome for every auth screen (/login, /register,
 * /forgot-password, /reset-password) so they are visually identical.
 *
 * Uses the app's existing surface/border tokens — no new design system.
 */

import Link from "next/link";
import { Activity } from "lucide-react";

function Brand() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
        <Activity className="h-6 w-6 text-primary" />
      </div>
      <span className="text-xl font-black tracking-tighter text-foreground">
        NextGen Trading
      </span>
      <span className="text-3xs text-primary tracking-widest uppercase">
        Work Hard, Play Hard
      </span>
    </div>
  );
}

export interface AuthCardProps {
  /** Card heading, e.g. "Sign in". No tagline is rendered by design. */
  title: string;
  children: React.ReactNode;
  /** Optional footer line beneath the fields, e.g. the cross-link. */
  footer?: React.ReactNode;
}

export function AuthCard({ title, children, footer }: AuthCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <Brand />

        <div className="bg-surface-low border border-border/10 rounded-sm p-6 space-y-5">
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          {children}
          {footer && <div className="text-center pt-1">{footer}</div>}
        </div>

        <p className="text-center text-3xs text-muted-foreground/50 uppercase tracking-widest">
          Educational software only. Live trading carries real financial risk.
        </p>
      </div>
    </div>
  );
}

/** Footer cross-link, e.g. "Don't have an account? Create one". */
export function AuthFooterLink({
  prompt,
  href,
  label,
}: {
  prompt: string;
  href: string;
  label: string;
}) {
  return (
    <p className="text-xs text-muted-foreground">
      {prompt}{" "}
      <Link href={href} className="text-primary hover:underline font-semibold">
        {label}
      </Link>
    </p>
  );
}
