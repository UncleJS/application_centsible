// ── Core domain types ──

export type TransactionType = "income" | "expense";

export type BillingCycle =
  | "weekly"
  | "fortnightly"
  | "monthly"
  | "quarterly"
  | "yearly";

export interface User {
  id: number;
  email: string;
  name: string;
  defaultCurrency: string;
  createdAt: string; // ISO-8601 UTC
  updatedAt: string;
}

export interface Category {
  id: number;
  userId: number;
  name: string;
  icon: string | null;
  color: string | null;
  type: TransactionType;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface Transaction {
  id: number;
  userId: number;
  categoryId: number;
  type: TransactionType;
  amount: string; // decimal string
  currency: string;
  convertedAmount: string | null; // in user's default currency
  description: string;
  date: string; // YYYY-MM-DD
  subscriptionId: number | null;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface Budget {
  id: number;
  userId: number;
  categoryId: number;
  year: number;
  month: number; // 1-12
  amount: string; // decimal string
  currency: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface SavingsGoal {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  targetAmount: string;
  currentAmount: string;
  currency: string;
  targetDate: string; // YYYY-MM-DD
  icon: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface SavingsContribution {
  id: number;
  savingsGoalId: number;
  amount: string;
  currency: string;
  note: string | null;
  date: string; // YYYY-MM-DD
  createdAt: string;
  archivedAt: string | null;
}

export interface Subscription {
  id: number;
  userId: number;
  categoryId: number | null;
  name: string;
  description: string | null;
  amount: string;
  currency: string;
  billingCycle: BillingCycle;
  nextRenewalDate: string; // YYYY-MM-DD
  startDate: string; // YYYY-MM-DD
  url: string | null;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface RecurringIncome {
  id: number;
  userId: number;
  categoryId: number | null;
  categoryName?: string | null;
  categoryIcon?: string | null;
  name: string;
  description: string | null;
  amount: string;
  currency: string;
  billingCycle: BillingCycle;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface ExchangeRate {
  id: number;
  baseCurrency: string;
  targetCurrency: string;
  rate: string; // decimal string
  date: string; // YYYY-MM-DD
  createdAt: string;
}

// ── API response types ──

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: Omit<User, "createdAt" | "updatedAt">;
  tokens: AuthTokens;
}

// ── Report types ──

export interface MonthlySummary {
  year: number;
  month: number;
  totalIncome: string;
  totalExpenses: string;
  netAmount: string;
  byCategory: CategorySummary[];
}

export interface CategorySummary {
  categoryId: number;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  type: TransactionType;
  totalAmount: string;
  budgetAmount: string | null;
  percentUsed: number | null;
  transactionCount: number;
}

export interface ForecastMonth {
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

export interface ForecastItem {
  name: string;
  amount: string;
  currency: string;
  date: string;
  type: "subscription" | "recurring-income" | "recurring" | "savings" | "budget";
  sourceId: number;
}
