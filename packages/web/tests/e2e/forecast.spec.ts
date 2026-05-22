import { test, expect, API_URL } from "./support/auth-fixtures";
import { ApiClient } from "./support/api-client";

test.describe("forecast", () => {
  test("forecast page renders", async ({ page }) => {
    await page.goto("/insights/forecast");
    await expect(page).toHaveURL(/insights\/forecast/);
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  });

  test("forecast endpoint returns up to 12 months of data", async ({
    apiContext,
    registeredUser,
  }) => {
    const api = new ApiClient(apiContext, registeredUser);
    const cats = await api.listCategories();
    const incomeCat = cats.find((c) => c.type === "income")!;

    // Seed a recurring income so the forecast has something to project.
    await api.createRecurringIncome({
      name: "Forecast salary",
      amount: "3000.00",
      currency: registeredUser.defaultCurrency,
      billingCycle: "monthly",
      categoryId: incomeCat.id,
    });

    const cookieHeader = registeredUser.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const res = await apiContext.get(`${API_URL}/reports/forecast?months=12`, {
      headers: { Cookie: cookieHeader, "x-csrf-token": registeredUser.csrfToken },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(12);
    expect(body.data.length).toBeGreaterThan(0);
  });
});
