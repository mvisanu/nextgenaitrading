"use client";

/**
 * /reset-password — set a new password.
 *
 * Reached from the emailed recovery link via /auth/callback, which has
 * already exchanged the code for a session. Without that session
 * updateUser() cannot work, so we check for one on mount and send the
 * user back to /forgot-password if the link was stale or reused.
 */

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { AuthCard, AuthFooterLink } from "@/components/auth/AuthCard";
import { AuthError } from "@/components/auth/AuthError";
import { PasswordField, SubmitButton } from "@/components/auth/AuthField";
import {
  PasswordRules,
  meetsPasswordRules,
} from "@/components/auth/PasswordRules";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { mapAuthError } from "@/lib/auth-errors";
import { hardNavigate } from "@/lib/navigate";

const schema = z
  .object({
    password: z.string().refine(meetsPasswordRules, {
      message: "Password doesn't meet the rules below",
    }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type Values = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const passwordValue = watch("password") ?? "";

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) throw new Error("Supabase not configured");
        const { data } = await supabase.auth.getSession();
        if (active) setHasSession(!!data.session);
      } catch {
        if (active) setHasSession(false);
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase not configured");

      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (error) throw error;

      hardNavigate("/dashboard");
    } catch (err) {
      setFormError(mapAuthError(err));
    }
  }

  if (checking) {
    return (
      <AuthCard title="Set a new password">
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AuthCard>
    );
  }

  if (!hasSession) {
    return (
      <AuthCard
        title="Link expired"
        footer={
          <AuthFooterLink
            prompt="Need a new one?"
            href="/forgot-password"
            label="Request another link"
          />
        }
      >
        <p className="text-sm text-muted-foreground">
          That reset link has expired or has already been used. Request a fresh
          one and try again.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set a new password"
      footer={
        <AuthFooterLink prompt="Changed your mind?" href="/login" label="Sign in" />
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <PasswordField
          id="password"
          label="New password"
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

        <SubmitButton pending={isSubmitting}>Update password</SubmitButton>
      </form>
    </AuthCard>
  );
}
