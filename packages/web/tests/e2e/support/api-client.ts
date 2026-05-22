import type { APIRequestContext } from "@playwright/test";
import type { RegisteredUser } from "./auth-fixtures";

const API_URL = process.env.E2E_API_URL || "http://127.0.0.1:4001";

// Thin HTTP helper for seeding test data through the real API. Every call goes
// through the same code path the browser uses (auth cookies + CSRF header), so
// spec files never need to know how Drizzle stores anything.

export class ApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly user: RegisteredUser
  ) {}

  private cookieHeader(): string {
    return this.user.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "Cookie": this.cookieHeader(),
      "x-csrf-token": this.user.csrfToken,
    };
  }

  async listCategories(): Promise<Array<{ id: number; name: string; type: "income" | "expense"; icon: string | null; color: string | null }>> {
    const res = await this.request.get(`${API_URL}/categories`, {
      headers: this.headers(),
    });
    if (!res.ok()) throw new Error(`GET /categories failed: ${res.status()}`);
    const body = await res.json();
    return body.data;
  }

  async createCategory(input: {
    name: string;
    type: "income" | "expense";
    icon?: string;
    color?: string;
  }) {
    const res = await this.request.post(`${API_URL}/categories`, {
      headers: this.headers(),
      data: input,
    });
    if (!res.ok()) throw new Error(`POST /categories failed: ${res.status()} ${await res.text()}`);
    return (await res.json()).data;
  }

  async createTransaction(input: {
    categoryId: number;
    type: "income" | "expense";
    amount: string;
    currency: string;
    description?: string;
    date: string;
  }) {
    const res = await this.request.post(`${API_URL}/transactions`, {
      headers: this.headers(),
      data: input,
    });
    if (!res.ok()) throw new Error(`POST /transactions failed: ${res.status()} ${await res.text()}`);
    return (await res.json()).data;
  }

  async createBudget(input: {
    categoryId: number;
    year: number;
    month: number;
    amount: string;
    currency: string;
  }) {
    const res = await this.request.post(`${API_URL}/budgets`, {
      headers: this.headers(),
      data: input,
    });
    if (!res.ok()) throw new Error(`POST /budgets failed: ${res.status()} ${await res.text()}`);
    return (await res.json()).data;
  }

  async createSubscription(input: {
    name: string;
    amount: string;
    currency: string;
    billingCycle: "weekly" | "fortnightly" | "monthly" | "quarterly" | "yearly";
    startDate: string;
    nextRenewalDate: string;
    categoryId?: number | null;
    autoRenew?: boolean;
  }) {
    const res = await this.request.post(`${API_URL}/subscriptions`, {
      headers: this.headers(),
      data: input,
    });
    if (!res.ok()) throw new Error(`POST /subscriptions failed: ${res.status()} ${await res.text()}`);
    return (await res.json()).data;
  }

  async createSavingsGoal(input: {
    name: string;
    targetAmount: string;
    currency: string;
    targetDate: string;
    description?: string;
    icon?: string;
  }) {
    const res = await this.request.post(`${API_URL}/savings-goals`, {
      headers: this.headers(),
      data: input,
    });
    if (!res.ok()) throw new Error(`POST /savings-goals failed: ${res.status()} ${await res.text()}`);
    return (await res.json()).data;
  }

  async contributeToGoal(goalId: number, input: { amount: string; currency: string; date?: string; note?: string }) {
    const res = await this.request.post(`${API_URL}/savings-goals/${goalId}/contribute`, {
      headers: this.headers(),
      data: input,
    });
    if (!res.ok()) throw new Error(`POST /savings-goals/${goalId}/contribute failed: ${res.status()} ${await res.text()}`);
    return (await res.json()).data;
  }

  async createRecurringIncome(input: {
    name: string;
    amount: string;
    currency: string;
    billingCycle: "weekly" | "fortnightly" | "monthly" | "quarterly" | "yearly";
    categoryId?: number | null;
    description?: string;
  }) {
    const res = await this.request.post(`${API_URL}/recurring-income`, {
      headers: this.headers(),
      data: input,
    });
    if (!res.ok()) throw new Error(`POST /recurring-income failed: ${res.status()} ${await res.text()}`);
    return (await res.json()).data;
  }
}
