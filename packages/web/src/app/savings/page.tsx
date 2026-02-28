"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Target,
  PiggyBank,
  CalendarClock,
  Plus,
  Pencil,
  Trash2,
  HandCoins,
  Inbox,
} from "lucide-react";

import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { formatCurrency, formatDate, daysUntil, getToday } from "@/lib/format";
import { SUPPORTED_CURRENCIES } from "@centsible/shared";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DateOnlyInput } from "@/components/ui/date-input";

interface SavingsGoal {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  targetAmount: string;
  currentAmount: string;
  currency: string;
  targetDate: string;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SummaryTileSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col gap-3 animate-pulse">
      <div className="h-3 w-24 rounded bg-zinc-800" />
      <div className="h-7 w-32 rounded bg-zinc-800" />
      <div className="h-3 w-20 rounded bg-zinc-800" />
    </div>
  );
}

function GoalCardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded bg-zinc-800" />
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-5 w-32 rounded bg-zinc-800" />
          <div className="h-3 w-48 rounded bg-zinc-800" />
        </div>
      </div>
      <div className="h-2 w-full rounded bg-zinc-800" />
      <div className="flex justify-between">
        <div className="h-4 w-24 rounded bg-zinc-800" />
        <div className="h-4 w-16 rounded bg-zinc-800" />
      </div>
      <div className="h-3 w-28 rounded bg-zinc-800" />
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function GoalProgressBar({ pct }: { pct: number }) {
  const color =
    pct >= 100
      ? "bg-green-500"
      : pct >= 50
        ? "bg-emerald-500"
        : "bg-blue-500";

  return (
    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

// ─── Days Badge ───────────────────────────────────────────────────────────────

function DaysBadge({ targetDate }: { targetDate: string }) {
  const days = daysUntil(targetDate);

  if (days < 0) {
    return (
      <Badge className="bg-zinc-700 text-zinc-400 border-zinc-600 text-xs">
        Overdue
      </Badge>
    );
  }
  if (days < 30) {
    return (
      <Badge className="bg-red-900/60 text-red-300 border-red-700 text-xs">
        {days}d left
      </Badge>
    );
  }
  if (days < 60) {
    return (
      <Badge className="bg-amber-900/60 text-amber-300 border-amber-700 text-xs">
        {days}d left
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-900/60 text-green-300 border-green-700 text-xs">
      {days}d left
    </Badge>
  );
}

// ─── Default form state ───────────────────────────────────────────────────────

const emptyGoalForm = {
  name: "",
  description: "",
  targetAmount: "",
  currency: "GBP",
  targetDate: getToday(),
  icon: "",
};

const emptyContribForm = {
  amount: "",
  note: "",
  date: getToday(),
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SavingsPage() {
  const { user } = useAuthStore();

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);

  // dialogs
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [contributeDialogOpen, setContributeDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [targetGoal, setTargetGoal] = useState<SavingsGoal | null>(null);

  const [goalForm, setGoalForm] = useState({ ...emptyGoalForm });
  const [contribForm, setContribForm] = useState({ ...emptyContribForm });

  const [saving, setSaving] = useState(false);
  const [contributing, setContributing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadGoals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSavingsGoals();
      setGoals(res.data ?? []);
    } catch {
      toast.error("Failed to load savings goals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  // ── Summary helpers ───────────────────────────────────────────────────────

  const activeGoals = useMemo(() => goals.filter((g) => !g.archivedAt), [goals]);

  const totalSaved = useMemo(
    () => activeGoals.reduce((sum, g) => sum + parseFloat(g.currentAmount || "0"), 0),
    [activeGoals]
  );

  const nearestGoal = useMemo(
    () =>
      activeGoals
        .filter((g) => daysUntil(g.targetDate) >= 0)
        .sort((a, b) => daysUntil(a.targetDate) - daysUntil(b.targetDate))[0],
    [activeGoals]
  );

  // ── Goal dialog ───────────────────────────────────────────────────────────

  function openCreateGoal() {
    setEditingGoal(null);
    setGoalForm({
      ...emptyGoalForm,
      currency: user?.defaultCurrency ?? "GBP",
    });
    setGoalDialogOpen(true);
  }

  function openEditGoal(goal: SavingsGoal) {
    setEditingGoal(goal);
    setGoalForm({
      name: goal.name,
      description: goal.description ?? "",
      targetAmount: goal.targetAmount,
      currency: goal.currency,
      targetDate: formatDate(goal.targetDate),
      icon: goal.icon ?? "",
    });
    setGoalDialogOpen(true);
  }

  async function handleSaveGoal() {
    if (!goalForm.name.trim()) {
      toast.error("Goal name is required.");
      return;
    }
    const parsedAmount = parseFloat(goalForm.targetAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Target amount must be a positive number.");
      return;
    }
    if (!goalForm.targetDate) {
      toast.error("Target date is required.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: goalForm.name.trim(),
        description: goalForm.description.trim() || null,
        targetAmount: String(parsedAmount.toFixed(2)),
        currency: goalForm.currency,
        targetDate: goalForm.targetDate,
        icon: goalForm.icon.trim() || null,
      };

      if (editingGoal) {
        await api.updateSavingsGoal(editingGoal.id, body);
        toast.success("Savings goal updated.");
      } else {
        await api.createSavingsGoal(body);
        toast.success("Savings goal created.");
      }

      setGoalDialogOpen(false);
      await loadGoals();
    } catch {
      toast.error(editingGoal ? "Failed to update goal." : "Failed to create goal.");
    } finally {
      setSaving(false);
    }
  }

  // ── Contribute dialog ─────────────────────────────────────────────────────

  function openContribute(goal: SavingsGoal) {
    setTargetGoal(goal);
    setContribForm({ ...emptyContribForm });
    setContributeDialogOpen(true);
  }

  async function handleContribute() {
    if (!targetGoal) return;
    const parsedAmount = parseFloat(contribForm.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Contribution amount must be a positive number.");
      return;
    }
    if (!contribForm.date) {
      toast.error("Contribution date is required.");
      return;
    }

    setContributing(true);
    try {
      await api.contributeSavingsGoal(targetGoal.id, {
        amount: String(parsedAmount.toFixed(2)),
        currency: targetGoal.currency,
        note: contribForm.note.trim() || null,
        date: contribForm.date,
      });
      toast.success("Contribution added.");
      setContributeDialogOpen(false);
      await loadGoals();
    } catch {
      toast.error("Failed to add contribution.");
    } finally {
      setContributing(false);
    }
  }

  // ── Delete dialog ─────────────────────────────────────────────────────────

  function openDelete(goal: SavingsGoal) {
    setTargetGoal(goal);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!targetGoal) return;
    setDeleting(true);
    try {
      await api.deleteSavingsGoal(targetGoal.id);
      toast.success("Savings goal deleted.");
      setDeleteDialogOpen(false);
      await loadGoals();
    } catch {
      toast.error("Failed to delete savings goal.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Target className="size-6 text-emerald-400" />
            Savings Goals
          </h1>
          <p className="text-sm text-zinc-500">
            Track your progress toward financial milestones.
          </p>
        </div>
        <Button
          className="bg-emerald-600 text-white hover:bg-emerald-500"
          onClick={openCreateGoal}
        >
          <Plus className="size-4" />
          Add Goal
        </Button>
      </div>

      {/* Summary tiles */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryTileSkeleton />
          <SummaryTileSkeleton />
          <SummaryTileSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Saved */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex flex-col gap-1 pt-6">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 rounded-md bg-emerald-900/50">
                  <PiggyBank className="size-4 text-emerald-400" />
                </div>
                <p className="text-xs uppercase tracking-widest font-medium text-zinc-500">
                  Total Saved
                </p>
              </div>
              <p className="text-2xl font-bold font-mono text-zinc-100">
                {formatCurrency(totalSaved, user?.defaultCurrency ?? "GBP")}
              </p>
              <p className="text-xs text-zinc-600">across all active goals</p>
            </CardContent>
          </Card>

          {/* Active Goals */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex flex-col gap-1 pt-6">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 rounded-md bg-blue-900/50">
                  <Target className="size-4 text-blue-400" />
                </div>
                <p className="text-xs uppercase tracking-widest font-medium text-zinc-500">
                  Active Goals
                </p>
              </div>
              <p className="text-2xl font-bold font-mono text-zinc-100">
                {activeGoals.length}
              </p>
              <p className="text-xs text-zinc-600">
                {activeGoals.length === 1 ? "goal in progress" : "goals in progress"}
              </p>
            </CardContent>
          </Card>

          {/* Nearest Deadline */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="flex flex-col gap-1 pt-6">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 rounded-md bg-amber-900/50">
                  <CalendarClock className="size-4 text-amber-400" />
                </div>
                <p className="text-xs uppercase tracking-widest font-medium text-zinc-500">
                  Nearest Deadline
                </p>
              </div>
              {nearestGoal ? (
                <>
                  <p className="text-lg font-semibold text-zinc-100 truncate">
                    {nearestGoal.name}
                  </p>
                  <p className="text-xs text-zinc-500 font-mono">
                    {formatDate(nearestGoal.targetDate)} &mdash;{" "}
                    <span
                      className={
                        daysUntil(nearestGoal.targetDate) < 30
                          ? "text-red-400"
                          : daysUntil(nearestGoal.targetDate) < 60
                            ? "text-amber-400"
                            : "text-green-400"
                      }
                    >
                      {daysUntil(nearestGoal.targetDate)}d
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-sm text-zinc-600">No upcoming deadlines</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Goals Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <GoalCardSkeleton key={i} />
          ))}
        </div>
      ) : activeGoals.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 py-20 text-center">
          <Inbox className="size-12 text-zinc-600" />
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-zinc-300">No savings goals yet</p>
            <p className="text-sm text-zinc-500 max-w-xs">
              Create your first savings goal to start tracking progress toward your
              financial milestones.
            </p>
          </div>
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={openCreateGoal}
          >
            <Plus className="size-4" />
            Add Goal
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeGoals.map((goal) => {
            const current = parseFloat(goal.currentAmount || "0");
            const target = parseFloat(goal.targetAmount || "1");
            const pct = target > 0 ? (current / target) * 100 : 0;
            const pctDisplay = Math.min(pct, 100).toFixed(1);

            return (
              <Card key={goal.id} className="bg-zinc-900 border-zinc-800 flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {goal.icon ? (
                        <div className="text-2xl leading-none shrink-0 select-none">
                          {goal.icon}
                        </div>
                      ) : (
                        <div className="p-2 rounded-md bg-zinc-800 shrink-0">
                          <Target className="size-4 text-zinc-500" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <CardTitle className="text-zinc-100 text-base leading-tight truncate">
                          {goal.name}
                        </CardTitle>
                        {goal.description && (
                          <CardDescription className="text-zinc-500 text-xs mt-0.5 line-clamp-2">
                            {goal.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                        onClick={() => openEditGoal(goal)}
                        title="Edit goal"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                        onClick={() => openContribute(goal)}
                        title="Add contribution"
                      >
                        <HandCoins className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
                        onClick={() => openDelete(goal)}
                        title="Delete goal"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-3 pt-0 flex-1">
                  {/* Progress bar */}
                  <GoalProgressBar pct={pct} />

                  {/* Amounts */}
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-sm font-mono text-zinc-100 font-semibold">
                        {formatCurrency(current, goal.currency)}
                      </p>
                      <p className="text-xs text-zinc-500 font-mono">
                        of {formatCurrency(target, goal.currency)}
                      </p>
                    </div>
                    <span
                      className={`text-lg font-bold font-mono ${
                        pct >= 100
                          ? "text-green-400"
                          : pct >= 50
                            ? "text-emerald-400"
                            : "text-blue-400"
                      }`}
                    >
                      {pctDisplay}%
                    </span>
                  </div>

                  {/* Date + days */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-zinc-500 font-mono">
                      {formatDate(goal.targetDate)}
                    </span>
                    <DaysBadge targetDate={goal.targetDate} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Goal Dialog ───────────────────────────────────────── */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              {editingGoal ? "Edit Savings Goal" : "New Savings Goal"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-300">Name <span className="text-red-400">*</span></Label>
              <Input
                value={goalForm.name}
                onChange={(e) => setGoalForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Emergency Fund"
                className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-300">Description</Label>
              <Input
                value={goalForm.description}
                onChange={(e) =>
                  setGoalForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Optional description"
                className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>

            {/* Target amount + currency */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-zinc-300">Target Amount <span className="text-red-400">*</span></Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={goalForm.targetAmount}
                  onChange={(e) =>
                    setGoalForm((p) => ({ ...p, targetAmount: e.target.value }))
                  }
                  placeholder="0.00"
                  className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 font-mono"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-zinc-300">Currency <span className="text-red-400">*</span></Label>
                <Select
                  value={goalForm.currency}
                  onValueChange={(val) =>
                    setGoalForm((p) => ({ ...p, currency: val }))
                  }
                >
                  <SelectTrigger className="w-full border-zinc-700 bg-zinc-800/50 text-zinc-100">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                    {SUPPORTED_CURRENCIES.map((c: string) => (
                      <SelectItem key={c} value={c} className="focus:bg-zinc-800 focus:text-zinc-100 font-mono">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Target date */}
            <DateOnlyInput
              name="targetDate"
              label="Target Date"
              value={goalForm.targetDate}
              onChange={(val: string) =>
                setGoalForm((p) => ({ ...p, targetDate: val }))
              }
              required
            />

            {/* Icon */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-300">Icon (emoji, optional)</Label>
              <Input
                value={goalForm.icon}
                onChange={(e) => setGoalForm((p) => ({ ...p, icon: e.target.value }))}
                placeholder="e.g. 🏖️"
                maxLength={8}
                className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setGoalDialogOpen(false)}
              disabled={saving}
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveGoal}
              disabled={saving}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {saving ? "Saving…" : editingGoal ? "Save Changes" : "Create Goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Contribute Dialog ───────────────────────────────────────────────── */}
      <Dialog open={contributeDialogOpen} onOpenChange={setContributeDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              Add Contribution
              {targetGoal && (
                <span className="text-zinc-400 font-normal ml-2 text-base">
                  — {targetGoal.name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Amount */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-300">
                Amount ({targetGoal?.currency ?? ""}) <span className="text-red-400">*</span>
              </Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={contribForm.amount}
                onChange={(e) =>
                  setContribForm((p) => ({ ...p, amount: e.target.value }))
                }
                placeholder="0.00"
                className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 font-mono"
              />
            </div>

            {/* Date */}
            <DateOnlyInput
              name="contribDate"
              label="Date"
              value={contribForm.date}
              onChange={(val: string) =>
                setContribForm((p) => ({ ...p, date: val }))
              }
              required
            />

            {/* Note */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-300">Note (optional)</Label>
              <Input
                value={contribForm.note}
                onChange={(e) =>
                  setContribForm((p) => ({ ...p, note: e.target.value }))
                }
                placeholder="e.g. Monthly transfer"
                className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>

            {/* Progress preview */}
            {targetGoal && (
              <div className="rounded-md bg-zinc-800/60 border border-zinc-700 p-3 flex flex-col gap-2">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Current</span>
                  <span className="font-mono text-zinc-300">
                    {formatCurrency(
                      parseFloat(targetGoal.currentAmount || "0"),
                      targetGoal.currency
                    )}
                  </span>
                </div>
                {contribForm.amount && !isNaN(parseFloat(contribForm.amount)) && (
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>After contribution</span>
                    <span className="font-mono text-emerald-400">
                      {formatCurrency(
                        parseFloat(targetGoal.currentAmount || "0") +
                          parseFloat(contribForm.amount),
                        targetGoal.currency
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Target</span>
                  <span className="font-mono text-zinc-300">
                    {formatCurrency(
                      parseFloat(targetGoal.targetAmount || "0"),
                      targetGoal.currency
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setContributeDialogOpen(false)}
              disabled={contributing}
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              onClick={handleContribute}
              disabled={contributing}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {contributing ? "Adding…" : "Add Contribution"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ──────────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Delete Savings Goal</DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <p className="text-zinc-400 text-sm">
              Are you sure you want to delete{" "}
              <span className="text-zinc-100 font-semibold">
                {targetGoal?.name}
              </span>
              ? This action cannot be undone and all contribution history will be
              lost.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-700 text-white hover:bg-red-600"
            >
              {deleting ? "Deleting…" : "Delete Goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
