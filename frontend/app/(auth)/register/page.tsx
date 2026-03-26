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
                Click the link in the email to create your account and sign in.
                The link expires in 1 hour.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setMagicLinkSent(false);
                  setRegisterError(null);
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
            <CardTitle className="text-2xl">Create account</CardTitle>
            <CardDescription>
              Enter your email to get started with NextGenStock
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

              {registerError && (
                <p role="alert" className="text-sm text-destructive">
                  {registerError}
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
            </form>
          </CardContent>

          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-primary hover:underline font-medium"
              >
                Sign in
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
