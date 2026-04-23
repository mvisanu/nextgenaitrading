"use client";

/**
 * /pin-setup — shown after a magic link login.
 *
 * Checks if the user already has a PIN:
 *   - Yes → redirect to /dashboard (or callbackUrl)
 *   - No  → prompt to create one
 *
 * Also reachable intentionally to reset an existing PIN.
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Activity, CheckCircle, Lock, Loader2, ArrowRight } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { pinAuthApi } from "@/lib/pin-auth-api";

// ── PIN pad (same component pattern as login page) ─────────────────────────

function PinPad({
  value,
  onChange,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  autoFocus?: boolean;
}) {
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (autoFocus) refs[0].current?.focus();
  }, [autoFocus]);

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

type Step = "checking" | "set-pin" | "confirm-pin" | "already-set" | "done";

function PinSetupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [step, setStep] = useState<Step>("checking");
  const [pin, setPin] = useState("    ");
  const [confirm, setConfirm] = useState("    ");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user already has a PIN
  useEffect(() => {
    async function check() {
      try {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          // Supabase not configured — skip PIN check and proceed
          setStep("set-pin");
          return;
        }

        // getSession() reads from cookies. On the first render after a
        // server-side exchangeCodeForSession redirect the local cache may be
        // cold; getUser() validates server-side as a reliable fallback.
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token ?? null;

        if (!accessToken) {
          // No access token in the local cache — this is the expected state right
          // after a PKCE code exchange (tokens land in cookies, not localStorage).
          // Try refreshSession() to read the refresh_token from cookies and get a
          // fresh access_token. If that works, proceed to the has-pin check so
          // returning users skip the setup form.
          const { data: refreshData } = await supabase.auth.refreshSession();
          const freshToken = refreshData.session?.access_token ?? null;
          if (freshToken) {
            const { has_pin } = await pinAuthApi.hasPin(freshToken);
            setStep(has_pin ? "already-set" : "set-pin");
            return;
          }
          // Refresh also failed — show the form (middleware redirects unauthed users)
          setStep("set-pin");
          return;
        }

        const { has_pin } = await pinAuthApi.hasPin(accessToken);
        setStep(has_pin ? "already-set" : "set-pin");
      } catch {
        setStep("set-pin");
      }
    }
    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSetPin() {
    // cleanPin = step-1 entry (frozen in `pin` state); cleanConfirm = step-2 re-entry
    const cleanPin = pin.replace(/\s/g, "");
    const cleanConfirm = confirm.replace(/\s/g, "");

    if (cleanPin.length !== 4) { setError("Please enter all 4 digits."); return; }
    if (step === "confirm-pin" && cleanPin !== cleanConfirm) {
      setError("PINs don't match. Try again.");
      setConfirm("    ");
      return;
    }

    if (step === "set-pin") {
      setStep("confirm-pin");
      setConfirm("    ");
      setError(null);
      return;
    }

    // Confirmed — save
    setIsPending(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    try {
      if (!supabase) throw new Error("Supabase not configured.");

      // 1. Server-validate the session. getUser() makes a real network call to
      //    Supabase and silently refreshes the access_token if it is expired,
      //    writing the new token pair back to cookie storage. This is more
      //    reliable than refreshSession() alone when the in-memory cache is cold
      //    after a server-side exchangeCodeForSession redirect.
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        // Session is fully invalid — sign out (clears cookies) and re-login.
        try { await supabase.auth.signOut(); } catch {}
        router.replace("/login");
        return;
      }

      // 2. getUser() refreshed the token in cookie storage; now read it back.
      //    Fall back to an explicit refreshSession() if getSession() still shows
      //    the old stale value (in-memory cache may lag behind cookie storage).
      let { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const { data: rd } = await supabase.auth.refreshSession();
        session = rd.session;
      }

      if (!session?.access_token) {
        try { await supabase.auth.signOut(); } catch {}
        router.replace("/login");
        return;
      }

      await pinAuthApi.setPin(cleanPin, session.access_token);
      setStep("done");
      toast.success("PIN saved! You can use it on your next login.");
      setTimeout(() => router.replace(next), 1500);
    } catch (err) {
      const msg = (err as Error).message;
      // 401 from the backend means the token is stale despite our refresh attempt.
      // Sign out so middleware doesn't bounce the user back to /dashboard.
      if (msg.includes("401") || msg.toLowerCase().includes("not authenticated")) {
        setError("Your session expired. Redirecting to sign in…");
        toast.error("Session expired — please sign in again.");
        try { await supabase?.auth.signOut(); } catch {}
        setTimeout(() => router.replace("/login"), 1500);
        return;
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setIsPending(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (step === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
      </div>
    );
  }

  // ── Already has PIN ──────────────────────────────────────────────────────

  if (step === "already-set") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xl font-black tracking-tighter text-foreground">NextGen Trading</span>
            <span className="text-3xs text-primary tracking-widest uppercase">Work Hard, Play Hard</span>
          </div>

          <div className="bg-surface-low border border-border/10 rounded-sm p-6 space-y-5">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-sm bg-green-500/10 flex items-center justify-center">
                <Lock className="h-6 w-6 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-foreground">PIN already set</h2>
              <p className="text-sm text-muted-foreground text-center">
                You already have a 4-digit PIN configured for quick login.
              </p>
            </div>

            <button
              onClick={() => router.replace(next)}
              className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-widest rounded-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <ArrowRight className="h-4 w-4" />
              Go to Dashboard
            </button>

            <button
              onClick={() => { setStep("set-pin"); setPin("    "); setConfirm("    "); setError(null); }}
              className="w-full py-2.5 border border-border/30 text-muted-foreground text-xs font-bold uppercase tracking-widest rounded-sm hover:text-foreground hover:border-primary/40 transition-colors"
            >
              Reset my PIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────

  if (step === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xl font-black tracking-tighter text-foreground">NextGen Trading</span>
          </div>
          <div className="bg-surface-low border border-border/10 rounded-sm p-6">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-sm bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">PIN saved!</h2>
              <p className="text-sm text-muted-foreground text-center">
                Use your 4-digit PIN for quick login next time.
              </p>
              <Loader2 className="h-4 w-4 text-primary animate-spin mt-2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Set PIN / Confirm PIN ─────────────────────────────────────────────────

  const isConfirming = step === "confirm-pin";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-2">
          <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <span className="text-xl font-black tracking-tighter text-foreground">NextGen Trading</span>
          <span className="text-3xs text-primary tracking-widest uppercase">Work Hard, Play Hard</span>
        </div>

        <div className="bg-surface-low border border-border/10 rounded-sm p-6 space-y-6">
          <div className="text-center space-y-1">
            <div className="flex justify-center mb-3">
              <div className="h-12 w-12 rounded-sm bg-primary/10 flex items-center justify-center">
                <Lock className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-foreground">
              {isConfirming ? "Confirm your PIN" : "Set a 4-digit PIN"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isConfirming
                ? "Re-enter your PIN to confirm"
                : "You'll use this PIN for quick sign-in next time"}
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex justify-center gap-2">
            <div className="h-1.5 w-8 rounded-full bg-primary" />
            <div className={`h-1.5 w-8 rounded-full transition-colors ${isConfirming ? "bg-primary" : "bg-surface-highest"}`} />
          </div>

          <PinPad
            value={isConfirming ? confirm : pin}
            onChange={isConfirming ? setConfirm : setPin}
            disabled={isPending}
            autoFocus
          />

          {error && (
            <p
              role="alert"
              className="text-xs text-destructive bg-destructive/5 border border-destructive/20 p-2 rounded-sm text-center"
            >
              {error}
            </p>
          )}

          <button
            onClick={handleSetPin}
            disabled={isPending || (isConfirming ? confirm.trim().length !== 4 : pin.trim().length !== 4)}
            className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-widest rounded-sm hover:opacity-90 active:opacity-70 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            {isConfirming ? "Save PIN" : "Continue"}
          </button>

          {!isConfirming && (
            <button
              onClick={() => router.replace(next)}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest"
            >
              Skip for now
            </button>
          )}
        </div>

        <p className="text-center text-3xs text-muted-foreground/50 uppercase tracking-widest">
          Educational software only. Live trading carries real financial risk.
        </p>
      </div>
    </div>
  );
}

export default function PinSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        </div>
      }
    >
      <PinSetupPageContent />
    </Suspense>
  );
}
