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
} from "lucide-react";
import { BILLING_CYCLE_MONTHS } from "@centsible/shared";

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

interface Subscription {
  id: number;
  type: "income" | "expense";
  categoryId: number | null;
  amount: string;
  currency: string;
  billingCycle: string;
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

  // For income: green is always good (received >= budgeted is ideal).
  // For expense: red when near/over limit.
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

interface BudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingBudget: Budget | null;
  allCategories: Category[];
  budgetedCategoryIds: Set<number>;
  year: number;
  month: number;
  currency: string;
  subscriptions: Subscription[];
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
  subscriptions,
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
  // a matching recurring income subscription (same categoryId).
  function handleCategoryChange(value: string) {
    setCategoryId(value);
    setPrefillHint(null);
    if (selectedType !== "income" || !value) return;
    const catId = Number(value);
    const match = subscriptions.find(
      (s) => s.type === "income" && s.categoryId === catId
    );
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

  // Filter categories by selected type, excluding already-budgeted ones (except the one being edited)
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
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

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
    fetchSavingsGoals();
    fetchRates(currency);
  }, [fetchCategories, fetchSubscriptions, fetchSavingsGoals, fetchRates, currency]);

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

  // Total monthly subscription cost — each subscription converted to userCurrency.
  // Rates are fetched with base=userCurrency so rates[subCurrency] = "units of subCurrency
  // per 1 unit of userCurrency". To convert subAmount → userCurrency: divide by the rate.
  // Skips subscriptions whose rate is missing rather than distorting the total with 1:1.
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

  // Total monthly savings needed — mirrors the forecast API formula exactly:
  // monthsRemaining = (targetYear - fYear) * 12 + (targetMonth - fMonth)
  // where fYear/fMonth is the DISPLAYED budget month (not today).
  const totalMonthlySavings = useMemo(() => {
    return savingsGoals.reduce((sum, goal) => {
      if (goal.archivedAt) return sum;
      const current = parseFloat(goal.currentAmount || "0");
      const target = parseFloat(goal.targetAmount || "0");
      if (current >= target) return sum;

      const targetDate = new Date(goal.targetDate + "T00:00:00Z");
      const targetYear = targetDate.getUTCFullYear();
      const targetMonth = targetDate.getUTCMonth() + 1; // 1-based

      // Use displayed month as the reference point, same as forecast API
      const monthsRemaining = Math.max(
        1,
        (targetYear - year) * 12 + (targetMonth - month)
      );

      // Skip goals whose target date is before or in the displayed month
      if ((targetYear - year) * 12 + (targetMonth - month) <= 0) return sum;

      return sum + (target - current) / monthsRemaining;
    }, 0);
  }, [savingsGoals, year, month]);

  // Grand total monthly commitment: expense budgets + subscriptions + savings
  // Income budgets are not a "commitment" — they are expected inflows
  const totalMonthlyCommitted = totalBudgetedExpenses + totalMonthlySubscriptions + totalMonthlySavings;

  // Rates are considered pending if the store hasn't loaded yet and there are
  // foreign-currency subscriptions whose conversion would otherwise be 1:1.
  const ratesPending =
    Object.keys(exchangeRates).length === 0 &&
    subscriptions.some((s) => s.currency !== currency);

  const budgetedCategoryIds = new Set(budgets.map((b) => b.categoryId));

  // Past month: year/month is before today's year/month
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

          {/* ── Row 3: Commitments ── */}
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

      {/* Create / Edit Dialog */}
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
        subscriptions={subscriptions}
        onSuccess={fetchBudgets}
      />
    </div>
  );
}
