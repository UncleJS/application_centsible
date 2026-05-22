import { test, expect, API_URL } from "./support/auth-fixtures";
import { ApiClient } from "./support/api-client";

const now = new Date();
const YEAR = now.getUTCFullYear();
const MONTH = now.getUTCMonth() + 1;
const TODAY = now.toISOString().slice(0, 10);

test.describe("CSV export", () => {
  test("export endpoint returns CSV with seeded rows", async ({
    apiContext,
    registeredUser,
  }) => {
    const api = new ApiClient(apiContext, registeredUser);
    const cats = await api.listCategories();
    const expenseCat = cats.find((c) => c.type === "expense")!;

    await api.createTransaction({
      categoryId: expenseCat.id,
      type: "expense",
      amount: "9.99",
      currency: registeredUser.defaultCurrency,
      description: "CSV export row",
      date: TODAY,
    });

    const cookieHeader = registeredUser.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const res = await apiContext.get(
      `${API_URL}/reports/export?year=${YEAR}&month=${MONTH}`,
      { headers: { Cookie: cookieHeader, "x-csrf-token": registeredUser.csrfToken } }
    );
    expect(res.ok()).toBe(true);
    expect(res.headers()["content-type"]).toContain("text/csv");
    const body = await res.text();
    expect(body).toContain("Date,Type,Category,Description,Amount,Currency");
    expect(body).toContain("CSV export row");
    expect(body).toContain(registeredUser.defaultCurrency);
  });
});
