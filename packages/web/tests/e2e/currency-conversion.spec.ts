import { test, expect, API_URL } from "./support/auth-fixtures";
import { ApiClient } from "./support/api-client";

const now = new Date();
const YEAR = now.getUTCFullYear();
const MONTH = now.getUTCMonth() + 1;
const TODAY = now.toISOString().slice(0, 10);

test.describe("currency conversion", () => {
  test("seeded rates surface via /exchange-rates/latest", async ({
    apiContext,
    registeredUser,
  }) => {
    const cookieHeader = registeredUser.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const res = await apiContext.get(`${API_URL}/exchange-rates/latest?base=GBP`, {
      headers: { Cookie: cookieHeader, "x-csrf-token": registeredUser.csrfToken },
    });
    // With EXCHANGE_RATE_API_BASE pointing at an unreachable host, the route
    // falls back to the cached rates seeded by global-setup.
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.base).toBe("GBP");
    expect(body.data.rates).toBeTruthy();
    expect(body.data.rates.USD).toBeTruthy();
    expect(Number(body.data.rates.USD)).toBeGreaterThan(0);
  });

  test("foreign-currency transaction shows up in the user-currency summary total", async ({
    apiContext,
    registeredUser,
  }) => {
    const api = new ApiClient(apiContext, registeredUser);
    const cats = await api.listCategories();
    const expenseCat = cats.find((c) => c.type === "expense")!;
    const foreign = registeredUser.defaultCurrency === "USD" ? "EUR" : "USD";

    await api.createTransaction({
      categoryId: expenseCat.id,
      type: "expense",
      amount: "100.00",
      currency: foreign,
      description: `Foreign ${foreign} expense`,
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
    expect(Number(body.data.totalExpenses)).toBeGreaterThan(0);
  });
});
