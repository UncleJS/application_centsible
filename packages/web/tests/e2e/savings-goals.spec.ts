import { test, expect, API_URL } from "./support/auth-fixtures";
import { ApiClient } from "./support/api-client";

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

test.describe("savings goals", () => {
  test("create a goal and see it on the page", async ({
    page,
    apiContext,
    registeredUser,
  }) => {
    const api = new ApiClient(apiContext, registeredUser);
    await api.createSavingsGoal({
      name: "Emergency Fund E2E",
      targetAmount: "5000.00",
      currency: registeredUser.defaultCurrency,
      targetDate: isoDateOffset(180),
    });

    await page.goto("/savings");
    await expect(page.getByText("Emergency Fund E2E").first()).toBeVisible({ timeout: 15_000 });
  });

  test("contributing increases currentAmount", async ({
    apiContext,
    registeredUser,
  }) => {
    const api = new ApiClient(apiContext, registeredUser);
    const goal = await api.createSavingsGoal({
      name: "Holiday Fund E2E",
      targetAmount: "2000.00",
      currency: registeredUser.defaultCurrency,
      targetDate: isoDateOffset(120),
    });

    await api.contributeToGoal(goal.id, {
      amount: "250.00",
      currency: registeredUser.defaultCurrency,
    });

    const cookieHeader = registeredUser.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const res = await apiContext.get(`${API_URL}/savings-goals/${goal.id}`, {
      headers: { Cookie: cookieHeader, "x-csrf-token": registeredUser.csrfToken },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Number(body.data.currentAmount)).toBeCloseTo(250, 2);
    expect(body.data.contributions).toHaveLength(1);
  });
});
