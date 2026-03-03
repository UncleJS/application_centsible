"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { api, isSafeUrl } from "@/lib/api";
import { useAuthStore, useExchangeRateStore } from "@/lib/store";
import { formatCurrency, formatDate, daysUntil, getToday } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DateOnlyInput } from "@/components/ui/date-input";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CreditCard,
  RefreshCw,
  CalendarClock,
  Link as LinkIcon,
  AlertCircle,
} from "lucide-react";
import {
  SUPPORTED_CURRENCIES,
  BILLING_CYCLE_LABELS,
  BILLING_CYCLE_MONTHS,
} from "@centsible/shared";

interface Subscription {
  id: number;
  userId: number;
  categoryId: number | null;
  name: string;
  description: string | null;
  amount: string;
  currency: string;
  billingCycle: BillingCycle;
  nextRenewalDate: string;
  startDate: string;
  url: string | null;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

type BillingCycle = "weekly" | "fortnightly" | "monthly" | "quarterly" | "yearly";

interface Category {
  id: number;
  name: string;
  type: string;
}

function toMonthly(amount: string, billingCycle: BillingCycle): number {
  const parsed = parseFloat(amount);
  const months = BILLING_CYCLE_MONTHS[billingCycle] ?? 1;
  return parsed / months;
}

function getRenewalColor(days: number): string {
  if (days < 7) return "text-red-400";
  if (days < 14) return "text-amber-400";
  return "text-emerald-400";
}

function getRenewalBadgeVariant(days: number): string {
  if (days < 7) return "bg-red-500/15 text-red-400 border-red-500/30";
  if (days < 14) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
}

function SubscriptionCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="h-4 w-36 rounded bg-zinc-800" />
          <div className="h-3 w-24 rounded bg-zinc-800" />
        </div>
        <div className="flex gap-1 shrink-0">
          <div className="h-7 w-7 rounded bg-zinc-800" />
          <div className="h-7 w-7 rounded bg-zinc-800" />
        </div>
      </div>
      <div className="h-px w-full bg-zinc-800" />
      <div className="flex flex-col gap-2">
        <div className="h-3 w-28 rounded bg-zinc-800" />
        <div className="h-3 w-20 rounded bg-zinc-800" />
        <div className="h-3 w-32 rounded bg-zinc-800" />
      </div>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col gap-3"
        >
          <div className="h-3 w-28 rounded bg-zinc-800" />
          <div className="h-7 w-32 rounded bg-zinc-800" />
          <div className="h-3 w-20 rounded bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

interface SubscriptionCardProps {
  subscription: Subscription;
  userCurrency: string;
  exchangeRates: Record<string, number>;
  onEdit: (sub: Subscription) => void;
  onDelete: (sub: Subscription) => void;
}

function SubscriptionCard({
  subscription,
  userCurrency,
  exchangeRates,
  onEdit,
  onDelete,
}: SubscriptionCardProps) {
  const days = daysUntil(subscription.nextRenewalDate);
  const renewalColor = getRenewalColor(days);
  const badgeClass = getRenewalBadgeVariant(days);
  const cycleLabel = BILLING_CYCLE_LABELS[subscription.billingCycle] ?? subscription.billingCycle;

  const isForeignCurrency = subscription.currency !== userCurrency;
  const foreignRate = isForeignCurrency ? exchangeRates[subscription.currency] : undefined;
  const localAmount =
    foreignRate !== undefined && foreignRate > 0
      ? parseFloat(subscription.amount) / foreignRate
      : null;

  return (
    <Card className="bg-zinc-900 border-zinc-800 flex flex-col">
      <CardHeader className="pb-0">
        <div className="flex items-start gap-2 min-w-0">
          <CardTitle className="text-base text-zinc-100 leading-snug truncate flex-1">
            {subscription.name}
          </CardTitle>
        </div>
        {subscription.description && (
          <CardDescription className="text-xs text-zinc-500 line-clamp-1">
            {subscription.description}
          </CardDescription>
        )}
        <CardAction>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              onClick={() => onEdit(subscription)}
              aria-label={`Edit ${subscription.name}`}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
              onClick={() => onDelete(subscription)}
              aria-label={`Delete ${subscription.name}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-3 flex-1">
        <Separator className="bg-zinc-800" />

        {/* Amount + cycle */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xl font-bold font-mono text-zinc-100">
              {formatCurrency(subscription.amount, subscription.currency)}
              {localAmount !== null && (
                <span className="text-sm font-normal text-zinc-400 ml-1.5">
                  ({formatCurrency(localAmount, userCurrency)})
                </span>
              )}
            </span>
          </div>
          <Badge
            variant="outline"
            className="text-xs border-zinc-700 text-zinc-400 bg-zinc-800/50 shrink-0"
          >
            {cycleLabel}
          </Badge>
        </div>

        <div className="flex flex-col gap-1.5 text-xs text-zinc-400">
          {/* Next renewal */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <CalendarClock className="size-3 shrink-0 text-zinc-600" />
              <span className="font-mono">{formatDate(subscription.nextRenewalDate)}</span>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold font-mono ${badgeClass}`}
            >
              {days < 0 ? "overdue" : days === 0 ? "today" : `${days}d`}
            </span>
          </div>

          {/* Auto-renew */}
          <div className="flex items-center gap-1.5">
            <RefreshCw className={`size-3 shrink-0 ${subscription.autoRenew ? "text-emerald-500" : "text-zinc-600"}`} />
            <span className={subscription.autoRenew ? "text-emerald-400" : "text-zinc-600"}>
              {subscription.autoRenew ? "Auto-renew on" : "Auto-renew off"}
            </span>
          </div>

          {/* URL */}
          {subscription.url && isSafeUrl(subscription.url) && (
            <div className="flex items-center gap-1.5">
              <LinkIcon className="size-3 shrink-0 text-zinc-600" />
              <a
                href={subscription.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-zinc-500 hover:text-zinc-300 transition-colors"
                title={subscription.url}
              >
                {new URL(subscription.url).hostname}
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface SubscriptionFormState {
  name: string;
  description: string;
  amount: string;
  currency: string;
  billingCycle: BillingCycle;
  startDate: string;
  nextRenewalDate: string;
  url: string;
  autoRenew: boolean;
  categoryId: string;
}

const DEFAULT_FORM: SubscriptionFormState = {
  name: "",
  description: "",
  amount: "",
  currency: "GBP",
  billingCycle: "monthly",
  startDate: getToday(),
  nextRenewalDate: getToday(),
  url: "",
  autoRenew: true,
  categoryId: "",
};

interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSub: Subscription | null;
  categories: Category[];
  userCurrency: string;
  onSuccess: () => void;
}

function SubscriptionDialog({
  open,
  onOpenChange,
  editingSub,
  categories,
  userCurrency,
  onSuccess,
}: SubscriptionDialogProps) {
  const [form, setForm] = useState<SubscriptionFormState>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = !!editingSub;

  useEffect(() => {
    if (open) {
      if (editingSub) {
        setForm({
          name: editingSub.name,
          description: editingSub.description ?? "",
          amount: editingSub.amount,
          currency: editingSub.currency,
          billingCycle: editingSub.billingCycle,
          startDate: formatDate(editingSub.startDate),
          nextRenewalDate: formatDate(editingSub.nextRenewalDate),
          url: editingSub.url ?? "",
          autoRenew: editingSub.autoRenew,
          categoryId: editingSub.categoryId !== null ? String(editingSub.categoryId) : "",
        });
      } else {
        setForm({ ...DEFAULT_FORM, currency: userCurrency });
      }
    }
  }, [open, editingSub, userCurrency]);

  function setField<K extends keyof SubscriptionFormState>(key: K, value: SubscriptionFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = parseFloat(form.amount);
    if (!form.amount || isNaN(parsed) || parsed <= 0) {
      toast.error("Please enter a valid amount greater than 0.");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Please enter a subscription name.");
      return;
    }
    if (!form.startDate) {
      toast.error("Please select a start date.");
      return;
    }
    if (!form.nextRenewalDate) {
      toast.error("Please select a next renewal date.");
      return;
    }

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      amount: String(parseFloat(form.amount).toFixed(2)),
      currency: form.currency,
      billingCycle: form.billingCycle,
      startDate: form.startDate,
      nextRenewalDate: form.nextRenewalDate,
      url: form.url.trim() || null,
      autoRenew: form.autoRenew,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
    };

    setSubmitting(true);
    try {
      if (isEditing) {
        await api.updateSubscription(editingSub!.id, body);
        toast.success("Subscription updated.");
      } else {
        await api.createSubscription(body);
        toast.success("Subscription created.");
      }
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  // Filter to expense categories only
  const expenseCategories = categories.filter((c) => c.type === "expense");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">
            {isEditing ? "Edit Subscription" : "Add Subscription"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-2">
            <Label className="text-zinc-300">
              Name <span className="text-red-400">*</span>
            </Label>
            <Input
              type="text"
              placeholder="Netflix, Spotify…"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600"
              required
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <Label className="text-zinc-300">Description</Label>
            <Input
              type="text"
              placeholder="Optional note…"
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          {/* Amount + Currency row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label className="text-zinc-300">
                Amount <span className="text-red-400">*</span>
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setField("amount", e.target.value)}
                className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 font-mono"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-zinc-300">Currency</Label>
              <Select value={form.currency} onValueChange={(v) => setField("currency", v)}>
                <SelectTrigger className="w-full border-zinc-700 bg-zinc-800/50 text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-h-60">
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c} className="focus:bg-zinc-800 focus:text-zinc-100 font-mono">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Billing Cycle */}
          <div className="flex flex-col gap-2">
            <Label className="text-zinc-300">Billing Cycle</Label>
            <Select
              value={form.billingCycle}
              onValueChange={(v) => setField("billingCycle", v as BillingCycle)}
            >
              <SelectTrigger className="w-full border-zinc-700 bg-zinc-800/50 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                {Object.entries(BILLING_CYCLE_LABELS).map(([value, label]) => (
                  <SelectItem
                    key={value}
                    value={value}
                    className="focus:bg-zinc-800 focus:text-zinc-100"
                  >
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date + Next Renewal Date */}
          <div className="grid grid-cols-2 gap-3">
            <DateOnlyInput
              name="startDate"
              label="Start Date"
              value={form.startDate}
              onChange={(v) => setField("startDate", v)}
              required
            />
            <DateOnlyInput
              name="nextRenewalDate"
              label="Next Renewal"
              value={form.nextRenewalDate}
              onChange={(v) => setField("nextRenewalDate", v)}
              required
            />
          </div>

          {/* URL */}
          <div className="flex flex-col gap-2">
            <Label className="text-zinc-300">URL</Label>
            <Input
              type="url"
              placeholder="https://…"
              value={form.url}
              onChange={(e) => setField("url", e.target.value)}
              className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 font-mono"
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-2">
            <Label className="text-zinc-300">Category</Label>
            <Select
              value={form.categoryId || "__none__"}
              onValueChange={(v) => setField("categoryId", v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="w-full border-zinc-700 bg-zinc-800/50 text-zinc-100">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                <SelectItem value="__none__" className="focus:bg-zinc-800 focus:text-zinc-100 text-zinc-500">
                  None
                </SelectItem>
                {expenseCategories.map((cat) => (
                  <SelectItem
                    key={cat.id}
                    value={String(cat.id)}
                    className="focus:bg-zinc-800 focus:text-zinc-100"
                  >
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Auto-renew toggle */}
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/30 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-zinc-300">Auto-renew</span>
              <span className="text-xs text-zinc-500">Automatically renews each billing cycle</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.autoRenew}
              onClick={() => setField("autoRenew", !form.autoRenew)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                form.autoRenew ? "bg-emerald-600" : "bg-zinc-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                  form.autoRenew ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <DialogFooter className="pt-1">
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Subscription"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: Subscription | null;
  onConfirm: () => void;
  deleting: boolean;
}

function DeleteDialog({
  open,
  onOpenChange,
  subscription,
  onConfirm,
  deleting,
}: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 flex items-center gap-2">
            <AlertCircle className="size-5 text-red-400 shrink-0" />
            Delete Subscription
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-1">
          <p className="text-sm text-zinc-300">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-zinc-100">
              {subscription?.name}
            </span>
            ? This action cannot be undone.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={deleting}
            className="bg-red-600 text-white hover:bg-red-500"
          >
            {deleting && <Loader2 className="size-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SubscriptionsPage() {
  const { user } = useAuthStore();
  const userCurrency = user?.defaultCurrency ?? "GBP";
  const { rates: exchangeRates, fetchRates } = useExchangeRateStore();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSub, setDeletingSub] = useState<Subscription | null>(null);

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSubscriptions();
      setSubscriptions(res.data ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load subscriptions.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.getCategories();
      setCategories(res.data ?? []);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  useEffect(() => {
    fetchCategories();
    fetchRates(userCurrency);
  }, [fetchCategories, fetchRates, userCurrency]);

  function handleCreate() {
    setEditingSub(null);
    setDialogOpen(true);
  }

  function handleEdit(sub: Subscription) {
    setEditingSub(sub);
    setDialogOpen(true);
  }

  function handleDeleteRequest(sub: Subscription) {
    setDeletingSub(sub);
    setDeleteDialogOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!deletingSub) return;
    setDeleting(true);
    try {
      await api.deleteSubscription(deletingSub.id);
      toast.success("Subscription deleted.");
      setDeleteDialogOpen(false);
      setDeletingSub(null);
      fetchSubscriptions();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete subscription.");
    } finally {
      setDeleting(false);
    }
  }

  // Monthly cost normalised to userCurrency
  const totalMonthlyCost = useMemo(
    () =>
      subscriptions.reduce((sum, sub) => {
        const rate =
          sub.currency === userCurrency
            ? 1
            : (exchangeRates[sub.currency] ?? null);
        if (rate === null || rate <= 0) return sum;
        return sum + toMonthly(sub.amount, sub.billingCycle) / rate;
      }, 0),
    [subscriptions, exchangeRates, userCurrency]
  );

  const activeCount = subscriptions.length;

  const ratesPending =
    Object.keys(exchangeRates).length === 0 &&
    subscriptions.some((s) => s.currency !== userCurrency);

  const nextRenewal = useMemo(
    () =>
      subscriptions.length > 0
        ? subscriptions.reduce((nearest, sub) =>
            sub.nextRenewalDate < nearest.nextRenewalDate ? sub : nearest
          )
        : null,
    [subscriptions]
  );

  const nextRenewalDays = nextRenewal ? daysUntil(nextRenewal.nextRenewalDate) : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <CreditCard className="size-6 text-emerald-400" />
            Subscriptions
          </h1>
          <p className="text-sm text-zinc-500">
            Track recurring charges and upcoming renewals.
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-emerald-600 text-white hover:bg-emerald-500"
        >
          <Plus className="size-4" />
          Add Subscription
        </Button>
      </div>

      {/* Summary Tiles */}
      {loading ? (
        <SummarySkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Monthly Cost */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex flex-col gap-1 pt-6">
              <p className="text-xs uppercase tracking-widest font-medium text-zinc-500">
                Monthly Cost
              </p>
              {ratesPending ? (
                <>
                  <p className="text-2xl font-bold font-mono text-zinc-500">—</p>
                  <p className="text-xs text-zinc-600">loading exchange rates…</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold font-mono text-zinc-100">
                    {formatCurrency(totalMonthlyCost, userCurrency)}
                  </p>
                  <p className="text-xs text-zinc-600">
                    normalized across all billing cycles
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Active Count */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex flex-col gap-1 pt-6">
              <p className="text-xs uppercase tracking-widest font-medium text-zinc-500">
                Active Subscriptions
              </p>
              <p className="text-2xl font-bold font-mono text-zinc-100">
                {activeCount}
              </p>
              <p className="text-xs text-zinc-600">
                active recurring services
              </p>
            </CardContent>
          </Card>

          {/* Next Renewal */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex flex-col gap-1 pt-6">
              <p className="text-xs uppercase tracking-widest font-medium text-zinc-500">
                Next Renewal
              </p>
              {nextRenewal ? (
                <>
                  <p className="text-2xl font-bold font-mono text-zinc-100 truncate">
                    {nextRenewal.name}
                  </p>
                  <p className={`text-xs font-mono font-semibold ${nextRenewalDays !== null ? getRenewalColor(nextRenewalDays) : "text-zinc-500"}`}>
                    {nextRenewalDays !== null
                      ? nextRenewalDays < 0
                        ? "overdue"
                        : nextRenewalDays === 0
                        ? "today"
                        : `in ${nextRenewalDays} day${nextRenewalDays === 1 ? "" : "s"}`
                      : "—"}{" "}
                    · {formatDate(nextRenewal.nextRenewalDate)}
                  </p>
                </>
              ) : (
                <p className="text-2xl font-bold font-mono text-zinc-600">—</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Subscription Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SubscriptionCardSkeleton key={i} />
          ))}
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 py-20 text-center">
          <CreditCard className="size-12 text-zinc-600" />
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-zinc-300">
              No subscriptions yet
            </p>
            <p className="text-sm text-zinc-500">
              Add your recurring services to track costs and renewals.
            </p>
          </div>
          <Button
            onClick={handleCreate}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
          >
            <Plus className="size-4" />
            Add Subscription
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subscriptions
            .slice()
            .sort((a, b) => a.nextRenewalDate.localeCompare(b.nextRenewalDate))
            .map((sub) => (
              <SubscriptionCard
                key={sub.id}
                subscription={sub}
                userCurrency={userCurrency}
                exchangeRates={exchangeRates}
                onEdit={handleEdit}
                onDelete={handleDeleteRequest}
              />
            ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <SubscriptionDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingSub(null);
        }}
        editingSub={editingSub}
        categories={categories}
        userCurrency={userCurrency}
        onSuccess={fetchSubscriptions}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeletingSub(null);
        }}
        subscription={deletingSub}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />
    </div>
  );
}
