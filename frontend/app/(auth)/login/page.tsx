"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/utils";
import { Loader2, Zap, Mail, CheckCircle } from "lucide-react";
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
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center justify-center gap-2">
            <Zap className="h-7 w-7 text-primary" />
            <span className="text-xl font-semibold">NextGenStock</span>
          </div>

          <Card>
            <CardHeader className="space-y-1 text-center">
              <div className="flex justify-center mb-2">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <CardTitle className="text-2xl">Check your email</CardTitle>
              <CardDescription>
                We sent a magic link to <strong>{sentEmail}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Click the link in the email to sign in. The link expires in 1
                hour.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setMagicLinkSent(false);
                  setLoginError(null);
                }}
              >
                <Mail className="h-4 w-4 mr-2" />
                Try a different email
              </Button>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Educational software only. Live trading carries real financial risk.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2">
          <Zap className="h-7 w-7 text-primary" />
          <span className="text-xl font-semibold">NextGenStock</span>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>
              Enter your email to receive a magic link
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={isPending}
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {loginError && (
                <p role="alert" className="text-sm text-destructive">
                  {loginError}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Send magic link
              </Button>

              {IS_DEV && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                  disabled={isPending}
                  onClick={handleDevLogin}
                >
                  Dev Login (skip magic link)
                </Button>
              )}
            </form>
          </CardContent>

          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-primary hover:underline font-medium"
              >
                Create one
              </Link>
            </p>
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Educational software only. Live trading carries real financial risk.
        </p>
      </div>
    </div>
  );
}
