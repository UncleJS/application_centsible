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
} from "@/components/ui/card";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { useAuthStore } from "@/lib/store";
import { formatCurrency, daysUntil, monthsUntil } from "@/lib/format";
import { BILLING_CYCLE_MONTHS } from "@centsible/shared";
import type { RecurringIncome } from "@centsible/shared";

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
  amountInUserCurrency?: string;
  spentInUserCurrency?: string;
  userCurrency?: string;
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
  const [recurringIncome, setRecurringIncome] = useState<RecurringIncome[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [summaryRes, budgetsRes, subsRes, goalsRes, recurringIncomeRes] = await Promise.all([
          api.getMonthlySummary(undefined, undefined, { signal: controller.signal }),
          api.getBudgets(undefined, undefined, { signal: controller.signal }),
          api.getUpcomingSubscriptions(30),
          api.getSavingsGoals({ signal: controller.signal }),
          api.getRecurringIncome({ signal: controller.signal }),
        ]);
        setSummary(summaryRes.data);
        setBudgets(budgetsRes.data);
        setSubscriptions(subsRes.data);
        setSavingsGoals(goalsRes.data);
        setRecurringIncome(recurringIncomeRes.data ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Failed to load dashboard data."
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();

    return () => controller.abort();
  }, []);

  const totalMonthlyRecurringIncome = recurringIncome.reduce((sum, item) => {
    const cycleMonths = BILLING_CYCLE_MONTHS[item.billingCycle] ?? 1;
    return sum + parseFloat(item.amount) / cycleMonths;
  }, 0);

  const adjustedTotalIncome = summary
    ? parseFloat(summary.totalIncome) + totalMonthlyRecurringIncome
    : totalMonthlyRecurringIncome;

  const adjustedNet = summary
    ? adjustedTotalIncome - parseFloat(summary.totalExpenses)
    : 0;

  const netPositive = adjustedNet >= 0;

  // Compute budget usage % from loaded budgets
  const budgetUsagePct = (() => {
    const totalBudgeted = budgets.reduce(
      (s, b) => s + parseFloat(b.amountInUserCurrency ?? b.amount),
      0
    );
    const totalSpent = budgets.reduce(
      (s, b) => s + parseFloat(b.spentInUserCurrency ?? b.spent ?? "0"),
      0
    );
    return totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  })();

  const topBudgets = budgets.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description={
          user
            ? `Welcome back, ${user.name}. Here’s your current income, spending, budgets, and savings progress.`
            : "Your current income, spending, budgets, and savings progress."
        }
        action={
          <Button
            variant="outline"
            className="border-zinc-700 bg-zinc-950/40 text-zinc-200 hover:bg-zinc-800"
            onClick={() => window.location.reload()}
          >
            Refresh
          </Button>
        }
      />

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Income"
              value={summary ? formatCurrency(adjustedTotalIncome, currency) : "—"}
              hint={totalMonthlyRecurringIncome > 0 ? `This month · includes ${formatCurrency(totalMonthlyRecurringIncome, currency)} recurring` : "This month"}
              icon={TrendingUp}
              accentClassName="text-emerald-300"
            />
            <StatCard
              label="Total Expenses"
              value={summary ? formatCurrency(summary.totalExpenses, currency) : "—"}
              hint="This month"
              icon={TrendingDown}
              accentClassName="text-red-300"
            />
            <StatCard
              label="Net Savings"
              value={summary ? formatCurrency(adjustedNet, currency) : "—"}
              hint={savingsGoals.length > 0 ? (() => {
                const totalSaved = savingsGoals.reduce((s, g) => s + parseFloat(g.currentAmount || "0"), 0);
                const totalTarget = savingsGoals.reduce((s, g) => s + parseFloat(g.targetAmount || "0"), 0);
                return `Saved ${formatCurrency(totalSaved, currency)} of ${formatCurrency(totalTarget, currency)} target`;
              })() : "Income minus expenses"}
              icon={Wallet}
              accentClassName={netPositive ? "text-emerald-300" : "text-red-300"}
            />
            <StatCard
              label="Budget Usage"
              value={summary ? `${budgetUsagePct.toFixed(1)}%` : "—"}
              hint="Of total budget spent"
              icon={Target}
              accentClassName={budgetUsagePct >= 90 ? "text-red-300" : budgetUsagePct >= 75 ? "text-amber-300" : "text-yellow-200"}
            />
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
                        const remaining = Math.max(target - current, 0);
                        const months = monthsUntil(goal.targetDate);
                        const monthlyNeeded =
                          pct < 100 && months !== null && months > 0
                            ? remaining / months
                            : null;

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
                            {pct >= 100 ? (
                              <p className="text-xs font-medium text-green-400">Goal reached!</p>
                            ) : monthlyNeeded !== null ? (
                              <p className="text-xs text-zinc-500">
                                <span className="text-zinc-300 font-mono">
                                  {formatCurrency(monthlyNeeded, goal.currency)}
                                </span>
                                {" "}/mo needed
                              </p>
                            ) : daysUntil(goal.targetDate) < 0 ? (
                              <p className="text-xs text-zinc-600">Overdue</p>
                            ) : null}
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
