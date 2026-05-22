import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

// Compact page-object models for the Centsible E2E suite. Each class exposes
// only the verbs the specs actually use; prefer accessible roles + labels so
// these survive Tailwind/shadcn class churn.

async function selectOption(page: Page, triggerLocator: Locator, optionText: string) {
  await triggerLocator.click();
  await page
    .getByRole("option", { name: optionText, exact: false })
    .first()
    .click();
}

export class LoginPage {
  constructor(private readonly page: Page) {}
  async goto() {
    await this.page.goto("/login");
    await expect(this.page.getByText("Welcome back")).toBeVisible();
  }
  async signIn(email: string, password: string) {
    await this.page.getByLabel("Email address").fill(email);
    await this.page.getByLabel("Password").fill(password);
    await this.page.getByRole("button", { name: /Sign in/ }).click();
  }
}

export class RegisterPage {
  constructor(private readonly page: Page) {}
  async goto() {
    await this.page.goto("/register");
    await expect(this.page.getByText("Create an account")).toBeVisible();
  }
  async register(opts: {
    name: string;
    email: string;
    password: string;
    currency?: string;
  }) {
    await this.page.getByLabel("Full name").fill(opts.name);
    await this.page.getByLabel("Email address").fill(opts.email);
    await this.page.getByLabel("Password", { exact: true }).fill(opts.password);
    await this.page.getByLabel("Confirm password").fill(opts.password);
    if (opts.currency && opts.currency !== "GBP") {
      const trigger = this.page.locator("#currency-trigger");
      await selectOption(this.page, trigger, opts.currency);
    }
    await this.page.getByRole("button", { name: /Create account/ }).click();
  }
}

export class TransactionsPage {
  constructor(private readonly page: Page) {}
  async goto() {
    await this.page.goto("/transactions");
    await expect(this.page).toHaveURL(/\/transactions/);
  }
  async openAddDialog() {
    await this.page.getByRole("button", { name: /Add Transaction/ }).first().click();
    await expect(this.page.getByRole("dialog")).toBeVisible();
  }
  async fillDialog(opts: {
    description: string;
    amount: string;
    type: "income" | "expense";
    categoryName: string;
    date: string;
    isRecurring?: boolean;
  }) {
    await this.page.locator("#tx-description").fill(opts.description);
    await this.page.locator("#tx-amount").fill(opts.amount);
    // Type select (first combobox in dialog)
    const dialog = this.page.getByRole("dialog");
    const comboboxes = dialog.getByRole("combobox");
    await selectOption(this.page, comboboxes.nth(0), opts.type === "income" ? "Income" : "Expense");
    await selectOption(this.page, comboboxes.nth(1), opts.categoryName);
    await this.page.locator("#tx-date").fill(opts.date);
    if (opts.isRecurring) {
      const sw = this.page.getByRole("switch");
      if ((await sw.getAttribute("aria-checked")) !== "true") await sw.click();
    }
  }
  async submitDialog(isEdit = false) {
    const label = isEdit ? /Save Changes/ : /Add Transaction/;
    await this.page.getByRole("dialog").getByRole("button", { name: label }).click();
    await expect(this.page.getByRole("dialog")).toBeHidden();
  }
  rowByDescription(description: string) {
    return this.page.getByRole("row").filter({ hasText: description });
  }
  async deleteRow(description: string) {
    const row = this.rowByDescription(description);
    await row.getByTitle("Delete transaction").click();
    await this.page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(row).toHaveCount(0);
  }
  async editRow(description: string) {
    await this.rowByDescription(description).getByTitle("Edit transaction").click();
    await expect(this.page.getByRole("dialog")).toBeVisible();
  }
  async filterByType(type: "all" | "income" | "expense") {
    const trigger = this.page.locator('button[role="combobox"]').first();
    await trigger.click();
    await this.page
      .getByRole("option", { name: type === "all" ? "All" : type === "income" ? "Income" : "Expense", exact: true })
      .click();
  }
  async clickNextPage() {
    await this.page.getByRole("button", { name: "Next", exact: true }).click();
  }
  async clickPrevPage() {
    await this.page.getByRole("button", { name: "Previous", exact: true }).click();
  }
}

export class BudgetsPage {
  constructor(private readonly page: Page) {}
  async goto() {
    await this.page.goto("/budgets");
    await expect(this.page).toHaveURL(/\/budgets/);
  }
  async openAddDialog() {
    await this.page.getByRole("button", { name: /Add Budget|New Budget|Create Budget/ }).first().click();
  }
  async fillDialog(opts: { categoryName: string; amount: string }) {
    const dialog = this.page.getByRole("dialog");
    await selectOption(this.page, dialog.getByRole("combobox").first(), opts.categoryName);
    await this.page.locator("#budget-amount").fill(opts.amount);
  }
  async submitDialog() {
    await this.page.getByRole("dialog").getByRole("button", { name: /Save|Create|Add/ }).click();
    await expect(this.page.getByRole("dialog")).toBeHidden();
  }
}

export class CategoriesPage {
  constructor(private readonly page: Page) {}
  async goto() {
    await this.page.goto("/categories");
    await expect(this.page).toHaveURL(/\/categories/);
  }
  async switchTab(tab: "expense" | "income") {
    await this.page.getByRole("tab", { name: new RegExp(tab, "i") }).click();
  }
  async addCategory(name: string, type: "expense" | "income") {
    await this.switchTab(type);
    await this.page.getByRole("button", { name: /Add Category|New Category|Create Category/ }).first().click();
    const dialog = this.page.getByRole("dialog");
    await dialog.getByLabel(/Name/i).fill(name);
    await dialog.getByRole("button", { name: /Save|Create|Add/ }).click();
    await expect(dialog).toBeHidden();
  }
}

export class SubscriptionsPage {
  constructor(private readonly page: Page) {}
  async goto() {
    await this.page.goto("/recurring/subscriptions");
    await expect(this.page).toHaveURL(/recurring\/subscriptions/);
  }
}

export class RecurringIncomePage {
  constructor(private readonly page: Page) {}
  async goto() {
    await this.page.goto("/recurring/income");
    await expect(this.page).toHaveURL(/recurring\/income/);
  }
}

export class SavingsPage {
  constructor(private readonly page: Page) {}
  async goto() {
    await this.page.goto("/savings");
    await expect(this.page).toHaveURL(/\/savings/);
  }
}

export class ReportsPage {
  constructor(private readonly page: Page) {}
  async goto() {
    await this.page.goto("/insights/reports");
    await expect(this.page).toHaveURL(/insights\/reports/);
  }
}

export class ForecastPage {
  constructor(private readonly page: Page) {}
  async goto() {
    await this.page.goto("/insights/forecast");
    await expect(this.page).toHaveURL(/insights\/forecast/);
  }
}

export class SettingsPage {
  constructor(private readonly page: Page) {}
  async goto() {
    await this.page.goto("/settings");
    await expect(this.page).toHaveURL(/\/settings/);
  }
  nameInput() {
    return this.page.locator("#settings-name");
  }
  currencyTrigger() {
    return this.page.locator("#settings-currency-trigger");
  }
  async setCurrency(code: string) {
    await selectOption(this.page, this.currencyTrigger(), code);
  }
  async saveProfile() {
    await this.page.getByRole("button", { name: /Save|Update|Save changes/i }).first().click();
  }
}

export class DashboardPage {
  constructor(private readonly page: Page) {}
  async goto() {
    await this.page.goto("/dashboard");
    await expect(this.page).toHaveURL(/\/dashboard/);
  }
}

export function pages(page: Page) {
  return {
    login: new LoginPage(page),
    register: new RegisterPage(page),
    dashboard: new DashboardPage(page),
    transactions: new TransactionsPage(page),
    budgets: new BudgetsPage(page),
    categories: new CategoriesPage(page),
    subscriptions: new SubscriptionsPage(page),
    recurringIncome: new RecurringIncomePage(page),
    savings: new SavingsPage(page),
    reports: new ReportsPage(page),
    forecast: new ForecastPage(page),
    settings: new SettingsPage(page),
  };
}
