"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Activity, Loader2, Mail, CheckCircle, Lock, ArrowLeft } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { pinAuthApi } from "@/lib/pin-auth-api";

const IS_DEV =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type Mode = "choose" | "pin" | "code" | "magic-sent";

// ── 4-digit PIN pad ──────────────────────────────────────────────────────────

function PinPad({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  function handleKey(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    const digit = e.key;
    if (digit === "Backspace") {
      const next = value.slice(0, index) + " " + value.slice(index + 1);
      onChange(next);
      if (index > 0) refs[index - 1].current?.focus();
      return;
    }
    if (!/^\d$/.test(digit)) return;
    const next = (value.slice(0, index) + digit + value.slice(index + 1)).slice(0, 4);
    onChange(next);
    if (index < 3) refs[index + 1].current?.focus();
  }

  return (
    <div className="flex justify-center gap-3">
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          ref={refs[i]}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={value[i]?.trim() ?? ""}
          onChange={() => {}}
          onKeyDown={(e) => handleKey(i, e)}
          onClick={() => refs[i].current?.select()}
          disabled={disabled}
          className="h-14 w-12 text-center text-2xl font-bold bg-surface-lowest border border-border/30 rounded-sm focus:ring-2 focus:ring-primary focus:outline-none text-foreground caret-transparent disabled:opacity-50 selection:bg-transparent"
        />
      ))}
    </div>
  );
}

// ── Brand header (shared) ────────────────────────────────────────────────────

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

// ── Main page ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("    ");
  const [code, setCode] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetError() {
    setError(null);
  }

  // ── Dev login ──────────────────────────────────────────────────────────────
  async function handleDevLogin() {
    const devEmail = email.trim() || "dev@nextgenstock.io";
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/test/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: devEmail }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Dev login failed: ${res.status}`);
      }
      const { access_token } = await res.json();
      document.cookie = `dev_token=${encodeURIComponent(access_token)}; path=/; max-age=3600; SameSite=Lax`;
      window.location.href = "/dashboard";
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsPending(false);
    }
  }

  // ── Magic link ────────────────────────────────────────────────────────────
  async function handleMagicLink() {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase not configured. Use Dev Login instead.");
      const { error: sbErr } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (sbErr) throw new Error(sbErr.message);
      setMode("magic-sent");
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setIsPending(false);
    }
  }

  // ── PIN login ─────────────────────────────────────────────────────────────
  async function handlePinLogin() {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    const cleanPin = pin.trim();
    if (cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
      setError("Please enter all 4 digits.");
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      const { token_hash } = await pinAuthApi.login(trimmed, cleanPin);
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase not configured.");
      const { error: sbErr } = await supabase.auth.verifyOtp({
        token_hash,
        type: "magiclink",
      });
      if (sbErr) throw new Error(sbErr.message);
      window.location.href = "/dashboard";
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
      setPin("    ");
    } finally {
      setIsPending(false);
    }
  }

  // ── Access-code (bypass) login ──────────────────────────────────────────────
  async function handleCodeLogin() {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    const cleanCode = code.trim();
    if (!cleanCode) {
      setError("Please enter your access code.");
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      const { token_hash } = await pinAuthApi.codeLogin(trimmed, cleanCode);
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase not configured.");
      const { error: sbErr } = await supabase.auth.verifyOtp({
        token_hash,
        type: "magiclink",
      });
      if (sbErr) throw new Error(sbErr.message);
      window.location.href = "/dashboard";
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
      setCode("");
    } finally {
      setIsPending(false);
    }
  }

  // ── "Magic sent" confirmation screen ──────────────────────────────────────
  if (mode === "magic-sent") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-8">
          <Brand />
          <div className="bg-surface-low border border-border/10 rounded-sm p-6 space-y-4">
            <div className="flex flex-col items-center space-y-3">
              <div className="h-12 w-12 rounded-sm bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Check your email</h2>
              <p className="text-sm text-muted-foreground text-center">
                We sent a magic link to{" "}
                <strong className="text-foreground">{email.trim()}</strong>
              </p>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Click the link in your email to sign in. It expires in 1 hour.
            </p>
            <button
              className="w-full py-2.5 border border-border/20 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-surface-high/50 transition-colors rounded-sm flex items-center justify-center gap-2"
              onClick={() => { setMode("choose"); resetError(); }}
            >
              <Mail className="h-4 w-4" />
              Try a different email
            </button>
          </div>
          <p className="text-center text-3xs text-muted-foreground/50 uppercase tracking-widest">
            Educational software only. Live trading carries real financial risk.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <Brand />

        <div className="bg-surface-low border border-border/10 rounded-sm p-6 space-y-5">

          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            {mode !== "choose" && (
              <button
                onClick={() => { setMode("choose"); resetError(); setPin("    "); setCode(""); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {mode === "pin"
                  ? "Enter your PIN"
                  : mode === "code"
                  ? "Enter access code"
                  : "Sign in"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {mode === "pin"
                  ? "Enter your 4-digit PIN to continue"
                  : mode === "code"
                  ? "Email + access code to bypass the magic link"
                  : "Choose how to sign in"}
              </p>
            </div>
          </div>

          {/* ── Email field (always visible) ────────────────────────── */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-3xs font-bold uppercase tracking-widest text-muted-foreground"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              disabled={isPending}
              value={email}
              onChange={(e) => { setEmail(e.target.value); resetError(); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (mode === "choose") handleMagicLink();
                }
              }}
              className="w-full bg-surface-lowest border-none text-sm p-2.5 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none text-foreground placeholder:text-muted-foreground/40"
            />
          </div>

          {/* ── PIN pad (PIN mode only) ──────────────────────────────── */}
          {mode === "pin" && (
            <div className="space-y-2">
              <label className="text-3xs font-bold uppercase tracking-widest text-muted-foreground block text-center">
                4-Digit PIN
              </label>
              <PinPad value={pin} onChange={setPin} disabled={isPending} />
            </div>
          )}

          {/* ── Access code (code mode only) ─────────────────────────── */}
          {mode === "code" && (
            <div className="space-y-1.5">
              <label
                htmlFor="access-code"
                className="text-3xs font-bold uppercase tracking-widest text-muted-foreground"
              >
                Access Code
              </label>
              <input
                id="access-code"
                type="password"
                placeholder="Enter access code"
                autoComplete="off"
                disabled={isPending}
                value={code}
                onChange={(e) => { setCode(e.target.value); resetError(); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleCodeLogin(); }}
                className="w-full bg-surface-lowest border-none text-sm p-2.5 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none text-foreground placeholder:text-muted-foreground/60"
              />
            </div>
          )}

          {/* ── Error ───────────────────────────────────────────────── */}
          {error && (
            <p
              role="alert"
              className="text-xs text-destructive bg-destructive/5 border border-destructive/20 p-2 rounded-sm"
            >
              {error}
            </p>
          )}

          {/* ── Action buttons ───────────────────────────────────────── */}
          {mode === "pin" ? (
            <button
              onClick={handlePinLogin}
              disabled={isPending || pin.trim().length !== 4 /* trim removes space-padding; counts only entered digits */}
              className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-widest rounded-sm hover:opacity-90 active:opacity-70 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Sign in with PIN
            </button>
          ) : mode === "code" ? (
            <button
              onClick={handleCodeLogin}
              disabled={isPending || !code.trim()}
              className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-widest rounded-sm hover:opacity-90 active:opacity-70 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Sign in with code
            </button>
          ) : (
            <div className="space-y-2">
              {/* Magic link */}
              <button
                onClick={handleMagicLink}
                disabled={isPending}
                className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-widest rounded-sm hover:opacity-90 active:opacity-70 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Send magic link
              </button>

              {/* PIN option */}
              <button
                onClick={() => { setMode("pin"); resetError(); setPin("    "); }}
                disabled={isPending}
                className="w-full py-2.5 border border-border/30 text-muted-foreground font-bold text-xs uppercase tracking-widest rounded-sm hover:border-primary/40 hover:text-foreground transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Lock className="h-4 w-4" />
                Enter my PIN
              </button>

              {/* Access-code (bypass) option */}
              <button
                onClick={() => { setMode("code"); resetError(); setCode(""); }}
                disabled={isPending}
                className="w-full py-2.5 border border-border/30 text-muted-foreground font-bold text-xs uppercase tracking-widest rounded-sm hover:border-primary/40 hover:text-foreground transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Lock className="h-4 w-4" />
                Use access code
              </button>

              {/* Dev login */}
              {IS_DEV && (
                <button
                  onClick={handleDevLogin}
                  disabled={isPending}
                  className="w-full py-2.5 border border-dashed border-yellow-500/30 text-yellow-500 text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-yellow-500/5 transition-colors disabled:opacity-50"
                >
                  Dev Login (skip magic link)
                </button>
              )}
            </div>
          )}

          <div className="text-center pt-1">
            <p className="text-xs text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-primary hover:underline font-semibold">
                Create one
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-3xs text-muted-foreground/50 uppercase tracking-widest">
          Educational software only. Live trading carries real financial risk.
        </p>
      </div>
    </div>
  );
}
