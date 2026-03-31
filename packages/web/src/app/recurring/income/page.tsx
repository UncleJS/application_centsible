"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { BILLING_CYCLE_LABELS, BILLING_CYCLE_MONTHS, SUPPORTED_CURRENCIES } from "@centsible/shared";
import type { RecurringIncome } from "@centsible/shared";
import { AmountBadge } from "@/components/ui/amount-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { TimestampCell } from "@/components/ui/timestamp-cell";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useAuthStore, useExchangeRateStore } from "@/lib/store";

const BILLING_CYCLES = ["weekly", "fortnightly", "monthly", "quarterly", "yearly"] as const;

interface Category {
  id: number;
  name: string;
  type: string;
}

interface RecurringIncomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: RecurringIncome | null;
  incomeCategories: Category[];
  currency: string;
  onSuccess: () => void;
}

function RecurringIncomeDialog({
  open,
  onOpenChange,
  editing,
  incomeCategories,
  currency,
  onSuccess,
}: RecurringIncomeDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [riCurrency, setRiCurrency] = useState(currency);
  const [billingCycle, setBillingCycle] = useState<string>("monthly");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [autoRenew, setAutoRenew] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? "");
      setAmount(editing.amount);
      setRiCurrency(editing.currency);
      setBillingCycle(editing.billingCycle);
      setCategoryId(editing.categoryId ? String(editing.categoryId) : "none");
      setAutoRenew(editing.autoRenew);
      return;
    }

    setName("");
    setDescription("");
    setAmount("");
    setRiCurrency(currency);
    setBillingCycle("monthly");
    setCategoryId("none");
    setAutoRenew(true);
  }, [currency, editing, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = parseFloat(amount);
    if (!name.trim()) {
      toast.error("Please enter a name.");
      return;
    }

    if (!amount || Number.isNaN(parsed) || parsed <= 0) {
      toast.error("Please enter a valid amount greater than 0.");
      return;
    }

    const body = {
      name: name.trim(),
      description: description.trim() || null,
      amount: parsed.toFixed(2),
      currency: riCurrency,
      billingCycle,
      categoryId: categoryId !== "none" ? Number(categoryId) : null,
      autoRenew,
    };

    setSubmitting(true);
    try {
      if (editing) {
        await api.updateRecurringIncome(editing.id, body);
        toast.success("Recurring income updated.");
      } else {
        await api.createRecurringIncome(body);
        toast.success("Recurring income added.");
      }
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">
            {editing ? "Edit Income Source" : "Add Income Source"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ri-name" className="text-zinc-300">
              Name
            </Label>
            <Input
              id="ri-name"
              placeholder="Salary, freelance, dividends"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ri-description" className="text-zinc-300">
              Description <span className="font-normal text-zinc-600">(optional)</span>
            </Label>
            <Input
              id="ri-description"
              placeholder="Additional notes"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ri-amount" className="text-zinc-300">
                Amount
              </Label>
              <Input
                id="ri-amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="border-zinc-700 bg-zinc-800/50 font-mono text-zinc-100 placeholder:text-zinc-600"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ri-currency" className="text-zinc-300">
                Currency
              </Label>
              <Select value={riCurrency} onValueChange={setRiCurrency}>
                <SelectTrigger id="ri-currency" className="border-zinc-700 bg-zinc-800/50 text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
                  {SUPPORTED_CURRENCIES.map((item) => (
                    <SelectItem key={item} value={item} className="focus:bg-zinc-800 focus:text-zinc-100">
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ri-cycle" className="text-zinc-300">
              Billing cycle
            </Label>
            <Select value={billingCycle} onValueChange={setBillingCycle}>
              <SelectTrigger id="ri-cycle" className="border-zinc-700 bg-zinc-800/50 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
                {BILLING_CYCLES.map((cycle) => (
                  <SelectItem key={cycle} value={cycle} className="focus:bg-zinc-800 focus:text-zinc-100">
                    {BILLING_CYCLE_LABELS[cycle]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ri-category" className="text-zinc-300">
              Category <span className="font-normal text-zinc-600">(optional)</span>
            </Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="ri-category" className="border-zinc-700 bg-zinc-800/50 text-zinc-100">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
                <SelectItem value="none" className="focus:bg-zinc-800 focus:text-zinc-100">
                  None
                </SelectItem>
                {incomeCategories.map((category) => (
                  <SelectItem
                    key={category.id}
                    value={String(category.id)}
                    className="focus:bg-zinc-800 focus:text-zinc-100"
                  >
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-800/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-zinc-200">Auto renew</p>
              <p className="text-xs text-zinc-500">Continue this source each cycle for planning.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoRenew}
              onClick={() => setAutoRenew((value) => !value)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                autoRenew ? "bg-emerald-600" : "bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
                  autoRenew ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-500" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {editing ? "Save changes" : "Add source"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface RecurringIncomeCardProps {
  item: RecurringIncome;
  currency: string;
  exchangeRates: Record<string, number>;
  onEdit: (item: RecurringIncome) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}

function RecurringIncomeCard({
  item,
  currency,
  exchangeRates,
  onEdit,
  onDelete,
  isDeleting,
}: RecurringIncomeCardProps) {
  const cycleMonths = BILLING_CYCLE_MONTHS[item.billingCycle] ?? 1;
  const rate = item.currency === currency ? 1 : (exchangeRates[item.currency] ?? null);
  const monthlyAmount = rate !== null && rate > 0 ? parseFloat(item.amount) / cycleMonths / rate : null;

  return (
    <Card className="border-zinc-800 bg-zinc-900/80">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-lg text-emerald-300">
            {item.categoryIcon ?? "↗"}
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base text-zinc-100">{item.name}</CardTitle>
            <CardDescription className="mt-1 text-xs text-zinc-500">
              {item.categoryName ?? "No category"} · {BILLING_CYCLE_LABELS[item.billingCycle] ?? item.billingCycle}
            </CardDescription>
          </div>
          <CardAction>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                onClick={() => onEdit(item)}
                aria-label={`Edit ${item.name}`}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
                onClick={() => onDelete(item.id)}
                disabled={isDeleting}
                aria-label={`Delete ${item.name}`}
              >
                {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              </Button>
            </div>
          </CardAction>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <AmountBadge amount={`${item.currency} ${parseFloat(item.amount).toFixed(2)}`} tone="income" />
          {item.autoRenew ? (
            <AmountBadge amount="Auto-renew" className="text-emerald-200" />
          ) : (
            <AmountBadge amount="Manual" />
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Normalised monthly</p>
          <p className="text-xl font-semibold text-zinc-50">
            {monthlyAmount !== null ? formatCurrency(monthlyAmount, currency) : "—"}
          </p>
        </div>

        {item.description ? <p className="text-sm text-zinc-400">{item.description}</p> : null}

        <div className="border-t border-zinc-800 pt-3">
          <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-zinc-600">Last updated</p>
          <TimestampCell value={item.updatedAt} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function RecurringIncomePage() {
  const { user } = useAuthStore();
  const currency = user?.defaultCurrency ?? "GBP";
  const { rates: exchangeRates, fetchRates } = useExchangeRateStore();

  const [recurringIncome, setRecurringIncome] = useState<RecurringIncome[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringIncome | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [recurringIncomeRes, categoriesRes] = await Promise.all([
        api.getRecurringIncome(),
        api.getCategories(),
      ]);

      setRecurringIncome((recurringIncomeRes.data ?? []).filter((item) => !item.archivedAt));
      setIncomeCategories((categoriesRes.data ?? []).filter((item) => item.type === "income" && !item.archivedAt));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load recurring income.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchRates(currency);
  }, [currency, fetchData, fetchRates]);

  const stats = useMemo(() => {
    const activeSources = recurringIncome.length;
    const autoRenewCount = recurringIncome.filter((item) => item.autoRenew).length;

    const monthlyTotal = recurringIncome.reduce((sum, item) => {
      const cycleMonths = BILLING_CYCLE_MONTHS[item.billingCycle] ?? 1;
      const rate = item.currency === currency ? 1 : (exchangeRates[item.currency] ?? null);
      if (rate === null || rate <= 0) return sum;
      return sum + parseFloat(item.amount) / cycleMonths / rate;
    }, 0);

    return { activeSources, autoRenewCount, monthlyTotal };
  }, [currency, exchangeRates, recurringIncome]);

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await api.deleteRecurringIncome(id);
      toast.success("Income source archived.");
      await fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete recurring income.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Recurring"
        title="Income sources"
        description="Track salary, freelance, dividends, and any other recurring income separately from your monthly budgets."
        action={
          <Button className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}>
            <Plus className="size-4" />
            Add source
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard
          label="Active sources"
          value={String(stats.activeSources)}
          hint="Recurring sources currently contributing to cash-flow planning."
          icon={Wallet}
        />
        <StatCard
          label="Monthly normalised"
          value={loading ? "—" : formatCurrency(stats.monthlyTotal, currency)}
          hint="Converted into your default currency and normalised to monthly value."
          icon={TrendingUp}
          accentClassName="text-emerald-300"
        />
        <StatCard
          label="Auto renew"
          value={String(stats.autoRenewCount)}
          hint="Sources configured to continue automatically every cycle."
          icon={RefreshCw}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/80" />
          ))}
        </div>
      ) : recurringIncome.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No recurring income yet"
          description="Add salary, freelance, or other regular income to improve forecast accuracy and keep budgets focused on monthly allocations."
          action={
            <Button className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              Add first source
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {recurringIncome.map((item) => (
            <RecurringIncomeCard
              key={item.id}
              item={item}
              currency={currency}
              exchangeRates={exchangeRates}
              onEdit={(entry) => {
                setEditing(entry);
                setDialogOpen(true);
              }}
              onDelete={handleDelete}
              isDeleting={deletingId === item.id}
            />
          ))}
        </div>
      )}

      <RecurringIncomeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        incomeCategories={incomeCategories}
        currency={currency}
        onSuccess={fetchData}
      />
    </div>
  );
}
