"use client";

/**
 * /forgot-password — single email field.
 *
 * The success state is shown regardless of whether the address exists, so
 * this page can't be used to enumerate registered users.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MailCheck } from "lucide-react";

import { AuthCard, AuthFooterLink } from "@/components/auth/AuthCard";
import { AuthError } from "@/components/auth/AuthError";
import { AuthField, SubmitButton } from "@/components/auth/AuthField";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { mapAuthError } from "@/lib/auth-errors";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
});
type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setFormError(null);
    const email = values.email.trim().toLowerCase();
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase not configured");

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // The callback exchanges the recovery code for a session, then
        // forwards to /reset-password where the new password is set.
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) throw error;

      setSentTo(email);
    } catch (err) {
      setFormError(mapAuthError(err));
    }
  }

  if (sentTo) {
    return (
      <AuthCard
        title="Check your email"
        footer={
          <AuthFooterLink
            prompt="Remembered it?"
            href="/login"
            label="Back to sign in"
          />
        }
      >
        <div className="flex flex-col items-center space-y-3 py-2">
          <div className="h-12 w-12 rounded-sm bg-primary/10 flex items-center justify-center">
            <MailCheck className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            If an account exists for{" "}
            <strong className="text-foreground">{sentTo}</strong>, we&apos;ve
            sent a link to reset your password.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      footer={
        <AuthFooterLink
          prompt="Remembered it?"
          href="/login"
          label="Back to sign in"
        />
      }
    >
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

        <AuthError message={formError} />

        <SubmitButton pending={isSubmitting}>Send reset link</SubmitButton>
      </form>
    </AuthCard>
  );
}
