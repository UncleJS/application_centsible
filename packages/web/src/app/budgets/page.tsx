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
} from "lucide-react";
import { BILLING_CYCLE_MONTHS } from "@centsible/shared";

interface Budget {
  id: number;
  categoryId: number;
  categoryName?: string | null;
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
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col gap-3"
        >
          <div className="h-3 w-24 rounded bg-zinc-800" />
          <div className="h-7 w-32 rounded bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

interface BudgetCardProps {
  budget: Budget;
  currency: string;
  onEdit: (budget: Budget) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}

function BudgetCard({
  budget,
  currency,
  onEdit,
  onDelete,
  isDeleting,
}: BudgetCardProps) {
  const amount = parseFloat(budget.amount);
  const spent = parseFloat(budget.spent ?? "0");
  const pct = amount > 0 ? Math.min(Math.round((spent / amount) * 100), 100) : 0;
  const barColor = getProgressColor(pct);
  const pctColor =
    pct >= 90 ? "text-red-400" : pct >= 75 ? "text-amber-400" : "text-emerald-400";

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-0">
        <CardTitle className="text-base text-zinc-100">
          {budget.categoryName ?? "Unknown"}
        </CardTitle>
        <CardDescription className="text-xs text-zinc-500 font-mono">
          {pct}% used
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              onClick={() => onEdit(budget)}
              aria-label={`Edit budget for ${budget.categoryName ?? "Unknown"}`}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
              onClick={() => onDelete(budget.id)}
              disabled={isDeleting}
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
  expenseCategories: Category[];
  budgetedCategoryIds: Set<number>;
  year: number;
  month: number;
  currency: string;
  onSuccess: () => void;
}

function BudgetDialog({
  open,
  onOpenChange,
  editingBudget,
  expenseCategories,
  budgetedCategoryIds,
  year,
  month,
  currency,
  onSuccess,
}: BudgetDialogProps) {
  const [categoryId, setCategoryId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingBudget) {
        setCategoryId(String(editingBudget.categoryId));
        setAmount(editingBudget.amount);
      } else {
        setCategoryId("");
        setAmount("");
      }
    }
  }, [open, editingBudget]);

  const isEditing = !!editingBudget;

  const availableCategories = isEditing
    ? expenseCategories.filter((c) => c.id === editingBudget!.categoryId)
    : expenseCategories.filter((c) => !budgetedCategoryIds.has(c.id));

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
          <div className="flex flex-col gap-2">
            <Label htmlFor="budget-category" className="text-zinc-300">
              Category
            </Label>
            {isEditing ? (
              <div className="flex h-9 items-center rounded-md border border-zinc-700 bg-zinc-800/50 px-3 text-sm text-zinc-400 cursor-default">
                {editingBudget!.categoryName ?? "Unknown"}
              </div>
            ) : (
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger
                  id="budget-category"
                  className="w-full border-zinc-700 bg-zinc-800/50 text-zinc-100 data-[placeholder]:text-zinc-500"
                >
                  <SelectValue placeholder="Select a category…" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                  {availableCategories.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-zinc-500 text-center">
                      All expense categories are already budgeted.
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
              Budget Amount
            </Label>
            <Input
              id="budget-amount"
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
      setCategories(
        (res.data ?? []).filter((c: Category) => c.type === "expense")
      );
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

  const totalBudgeted = budgets.reduce(
    (sum, b) => sum + parseFloat(b.amount),
    0
  );
  const totalSpent = budgets.reduce(
    (sum, b) => sum + parseFloat(b.spent ?? "0"),
    0
  );
  const totalRemaining = totalBudgeted - totalSpent;

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

  // Total monthly savings needed — uses the same whole-calendar-month formula
  // as the forecast API (reports.ts): (targetYear - nowYear)*12 + (targetMonth - nowMonth).
  // We snapshot `now` once so every goal uses the same instant.
  const totalMonthlySavings = useMemo(() => {
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1; // 1-based
    return savingsGoals.reduce((sum, goal) => {
      if (goal.archivedAt) return sum;
      const current = parseFloat(goal.currentAmount || "0");
      const target = parseFloat(goal.targetAmount || "0");
      if (current >= target) return sum;

      const targetDate = new Date(goal.targetDate + "T00:00:00Z");
      const targetYear = targetDate.getUTCFullYear();
      const targetMonth = targetDate.getUTCMonth() + 1; // 1-based
      const monthsRemaining = Math.max(
        1,
        (targetYear - nowYear) * 12 + (targetMonth - nowMonth)
      );

      // Skip goals whose target date is already past
      if ((targetYear - nowYear) * 12 + (targetMonth - nowMonth) <= 0) return sum;

      return sum + (target - current) / monthsRemaining;
    }, 0);
  }, [savingsGoals]);

  // Grand total monthly commitment: budgets + subscriptions + savings
  const totalMonthlyCommitted = totalBudgeted + totalMonthlySubscriptions + totalMonthlySavings;

  // Rates are considered pending if the store hasn't loaded yet and there are
  // foreign-currency subscriptions whose conversion would otherwise be 1:1.
  const ratesPending =
    Object.keys(exchangeRates).length === 0 &&
    subscriptions.some((s) => s.currency !== currency);

  const budgetedCategoryIds = new Set(budgets.map((b) => b.categoryId));

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

      {/* Summary Row */}
      {loading ? (
        <SummarySkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* ── Existing 3 ── */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex flex-col gap-1 pt-6">
              <p className="text-xs uppercase tracking-widest font-medium text-zinc-500">
                Total Budgeted
              </p>
              <p className="text-2xl font-bold font-mono text-zinc-100">
                {formatCurrency(totalBudgeted, currency)}
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
                  totalSpent > totalBudgeted ? "text-red-400" : "text-zinc-100"
                }`}
              >
                {formatCurrency(totalSpent, currency)}
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
                  totalRemaining < 0 ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {formatCurrency(totalRemaining, currency)}
              </p>
            </CardContent>
          </Card>

          {/* ── 3 new cards ── */}
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
                    budgets + subscriptions + savings
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              currency={currency}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isDeleting={deletingId === budget.id}
            />
          ))}
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
        expenseCategories={categories}
        budgetedCategoryIds={budgetedCategoryIds}
        year={year}
        month={month}
        currency={currency}
        onSuccess={fetchBudgets}
      />
    </div>
  );
}
