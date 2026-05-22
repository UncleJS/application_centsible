import { test, expect, API_URL } from "./support/auth-fixtures";

test.describe("validation", () => {
  test("register rejects an invalid email", async ({ apiContext }) => {
    const res = await apiContext.post(`${API_URL}/auth/register`, {
      data: {
        email: "not-an-email",
        password: "e2e-test-password-1",
        name: "Test",
        defaultCurrency: "GBP",
      },
    });
    expect(res.status()).toBe(400);
  });

  test("register rejects a password under 8 characters", async ({ apiContext }) => {
    const res = await apiContext.post(`${API_URL}/auth/register`, {
      data: {
        email: `e2e-short-${Date.now()}@e2e.local`,
        password: "short",
        name: "Test",
        defaultCurrency: "GBP",
      },
    });
    expect(res.status()).toBe(400);
  });

  test("transaction with negative amount is rejected", async ({ apiContext, registeredUser }) => {
    const cookieHeader = registeredUser.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    // Get a real category id so type validation isn't what trips us up.
    const catRes = await apiContext.get(`${API_URL}/categories`, {
      headers: { Cookie: cookieHeader, "x-csrf-token": registeredUser.csrfToken },
    });
    const cats = (await catRes.json()).data as Array<{ id: number; type: string }>;
    const cat = cats.find((c) => c.type === "expense")!;

    const res = await apiContext.post(`${API_URL}/transactions`, {
      headers: {
        Cookie: cookieHeader,
        "x-csrf-token": registeredUser.csrfToken,
        "Content-Type": "application/json",
      },
      data: {
        categoryId: cat.id,
        type: "expense",
        amount: "-12.00",
        currency: registeredUser.defaultCurrency,
        description: "Negative test",
        date: "2026-05-22",
      },
    });
    expect(res.status()).toBe(400);
  });

  test("budget with unsupported currency is rejected", async ({ apiContext, registeredUser }) => {
    const cookieHeader = registeredUser.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const catRes = await apiContext.get(`${API_URL}/categories`, {
      headers: { Cookie: cookieHeader, "x-csrf-token": registeredUser.csrfToken },
    });
    const cats = (await catRes.json()).data as Array<{ id: number; type: string }>;
    const cat = cats.find((c) => c.type === "expense")!;

    const res = await apiContext.post(`${API_URL}/budgets`, {
      headers: {
        Cookie: cookieHeader,
        "x-csrf-token": registeredUser.csrfToken,
        "Content-Type": "application/json",
      },
      data: {
        categoryId: cat.id,
        year: 2026,
        month: 5,
        amount: "100.00",
        currency: "XYZ",
      },
    });
    expect(res.status()).toBe(400);
  });
});
