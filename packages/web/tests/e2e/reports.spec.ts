import { test, expect, API_URL } from "./support/auth-fixtures";
import { ApiClient } from "./support/api-client";

const now = new Date();
const YEAR = now.getUTCFullYear();
const MONTH = now.getUTCMonth() + 1;
const TODAY = now.toISOString().slice(0, 10);

test.describe("reports", () => {
  test("summary totals match seeded transactions", async ({
    apiContext,
    registeredUser,
  }) => {
    const api = new ApiClient(apiContext, registeredUser);
    const cats = await api.listCategories();
    const expenseCat = cats.find((c) => c.type === "expense")!;
    const incomeCat = cats.find((c) => c.type === "income")!;

    await api.createTransaction({
      categoryId: incomeCat.id,
      type: "income",
      amount: "3000.00",
      currency: registeredUser.defaultCurrency,
      description: "Salary",
      date: TODAY,
    });
    await api.createTransaction({
      categoryId: expenseCat.id,
      type: "expense",
      amount: "120.50",
      currency: registeredUser.defaultCurrency,
      description: "Groceries",
      date: TODAY,
    });

    const cookieHeader = registeredUser.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const res = await apiContext.get(
      `${API_URL}/reports/summary?year=${YEAR}&month=${MONTH}`,
      { headers: { Cookie: cookieHeader, "x-csrf-token": registeredUser.csrfToken } }
    );
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Number(body.data.totalIncome)).toBeGreaterThanOrEqual(3000);
    expect(Number(body.data.totalExpenses)).toBeGreaterThanOrEqual(120.5);
    expect(Number(body.data.netAmount)).toBeCloseTo(
      Number(body.data.totalIncome) - Number(body.data.totalExpenses),
      2
    );
  });

  test("reports page renders without errors", async ({ page }) => {
    await page.goto("/insights/reports");
    await expect(page).toHaveURL(/insights\/reports/);
    // Page-level error boundary or 5xx would prevent the chrome from rendering.
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  });

  test("trend endpoint returns an array", async ({ apiContext, registeredUser }) => {
    const cookieHeader = registeredUser.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const res = await apiContext.get(`${API_URL}/reports/trend?months=3`, {
      headers: { Cookie: cookieHeader, "x-csrf-token": registeredUser.csrfToken },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});
