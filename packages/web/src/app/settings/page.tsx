"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { SUPPORTED_CURRENCIES } from "@centsible/shared";
import { toast } from "sonner";
import { Loader2, Settings, User, Coins } from "lucide-react";
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

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();

  const [name, setName] = useState(user?.name ?? "");
  const [currency, setCurrency] = useState(user?.defaultCurrency ?? "GBP");
  const [saving, setSaving] = useState(false);

  // Keep form in sync if user loads after hydration
  useEffect(() => {
    if (user) {
      setName(user.name);
      setCurrency(user.defaultCurrency);
    }
  }, [user]);

  const isDirty =
    name.trim() !== (user?.name ?? "") ||
    currency !== (user?.defaultCurrency ?? "GBP");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Name cannot be empty.");
      return;
    }

    const updates: { name?: string; defaultCurrency?: string } = {};
    if (name.trim() !== user?.name) updates.name = name.trim();
    if (currency !== user?.defaultCurrency) updates.defaultCurrency = currency;

    if (Object.keys(updates).length === 0) return;

    setSaving(true);
    try {
      const res = await api.updateProfile(updates);
      updateUser(res.data.user);
      toast.success("Settings saved.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Settings className="size-6 text-emerald-400" />
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
          <p className="text-sm text-zinc-500">Manage your account preferences.</p>
        </div>
      </div>

      {/* Profile Card */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100 text-base">
            <User className="size-4 text-zinc-400" />
            Profile
          </CardTitle>
          <CardDescription className="text-zinc-500">
            Update your display name and default currency.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSave} className="flex flex-col gap-6">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-name" className="text-zinc-300">
                Full name
              </Label>
              <Input
                id="settings-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                maxLength={100}
                className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
              />
            </div>

            {/* Email — read-only */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-300">Email address</Label>
              <div className="flex h-9 items-center rounded-md border border-zinc-700 bg-zinc-800/30 px-3 text-sm text-zinc-500 cursor-default select-none">
                {user?.email ?? "—"}
              </div>
              <p className="text-xs text-zinc-600">Email cannot be changed.</p>
            </div>

            {/* Default Currency */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-currency-trigger" className="text-zinc-300 flex items-center gap-1.5">
                <Coins className="size-3.5 text-zinc-500" />
                Default currency
              </Label>
              <Select
                value={currency}
                onValueChange={setCurrency}
                disabled={saving}
              >
                <SelectTrigger
                  id="settings-currency-trigger"
                  className="border-zinc-700 bg-zinc-800/50 text-zinc-100 focus:ring-emerald-500 focus:border-emerald-500 w-full font-mono"
                >
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-h-72">
                  {SUPPORTED_CURRENCIES.map((code) => (
                    <SelectItem
                      key={code}
                      value={code}
                      className="font-mono focus:bg-zinc-800 focus:text-zinc-100"
                    >
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-600">
                Used for all budget, savings, and report displays.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={saving || !isDirty}
                className="bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
