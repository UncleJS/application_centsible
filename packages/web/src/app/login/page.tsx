"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  function validateEmail(value: string): string {
    if (!value.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
      return "Enter a valid email address.";
    return "";
  }

  function validatePassword(value: string): string {
    if (!value) return "Password is required.";
    if (value.length < 8) return "Password must be at least 8 characters.";
    return "";
  }

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    if (emailError) setEmailError(validateEmail(e.target.value));
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value);
    if (passwordError) setPasswordError(validatePassword(e.target.value));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;

    try {
      await login(email.trim(), password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      toast.error(message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-2xl font-bold text-white select-none">
            ¢
          </div>
          <span className="text-2xl font-bold tracking-tight text-zinc-100">
            Centsible
          </span>
        </div>

        {/* Card */}
        <Card className="border-zinc-800 bg-zinc-900 shadow-xl">
          <CardHeader className="pb-0">
            <CardTitle className="text-center text-xl text-zinc-100">
              Welcome back
            </CardTitle>
            <CardDescription className="text-center text-zinc-400">
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-zinc-300">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "email-error" : undefined}
                  disabled={isLoading}
                  className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                />
                {emailError && (
                  <p
                    id="email-error"
                    role="alert"
                    className="text-xs text-red-400"
                  >
                    {emailError}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-zinc-300">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={handlePasswordChange}
                  aria-invalid={!!passwordError}
                  aria-describedby={
                    passwordError ? "password-error" : undefined
                  }
                  disabled={isLoading}
                  className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                />
                {passwordError && (
                  <p
                    id="password-error"
                    role="alert"
                    className="text-xs text-red-400"
                  >
                    {passwordError}
                  </p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                size="lg"
                disabled={isLoading}
                className="w-full bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:ring-emerald-500/40 disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Register link */}
        <p className="mt-6 text-center text-sm text-zinc-500">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-emerald-500 underline-offset-4 transition-colors hover:text-emerald-400 hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
