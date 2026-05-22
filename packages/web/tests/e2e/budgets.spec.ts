import { test, expect, API_URL } from "./support/auth-fixtures";
import { ApiClient } from "./support/api-client";

const now = new Date();
const YEAR = now.getUTCFullYear();
const MONTH = now.getUTCMonth() + 1;
const TODAY = now.toISOString().slice(0, 10);

test.describe("budgets", () => {
  test("create a budget and see it on the budgets page", async ({ page, apiContext, registeredUser }) => {
    const api = new ApiClient(apiContext, registeredUser);
    const cats = await api.listCategories();
    const cat = cats.find((c) => c.type === "expense")!;
    await api.createBudget({
      categoryId: cat.id,
      year: YEAR,
      month: MONTH,
      amount: "300.00",
      currency: registeredUser.defaultCurrency,
    });

    await page.goto("/budgets");
    await expect(page.getByText(cat.name).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("£300.00").first()).toBeVisible();
  });

  test("creating a transaction in a budgeted category bumps spent", async ({
    apiContext,
    registeredUser,
  }) => {
    const api = new ApiClient(apiContext, registeredUser);
    const cats = await api.listCategories();
    const cat = cats.find((c) => c.type === "expense")!;
    await api.createBudget({
      categoryId: cat.id,
      year: YEAR,
      month: MONTH,
      amount: "500.00",
      currency: registeredUser.defaultCurrency,
    });
    await api.createTransaction({
      categoryId: cat.id,
      type: "expense",
      amount: "120.00",
      currency: registeredUser.defaultCurrency,
      description: "Counts against budget",
      date: TODAY,
    });

    const res = await apiContext.get(
      `${API_URL}/budgets?year=${YEAR}&month=${MONTH}`,
      {
        headers: {
          Cookie: registeredUser.cookies.map((c) => `${c.name}=${c.value}`).join("; "),
          "x-csrf-token": registeredUser.csrfToken,
        },
      }
    );
    expect(res.ok()).toBe(true);
    const body = await res.json();
    const row = body.data.find((b: { categoryId: number }) => b.categoryId === cat.id);
    expect(row, "budget row for the seeded category should be present").toBeTruthy();
    expect(Number(row.spent)).toBeGreaterThanOrEqual(120);
  });
});
