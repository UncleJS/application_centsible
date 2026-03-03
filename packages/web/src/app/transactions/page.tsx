"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { formatCurrency, formatDate, getToday } from "@/lib/format";
import { toast } from "sonner";
import { DateOnlyInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

const PAGE_SIZE = 20;

interface Transaction {
  id: number;
  description: string;
  amount: string;
  type: "income" | "expense";
  categoryId: number;
  date: string;
  category?: {
    id: number;
    name: string;
    type: "income" | "expense";
    icon: string;
  };
}

interface Category {
  id: number;
  name: string;
  type: "income" | "expense";
  icon: string | null;
}

interface FormState {
  description: string;
  amount: string;
  type: "income" | "expense";
  categoryId: string;
  date: string;
}

const EMPTY_FORM: FormState = {
  description: "",
  amount: "",
  type: "expense",
  categoryId: "",
  date: getToday(),
};

export default function TransactionsPage() {
  const { user } = useAuthStore();
  const currency = user?.defaultCurrency ?? "USD";

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingTx, setLoadingTx] = useState(true);
  const [loadingCats, setLoadingCats] = useState(true);

  const [filterType, setFilterType] = useState<"" | "income" | "expense">("");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [searchRaw, setSearchRaw] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api
      .getCategories()
      .then((res) => setCategories(res.data))
      .catch(() => toast.error("Failed to load categories"))
      .finally(() => setLoadingCats(false));
  }, []);

  const loadTransactions = useCallback(
    async (page: number) => {
      setLoadingTx(true);
      try {
        const params: Record<string, string> = {
          page: String(page),
          pageSize: String(PAGE_SIZE),
        };
        if (filterType) params.type = filterType;
        if (filterCategoryId) params.categoryId = filterCategoryId;
        if (filterFrom) params.dateFrom = filterFrom;
        if (filterTo) params.dateTo = filterTo;
        if (search) params.search = search;

        const res = await api.getTransactions(params);
        setTransactions(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        setCurrentPage(res.page);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to load transactions");
      } finally {
        setLoadingTx(false);
      }
    },
    [filterType, filterCategoryId, filterFrom, filterTo, search]
  );

  useEffect(() => {
    setCurrentPage(1);
    loadTransactions(1);
  }, [filterType, filterCategoryId, filterFrom, filterTo, search, loadTransactions]);

  const handleSearchChange = (value: string) => {
    setSearchRaw(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setSearch(value.trim());
    }, 400);
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, []);

  const openAddDialog = () => {
    setEditingTx(null);
    setForm({ ...EMPTY_FORM, date: getToday() });
    setDialogOpen(true);
  };

  const openEditDialog = (tx: Transaction) => {
    setEditingTx(tx);
    setForm({
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      categoryId: String(tx.categoryId),
      date: formatDate(tx.date),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.description.trim()) {
      toast.error("Description is required");
      return;
    }
    const parsedAmount = parseFloat(form.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid positive amount");
      return;
    }
    if (!form.categoryId) {
      toast.error("Please select a category");
      return;
    }
    if (!form.date) {
      toast.error("Please select a date");
      return;
    }

    const body: Record<string, unknown> = {
      description: form.description.trim(),
      amount: String(parseFloat(form.amount).toFixed(2)),
      type: form.type,
      categoryId: Number(form.categoryId),
      date: form.date,
    };
    setSubmitting(true);
    try {
      if (editingTx) {
        await api.updateTransaction(editingTx.id, body);
        toast.success("Transaction updated");
      } else {
        await api.createTransaction(body);
        toast.success("Transaction added");
      }
      setDialogOpen(false);
      loadTransactions(currentPage);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save transaction");
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (tx: Transaction) => {
    setDeletingTx(tx);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingTx) return;
    setDeleting(true);
    try {
      await api.deleteTransaction(deletingTx.id);
      toast.success("Transaction deleted");
      setDeleteDialogOpen(false);
      setDeletingTx(null);
      const newPage =
        transactions.length === 1 && currentPage > 1
          ? currentPage - 1
          : currentPage;
      loadTransactions(newPage);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete transaction");
    } finally {
      setDeleting(false);
    }
  };

  const findCategory = (id: number) =>
    categories.find((c) => c.id === id);

  const filteredFormCategories = categories.filter(
    (c) => c.type === form.type
  );

  const handleFormTypeChange = (value: "income" | "expense") => {
    setForm((prev) => ({ ...prev, type: value, categoryId: "" }));
  };

  const clearFilters = () => {
    setFilterType("");
    setFilterCategoryId("");
    setFilterFrom("");
    setFilterTo("");
    setSearchRaw("");
    setSearch("");
  };

  const hasActiveFilters =
    !!filterType ||
    !!filterCategoryId ||
    !!filterFrom ||
    !!filterTo ||
    !!search;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">
            Transactions
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {loadingTx ? (
              <span className="inline-block h-4 w-24 animate-pulse rounded bg-zinc-800" />
            ) : (
              `${total} transaction${total !== 1 ? "s" : ""} found`
            )}
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog}>
              <Plus className="size-4" />
              Add Transaction
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingTx ? "Edit Transaction" : "Add Transaction"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tx-description">
                  Description <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="tx-description"
                  placeholder="e.g. Grocery shopping"
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tx-amount">
                  Amount <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="tx-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, amount: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>
                  Type <span className="text-red-400">*</span>
                </Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    handleFormTypeChange(v as "income" | "expense")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>
                  Category <span className="text-red-400">*</span>
                </Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, categoryId: v }))
                  }
                  disabled={loadingCats}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        loadingCats ? "Loading…" : "Select category"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredFormCategories.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No categories for this type
                      </SelectItem>
                    ) : (
                      filteredFormCategories.map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>
                          {cat.icon && <span className="mr-1">{cat.icon}</span>}
                          {cat.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <DateOnlyInput
                name="tx-date"
                label="Date"
                value={form.date}
                onChange={(v) => setForm((p) => ({ ...p, date: v }))}
                required
              />

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {editingTx ? "Save Changes" : "Add Transaction"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1.5 min-w-[130px]">
              <Label className="text-zinc-400 text-xs uppercase tracking-wide">
                Type
              </Label>
              <Select
                value={filterType || "all"}
                onValueChange={(v) =>
                  setFilterType(v === "all" ? "" : (v as "income" | "expense"))
                }
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5 min-w-[160px]">
              <Label className="text-zinc-400 text-xs uppercase tracking-wide">
                Category
              </Label>
              <Select
                value={filterCategoryId || "all"}
                onValueChange={(v) =>
                  setFilterCategoryId(v === "all" ? "" : v)
                }
                disabled={loadingCats}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories
                    .filter((c) => !filterType || c.type === filterType)
                    .map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.icon && <span className="mr-1">{cat.icon}</span>}
                        {cat.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-400 text-xs uppercase tracking-wide">
                From
              </Label>
              <DateOnlyInput
                name="filter-from"
                value={filterFrom}
                onChange={(v) => setFilterFrom(v)}
                className="w-[150px]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-400 text-xs uppercase tracking-wide">
                To
              </Label>
              <DateOnlyInput
                name="filter-to"
                value={filterTo}
                onChange={(v) => setFilterTo(v)}
                className="w-[150px]"
              />
            </div>

            <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
              <Label className="text-zinc-400 text-xs uppercase tracking-wide">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500 pointer-events-none" />
                <Input
                  placeholder="Search description…"
                  value={searchRaw}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-zinc-400 hover:text-zinc-100 self-end"
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-zinc-100">Transactions</CardTitle>
          <CardAction>
            {!loadingTx && totalPages > 1 && (
              <span className="text-sm text-zinc-400">
                Page {currentPage} of {totalPages}
              </span>
            )}
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800">
                <TableHead className="pl-6 text-zinc-400">Date</TableHead>
                <TableHead className="text-zinc-400">Description</TableHead>
                <TableHead className="text-zinc-400">Category</TableHead>
                <TableHead className="text-zinc-400">Type</TableHead>
                <TableHead className="text-right text-zinc-400">
                  Amount
                </TableHead>
                <TableHead className="pr-6 text-right text-zinc-400">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingTx ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-zinc-800">
                    <TableCell className="pl-6">
                      <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-40 animate-pulse rounded bg-zinc-800" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-28 animate-pulse rounded bg-zinc-800" />
                    </TableCell>
                    <TableCell>
                      <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-800" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="ml-auto h-4 w-20 animate-pulse rounded bg-zinc-800" />
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="ml-auto h-8 w-16 animate-pulse rounded bg-zinc-800" />
                    </TableCell>
                  </TableRow>
                ))
              ) : transactions.length === 0 ? (
                <TableRow className="border-zinc-800">
                  <TableCell
                    colSpan={6}
                    className="py-16 text-center text-zinc-500"
                  >
                    {hasActiveFilters
                      ? "No transactions match your filters."
                      : "No transactions yet. Add your first one!"}
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => {
                  const cat =
                    tx.category ?? findCategory(tx.categoryId);
                  return (
                    <TableRow
                      key={tx.id}
                      className="border-zinc-800 hover:bg-zinc-800/40 transition-colors"
                    >
                      <TableCell className="pl-6 font-mono text-zinc-300 text-sm">
                        {formatDate(tx.date)}
                      </TableCell>

                      <TableCell className="text-zinc-100 max-w-[200px] truncate">
                        <span title={tx.description}>{tx.description}</span>
                      </TableCell>

                      <TableCell className="text-zinc-300">
                        {cat ? (
                          <span className="flex items-center gap-1.5">
                            <span className="text-base leading-none">
                              {cat.icon}
                            </span>
                            <span className="text-sm">{cat.name}</span>
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-sm">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        {tx.type === "income" ? (
                          <Badge className="bg-emerald-950 text-emerald-400 border-emerald-800 gap-1">
                            <ArrowUpRight className="size-3" />
                            Income
                          </Badge>
                        ) : (
                          <Badge className="bg-red-950 text-red-400 border-red-800 gap-1">
                            <ArrowDownLeft className="size-3" />
                            Expense
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell
                        className={`text-right font-mono font-semibold text-sm ${
                          tx.type === "income"
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {tx.type === "income" ? "+" : "−"}
                        {formatCurrency(tx.amount, currency)}
                      </TableCell>

                      <TableCell className="pr-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEditDialog(tx)}
                            className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700"
                            title="Edit transaction"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openDeleteDialog(tx)}
                            className="text-zinc-400 hover:text-red-400 hover:bg-red-950/40"
                            title="Delete transaction"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {!loadingTx && totalPages > 1 && (
            <div className="flex items-center justify-between px-6 pt-4 pb-2">
              <span className="text-sm text-zinc-500">
                Showing{" "}
                {Math.min((currentPage - 1) * PAGE_SIZE + 1, total)}–
                {Math.min(currentPage * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadTransactions(currentPage - 1)}
                  disabled={currentPage <= 1 || loadingTx}
                >
                  Previous
                </Button>
                <span className="text-sm text-zinc-400 px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadTransactions(currentPage + 1)}
                  disabled={currentPage >= totalPages || loadingTx}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-zinc-300">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-zinc-100">
                &ldquo;{deletingTx?.description}&rdquo;
              </span>
              ? This action cannot be undone.
            </p>
            {deletingTx && (
              <p className="mt-1 text-sm text-zinc-500">
                {formatDate(deletingTx.date)} ·{" "}
                {formatCurrency(deletingTx.amount, currency)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
