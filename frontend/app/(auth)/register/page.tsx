"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { Loader2, Mail, CheckCircle, Activity } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const [isPending, setIsPending] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  async function onSubmit(values: RegisterFormValues) {
    setIsPending(true);
    setRegisterError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase not configured. Use Dev Login on the login page.");
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setRegisterError(error.message);
        toast.error(error.message);
      } else {
        setMagicLinkSent(true);
        setSentEmail(values.email);
        toast.success("Magic link sent! Check your email to complete signup.");
      }
    } catch (err) {
      const msg = getErrorMessage(
        err as Error,
        "Failed to send magic link."
      );
      setRegisterError(msg);
      toast.error(msg);
    } finally {
      setIsPending(false);
    }
  }

  if (magicLinkSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xl font-black tracking-tighter text-foreground">NextGenAi Trading</span>
            <span className="text-3xs text-primary tracking-widest uppercase">Institutional Tier</span>
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
              Click the link in the email to create your account and sign in. The link expires in 1 hour.
            </p>
            <button
              className="w-full py-2.5 border border-border/20 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-surface-high/50 transition-colors rounded-sm flex items-center justify-center gap-2"
              onClick={() => {
                setMagicLinkSent(false);
                setRegisterError(null);
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
          <span className="text-xl font-black tracking-tighter text-foreground">NextGenAi Trading</span>
          <span className="text-3xs text-primary tracking-widest uppercase">Institutional Tier</span>
        </div>

        {/* Register card */}
        <div className="bg-surface-low border border-border/10 rounded-sm p-6 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">Create account</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Enter your email to get started with NextGenAi Trading
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

            {registerError && (
              <p role="alert" className="text-xs text-destructive bg-destructive/5 border border-destructive/20 p-2 rounded-sm">
                {registerError}
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
          </form>

          <div className="text-center pt-2">
            <p className="text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-primary hover:underline font-semibold"
              >
                Sign in
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
