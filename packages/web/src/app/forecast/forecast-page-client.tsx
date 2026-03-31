"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  CreditCard,
  PiggyBank,
  TableIcon,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { formatCurrency, getMonthName, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ForecastItem {
  name: string;
  amount: string;
  currency: string;
  date: string;
  type: "subscription" | "recurring" | "savings" | "budget" | "recurring-income" | "income-budget";
  sourceId: number;
}

interface ForecastMonth {
  year: number;
  month: number;
  projectedExpenses: string;
  projectedIncome: string;
  subscriptionCosts: string;
  recurringIncomeSources: string;
  savingsContributions: string;
  totalProjected: string;
  items: ForecastItem[];
}

const TYPE_BADGE: Record<
  ForecastItem["type"],
  { label: string; className: string }
> = {
  subscription: {
    label: "Subscription",
    className:
      "bg-blue-950 text-blue-400 border border-blue-800 hover:bg-blue-950",
  },
  recurring: {
    label: "Recurring",
    className:
      "bg-purple-950 text-purple-400 border border-purple-800 hover:bg-purple-950",
  },
  savings: {
    label: "Savings",
    className:
      "bg-amber-950 text-amber-400 border border-amber-800 hover:bg-amber-950",
  },
  budget: {
    label: "Budget",
    className:
      "bg-emerald-950 text-emerald-400 border border-emerald-800 hover:bg-emerald-950",
  },
  "recurring-income": {
    label: "Recurring Income",
    className:
      "bg-emerald-950 text-emerald-400 border border-emerald-800 hover:bg-emerald-950",
  },
  "income-budget": {
    label: "Income Budget",
    className:
      "bg-teal-950 text-teal-400 border border-teal-800 hover:bg-teal-950",
  },
};

function TypeBadge({ type }: { type: ForecastItem["type"] }) {
  const config = TYPE_BADGE[type] ?? TYPE_BADGE.budget;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

function SummaryCardSkeleton() {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <div className="animate-pulse bg-zinc-800 rounded h-4 w-32 mb-2" />
        <div className="animate-pulse bg-zinc-800 rounded h-3 w-48" />
      </CardHeader>
      <CardContent>
        <div className="animate-pulse bg-zinc-800 rounded h-8 w-40" />
      </CardContent>
    </Card>
  );
}

function MonthCardSkeleton() {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <div className="animate-pulse bg-zinc-800 rounded h-5 w-28" />
        <div className="animate-pulse bg-zinc-800 rounded h-4 w-20 mt-1" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="animate-pulse bg-zinc-800 rounded h-4 w-full" />
        <div className="animate-pulse bg-zinc-800 rounded h-3 w-3/4" />
        <div className="animate-pulse bg-zinc-800 rounded h-3 w-2/3" />
      </CardContent>
    </Card>
  );
}

function StackedBar({
  subscriptions,
  expenses,
  savings,
  total,
}: {
  subscriptions: number;
  expenses: number;
  savings: number;
  total: number;
}) {
  if (total === 0) {
    return (
      <div className="h-3 w-full rounded-full bg-zinc-800 overflow-hidden" />
    );
  }
  const subPct = Math.round((subscriptions / total) * 100);
  const expPct = Math.round((expenses / total) * 100);
  const savPct = Math.round((savings / total) * 100);

  return (
    <div className="h-3 w-full rounded-full bg-zinc-800 overflow-hidden flex">
      {subPct > 0 && (
        <div
          className="bg-blue-500 h-full transition-all duration-500"
          style={{ width: `${subPct}%` }}
        />
      )}
      {expPct > 0 && (
        <div
          className="bg-red-500 h-full transition-all duration-500"
          style={{ width: `${expPct}%` }}
        />
      )}
      {savPct > 0 && (
        <div
          className="bg-amber-500 h-full transition-all duration-500"
          style={{ width: `${savPct}%` }}
        />
      )}
    </div>
  );
}

function MonthCard({
  data,
  currency,
}: {
  data: ForecastMonth;
  currency: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const total = parseFloat(data.totalProjected) || 0;
  const subs = parseFloat(data.subscriptionCosts) || 0;
  const expenses = parseFloat(data.projectedExpenses) || 0;
  const savings = parseFloat(data.savingsContributions) || 0;
  const income = parseFloat(data.projectedIncome) || 0;

  const sortedItems = [...(data.items ?? [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <Card className="bg-zinc-900 border-zinc-800 flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-zinc-100 text-base">
              {getMonthName(data.month)} {data.year}
            </CardTitle>
            <CardDescription className="text-zinc-400 text-xs mt-0.5">
              {sortedItems.length} item{sortedItems.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <span className={`text-xl font-semibold tabular-nums font-mono ${
            parseFloat(data.totalProjected) >= 0 ? "text-emerald-400" : "text-red-400"
          }`}>
            {formatCurrency(data.totalProjected, currency)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1">
        <StackedBar
          subscriptions={subs}
          expenses={expenses}
          savings={savings}
          total={total}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
              Subscriptions
            </span>
            <span className="text-zinc-200 tabular-nums font-mono">
              {formatCurrency(data.subscriptionCosts, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
              Expenses
            </span>
            <span className="text-zinc-200 tabular-nums font-mono">
              {formatCurrency(data.projectedExpenses, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
              Savings
            </span>
            <span className="text-zinc-200 tabular-nums font-mono">
              {formatCurrency(data.savingsContributions, currency)}
            </span>
          </div>
          {income > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-zinc-300">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Income
              </span>
              <span className="text-emerald-400 tabular-nums font-mono">
                +{formatCurrency(data.projectedIncome, currency)}
              </span>
            </div>
          )}
        </div>
      </CardContent>

      {sortedItems.length > 0 && (
        <CardFooter className="pt-0 flex-col gap-0 px-0">
          <Separator className="bg-zinc-800 mb-0" />
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-3 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 transition-colors rounded-b-xl"
          >
            <span>{expanded ? "Hide" : "Show"} items</span>
            {expanded ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </button>

          {expanded && (
            <div className="w-full px-4 pb-4 space-y-1">
              {sortedItems.map((item, idx) => (
                <div
                  key={`${item.sourceId}-${idx}`}
                  className="flex items-center justify-between py-1.5 border-b border-zinc-800/60 last:border-0 gap-2"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm text-zinc-200 truncate">
                      {item.name}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">
                      {formatDate(item.date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <TypeBadge type={item.type} />
                    <span className="text-sm text-zinc-200 tabular-nums font-mono">
                      {formatCurrency(item.amount, item.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

export default function ForecastPage() {
  const { user } = useAuthStore();
  const currency = user?.defaultCurrency ?? "GBP";

  const [horizon, setHorizon] = useState<string>("6");
  const [forecastData, setForecastData] = useState<ForecastMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllItems, setShowAllItems] = useState(false);

  const loadForecast = useCallback(
    async (months: number) => {
      setLoading(true);
      try {
        const result = await api.getForecast(months);
        setForecastData(result.data ?? []);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Failed to load forecast";
        toast.error(msg);
        setForecastData([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadForecast(parseInt(horizon, 10));
  }, [horizon, loadForecast]);

  // Totals across all months
  const totals = forecastData.reduce(
    (acc, m) => {
      acc.projected += (parseFloat(m.subscriptionCosts) || 0) + (parseFloat(m.projectedExpenses) || 0) + (parseFloat(m.savingsContributions) || 0);
      acc.subscriptions += parseFloat(m.subscriptionCosts) || 0;
      acc.savings += parseFloat(m.savingsContributions) || 0;
      acc.income += parseFloat(m.projectedIncome) || 0;
      return acc;
    },
    { projected: 0, subscriptions: 0, savings: 0, income: 0 }
  );

  // All items sorted by date
  const allItems: (ForecastItem & { monthLabel: string })[] = forecastData
    .flatMap((m) =>
      (m.items ?? []).map((item) => ({
        ...item,
        monthLabel: `${getMonthName(m.month)} ${m.year}`,
      }))
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const isEmpty = !loading && forecastData.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Insights"
        title="Forward Forecast"
        description="Projected income and costs based on subscriptions, budgets, recurring income, and savings goals."
        action={<div className="flex items-center gap-3">
          <Label className="text-zinc-300 text-sm shrink-0">
            Horizon
          </Label>
          <Select
            value={horizon}
            onValueChange={(val) => setHorizon(val)}
          >
            <SelectTrigger className="w-36 border-zinc-700 bg-zinc-800/50 text-zinc-100">
              <SelectValue placeholder="Select months" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
              <SelectItem value="3" className="focus:bg-zinc-800 focus:text-zinc-100">3 months</SelectItem>
              <SelectItem value="6" className="focus:bg-zinc-800 focus:text-zinc-100">6 months</SelectItem>
              <SelectItem value="12" className="focus:bg-zinc-800 focus:text-zinc-100">12 months</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="icon-sm"
            variant="outline"
            className="border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
            onClick={() => loadForecast(parseInt(horizon, 10))}
            disabled={loading}
            title="Refresh forecast"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Projected Expenses"
              value={formatCurrency(totals.projected.toFixed(2), currency)}
              hint={`Over ${horizon} month${horizon !== "1" ? "s" : ""}`}
              icon={TrendingUp}
              accentClassName="text-red-300"
            />
            <StatCard
              label="Subscription Costs"
              value={formatCurrency(totals.subscriptions.toFixed(2), currency)}
              hint={`Over ${horizon} month${horizon !== "1" ? "s" : ""}`}
              icon={CreditCard}
            />
            <StatCard
              label="Savings Contributions"
              value={formatCurrency(totals.savings.toFixed(2), currency)}
              hint={`Over ${horizon} month${horizon !== "1" ? "s" : ""}`}
              icon={PiggyBank}
              accentClassName="text-amber-300"
            />
            <StatCard
              label="Projected Income"
              value={formatCurrency(totals.income.toFixed(2), currency)}
              hint={`Over ${horizon} month${horizon !== "1" ? "s" : ""}`}
              icon={TrendingUp}
              accentClassName="text-emerald-300"
            />
          </>
        )}
      </div>

      {/* Empty State */}
      {isEmpty && (
        <EmptyState
          icon={TrendingUp}
          title="No forecast data available"
          description="Add subscriptions, recurring income, budgets, or savings goals to generate a forward projection."
        />
      )}

      {/* Monthly Grid */}
      {!isEmpty && (
        <div>
          <h2 className="text-base font-semibold text-zinc-200 mb-4">
            Monthly Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading
              ? Array.from({ length: parseInt(horizon, 10) }).map((_, i) => (
                  <MonthCardSkeleton key={i} />
                ))
              : forecastData.map((month) => (
                  <MonthCard
                    key={`${month.year}-${month.month}`}
                    data={month}
                    currency={currency}
                  />
                ))}
          </div>
        </div>
      )}

      {/* All Items Table */}
      {!loading && allItems.length > 0 && (
        <div>
          <button
            onClick={() => setShowAllItems((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
          >
            <span className="flex items-center gap-2 font-medium">
              <TableIcon className="size-4 text-zinc-500" />
              All Forecast Items
              <span className="ml-1 text-xs text-zinc-500 font-normal">
                ({allItems.length})
              </span>
            </span>
            {showAllItems ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </button>

          {showAllItems && (
            <div className="mt-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400 font-medium w-32 pl-6">
                      Date
                    </TableHead>
                    <TableHead className="text-zinc-400 font-medium">
                      Name
                    </TableHead>
                    <TableHead className="text-zinc-400 font-medium w-36 hidden sm:table-cell">
                      Month
                    </TableHead>
                    <TableHead className="text-zinc-400 font-medium w-36">
                      Type
                    </TableHead>
                    <TableHead className="text-zinc-400 font-medium text-right w-32 pr-6">
                      Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allItems.map((item, idx) => (
                    <TableRow
                      key={`all-${item.sourceId}-${idx}`}
                      className="border-zinc-800 hover:bg-zinc-800/40 transition-colors"
                    >
                      <TableCell className="text-zinc-400 text-sm tabular-nums font-mono pl-6">
                        {formatDate(item.date)}
                      </TableCell>
                      <TableCell className="text-zinc-200 text-sm font-medium">
                        {item.name}
                      </TableCell>
                      <TableCell className="text-zinc-500 text-sm hidden sm:table-cell">
                        {item.monthLabel}
                      </TableCell>
                      <TableCell>
                        <TypeBadge type={item.type} />
                      </TableCell>
                      <TableCell className="text-right text-zinc-200 text-sm tabular-nums font-mono pr-6">
                        {formatCurrency(item.amount, item.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
