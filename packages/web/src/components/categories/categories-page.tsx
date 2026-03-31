"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Inbox, Tag } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
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

interface Category {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  type: "income" | "expense";
  userId: number;
  archivedAt: string | null;
}

interface CategoriesPageProps {
  type: "income" | "expense";
  showHeader?: boolean;
}

const emptyForm = { name: "", icon: "", color: "" };

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#10b981", "#06b6d4", "#3b82f6", "#8b5cf6",
  "#ec4899", "#f43f5e", "#84cc16", "#14b8a6",
];

function ColorSwatch({
  color,
  selected,
  onClick,
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-6 w-6 rounded-full transition-all ${
        selected ? "ring-2 ring-offset-2 ring-offset-zinc-900 ring-white scale-110" : "hover:scale-105"
      }`}
      style={{ backgroundColor: color }}
      title={color}
    />
  );
}

export function CategoriesPage({ type, showHeader = true }: CategoriesPageProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [targetCategory, setTargetCategory] = useState<Category | null>(null);

  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getCategories();
      const filtered = (res.data ?? []).filter(
        (c) => c.type === type && !c.archivedAt
      );
      setCategories(filtered);
    } catch {
      toast.error("Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // ── Dialog helpers ────────────────────────────────────────────────────────

  function openCreate() {
    setEditingCategory(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  }

  function openEdit(cat: Category) {
    setEditingCategory(cat);
    setForm({
      name: cat.name,
      icon: cat.icon ?? "",
      color: cat.color ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Category name is required.");
      return;
    }

    // Validate color if provided
    if (form.color && !/^#[0-9a-fA-F]{6}$/.test(form.color)) {
      toast.error("Color must be in #RRGGBB hex format.");
      return;
    }

    setSaving(true);
    try {
      const colorVal = form.color.trim() || null;
      const iconVal = form.icon.trim() || null;

      if (editingCategory) {
        await api.updateCategory(editingCategory.id, {
          name,
          icon: iconVal,
          color: colorVal,
        });
        toast.success("Category updated.");
      } else {
        await api.createCategory({
          name,
          icon: iconVal,
          color: colorVal,
          type,
        });
        toast.success("Category created.");
      }

      setDialogOpen(false);
      await loadCategories();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : editingCategory
          ? "Failed to update category."
          : "Failed to create category."
      );
    } finally {
      setSaving(false);
    }
  }

  function openDelete(cat: Category) {
    setTargetCategory(cat);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!targetCategory) return;
    setDeleting(true);
    try {
      await api.deleteCategory(targetCategory.id);
      toast.success("Category deleted.");
      setDeleteDialogOpen(false);
      await loadCategories();
    } catch {
      toast.error("Failed to delete category.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const typeLabel = type === "income" ? "Income" : "Expense";
  const accentColor =
    type === "income" ? "text-green-400" : "text-red-400";
  const accentBg =
    type === "income" ? "bg-green-900/40" : "bg-red-900/40";
  const btnClass =
    type === "income"
      ? "bg-green-700 text-white hover:bg-green-600"
      : "bg-red-700 text-white hover:bg-red-600";

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          {showHeader ? (
            <>
              <h1 className={`text-2xl font-bold text-zinc-100 flex items-center gap-2`}>
                <Tag className={`size-6 ${accentColor}`} />
                {typeLabel} Categories
              </h1>
              <p className="text-sm text-zinc-500">
                Manage your {type} categories for transactions and budgets.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <Tag className={`size-4 ${accentColor}`} />
                {typeLabel}
              </div>
              <p className="text-sm text-zinc-500">
                Manage your {type} categories for transactions and budgets.
              </p>
            </>
          )}
        </div>
        <Button className={btnClass} onClick={openCreate}>
          <Plus className="size-4" />
          Add Category
        </Button>
      </div>

      {/* Category Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex items-center gap-3"
            >
              <div className="h-9 w-9 rounded-lg bg-zinc-800 shrink-0" />
              <div className="h-4 w-28 rounded bg-zinc-800" />
            </div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 py-20 text-center">
          <Inbox className="size-12 text-zinc-600" />
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-zinc-300">
              No {type} categories yet
            </p>
            <p className="text-sm text-zinc-500 max-w-xs">
              Add your first {type} category to organise your{" "}
              {type === "income" ? "earnings" : "spending"}.
            </p>
          </div>
          <Button className={btnClass} onClick={openCreate}>
            <Plus className="size-4" />
            Add Category
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {categories.map((cat) => (
            <Card
              key={cat.id}
              className="bg-zinc-900 border-zinc-800 group"
            >
              <CardContent className="flex items-center gap-3 p-4">
                {/* Icon / color swatch */}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg ${
                    cat.color ? "" : accentBg
                  }`}
                  style={
                    cat.color
                      ? { backgroundColor: cat.color + "33" }
                      : undefined
                  }
                >
                  {cat.icon ? (
                    <span className="leading-none">{cat.icon}</span>
                  ) : (
                    <Tag
                      className={`size-4 ${accentColor}`}
                      style={cat.color ? { color: cat.color } : undefined}
                    />
                  )}
                </div>

                {/* Name + colour dot */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {cat.color && (
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                    )}
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {cat.name}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                    onClick={() => openEdit(cat)}
                    title="Edit"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
                    onClick={() => openDelete(cat)}
                    title="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create / Edit Dialog ──────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              {editingCategory
                ? `Edit ${typeLabel} Category`
                : `New ${typeLabel} Category`}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-300">
                Name <span className="text-red-400">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder={
                  type === "income" ? "e.g. Salary" : "e.g. Groceries"
                }
                className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
              />
            </div>

            {/* Icon */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-300">Icon (emoji, optional)</Label>
              <Input
                value={form.icon}
                onChange={(e) =>
                  setForm((p) => ({ ...p, icon: e.target.value }))
                }
                placeholder={type === "income" ? "e.g. 💰" : "e.g. 🛒"}
                maxLength={8}
                className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>

            {/* Color */}
            <div className="flex flex-col gap-2">
              <Label className="text-zinc-300">Colour (optional)</Label>
              {/* Preset swatches */}
              <div className="flex flex-wrap gap-2 py-1">
                {PRESET_COLORS.map((c) => (
                  <ColorSwatch
                    key={c}
                    color={c}
                    selected={form.color === c}
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        color: p.color === c ? "" : c,
                      }))
                    }
                  />
                ))}
              </div>
              {/* Manual hex input */}
              <div className="flex items-center gap-2">
                {form.color && /^#[0-9a-fA-F]{6}$/.test(form.color) && (
                  <span
                    className="h-6 w-6 rounded-full shrink-0 border border-zinc-700"
                    style={{ backgroundColor: form.color }}
                  />
                )}
                <Input
                  value={form.color}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, color: e.target.value }))
                  }
                  placeholder="#3b82f6"
                  maxLength={7}
                  className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 font-mono text-sm"
                />
                {form.color && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-zinc-500 hover:text-zinc-300 shrink-0"
                    onClick={() => setForm((p) => ({ ...p, color: "" }))}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className={btnClass}
            >
              {saving
                ? "Saving…"
                : editingCategory
                ? "Save Changes"
                : "Create Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ───────────────────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              Delete Category
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <p className="text-zinc-400 text-sm">
              Are you sure you want to delete{" "}
              <span className="text-zinc-100 font-semibold">
                {targetCategory?.name}
              </span>
              ? Existing transactions and budgets using this category will be
              unaffected, but no new ones can use it.
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
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
