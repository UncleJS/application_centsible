"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuthStore, useExchangeRateStore } from "@/lib/store";
import { formatCurrency, getMonthName } from "@/lib/format";
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
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PiggyBank,
  CreditCard,
  Target,
  TrendingDown,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { BILLING_CYCLE_MONTHS } from "@centsible/shared";
import type { RecurringIncome, Subscription } from "@centsible/shared";

interface Budget {
  id: number;
  categoryId: number;
  categoryName?: string | null;
  categoryType?: string | null;
  amount: string;
  spent?: string;
  year: number;
  month: number;
}

interface Category {
  id: number;
  name: string;
  type: string;
}

interface SavingsGoal {
  id: number;
  targetAmount: string;
  currentAmount: string;
  targetDate: string;
  archivedAt: string | null;
}

function getProgressColor(pct: number): string {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 75) return "bg-amber-500";
  return "bg-emerald-500";
}

function BudgetCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-4 w-32 rounded bg-zinc-800" />
          <div className="h-3 w-20 rounded bg-zinc-800" />
        </div>
        <div className="flex gap-2 ml-4">
          <div className="h-8 w-8 rounded bg-zinc-800" />
          <div className="h-8 w-8 rounded bg-zinc-800" />
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-800" />
      <div className="flex justify-between">
        <div className="h-3 w-28 rounded bg-zinc-800" />
        <div className="h-3 w-10 rounded bg-zinc-800" />
      </div>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col gap-3"
        >
          <div className="h-3 w-24 rounded bg-zinc-800" />
          <div className="h-7 w-32 rounded bg-zinc-800" />
        </div>
      ))}
      {/* Projected Balance skeleton — full width */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col gap-3 lg:col-span-3">
        <div className="h-3 w-32 rounded bg-zinc-800" />
        <div className="h-9 w-48 rounded bg-zinc-800" />
      </div>
    </div>
  );
}

interface BudgetCardProps {
  budget: Budget;
  currency: string;
  onEdit: (budget: Budget) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
  isPastMonth: boolean;
  isIncome: boolean;
}

function BudgetCard({
  budget,
  currency,
  onEdit,
  onDelete,
  isDeleting,
  isPastMonth,
  isIncome,
}: BudgetCardProps) {
  const amount = parseFloat(budget.amount);
  const actual = parseFloat(budget.spent ?? "0");
  const pct = amount > 0 ? Math.min(Math.round((actual / amount) * 100), 100) : 0;

  const barColor = isIncome
    ? "bg-emerald-500"
    : getProgressColor(pct);
  const pctColor = isIncome
    ? "text-emerald-400"
    : pct >= 90
    ? "text-red-400"
    : pct >= 75
    ? "text-amber-400"
    : "text-emerald-400";

  const spentLabel = isIncome ? "Received" : "Spent";

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-0">
        <CardTitle className="text-base text-zinc-100">
          {budget.categoryName ?? "Unknown"}
        </CardTitle>
        <CardDescription className="text-xs text-zinc-500 font-mono">
          {pct}% {isIncome ? "received" : "used"}
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30"
              onClick={() => onEdit(budget)}
              disabled={isPastMonth}
              title={isPastMonth ? "Past months are read-only" : undefined}
              aria-label={`Edit budget for ${budget.categoryName ?? "Unknown"}`}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-zinc-400 hover:text-red-400 hover:bg-zinc-800 disabled:opacity-30"
              onClick={() => onDelete(budget.id)}
              disabled={isDeleting || isPastMonth}
              title={isPastMonth ? "Past months are read-only" : undefined}
              aria-label={`Delete budget for ${budget.categoryName ?? "Unknown"}`}
            >
              {isDeleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </Button>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-2">
        <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-mono text-zinc-300">
            <span className="text-xs text-zinc-600 mr-1">{spentLabel}</span>
            {formatCurrency(budget.spent ?? "0", currency)}{" "}
            <span className="text-zinc-600">/</span>{" "}
            {formatCurrency(budget.amount, currency)}
          </span>
          <span className={`text-xs font-semibold font-mono ${pctColor}`}>
            {pct}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Budget Dialog ─────────────────────────────────────────────────────────────

interface BudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingBudget: Budget | null;
  allCategories: Category[];
  budgetedCategoryIds: Set<number>;
  year: number;
  month: number;
  currency: string;
  recurringIncome: RecurringIncome[];
  onSuccess: () => void;
}

function BudgetDialog({
  open,
  onOpenChange,
  editingBudget,
  allCategories,
  budgetedCategoryIds,
  year,
  month,
  currency,
  recurringIncome,
  onSuccess,
}: BudgetDialogProps) {
  const [categoryId, setCategoryId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [selectedType, setSelectedType] = useState<"expense" | "income">("expense");
  const [submitting, setSubmitting] = useState(false);
  const [prefillHint, setPrefillHint] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editingBudget) {
        setCategoryId(String(editingBudget.categoryId));
        setAmount(editingBudget.amount);
        setSelectedType(
          editingBudget.categoryType === "income" ? "income" : "expense"
        );
      } else {
        setCategoryId("");
        setAmount("");
        setSelectedType("expense");
        setPrefillHint(null);
      }
    }
  }, [open, editingBudget]);

  // When user selects an income category while creating, pre-fill amount from
  // a matching recurring income record (same categoryId).
  function handleCategoryChange(value: string) {
    setCategoryId(value);
    setPrefillHint(null);
    if (selectedType !== "income" || !value) return;
    const catId = Number(value);
    const match = recurringIncome.find((ri) => ri.categoryId === catId);
    if (match) {
      const cycleMonths = BILLING_CYCLE_MONTHS[match.billingCycle] ?? 1;
      const monthly = parseFloat(match.amount) / cycleMonths;
      const formatted = monthly.toFixed(2);
      setAmount(formatted);
      setPrefillHint(
        `Pre-filled from recurring income (${match.currency} ${parseFloat(match.amount).toFixed(2)} / ${match.billingCycle} → ~${match.currency} ${formatted}/mo)`
      );
    }
  }

  const isEditing = !!editingBudget;

  const availableCategories = isEditing
    ? allCategories.filter((c) => c.id === editingBudget!.categoryId)
    : allCategories.filter(
        (c) => c.type === selectedType && !budgetedCategoryIds.has(c.id)
      );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      toast.error("Please enter a valid amount greater than 0.");
      return;
    }
    if (!isEditing && !categoryId) {
      toast.error("Please select a category.");
      return;
    }

    const formattedAmount = String(parsed.toFixed(2));
    setSubmitting(true);
    try {
      if (isEditing) {
        await api.updateBudget(editingBudget!.id, { amount: formattedAmount });
        toast.success("Budget updated.");
      } else {
        await api.createBudget({
          categoryId: Number(categoryId),
          amount: formattedAmount,
          year,
          month,
          currency,
        });
        toast.success("Budget created.");
      }
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">
            {isEditing ? "Edit Budget" : "Create Budget"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Type selector — only shown when creating */}
          {!isEditing && (
            <div className="flex flex-col gap-2">
              <Label className="text-zinc-300">Type</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setSelectedType("expense"); setCategoryId(""); setPrefillHint(null); }}
                  className={`flex-1 rounded-md border py-1.5 text-sm font-medium transition-colors ${
                    selectedType === "expense"
                      ? "border-emerald-600 bg-emerald-600/20 text-emerald-300"
                      : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedType("income"); setCategoryId(""); setPrefillHint(null); }}
                  className={`flex-1 rounded-md border py-1.5 text-sm font-medium transition-colors ${
                    selectedType === "income"
                      ? "border-blue-600 bg-blue-600/20 text-blue-300"
                      : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  Income
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="budget-category" className="text-zinc-300">
              Category
            </Label>
            {isEditing ? (
              <div className="flex h-9 items-center rounded-md border border-zinc-700 bg-zinc-800/50 px-3 text-sm text-zinc-400 cursor-default">
                {editingBudget!.categoryName ?? "Unknown"}
              </div>
            ) : (
              <Select value={categoryId} onValueChange={handleCategoryChange}>
                <SelectTrigger
                  id="budget-category"
                  className="w-full border-zinc-700 bg-zinc-800/50 text-zinc-100 data-[placeholder]:text-zinc-500"
                >
                  <SelectValue placeholder="Select a category…" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                  {availableCategories.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-zinc-500 text-center">
                      All {selectedType} categories are already budgeted.
                    </div>
                  ) : (
                    availableCategories.map((cat) => (
                      <SelectItem
                        key={cat.id}
                        value={String(cat.id)}
                        className="focus:bg-zinc-800 focus:text-zinc-100"
                      >
                        {cat.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="budget-amount" className="text-zinc-300">
              {isEditing && editingBudget?.categoryType === "income"
                ? "Target Income"
                : "Budget Amount"}
            </Label>
            <Input
              id="budget-amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setPrefillHint(null); }}
              className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 font-mono"
              required
            />
            {prefillHint && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                <TrendingUp className="size-3 shrink-0" />
                {prefillHint}
              </p>
            )}
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
              disabled={
                submitting ||
                (!isEditing &&
                  (availableCategories.length === 0 || !categoryId))
              }
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Recurring Income Dialog ───────────────────────────────────────────────────

const BILLING_CYCLES = ["weekly", "fortnightly", "monthly", "quarterly", "yearly"] as const;

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
    if (open) {
      if (editing) {
        setName(editing.name);
        setDescription(editing.description ?? "");
        setAmount(editing.amount);
        setRiCurrency(editing.currency);
        setBillingCycle(editing.billingCycle);
        setCategoryId(editing.categoryId ? String(editing.categoryId) : "none");
        setAutoRenew(editing.autoRenew);
      } else {
        setName("");
        setDescription("");
        setAmount("");
        setRiCurrency(currency);
        setBillingCycle("monthly");
        setCategoryId("none");
        setAutoRenew(true);
      }
    }
  }, [open, editing, currency]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!name.trim()) {
      toast.error("Please enter a name.");
      return;
    }
    if (!amount || isNaN(parsed) || parsed <= 0) {
      toast.error("Please enter a valid amount greater than 0.");
      return;
    }

    const body = {
      name: name.trim(),
      description: description.trim() || null,
      amount: parsed.toFixed(2),
      currency: riCurrency,
      billingCycle,
      categoryId: categoryId && categoryId !== "none" ? Number(categoryId) : null,
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
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">
            {editing ? "Edit Recurring Income" : "Add Recurring Income"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="ri-name" className="text-zinc-300">Name</Label>
            <Input
              id="ri-name"
              placeholder="e.g. Salary, Freelance"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600"
              required
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="ri-description" className="text-zinc-300">
              Description <span className="text-zinc-600 font-normal">(optional)</span>
            </Label>
            <Input
              id="ri-description"
              placeholder="Additional notes…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          {/* Amount + Currency */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-2 flex-1">
              <Label htmlFor="ri-amount" className="text-zinc-300">Amount</Label>
              <Input
                id="ri-amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 font-mono"
                required
              />
            </div>
            <div className="flex flex-col gap-2 w-28">
              <Label htmlFor="ri-currency" className="text-zinc-300">Currency</Label>
              <Input
                id="ri-currency"
                placeholder="GBP"
                value={riCurrency}
                onChange={(e) => setRiCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 font-mono uppercase"
              />
            </div>
          </div>

          {/* Billing Cycle */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="ri-billing-cycle" className="text-zinc-300">Billing Cycle</Label>
            <Select value={billingCycle} onValueChange={setBillingCycle}>
              <SelectTrigger
                id="ri-billing-cycle"
                className="w-full border-zinc-700 bg-zinc-800/50 text-zinc-100"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                {BILLING_CYCLES.map((cycle) => (
                  <SelectItem
                    key={cycle}
                    value={cycle}
                    className="focus:bg-zinc-800 focus:text-zinc-100 capitalize"
                  >
                    {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="ri-category" className="text-zinc-300">
              Category <span className="text-zinc-600 font-normal">(optional)</span>
            </Label>
            <Select
              value={categoryId}
              onValueChange={setCategoryId}
            >
              <SelectTrigger
                id="ri-category"
                className="w-full border-zinc-700 bg-zinc-800/50 text-zinc-100 data-[placeholder]:text-zinc-500"
              >
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                <SelectItem value="none" className="focus:bg-zinc-800 focus:text-zinc-100 text-zinc-500">
                  None
                </SelectItem>
                {incomeCategories.map((cat) => (
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

          {/* Auto Renew */}
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/30 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-zinc-300">Auto-renew</span>
              <span className="text-xs text-zinc-500">Automatically continues each cycle</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoRenew}
              onClick={() => setAutoRenew(!autoRenew)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                autoRenew ? "bg-emerald-600" : "bg-zinc-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                  autoRenew ? "translate-x-5" : "translate-x-0"
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
              {editing ? "Save Changes" : "Add Income"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Recurring Income Card ─────────────────────────────────────────────────────

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
  const rate =
    item.currency === currency ? 1 : (exchangeRates[item.currency] ?? null);
  const monthlyInUserCurrency =
    rate !== null && rate > 0
      ? parseFloat(item.amount) / cycleMonths / rate
      : null;

  const cycleLabel =
    item.billingCycle.charAt(0).toUpperCase() + item.billingCycle.slice(1);

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-0">
        <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
          {item.categoryIcon && (
            <span className="text-sm">{item.categoryIcon}</span>
          )}
          {item.name}
        </CardTitle>
        <CardDescription className="text-xs text-zinc-500">
          {item.categoryName ?? "No category"} · {cycleLabel}
          {item.autoRenew && (
            <span className="ml-1.5 inline-flex items-center gap-0.5 text-emerald-600">
              <RefreshCw className="size-2.5" />
              auto
            </span>
          )}
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              onClick={() => onEdit(item)}
              aria-label={`Edit ${item.name}`}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-zinc-400 hover:text-red-400 hover:bg-zinc-800 disabled:opacity-30"
              onClick={() => onDelete(item.id)}
              disabled={isDeleting}
              aria-label={`Delete ${item.name}`}
            >
              {isDeleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </Button>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-3">
        <p className="text-2xl font-bold font-mono text-emerald-400">
          {item.currency} {parseFloat(item.amount).toFixed(2)}
        </p>
        {monthlyInUserCurrency !== null && item.currency !== currency && (
          <p className="text-xs text-zinc-600 font-mono mt-0.5">
            ≈ {formatCurrency(monthlyInUserCurrency, currency)}/mo
          </p>
        )}
        {monthlyInUserCurrency !== null && item.currency === currency && cycleMonths !== 1 && (
          <p className="text-xs text-zinc-600 font-mono mt-0.5">
            ≈ {formatCurrency(monthlyInUserCurrency, currency)}/mo
          </p>
        )}
        {item.description && (
          <p className="text-xs text-zinc-600 mt-1 truncate">{item.description}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BudgetsPage() {
  const { user } = useAuthStore();
  const currency = user?.defaultCurrency ?? "GBP";
  const { rates: exchangeRates, fetchRates } = useExchangeRateStore();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [recurringIncome, setRecurringIncome] = useState<RecurringIncome[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Budget dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  // Recurring income dialog state
  const [riDialogOpen, setRiDialogOpen] = useState(false);
  const [editingRI, setEditingRI] = useState<RecurringIncome | null>(null);
  const [deletingRIId, setDeletingRIId] = useState<number | null>(null);

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getBudgets(year, month);
      setBudgets(res.data ?? []);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load budgets."
      );
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.getCategories();
      setCategories(res.data ?? []);
    } catch {
      // non-critical
    }
  }, []);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const res = await api.getSubscriptions();
      setSubscriptions(res.data ?? []);
    } catch {
      // non-critical
    }
  }, []);

  const fetchRecurringIncome = useCallback(async () => {
    try {
      const res = await api.getRecurringIncome();
      setRecurringIncome(res.data ?? []);
    } catch {
      // non-critical
    }
  }, []);

  const fetchSavingsGoals = useCallback(async () => {
    try {
      const res = await api.getSavingsGoals();
      setSavingsGoals(res.data ?? []);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  useEffect(() => {
    fetchCategories();
    fetchSubscriptions();
    fetchRecurringIncome();
    fetchSavingsGoals();
    fetchRates(currency);
  }, [fetchCategories, fetchSubscriptions, fetchRecurringIncome, fetchSavingsGoals, fetchRates, currency]);

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await api.deleteBudget(id);
      toast.success("Budget deleted.");
      fetchBudgets();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete budget."
      );
    } finally {
      setDeletingId(null);
    }
  }

  function handleEdit(budget: Budget) {
    setEditingBudget(budget);
    setDialogOpen(true);
  }

  function handleCreate() {
    setEditingBudget(null);
    setDialogOpen(true);
  }

  async function handleDeleteRI(id: number) {
    setDeletingRIId(id);
    try {
      await api.deleteRecurringIncome(id);
      toast.success("Recurring income deleted.");
      fetchRecurringIncome();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete recurring income."
      );
    } finally {
      setDeletingRIId(null);
    }
  }

  function handleEditRI(item: RecurringIncome) {
    setEditingRI(item);
    setRiDialogOpen(true);
  }

  function handleCreateRI() {
    setEditingRI(null);
    setRiDialogOpen(true);
  }

  // Split budgets by category type
  const expenseBudgets = budgets.filter((b) => b.categoryType !== "income");
  const incomeBudgets = budgets.filter((b) => b.categoryType === "income");

  // Expense totals
  const totalBudgetedExpenses = expenseBudgets.reduce(
    (sum, b) => sum + parseFloat(b.amount),
    0
  );
  const totalSpentExpenses = expenseBudgets.reduce(
    (sum, b) => sum + parseFloat(b.spent ?? "0"),
    0
  );
  const totalRemainingExpenses = totalBudgetedExpenses - totalSpentExpenses;

  // Income totals
  const totalBudgetedIncome = incomeBudgets.reduce(
    (sum, b) => sum + parseFloat(b.amount),
    0
  );
  const totalReceivedIncome = incomeBudgets.reduce(
    (sum, b) => sum + parseFloat(b.spent ?? "0"),
    0
  );
  const totalIncomeSurplus = totalReceivedIncome - totalBudgetedIncome;

  // Total monthly subscription cost (all subscriptions are expense-only now)
  const totalMonthlySubscriptions = useMemo(
    () =>
      subscriptions.reduce((sum, sub) => {
        const cycleMonths = BILLING_CYCLE_MONTHS[sub.billingCycle] ?? 1;
        const rate =
          sub.currency === currency
            ? 1
            : (exchangeRates[sub.currency] ?? null);
        if (rate === null || rate <= 0) return sum;
        return sum + (parseFloat(sub.amount) / cycleMonths) / rate;
      }, 0),
    [subscriptions, exchangeRates, currency]
  );

  // Total monthly savings needed
  const totalMonthlySavings = useMemo(() => {
    return savingsGoals.reduce((sum, goal) => {
      if (goal.archivedAt) return sum;
      const current = parseFloat(goal.currentAmount || "0");
      const target = parseFloat(goal.targetAmount || "0");
      if (current >= target) return sum;

      const targetDate = new Date(goal.targetDate + "T00:00:00Z");
      const targetYear = targetDate.getUTCFullYear();
      const targetMonth = targetDate.getUTCMonth() + 1;

      const monthsRemaining = Math.max(
        1,
        (targetYear - year) * 12 + (targetMonth - month)
      );

      if ((targetYear - year) * 12 + (targetMonth - month) <= 0) return sum;

      return sum + (target - current) / monthsRemaining;
    }, 0);
  }, [savingsGoals, year, month]);

  // Grand total monthly commitment: expense budgets + subscriptions + savings
  const totalMonthlyCommitted = totalBudgetedExpenses + totalMonthlySubscriptions + totalMonthlySavings;

  // Monthly recurring income (normalised across all billing cycles)
  const totalMonthlyRecurringIncome = useMemo(
    () =>
      recurringIncome.reduce((sum, item) => {
        const cycleMonths = BILLING_CYCLE_MONTHS[item.billingCycle] ?? 1;
        return sum + parseFloat(item.amount) / cycleMonths;
      }, 0),
    [recurringIncome]
  );

  const ratesPending =
    Object.keys(exchangeRates).length === 0 &&
    subscriptions.some((s) => s.currency !== currency);

  const budgetedCategoryIds = new Set(budgets.map((b) => b.categoryId));

  // Income categories for the recurring income dialog
  const incomeCategories = categories.filter((c) => c.type === "income");

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const isPastMonth =
    year < currentYear || (year === currentYear && month < currentMonth);

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <PiggyBank className="size-6 text-emerald-400" />
            Budgets
          </h1>
          <p className="text-sm text-zinc-500">
            Set monthly spending limits by category.
          </p>
        </div>

        <Button
          onClick={handleCreate}
          className="bg-emerald-600 text-white hover:bg-emerald-500"
        >
          <Plus className="size-4" />
          Add Budget
        </Button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={prevMonth}
          className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </Button>

        <span className="text-lg font-semibold text-zinc-100 min-w-[11rem] text-center tracking-tight select-none">
          {getMonthName(month)} {year}
        </span>

        <Button
          variant="outline"
          size="icon"
          onClick={nextMonth}
          className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Summary Grid */}
      {loading ? (
        <SummarySkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* ── Row 1: Expense budgets ── */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex flex-col gap-1 pt-6">
              <p className="text-xs uppercase tracking-widest font-medium text-zinc-500">
                Budgeted Expenses
              </p>
              <p className="text-2xl font-bold font-mono text-zinc-100">
                {formatCurrency(totalBudgetedExpenses, currency)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex flex-col gap-1 pt-6">
              <p className="text-xs uppercase tracking-widest font-medium text-zinc-500">
                Total Spent
              </p>
              <p
                className={`text-2xl font-bold font-mono ${
                  totalSpentExpenses > totalBudgetedExpenses ? "text-red-400" : "text-zinc-100"
                }`}
              >
                {formatCurrency(totalSpentExpenses, currency)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex flex-col gap-1 pt-6">
              <p className="text-xs uppercase tracking-widest font-medium text-zinc-500">
                Remaining
              </p>
              <p
                className={`text-2xl font-bold font-mono ${
                  totalRemainingExpenses < 0 ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {formatCurrency(totalRemainingExpenses, currency)}
              </p>
            </CardContent>
          </Card>

          {/* ── Row 2: Income budgets ── */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex flex-col gap-1 pt-6">
              <p className="text-xs uppercase tracking-widest font-medium text-zinc-500">
                Budgeted Income
              </p>
              <p className="text-2xl font-bold font-mono text-zinc-100">
                {formatCurrency(totalBudgetedIncome, currency)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex flex-col gap-1 pt-6">
              <p className="text-xs uppercase tracking-widest font-medium text-zinc-500">
                Total Received
              </p>
              <p className="text-2xl font-bold font-mono text-zinc-100">
                {formatCurrency(totalReceivedIncome, currency)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex flex-col gap-1 pt-6">
              <p className="text-xs uppercase tracking-widest font-medium text-zinc-500">
                Income Surplus
              </p>
              <p
                className={`text-2xl font-bold font-mono ${
                  totalIncomeSurplus >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {formatCurrency(totalIncomeSurplus, currency)}
              </p>
            </CardContent>
          </Card>

          {/* ── Row 3: Recurring income (informational) ── */}
          <Card className="bg-zinc-900 border-zinc-800 lg:col-span-3">
            <CardContent className="flex flex-col gap-1 pt-6">
              <div className="flex items-center gap-2 mb-0.5">
                <TrendingUp className="size-3.5 text-green-400" />
                <p className="text-xs uppercase tracking-widest font-medium text-zinc-500">
                  Monthly Recurring Income
                </p>
              </div>
              <p className="text-2xl font-bold font-mono text-green-400">
                {formatCurrency(totalMonthlyRecurringIncome, currency)}
              </p>
              <p className="text-xs text-zinc-600">
                normalised monthly total across all recurring income sources
              </p>
            </CardContent>
          </Card>

          {/* ── Row 4: Commitments ── */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex flex-col gap-1 pt-6">
              <div className="flex items-center gap-2 mb-0.5">
                <CreditCard className="size-3.5 text-amber-400" />
                <p className="text-xs uppercase tracking-widest font-medium text-zinc-500">
                  Monthly Subscriptions
                </p>
              </div>
              {ratesPending ? (
                <>
                  <p className="text-2xl font-bold font-mono text-zinc-500">—</p>
                  <p className="text-xs text-zinc-600">loading exchange rates…</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold font-mono text-zinc-100">
                    {formatCurrency(totalMonthlySubscriptions, currency)}
                  </p>
                  <p className="text-xs text-zinc-600">
                    normalised across all billing cycles
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex flex-col gap-1 pt-6">
              <div className="flex items-center gap-2 mb-0.5">
                <Target className="size-3.5 text-blue-400" />
                <p className="text-xs uppercase tracking-widest font-medium text-zinc-500">
                  Monthly Savings
                </p>
              </div>
              <p className="text-2xl font-bold font-mono text-zinc-100">
                {formatCurrency(totalMonthlySavings, currency)}
              </p>
              <p className="text-xs text-zinc-600">
                needed to stay on track across all goals
              </p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex flex-col gap-1 pt-6">
              <div className="flex items-center gap-2 mb-0.5">
                <TrendingDown className="size-3.5 text-purple-400" />
                <p className="text-xs uppercase tracking-widest font-medium text-zinc-500">
                  Monthly Committed
                </p>
              </div>
              {ratesPending ? (
                <>
                  <p className="text-2xl font-bold font-mono text-zinc-500">—</p>
                  <p className="text-xs text-zinc-600">loading exchange rates…</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold font-mono text-purple-300">
                    {formatCurrency(totalMonthlyCommitted, currency)}
                  </p>
                  <p className="text-xs text-zinc-600">
                    expense budgets + subscriptions + savings
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Row 4: Projected Balance (full-width) ── */}
          <Card
            className={`bg-zinc-900 border-zinc-800 lg:col-span-3 ${
              ratesPending ? "" : totalBudgetedIncome - totalMonthlyCommitted >= 0
                ? "border-emerald-800/50"
                : "border-red-800/50"
            }`}
          >
            <CardContent className="flex flex-col gap-1 pt-6">
              <p className="text-xs uppercase tracking-widest font-medium text-zinc-500">
                Projected Balance
              </p>
              {ratesPending ? (
                <>
                  <p className="text-2xl font-bold font-mono text-zinc-500">—</p>
                  <p className="text-xs text-zinc-600">loading exchange rates…</p>
                </>
              ) : (
                <>
                  <p
                    className={`text-3xl font-bold font-mono ${
                      totalBudgetedIncome - totalMonthlyCommitted >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {formatCurrency(totalBudgetedIncome - totalMonthlyCommitted, currency)}
                  </p>
                  <p className="text-xs text-zinc-600">
                    budgeted income − committed (expense budgets + subscriptions + savings)
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Budget Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <BudgetCardSkeleton key={i} />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 py-20 text-center">
          <PiggyBank className="size-12 text-zinc-600" />
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-zinc-300">
              No budgets set for {getMonthName(month)} {year}
            </p>
            <p className="text-sm text-zinc-500">
              Create a budget to start tracking your spending.
            </p>
          </div>
          <Button
            onClick={handleCreate}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
          >
            <Plus className="size-4" />
            Add Budget
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Income Budgets section */}
          {incomeBudgets.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
                Income Budgets
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {incomeBudgets.map((budget) => (
                  <BudgetCard
                    key={budget.id}
                    budget={budget}
                    currency={currency}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isDeleting={deletingId === budget.id}
                    isPastMonth={isPastMonth}
                    isIncome
                  />
                ))}
              </div>
            </div>
          )}

          {/* Expense Budgets section */}
          {expenseBudgets.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
                Expense Budgets
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {expenseBudgets.map((budget) => (
                  <BudgetCard
                    key={budget.id}
                    budget={budget}
                    currency={currency}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isDeleting={deletingId === budget.id}
                    isPastMonth={isPastMonth}
                    isIncome={false}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Recurring Income Section ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              <TrendingUp className="size-4 text-emerald-400" />
              Recurring Income
            </h2>
            <p className="text-sm text-zinc-500">
              Regular income sources used to project monthly earnings.
            </p>
          </div>
          <Button
            onClick={handleCreateRI}
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-500"
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>

        {recurringIncome.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 py-12 text-center">
            <TrendingUp className="size-10 text-zinc-600" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-zinc-300">No recurring income yet</p>
              <p className="text-xs text-zinc-500">
                Add salary, freelance, or any regular income source.
              </p>
            </div>
            <Button
              onClick={handleCreateRI}
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              <Plus className="size-3.5" />
              Add Income
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recurringIncome.map((item) => (
              <RecurringIncomeCard
                key={item.id}
                item={item}
                currency={currency}
                exchangeRates={exchangeRates}
                onEdit={handleEditRI}
                onDelete={handleDeleteRI}
                isDeleting={deletingRIId === item.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Budget Create / Edit Dialog */}
      <BudgetDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingBudget(null);
        }}
        editingBudget={editingBudget}
        allCategories={categories}
        budgetedCategoryIds={budgetedCategoryIds}
        year={year}
        month={month}
        currency={currency}
        recurringIncome={recurringIncome}
        onSuccess={fetchBudgets}
      />

      {/* Recurring Income Create / Edit Dialog */}
      <RecurringIncomeDialog
        open={riDialogOpen}
        onOpenChange={(open) => {
          setRiDialogOpen(open);
          if (!open) setEditingRI(null);
        }}
        editing={editingRI}
        incomeCategories={incomeCategories}
        currency={currency}
        onSuccess={fetchRecurringIncome}
      />
    </div>
  );
}
