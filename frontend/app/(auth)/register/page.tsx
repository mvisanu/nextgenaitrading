"use client";

/**
 * /register — email + password + confirm, with live password rules.
 *
 * Registration goes browser → Supabase directly via signUp(). It used to
 * POST to the backend's /auth/register (which minted a pre-confirmed
 * user), but that made account creation depend on the API being up; a
 * suspended backend took registration down with it. The backend endpoint
 * still exists and is untouched — it simply has no UI caller now.
 *
 * Both Supabase configurations are handled: when email confirmation is
 * disabled signUp returns a session and we go straight to the dashboard;
 * when it's enabled we show the confirm-your-email state in place.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MailCheck } from "lucide-react";

import { AuthCard, AuthFooterLink } from "@/components/auth/AuthCard";
import { AuthError } from "@/components/auth/AuthError";
import {
  AuthField,
  PasswordField,
  SubmitButton,
} from "@/components/auth/AuthField";
import {
  PasswordRules,
  meetsPasswordRules,
} from "@/components/auth/PasswordRules";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { mapAuthError } from "@/lib/auth-errors";
import { hardNavigate } from "@/lib/navigate";

const registerSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().refine(meetsPasswordRules, {
      message: "Password doesn't meet the rules below",
    }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const passwordValue = watch("password") ?? "";

  async function onSubmit(values: RegisterValues) {
    setFormError(null);
    const email = values.email.trim().toLowerCase();
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase not configured");

      const { data, error } = await supabase.auth.signUp({
        email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;

      // Supabase does not error on a duplicate email (that would leak which
      // addresses are registered). It returns a user with no identities.
      if (data.user && data.user.identities?.length === 0) {
        throw new Error("User already registered");
      }

      if (data.session) {
        // Email confirmation is disabled — we're already signed in.
        hardNavigate("/dashboard");
        return;
      }

      setConfirmEmail(email);
    } catch (err) {
      setFormError(mapAuthError(err));
    }
  }

  if (confirmEmail) {
    return (
      <AuthCard
        title="Check your email"
        footer={
          <AuthFooterLink
            prompt="Already confirmed?"
            href="/login"
            label="Sign in"
          />
        }
      >
        <div className="flex flex-col items-center space-y-3 py-2">
          <div className="h-12 w-12 rounded-sm bg-primary/10 flex items-center justify-center">
            <MailCheck className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            We sent a confirmation link to{" "}
            <strong className="text-foreground">{confirmEmail}</strong>. Click
            it to activate your account.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create account"
      footer={
        <AuthFooterLink
          prompt="Already have an account?"
          href="/login"
          label="Sign in"
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

        <PasswordField
          id="password"
          placeholder="Create a password"
          autoComplete="new-password"
          disabled={isSubmitting}
          error={errors.password?.message}
          {...register("password")}
        />

        <PasswordRules value={passwordValue} />

        <PasswordField
          id="confirmPassword"
          label="Confirm password"
          placeholder="Re-enter your password"
          autoComplete="new-password"
          disabled={isSubmitting}
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        <AuthError message={formError} />

        <SubmitButton pending={isSubmitting}>Create account</SubmitButton>
      </form>
    </AuthCard>
  );
}
