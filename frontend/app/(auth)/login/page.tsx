"use client";

/**
 * /login — one primary path (email + password) and one secondary path
 * (magic link, swapped in place). PIN and access-code sign-in were
 * removed; their backend endpoints still exist but have no UI.
 */

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle } from "lucide-react";

import { AuthCard, AuthFooterLink } from "@/components/auth/AuthCard";
import { AuthError } from "@/components/auth/AuthError";
import {
  AuthField,
  PasswordField,
  SubmitButton,
  TextLinkButton,
} from "@/components/auth/AuthField";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { mapAuthError } from "@/lib/auth-errors";
import { hardNavigate, safeInternalPath } from "@/lib/navigate";

/** Dev login is a debug affordance — never render it in production. */
const SHOW_DEV_LOGIN = process.env.NEXT_PUBLIC_ENV === "development";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const passwordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type PasswordValues = z.infer<typeof passwordSchema>;

const magicSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});
type MagicValues = z.infer<typeof magicSchema>;

/** Post-login destination from ?callbackUrl, guarded against open redirects. */
function redirectTarget(): string {
  if (typeof window === "undefined") return "/dashboard";
  return safeInternalPath(
    new URLSearchParams(window.location.search).get("callbackUrl")
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<"password" | "magic" | "magic-sent">(
    "password"
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState("");

  function switchMode(next: "password" | "magic") {
    setMode(next);
    setFormError(null);
  }

  if (mode === "magic-sent") {
    return (
      <AuthCard title="Check your email">
        <div className="flex flex-col items-center space-y-3 py-2">
          <div className="h-12 w-12 rounded-sm bg-primary/10 flex items-center justify-center">
            <CheckCircle className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            We sent a sign-in link to{" "}
            <strong className="text-foreground">{sentTo}</strong>. It expires in
            one hour.
          </p>
        </div>
        <div className="text-center">
          <TextLinkButton onClick={() => switchMode("password")}>
            Back to password sign-in
          </TextLinkButton>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Sign in"
      footer={
        <AuthFooterLink
          prompt="Don't have an account?"
          href="/register"
          label="Create one"
        />
      }
    >
      {mode === "password" ? (
        <PasswordForm
          error={formError}
          setError={setFormError}
          onUseMagicLink={() => switchMode("magic")}
        />
      ) : (
        <MagicLinkForm
          error={formError}
          setError={setFormError}
          onSent={(email) => {
            setSentTo(email);
            setMode("magic-sent");
          }}
          onBack={() => switchMode("password")}
        />
      )}

      {SHOW_DEV_LOGIN && <DevLoginButton onError={setFormError} />}
    </AuthCard>
  );
}

// ── Password sign-in (primary) ───────────────────────────────────────────────

function PasswordForm({
  error,
  setError,
  onUseMagicLink,
}: {
  error: string | null;
  setError: (m: string | null) => void;
  onUseMagicLink: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  async function onSubmit(values: PasswordValues) {
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase not configured");

      const { error: sbErr } = await supabase.auth.signInWithPassword({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      if (sbErr) throw sbErr;

      hardNavigate(redirectTarget());
    } catch (err) {
      setError(mapAuthError(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <AuthField
        id="email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        disabled={isSubmitting}
        error={errors.email?.message}
        {...register("email")}
      />

      <PasswordField
        id="password"
        placeholder="Your password"
        autoComplete="current-password"
        disabled={isSubmitting}
        error={errors.password?.message}
        {...register("password")}
      />

      <AuthError message={error} />

      <SubmitButton pending={isSubmitting}>Sign in</SubmitButton>

      <div className="flex flex-col items-center gap-2 pt-1">
        <TextLinkButton onClick={onUseMagicLink} disabled={isSubmitting}>
          Email me a sign-in link instead
        </TextLinkButton>
        <Link
          href="/forgot-password"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Forgot password?
        </Link>
      </div>
    </form>
  );
}

// ── Magic link (secondary, swapped in place) ─────────────────────────────────

function MagicLinkForm({
  error,
  setError,
  onSent,
  onBack,
}: {
  error: string | null;
  setError: (m: string | null) => void;
  onSent: (email: string) => void;
  onBack: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MagicValues>({ resolver: zodResolver(magicSchema) });

  async function onSubmit(values: MagicValues) {
    setError(null);
    const email = values.email.trim().toLowerCase();
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase not configured");

      const { error: sbErr } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (sbErr) throw sbErr;

      onSent(email);
    } catch (err) {
      setError(mapAuthError(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <AuthField
        id="email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        disabled={isSubmitting}
        error={errors.email?.message}
        {...register("email")}
      />

      <AuthError message={error} />

      <SubmitButton pending={isSubmitting}>Send link</SubmitButton>

      <div className="text-center pt-1">
        <TextLinkButton onClick={onBack} disabled={isSubmitting}>
          Back to password sign-in
        </TextLinkButton>
      </div>
    </form>
  );
}

// ── Dev-only bypass ──────────────────────────────────────────────────────────

function DevLoginButton({ onError }: { onError: (m: string | null) => void }) {
  const [pending, setPending] = useState(false);

  async function handleDevLogin() {
    setPending(true);
    onError(null);
    try {
      const res = await fetch(`${API_BASE}/test/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "dev@nextgenstock.io" }),
      });
      if (!res.ok) throw new Error(`Dev login failed: ${res.status}`);
      const { access_token } = await res.json();
      document.cookie = `dev_token=${encodeURIComponent(access_token)}; path=/; max-age=3600; SameSite=Lax`;
      hardNavigate("/dashboard");
    } catch (err) {
      onError(mapAuthError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDevLogin}
      disabled={pending}
      className="w-full py-2.5 border border-dashed border-yellow-500/30 text-yellow-500 text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-yellow-500/5 transition-colors disabled:opacity-50"
    >
      Dev Login
    </button>
  );
}
