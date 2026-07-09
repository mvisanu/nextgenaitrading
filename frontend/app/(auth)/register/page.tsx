"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { Loader2, UserPlus, Activity } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { pinAuthApi } from "@/lib/pin-auth-api";

const registerSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
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
      // 1. Create the account (backend creates a confirmed Supabase user —
      //    no confirmation email needed).
      await pinAuthApi.register(values.email, values.password);

      // 2. Sign in immediately with the new credentials.
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase not configured.");
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      if (error) throw new Error(error.message);

      toast.success("Account created! Signing you in…");
      window.location.href = "/dashboard";
    } catch (err) {
      const msg = getErrorMessage(err as Error, "Failed to create account.");
      setRegisterError(msg);
      toast.error(msg);
    } finally {
      setIsPending(false);
    }
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

        {/* Register card */}
        <div className="bg-surface-low border border-border/10 rounded-sm p-6 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">Create account</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Pick an email and password — you&apos;ll be signed in right away
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

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                disabled={isPending}
                className="w-full bg-surface-lowest border-none text-sm p-2.5 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none text-foreground placeholder:text-muted-foreground/60"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-3xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                autoComplete="new-password"
                disabled={isPending}
                className="w-full bg-surface-lowest border-none text-sm p-2.5 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none text-foreground placeholder:text-muted-foreground/60"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-3xs text-destructive">
                  {errors.confirmPassword.message}
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
                <UserPlus className="h-4 w-4" />
              )}
              Create account
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
