"use client";

/**
 * Live password-rule checklist, shared by /register and /reset-password
 * so both enforce and display exactly the same policy.
 */

import { Check, CircleDashed } from "lucide-react";

export const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "One letter", test: (v: string) => /[A-Za-z]/.test(v) },
  { label: "One number", test: (v: string) => /\d/.test(v) },
] as const;

/** True when every rule passes. Used by the zod schemas. */
export function meetsPasswordRules(value: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(value));
}

export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="space-y-1" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <li
            key={rule.label}
            className={`flex items-center gap-1.5 text-3xs ${
              met ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {met ? (
              <Check className="h-3 w-3" />
            ) : (
              <CircleDashed className="h-3 w-3" />
            )}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
