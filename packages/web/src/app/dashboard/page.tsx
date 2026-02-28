"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Target,
  CreditCard,
  PiggyBank,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { formatCurrency, daysUntil } from "@/lib/format";

interface MonthlySummary {
  year?: number;
  month?: number;
  totalIncome: string;
  totalExpenses: string;
  netAmount: string;
  byCategory?: Array<{
    categoryId: number;
    categoryName: string | null;
    categoryIcon: string | null;
    categoryColor: string | null;
    type: string;
    totalAmount: string;
    budgetAmount: string | null;
    percentUsed: number | null;
    transactionCount: number;
  }>;
}

interface Budget {
  id: number;
  categoryId: number;
  categoryName?: string | null;
  amount: string;
  spent?: string;
  year: number;
  month: number;
}

interface Subscription {
  id: number;
  name: string;
  amount: string;
  currency: string;
  nextRenewalDate: string;
  billingCycle: string;
}

interface SavingsGoal {
  id: number;
  name: string;
  targetAmount: string;
  currentAmount: string;
  currency: string;
  targetDate: string;
  icon: string | null;
}

function budgetBarColor(pct: number): string {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 75) return "bg-amber-500";
  return "bg-green-500";
}

function subscriptionDayColor(days: number): string {
  if (days < 7) return "text-red-400";
  if (days < 14) return "text-amber-400";
  return "text-green-400";
}

function savingsBarColor(pct: number): string {
  if (pct >= 100) return "bg-green-500";
  return "bg-blue-500";
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 p-6"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-3 w-24 rounded bg-zinc-800" />
                <div className="h-7 w-32 rounded bg-zinc-800" />
              </div>
              <div className="h-9 w-9 rounded-lg bg-zinc-800" />
            </div>
            <div className="h-3 w-20 rounded bg-zinc-800" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-6 h-5 w-36 rounded bg-zinc-800" />
          <div className="space-y-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <div className="h-3 w-28 rounded bg-zinc-800" />
                  <div className="h-3 w-20 rounded bg-zinc-800" />
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 h-5 w-44 rounded bg-zinc-800" />
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-3 w-32 rounded bg-zinc-800" />
                  <div className="h-3 w-16 rounded bg-zinc-800" />
                </div>
              ))}
            </div>
          </div>

          <div className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 h-5 w-36 rounded bg-zinc-800" />
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between">
                    <div className="h-3 w-28 rounded bg-zinc-800" />
                    <div className="h-3 w-20 rounded bg-zinc-800" />
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-800" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const currency = user?.defaultCurrency ?? "USD";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [summaryRes, budgetsRes, subsRes, goalsRes] = await Promise.all([
          api.getMonthlySummary(),
          api.getBudgets(),
          api.getUpcomingSubscriptions(30),
          api.getSavingsGoals(),
        ]);
        setSummary(summaryRes.data);
        setBudgets(budgetsRes.data);
        setSubscriptions(subsRes.data);
        setSavingsGoals(goalsRes.data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load dashboard data."
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const netPositive = summary ? parseFloat(summary.netAmount) >= 0 : true;

  // Compute budget usage % from loaded budgets
  const budgetUsagePct = (() => {
    const totalBudgeted = budgets.reduce((s, b) => s + parseFloat(b.amount), 0);
    const totalSpent = budgets.reduce((s, b) => s + parseFloat(b.spent ?? "0"), 0);
    return totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  })();

  const topBudgets = budgets.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">
          Dashboard
        </h1>
        {user && (
          <p className="mt-1 text-zinc-400">
            Welcome back,{" "}
            <span className="font-medium text-zinc-200">{user.name}</span>
          </p>
        )}
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <div className="rounded-xl border border-red-800 bg-red-950/40 px-6 py-8 text-center">
          <p className="text-sm font-medium text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-red-800 px-4 py-2 text-xs font-semibold text-red-100 transition-colors hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Total Income */}
            <Card className="border-zinc-800 bg-zinc-900">
              <CardHeader>
                <CardDescription className="text-zinc-400">
                  Total Income
                </CardDescription>
                <CardTitle className="text-2xl font-bold text-green-400">
                  {summary ? formatCurrency(summary.totalIncome, currency) : "—"}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-zinc-500">This month</p>
              </CardContent>
            </Card>

            {/* Total Expenses */}
            <Card className="border-zinc-800 bg-zinc-900">
              <CardHeader>
                <CardDescription className="text-zinc-400">
                  Total Expenses
                </CardDescription>
                <CardTitle className="text-2xl font-bold text-red-400">
                  {summary
                    ? formatCurrency(summary.totalExpenses, currency)
                    : "—"}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
                    <TrendingDown className="h-5 w-5 text-red-400" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-zinc-500">This month</p>
              </CardContent>
            </Card>

            {/* Net Savings */}
            <Card className="border-zinc-800 bg-zinc-900">
              <CardHeader>
                <CardDescription className="text-zinc-400">
                  Net Savings
                </CardDescription>
                <CardTitle
                  className={`text-2xl font-bold ${
                    netPositive ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {summary
                    ? formatCurrency(summary.netAmount, currency)
                    : "—"}
                </CardTitle>
                <CardAction>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      netPositive ? "bg-emerald-500/10" : "bg-red-500/10"
                    }`}
                  >
                    <Wallet
                      className={`h-5 w-5 ${
                        netPositive ? "text-emerald-400" : "text-red-400"
                      }`}
                    />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-zinc-500">Income minus expenses</p>
              </CardContent>
            </Card>

            {/* Budget Usage */}
            <Card className="border-zinc-800 bg-zinc-900">
              <CardHeader>
                <CardDescription className="text-zinc-400">
                  Budget Usage
                </CardDescription>
                <CardTitle
                  className={`text-2xl font-bold ${
                    budgetUsagePct >= 90
                      ? "text-red-400"
                      : budgetUsagePct >= 75
                      ? "text-amber-400"
                      : "text-amber-300"
                  }`}
                >
                  {summary
                    ? `${budgetUsagePct.toFixed(1)}%`
                    : "—"}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                    <Target className="h-5 w-5 text-amber-400" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-zinc-500">Of total budget spent</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Budget Progress */}
            <Card className="border-zinc-800 bg-zinc-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-zinc-100">
                  <Target className="h-4 w-4 text-zinc-400" />
                  Budget Progress
                </CardTitle>
                <CardDescription className="text-zinc-500">
                  Top 5 categories this month
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topBudgets.length === 0 ? (
                  <p className="py-6 text-center text-sm text-zinc-500">
                    No budgets set for this month.
                  </p>
                ) : (
                  <div className="space-y-5">
                    {topBudgets.map((budget) => {
                      const spent = parseFloat(budget.spent ?? "0");
                      const amount = parseFloat(budget.amount);
                      const pct =
                        amount > 0
                          ? Math.min((spent / amount) * 100, 100)
                          : 0;
                      const barColor = budgetBarColor(pct);

                      return (
                        <div key={budget.id}>
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-sm font-medium text-zinc-200">
                              {budget.categoryName ?? "Unknown"}
                            </span>
                            <span className="text-xs text-zinc-400">
                              {formatCurrency(budget.spent ?? "0", currency)}{" "}
                              <span className="text-zinc-600">/</span>{" "}
                              {formatCurrency(budget.amount, currency)}
                            </span>
                          </div>
                          <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                            <div
                              className={`h-full rounded-full transition-all ${barColor}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="mt-1 text-right text-xs text-zinc-500">
                            {pct.toFixed(1)}%
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right Column */}
            <div className="flex flex-col gap-4">
              {/* Upcoming Subscriptions */}
              <Card className="border-zinc-800 bg-zinc-900">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-zinc-100">
                    <CreditCard className="h-4 w-4 text-zinc-400" />
                    Upcoming Subscriptions
                  </CardTitle>
                  <CardDescription className="text-zinc-500">
                    Renewals in the next 30 days
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {subscriptions.length === 0 ? (
                    <p className="py-4 text-center text-sm text-zinc-500">
                      No upcoming renewals.
                    </p>
                  ) : (
                    <div className="divide-y divide-zinc-800">
                      {subscriptions.map((sub) => {
                        const days = daysUntil(sub.nextRenewalDate);
                        const dayColor = subscriptionDayColor(days);

                        return (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-zinc-200">
                                {sub.name}
                              </p>
                              <p className={`text-xs font-medium ${dayColor}`}>
                                {days === 0
                                  ? "Due today"
                                  : days === 1
                                  ? "Due tomorrow"
                                  : `${days} days`}
                              </p>
                            </div>
                            <div className="ml-4 shrink-0 text-right">
                              <p className="text-sm font-semibold text-zinc-100">
                                {formatCurrency(sub.amount, sub.currency)}
                              </p>
                              <p className="text-xs capitalize text-zinc-500">
                                {sub.billingCycle}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Savings Goals */}
              <Card className="border-zinc-800 bg-zinc-900">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-zinc-100">
                    <PiggyBank className="h-4 w-4 text-zinc-400" />
                    Savings Goals
                  </CardTitle>
                  <CardDescription className="text-zinc-500">
                    Progress towards your targets
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {savingsGoals.length === 0 ? (
                    <p className="py-4 text-center text-sm text-zinc-500">
                      No savings goals yet.
                    </p>
                  ) : (
                    <div className="space-y-5">
                      {savingsGoals.map((goal) => {
                        const current = parseFloat(goal.currentAmount);
                        const target = parseFloat(goal.targetAmount);
                        const pct =
                          target > 0
                            ? Math.min((current / target) * 100, 100)
                            : 0;
                        const barColor = savingsBarColor(pct);

                        return (
                          <div key={goal.id}>
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-200">
                                {goal.icon && (
                                  <span className="text-base leading-none">
                                    {goal.icon}
                                  </span>
                                )}
                                {goal.name}
                              </span>
                              <span className="text-xs text-zinc-400">
                                {formatCurrency(goal.currentAmount, goal.currency)}{" "}
                                <span className="text-zinc-600">/</span>{" "}
                                {formatCurrency(goal.targetAmount, goal.currency)}
                              </span>
                            </div>
                            <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                              <div
                                className={`h-full rounded-full transition-all ${barColor}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="mt-1 text-right text-xs text-zinc-500">
                              {pct.toFixed(1)}%
                              {goal.targetDate && (
                                <span className="ml-2 text-zinc-600">
                                  · target {goal.targetDate}
                                </span>
                              )}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
