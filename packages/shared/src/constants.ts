// ── Supported currencies ──

export const SUPPORTED_CURRENCIES = [
  "AUD", "BGN", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK",
  "EUR", "GBP", "HKD", "HRK", "HUF", "IDR", "INR", "ISK",
  "JPY", "KRW", "MXN", "MYR", "NOK", "NZD", "PHP", "PLN",
  "RON", "SEK", "SGD", "THB", "TRY", "USD", "ZAR",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

// ── Default categories ──

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Food & Groceries", icon: "🛒", color: "#22c55e" },
  { name: "Dining Out", icon: "🍽️", color: "#f97316" },
  { name: "Transport", icon: "🚗", color: "#3b82f6" },
  { name: "Bills & Utilities", icon: "💡", color: "#ef4444" },
  { name: "Entertainment", icon: "🎬", color: "#a855f7" },
  { name: "Shopping", icon: "🛍️", color: "#ec4899" },
  { name: "Health", icon: "💊", color: "#14b8a6" },
  { name: "Housing", icon: "🏠", color: "#6366f1" },
  { name: "Insurance", icon: "🛡️", color: "#64748b" },
  { name: "Subscriptions", icon: "📱", color: "#f59e0b" },
  { name: "Personal Care", icon: "✂️", color: "#8b5cf6" },
  { name: "Education", icon: "📚", color: "#06b6d4" },
  { name: "Gifts & Donations", icon: "🎁", color: "#d946ef" },
  { name: "Other", icon: "📦", color: "#78716c" },
] as const;

export const DEFAULT_INCOME_CATEGORIES = [
  { name: "Salary", icon: "💰", color: "#22c55e" },
  { name: "Freelance", icon: "💻", color: "#3b82f6" },
  { name: "Investments", icon: "📈", color: "#a855f7" },
  { name: "Refunds", icon: "↩️", color: "#f97316" },
  { name: "Other Income", icon: "💵", color: "#78716c" },
] as const;

// ── Billing cycle helpers ──

export const BILLING_CYCLE_LABELS: Record<string, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export const BILLING_CYCLE_MONTHS: Record<string, number> = {
  weekly: 1 / 4.33,
  fortnightly: 1 / 2.17,
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

// ── Exchange rate API ──

export const EXCHANGE_RATE_API_BASE = "https://api.frankfurter.app";
