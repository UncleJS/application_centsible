"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Download, TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown, BarChart3 } from "lucide-react";

import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { formatCurrency, getMonthName } from "@/lib/format";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryRow {
  categoryId: number;
  categoryName: string;
  totalAmount: string;
  budgetAmount: string | null;
  percentUsed: number | null;
  transactionCount: number;
}

interface MonthlySummary {
  year: number;
  month: number;
  totalIncome: string;
  totalExpenses: string;
  netAmount: string;
  byCategory: CategoryRow[];
}

interface TrendRow {
  year: number;
  month: number;
  income: string;
  expenses: string;
  net: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const TREND_HORIZONS = [3, 6, 12] as const;
type TrendHorizon = (typeof TREND_HORIZONS)[number];

// ─── Skeleton helpers ─────────────────────────────────────────────────────────

function SummaryCardSkeleton() {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <div className="animate-pulse bg-zinc-800 rounded h-4 w-24 mb-2" />
        <div className="animate-pulse bg-zinc-800 rounded h-7 w-32" />
      </CardHeader>
    </Card>
  );
}

function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="animate-pulse bg-zinc-800 rounded h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  title,
  amount,
  currency,
  colorClass,
  icon,
}: {
  title: string;
  amount: string;
  currency: string;
  colorClass: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-zinc-400">{title}</CardTitle>
          <span className={colorClass}>{icon}</span>
        </div>
        <p className={`text-2xl font-bold mt-1 ${colorClass}`}>
          {formatCurrency(amount, currency)}
        </p>
      </CardHeader>
    </Card>
  );
}

function PercentBar({ percent }: { percent: number | null }) {
  if (percent === null) {
    return <span className="text-zinc-600 text-xs">—</span>;
  }

  const clamped = Math.min(percent, 100);
  const colorClass =
    percent >= 90
      ? "bg-red-500"
      : percent >= 75
      ? "bg-amber-500"
      : "bg-emerald-500";

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span
        className={`text-xs font-medium w-10 text-right ${
          percent >= 90
            ? "text-red-400"
            : percent >= 75
            ? "text-amber-400"
            : "text-emerald-400"
        }`}
      >
        {percent.toFixed(1)}%
      </span>
    </div>
  );
}

function MoMBadge({ current, previous }: { current: string; previous: string | undefined }) {
  if (!previous) return <span className="text-zinc-600 text-xs">—</span>;

  const curr = parseFloat(current);
  const prev = parseFloat(previous);
  if (prev === 0) return <span className="text-zinc-600 text-xs">—</span>;

  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  const up = pct > 0;
  const neutral = Math.abs(pct) < 0.01;

  if (neutral) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-zinc-400">
        <Minus className="size-3" /> 0.0%
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        up ? "text-red-400" : "text-emerald-400"
      }`}
    >
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ─── Stacked Bar Chart ────────────────────────────────────────────────────────

function TrendBarChart({ data, currency }: { data: TrendRow[]; currency: string }) {
  if (!data.length) return null;

  const maxVal = Math.max(
    ...data.flatMap((r) => [Math.abs(parseFloat(r.income)), Math.abs(parseFloat(r.expenses))])
  );

  if (maxVal === 0) return null;

  return (
    <div className="mt-2 mb-6">
      <div className="flex items-end gap-2 h-40 px-1">
        {data.map((row) => {
          const income = Math.abs(parseFloat(row.income));
          const expenses = Math.abs(parseFloat(row.expenses));
          const incomeH = (income / maxVal) * 100;
          const expenseH = (expenses / maxVal) * 100;

          return (
            <div key={`${row.year}-${row.month}`} className="flex-1 flex flex-col items-center gap-1">
              {/* bars */}
              <div className="w-full flex gap-0.5 items-end h-32">
                {/* income bar */}
                <div className="flex-1 flex items-end">
                  <div
                    title={`Income: ${formatCurrency(row.income, currency)}`}
                    className="w-full rounded-t bg-emerald-600/80 hover:bg-emerald-500 transition-colors cursor-default"
                    style={{ height: `${incomeH}%`, minHeight: incomeH > 0 ? 2 : 0 }}
                  />
                </div>
                {/* expense bar */}
                <div className="flex-1 flex items-end">
                  <div
                    title={`Expenses: ${formatCurrency(row.expenses, currency)}`}
                    className="w-full rounded-t bg-red-600/80 hover:bg-red-500 transition-colors cursor-default"
                    style={{ height: `${expenseH}%`, minHeight: expenseH > 0 ? 2 : 0 }}
                  />
                </div>
              </div>
              {/* label */}
              <span className="text-zinc-500 text-[10px] leading-tight text-center whitespace-nowrap">
                {getMonthName(row.month).slice(0, 3)}
                <br />
                {row.year}
              </span>
            </div>
          );
        })}
      </div>
      {/* legend */}
      <div className="flex items-center gap-4 mt-1 px-1">
        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-600/80" />
          Income
        </span>
        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-600/80" />
          Expenses
        </span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { user } = useAuthStore();
  const currency = user?.defaultCurrency ?? "GBP";

  // Month/Year selector
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState<number>(CURRENT_MONTH);

  // Data
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(false);

  const [trendData, setTrendData] = useState<TrendRow[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState(false);
  const [trendHorizon, setTrendHorizon] = useState<TrendHorizon>(6);

  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // ── Fetch monthly summary ──────────────────────────────────────────────────

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(false);
    try {
      const res = await api.getMonthlySummary(selectedYear, selectedMonth);
      setSummary(res.data);
    } catch (err: unknown) {
      setSummaryError(true);
      toast.error(err instanceof Error ? err.message : "Failed to load monthly summary.");
    } finally {
      setSummaryLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  // ── Fetch trend data ───────────────────────────────────────────────────────

  const fetchTrend = useCallback(async () => {
    setTrendLoading(true);
    setTrendError(false);
    try {
      const res = await api.getTrend(trendHorizon);
      setTrendData(res.data ?? []);
    } catch (err: unknown) {
      setTrendError(true);
      toast.error(err instanceof Error ? err.message : "Failed to load trend data.");
    } finally {
      setTrendLoading(false);
    }
  }, [trendHorizon]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (activeTab === "trends") {
      fetchTrend();
    }
  }, [activeTab, fetchTrend]);

  // ── CSV Export ─────────────────────────────────────────────────────────────

  const handleExport = async () => {
    setExporting(true);
    try {
      const csv = await api.exportCsv(selectedYear, selectedMonth);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `centsible-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported successfully.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to export CSV.");
    } finally {
      setExporting(false);
    }
  };

  // ── Net amount color ───────────────────────────────────────────────────────

  const netColorClass = () => {
    if (!summary) return "text-zinc-100";
    const net = parseFloat(summary.netAmount);
    return net >= 0 ? "text-emerald-400" : "text-red-400";
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <BarChart3 className="size-6 text-emerald-400" />
            Reports & Analytics
          </h1>
          <p className="text-sm text-zinc-500">
            Review your income, expenses, and spending trends.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {/* Year selector */}
          <div className="flex flex-col gap-1">
            <Label className="text-zinc-400 text-xs uppercase tracking-wide">Year</Label>
            <Select
              value={String(selectedYear)}
              onValueChange={(v) => setSelectedYear(Number(v))}
            >
              <SelectTrigger className="w-[96px] border-zinc-700 bg-zinc-800/50 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)} className="focus:bg-zinc-800 focus:text-zinc-100">
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Month selector */}
          <div className="flex flex-col gap-1">
            <Label className="text-zinc-400 text-xs uppercase tracking-wide">Month</Label>
            <Select
              value={String(selectedMonth)}
              onValueChange={(v) => setSelectedMonth(Number(v))}
            >
              <SelectTrigger className="w-[128px] border-zinc-700 bg-zinc-800/50 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                {MONTHS.map((m) => (
                  <SelectItem key={m} value={String(m)} className="focus:bg-zinc-800 focus:text-zinc-100">
                    {getMonthName(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Export button */}
          <Button
            onClick={handleExport}
            disabled={exporting || summaryLoading}
            className="bg-emerald-600 text-white hover:bg-emerald-500 gap-2"
          >
            <Download className="size-4" />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="categories">Category Breakdown</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════════════
            TAB: OVERVIEW
        ════════════════════════════════════════════════ */}
        <TabsContent value="overview" className="space-y-6">
          {summaryLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
            </div>
          ) : summaryError ? (
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-10 text-center">
              <p className="text-red-400 font-medium">Failed to load summary.</p>
              <p className="text-zinc-500 text-sm mt-1">
                Check your connection and try again.
              </p>
              <Button
                variant="outline"
                className="mt-4 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                onClick={fetchSummary}
              >
                Retry
              </Button>
            </div>
          ) : !summary ? (
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-10 text-center">
              <p className="text-zinc-400">No data for {getMonthName(selectedMonth)} {selectedYear}.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard
                  title="Total Income"
                  amount={summary.totalIncome}
                  currency={currency}
                  colorClass="text-green-400"
                  icon={<TrendingUp className="size-5" />}
                />
                <SummaryCard
                  title="Total Expenses"
                  amount={summary.totalExpenses}
                  currency={currency}
                  colorClass="text-red-400"
                  icon={<TrendingDown className="size-5" />}
                />
                <SummaryCard
                  title="Net Amount"
                  amount={summary.netAmount}
                  currency={currency}
                  colorClass={netColorClass()}
                  icon={
                    parseFloat(summary.netAmount) >= 0 ? (
                      <TrendingUp className="size-5" />
                    ) : (
                      <TrendingDown className="size-5" />
                    )
                  }
                />
              </div>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-base text-zinc-100">
                    {getMonthName(selectedMonth)} {selectedYear} — Summary
                  </CardTitle>
                  <CardDescription className="text-zinc-500">
                    {summary.byCategory.length} spending{" "}
                    {summary.byCategory.length === 1 ? "category" : "categories"} recorded.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {summary.byCategory.length === 0 ? (
                    <p className="text-zinc-500 text-sm">No category data available.</p>
                  ) : (
                    <div className="space-y-3">
                      {summary.byCategory.map((cat) => (
                        <div key={cat.categoryId} className="flex items-center gap-3">
                          <span className="text-zinc-300 text-sm w-36 truncate shrink-0">
                            {cat.categoryName}
                          </span>
                          <div className="flex-1">
                            <PercentBar percent={cat.percentUsed} />
                          </div>
                          <span className="text-zinc-400 text-sm text-right w-28 shrink-0">
                            {formatCurrency(cat.totalAmount, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════
            TAB: CATEGORY BREAKDOWN
        ════════════════════════════════════════════════ */}
        <TabsContent value="categories" className="space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-base text-zinc-100">Category Breakdown</CardTitle>
              <CardDescription className="text-zinc-500">
                {getMonthName(selectedMonth)} {selectedYear}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {summaryLoading ? (
                <div className="p-6">
                  <TableSkeleton rows={6} cols={5} />
                </div>
              ) : summaryError ? (
                <div className="p-10 text-center">
                  <p className="text-red-400 font-medium">Failed to load data.</p>
                  <Button
                    variant="outline"
                    className="mt-4 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    onClick={fetchSummary}
                  >
                    Retry
                  </Button>
                </div>
              ) : !summary || summary.byCategory.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-zinc-400">
                    No category data for {getMonthName(selectedMonth)} {selectedYear}.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-400 font-medium pl-6">Category</TableHead>
                        <TableHead className="text-zinc-400 font-medium text-right">Total Amount</TableHead>
                        <TableHead className="text-zinc-400 font-medium text-right">Budget</TableHead>
                        <TableHead className="text-zinc-400 font-medium">% Used</TableHead>
                        <TableHead className="text-zinc-400 font-medium text-right pr-6">Transactions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.byCategory.map((cat) => (
                        <TableRow
                          key={cat.categoryId}
                          className="border-zinc-800 hover:bg-zinc-800/40"
                        >
                          <TableCell className="text-zinc-100 font-medium pl-6">
                            {cat.categoryName}
                          </TableCell>
                          <TableCell className="text-right text-zinc-300">
                            {formatCurrency(cat.totalAmount, currency)}
                          </TableCell>
                          <TableCell className="text-right text-zinc-400">
                            {cat.budgetAmount
                              ? formatCurrency(cat.budgetAmount, currency)
                              : <span className="text-zinc-600">—</span>}
                          </TableCell>
                          <TableCell>
                            <PercentBar percent={cat.percentUsed} />
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <Badge
                              variant="secondary"
                              className="bg-zinc-800 text-zinc-300 border-zinc-700"
                            >
                              {cat.transactionCount}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════════════════════════════
            TAB: TRENDS
        ════════════════════════════════════════════════ */}
        <TabsContent value="trends" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Income vs Expenses Over Time</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Month-over-month financial trends</p>
            </div>
            {/* Horizon selector */}
            <div className="flex items-center gap-2">
              <Label className="text-zinc-400 text-xs whitespace-nowrap">Horizon</Label>
              <Select
                value={String(trendHorizon)}
                onValueChange={(v) => setTrendHorizon(Number(v) as TrendHorizon)}
              >
                <SelectTrigger className="w-[110px] border-zinc-700 bg-zinc-800/50 text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                  {TREND_HORIZONS.map((h) => (
                    <SelectItem key={h} value={String(h)} className="focus:bg-zinc-800 focus:text-zinc-100">
                      {h} months
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              {trendLoading ? (
                <div className="space-y-4">
                  <div className="h-40 flex items-end gap-2">
                    {Array.from({ length: trendHorizon }).map((_, i) => (
                      <div key={i} className="flex-1 flex gap-0.5 items-end h-full">
                        <div className="flex-1 animate-pulse bg-zinc-800 rounded-t" style={{ height: `${40 + (i * 10) % 60}%` }} />
                        <div className="flex-1 animate-pulse bg-zinc-800 rounded-t" style={{ height: `${30 + (i * 15) % 50}%` }} />
                      </div>
                    ))}
                  </div>
                  <TableSkeleton rows={trendHorizon} cols={5} />
                </div>
              ) : trendError ? (
                <div className="py-10 text-center">
                  <p className="text-red-400 font-medium">Failed to load trend data.</p>
                  <Button
                    variant="outline"
                    className="mt-4 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    onClick={fetchTrend}
                  >
                    Retry
                  </Button>
                </div>
              ) : trendData.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-zinc-400">No trend data available.</p>
                </div>
              ) : (
                <>
                  {/* Stacked bar chart */}
                  <TrendBarChart data={trendData} currency={currency} />

                  <Separator className="bg-zinc-800 mb-4" />

                  {/* Trend table */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-zinc-800 hover:bg-transparent">
                          <TableHead className="text-zinc-400 font-medium">Month</TableHead>
                          <TableHead className="text-zinc-400 font-medium text-right">Income</TableHead>
                          <TableHead className="text-zinc-400 font-medium text-right">Expenses</TableHead>
                          <TableHead className="text-zinc-400 font-medium text-right">Net</TableHead>
                          <TableHead className="text-zinc-400 font-medium text-right">MoM Expenses</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trendData.map((row, idx) => {
                          const prev = trendData[idx - 1];
                          const net = parseFloat(row.net);

                          return (
                            <TableRow
                              key={`${row.year}-${row.month}`}
                              className="border-zinc-800 hover:bg-zinc-800/40"
                            >
                              <TableCell className="text-zinc-100 font-medium">
                                {getMonthName(row.month)} {row.year}
                              </TableCell>
                              <TableCell className="text-right text-green-400">
                                {formatCurrency(row.income, currency)}
                              </TableCell>
                              <TableCell className="text-right text-red-400">
                                {formatCurrency(row.expenses, currency)}
                              </TableCell>
                              <TableCell
                                className={`text-right font-medium ${
                                  net >= 0 ? "text-emerald-400" : "text-red-400"
                                }`}
                              >
                                {formatCurrency(row.net, currency)}
                              </TableCell>
                              <TableCell className="text-right">
                                <MoMBadge
                                  current={row.expenses}
                                  previous={prev?.expenses}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
