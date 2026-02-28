"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuthStore } from "@/lib/store";
import { SUPPORTED_CURRENCIES } from "@centsible/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Name is required.";
    if (!email.trim()) errors.email = "Email is required.";
    if (password.length < 8)
      errors.password = "Password must be at least 8 characters.";
    if (password.length > 128)
      errors.password = "Password must be at most 128 characters.";
    if (password !== confirmPassword)
      errors.confirmPassword = "Passwords do not match.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    try {
      await register(email.trim(), password, name.trim(), currency);
      router.push("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Registration failed.";
      toast.error(message);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Branding */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-600 text-2xl font-bold text-white select-none">
            ¢
          </div>
          <span className="text-zinc-100 font-semibold text-2xl tracking-tight">
            Centsible
          </span>
        </div>

        {/* Card */}
        <Card className="bg-zinc-900 border-zinc-800 shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-zinc-100 text-xl">
              Create an account
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Start tracking your finances today.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-zinc-300 text-sm">
                  Full name
                </Label>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
                />
                {fieldErrors.name && (
                  <p className="text-red-400 text-xs">{fieldErrors.name}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-zinc-300 text-sm">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="jane@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
                />
                {fieldErrors.email && (
                  <p className="text-red-400 text-xs">{fieldErrors.email}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-zinc-300 text-sm">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
                />
                {fieldErrors.password && (
                  <p className="text-red-400 text-xs">{fieldErrors.password}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="confirmPassword"
                  className="text-zinc-300 text-sm"
                >
                  Confirm password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
                />
                {fieldErrors.confirmPassword && (
                  <p className="text-red-400 text-xs">
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Default Currency */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="currency-trigger"
                  className="text-zinc-300 text-sm"
                >
                  Default currency
                </Label>
                <Select
                  value={currency}
                  onValueChange={setCurrency}
                  disabled={isLoading}
                >
                  <SelectTrigger
                    id="currency-trigger"
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 focus:ring-emerald-500 focus:border-emerald-500 w-full"
                  >
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-100 max-h-60">
                    {SUPPORTED_CURRENCIES.map((code) => (
                      <SelectItem
                        key={code}
                        value={code}
                        className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100"
                      >
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold mt-2 disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>

            {/* Login link */}
            <p className="mt-5 text-center text-sm text-zinc-500">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
