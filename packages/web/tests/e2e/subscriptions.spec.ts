import { test, expect, API_URL } from "./support/auth-fixtures";
import { ApiClient } from "./support/api-client";

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

test.describe("subscriptions", () => {
  test("create a subscription and see it on the page", async ({
    page,
    apiContext,
    registeredUser,
  }) => {
    const api = new ApiClient(apiContext, registeredUser);
    await api.createSubscription({
      name: "Netflix E2E",
      amount: "15.99",
      currency: registeredUser.defaultCurrency,
      billingCycle: "monthly",
      startDate: isoDateOffset(-30),
      nextRenewalDate: isoDateOffset(3),
    });

    await page.goto("/recurring/subscriptions");
    await expect(page.getByText("Netflix E2E").first()).toBeVisible({ timeout: 15_000 });
  });

  test("upcoming-renewals endpoint includes a near-due subscription", async ({
    apiContext,
    registeredUser,
  }) => {
    const api = new ApiClient(apiContext, registeredUser);
    await api.createSubscription({
      name: "Spotify Soon",
      amount: "9.99",
      currency: registeredUser.defaultCurrency,
      billingCycle: "monthly",
      startDate: isoDateOffset(-90),
      nextRenewalDate: isoDateOffset(5),
    });

    const cookieHeader = registeredUser.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const res = await apiContext.get(`${API_URL}/subscriptions/upcoming?days=14`, {
      headers: { Cookie: cookieHeader, "x-csrf-token": registeredUser.csrfToken },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    const found = (body.data as Array<{ name: string }>).some((s) => s.name === "Spotify Soon");
    expect(found).toBe(true);
  });
});
