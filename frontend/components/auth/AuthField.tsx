"use client";

/**
 * Field primitives shared by the auth screens.
 *
 * Deliberately plain <input> elements styled with the same tokens the
 * previous auth pages used, so the rebuild is visually continuous with
 * the rest of the app.
 */

import { forwardRef, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const LABEL_CLASS =
  "text-3xs font-bold uppercase tracking-widest text-muted-foreground";
const INPUT_CLASS =
  "w-full bg-surface-lowest border-none text-sm p-2.5 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none text-foreground placeholder:text-muted-foreground/40";

export interface AuthFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  /** Field-level validation message rendered beneath the input. */
  error?: string;
}

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(
  function AuthField({ id, label, error, className, ...rest }, ref) {
    return (
      <div className="space-y-1.5">
        <label htmlFor={id} className={LABEL_CLASS}>
          {label}
        </label>
        <input
          id={id}
          ref={ref}
          aria-invalid={error ? true : undefined}
          className={className ?? INPUT_CLASS}
          {...rest}
        />
        {error && <p className="text-3xs text-destructive">{error}</p>}
      </div>
    );
  }
);

export interface PasswordFieldProps
  extends Omit<AuthFieldProps, "type" | "label"> {
  label?: string;
}

/** Password input with a show/hide toggle. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField({ id, label = "Password", error, ...rest }, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <div className="space-y-1.5">
        <label htmlFor={id} className={LABEL_CLASS}>
          {label}
        </label>
        <div className="relative">
          <input
            id={id}
            ref={ref}
            type={visible ? "text" : "password"}
            aria-invalid={error ? true : undefined}
            className={`${INPUT_CLASS} pr-10`}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {visible ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {error && <p className="text-3xs text-destructive">{error}</p>}
      </div>
    );
  }
);

export function SubmitButton({
  pending,
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-widest rounded-sm hover:opacity-90 active:opacity-70 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
      {...rest}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/** Small centred text button used for the secondary/inline links. */
export function TextLinkButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="text-xs text-primary hover:underline disabled:opacity-50"
      {...rest}
    >
      {children}
    </button>
  );
}
