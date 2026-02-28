const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

import type {
  User,
  Category,
  Transaction,
  Budget,
  SavingsGoal,
  SavingsContribution,
  Subscription,
  MonthlySummary,
  ForecastMonth,
  AuthTokens,
} from "@centsible/shared";

interface RequestOptions extends RequestInit {
  token?: string;
}

interface AuthResponse {
  data: {
    user: Omit<User, "createdAt" | "updatedAt">;
    tokens: AuthTokens;
  };
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Validate that a URL uses a safe protocol (http/https only) */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onTokenRefreshed: ((tokens: AuthTokens) => void) | null = null;
  private onUnauthorized: (() => void) | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
  }

  onRefresh(callback: (tokens: AuthTokens) => void) {
    this.onTokenRefreshed = callback;
  }

  onAuthError(callback: () => void) {
    this.onUnauthorized = callback;
  }

  private async request<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { token, ...fetchOptions } = options;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(fetchOptions.headers as Record<string, string>),
    };

    const authToken = token || this.accessToken;
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...fetchOptions,
      headers,
    });

    // Handle token refresh
    if (response.status === 401 && this.refreshToken && !token) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.request<T>(path, { ...options, token: this.accessToken! });
      }
      this.onUnauthorized?.();
      throw new Error("Session expired");
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    // Handle CSV responses
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("text/csv")) {
      return (await response.text()) as unknown as T;
    }

    return response.json();
  }

  private async tryRefresh(): Promise<boolean> {
    // Mutex: if a refresh is already in flight, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this._doRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async _doRefresh(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      this.accessToken = data.data.tokens.accessToken;
      this.refreshToken = data.data.tokens.refreshToken;
      this.onTokenRefreshed?.(data.data.tokens);
      return true;
    } catch {
      return false;
    }
  }

  // ── Auth ──
  async register(body: { email: string; password: string; name: string; defaultCurrency?: string }) {
    return this.request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async login(body: { email: string; password: string }) {
    return this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async logout() {
    return this.request("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });
  }

  // ── Categories ──
  async getCategories() {
    return this.request<{ data: Category[] }>("/categories");
  }

  async createCategory(body: { name: string; icon?: string | null; color?: string | null; type: "income" | "expense" }) {
    return this.request<{ data: Category }>("/categories", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async updateCategory(id: number, body: { name?: string; icon?: string | null; color?: string | null }) {
    return this.request<{ data: Category }>(`/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  async deleteCategory(id: number) {
    return this.request<{ message: string }>(`/categories/${id}`, { method: "DELETE" });
  }

  // ── Transactions ──
  async getTransactions(params?: Record<string, string>) {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<PaginatedResponse<Transaction>>(`/transactions${query}`);
  }

  async createTransaction(body: Record<string, unknown>) {
    return this.request<{ data: Transaction }>("/transactions", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async updateTransaction(id: number, body: Record<string, unknown>) {
    return this.request<{ data: Transaction }>(`/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  async deleteTransaction(id: number) {
    return this.request<{ message: string }>(`/transactions/${id}`, { method: "DELETE" });
  }

  // ── Budgets ──
  async getBudgets(year?: number, month?: number) {
    const params = new URLSearchParams();
    if (year) params.set("year", String(year));
    if (month) params.set("month", String(month));
    return this.request<{ data: (Budget & { categoryName?: string | null; spent?: string })[] }>(`/budgets?${params}`);
  }

  async createBudget(body: Record<string, unknown>) {
    return this.request<{ data: Budget }>("/budgets", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async updateBudget(id: number, body: { amount: string }) {
    return this.request<{ data: Budget }>(`/budgets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  async deleteBudget(id: number) {
    return this.request<{ message: string }>(`/budgets/${id}`, { method: "DELETE" });
  }

  // ── Savings Goals ──
  async getSavingsGoals() {
    return this.request<{ data: SavingsGoal[] }>("/savings-goals");
  }

  async getSavingsGoal(id: number) {
    return this.request<{ data: SavingsGoal & { contributions?: SavingsContribution[] } }>(`/savings-goals/${id}`);
  }

  async createSavingsGoal(body: Record<string, unknown>) {
    return this.request<{ data: SavingsGoal }>("/savings-goals", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async updateSavingsGoal(id: number, body: Record<string, unknown>) {
    return this.request<{ data: SavingsGoal }>(`/savings-goals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  async contributeSavingsGoal(id: number, body: Record<string, unknown>) {
    return this.request<{ data: SavingsGoal }>(`/savings-goals/${id}/contribute`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async deleteSavingsGoal(id: number) {
    return this.request<{ message: string }>(`/savings-goals/${id}`, { method: "DELETE" });
  }

  // ── Subscriptions ──
  async getSubscriptions() {
    return this.request<{ data: Subscription[] }>("/subscriptions");
  }

  async getUpcomingSubscriptions(days?: number) {
    const params = days ? `?days=${days}` : "";
    return this.request<{ data: Subscription[] }>(`/subscriptions/upcoming${params}`);
  }

  async createSubscription(body: Record<string, unknown>) {
    return this.request<{ data: Subscription }>("/subscriptions", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async updateSubscription(id: number, body: Record<string, unknown>) {
    return this.request<{ data: Subscription }>(`/subscriptions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  async deleteSubscription(id: number) {
    return this.request<{ message: string }>(`/subscriptions/${id}`, { method: "DELETE" });
  }

  // ── Reports ──
  async getMonthlySummary(year?: number, month?: number) {
    const params = new URLSearchParams();
    if (year) params.set("year", String(year));
    if (month) params.set("month", String(month));
    return this.request<{ data: MonthlySummary }>(`/reports/summary?${params}`);
  }

  async getForecast(months?: number) {
    const params = months ? `?months=${months}` : "";
    return this.request<{ data: ForecastMonth[] }>(`/reports/forecast${params}`);
  }

  async getTrend(months?: number) {
    const params = months ? `?months=${months}` : "";
    return this.request<{ data: { year: number; month: number; income: string; expenses: string; net: string }[] }>(`/reports/trend${params}`);
  }

  async exportCsv(year: number, month: number) {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
    });
    return this.request<string>(`/reports/export?${params}`);
  }

  // ── Exchange Rates ──
  async getLatestRates(base?: string) {
    const params = base ? `?base=${base}` : "";
    return this.request<{ data: { base: string; date: string; rates: Record<string, number> }; cached?: boolean }>(`/exchange-rates/latest${params}`);
  }

  async convertCurrency(from: string, to: string, amount: string) {
    return this.request<{ data: { base: string; date: string; rates: Record<string, number> } }>(`/exchange-rates/convert?from=${from}&to=${to}&amount=${amount}`);
  }

  async getCurrencies() {
    return this.request<{ data: string[] }>("/exchange-rates/currencies");
  }
}

export const api = new ApiClient(API_URL);
