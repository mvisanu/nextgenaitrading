"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/utils";
import { Loader2, Mail, CheckCircle, Activity } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const IS_DEV = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const [isPending, setIsPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Dev login: bypass magic link by using /test/token endpoint
  async function handleDevLogin() {
    const email = getValues("email") || "dev@nextgenstock.io";
    setIsPending(true);
    setLoginError(null);
    try {
      const res = await fetch(`${API_BASE}/test/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Dev login failed: ${res.status}`);
      }
      const { access_token } = await res.json();
      // Store as cookie so middleware and api client can read it
      document.cookie = `dev_token=${encodeURIComponent(access_token)}; path=/; max-age=3600; SameSite=Lax`;
      // Full page reload to clear stale auth query cache
      window.location.href = "/dashboard";
    } catch (err) {
      setLoginError((err as Error).message);
    } finally {
      setIsPending(false);
    }
  }

  async function onSubmit(values: LoginFormValues) {
    setIsPending(true);
    setLoginError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase not configured. Use Dev Login instead.");
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setLoginError(error.message);
        toast.error(error.message);
      } else {
        setMagicLinkSent(true);
        setSentEmail(values.email);
        toast.success("Magic link sent! Check your email.");
      }
    } catch (err) {
      const msg = getErrorMessage(err as Error, "Failed to send magic link.");
      setLoginError(msg);
      toast.error(msg);
    } finally {
      setIsPending(false);
    }
  }

  if (magicLinkSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-8">
          {/* Brand */}
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xl font-black tracking-tighter text-foreground">NextGen Trading</span>
            <span className="text-3xs text-primary tracking-widest uppercase">Work Hard, Play Hard</span>
          </div>

          <div className="bg-surface-low border border-border/10 rounded-sm p-6 space-y-4">
            <div className="flex flex-col items-center space-y-3">
              <div className="h-12 w-12 rounded-sm bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Check your email</h2>
              <p className="text-sm text-muted-foreground text-center">
                We sent a magic link to <strong className="text-foreground">{sentEmail}</strong>
              </p>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Click the link in the email to sign in. The link expires in 1 hour.
            </p>
            <button
              className="w-full py-2.5 border border-border/20 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-surface-high/50 transition-colors rounded-sm flex items-center justify-center gap-2"
              onClick={() => {
                setMagicLinkSent(false);
                setLoginError(null);
              }}
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
        {/* Brand */}
        <div className="flex flex-col items-center gap-2">
          <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <span className="text-xl font-black tracking-tighter text-foreground">NextGen Trading</span>
          <span className="text-3xs text-primary tracking-widest uppercase">Work Hard, Play Hard</span>
        </div>

        {/* Login card */}
        <div className="bg-surface-low border border-border/10 rounded-sm p-6 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">Sign in</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Enter your email to receive a magic link
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isPending}
                className="w-full bg-surface-lowest border-none text-sm p-2.5 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none text-foreground placeholder:text-muted-foreground/40"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-3xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            {loginError && (
              <p role="alert" className="text-xs text-destructive bg-destructive/5 border border-destructive/20 p-2 rounded-sm">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-widest rounded-sm hover:opacity-90 active:opacity-70 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Send magic link
            </button>

            {IS_DEV && (
              <button
                type="button"
                className="w-full py-2.5 border border-dashed border-yellow-500/30 text-yellow-500 text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-yellow-500/5 transition-colors disabled:opacity-50"
                disabled={isPending}
                onClick={handleDevLogin}
              >
                Dev Login (skip magic link)
              </button>
            )}
          </form>

          <div className="text-center pt-2">
            <p className="text-xs text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-primary hover:underline font-semibold"
              >
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
