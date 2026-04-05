function resolveLocale(): string {
  if (typeof navigator === "undefined") return "en-US";
  const preferred = navigator.languages?.[0] || navigator.language;
  return preferred || "en-US";
}

/**
 * Format a date string to YYYY-MM-DD HH:mm:ss in local time
 */
export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

/**
 * Format a date string to YYYY-MM-DD
 */
export function formatDate(dateString: string): string {
  if (!dateString) return "";
  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Format a currency amount
 */
export function formatCurrency(amount: string | number, currency: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat(resolveLocale(), {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Get the month name
 */
export function getMonthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleDateString(resolveLocale(), {
    month: "long",
  });
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Calculate fractional months remaining until a target date.
 * Returns null if the date is in the past.
 */
export function monthsUntil(dateString: string): number | null {
  const today = new Date();
  const target = new Date(dateString);
  if (target <= today) return null;
  const years = target.getFullYear() - today.getFullYear();
  const months = target.getMonth() - today.getMonth();
  const days = target.getDate() - today.getDate();
  const fractional = years * 12 + months + days / 30;
  return fractional > 0 ? fractional : null;
}
/**
 * Calculate days until a date
 */
export function daysUntil(dateString: string): number {
  const target = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
