import { test, expect, API_URL } from "./support/auth-fixtures";
import { ApiClient } from "./support/api-client";

// Sentinel names sampled from @centsible/shared's DEFAULT_*_CATEGORIES. We
// don't import the shared package here because it's resolved as CJS by
// Playwright's TS loader, which breaks named ESM imports.
const EXPECTED_EXPENSE = ["Food & Groceries", "Transport", "Housing"];
const EXPECTED_INCOME = ["Salary"];

test.describe("categories", () => {
  test("default expense + income categories are seeded on register", async ({
    apiContext,
    registeredUser,
  }) => {
    const api = new ApiClient(apiContext, registeredUser);
    const cats = await api.listCategories();

    const expenseNames = cats.filter((c) => c.type === "expense").map((c) => c.name);
    const incomeNames = cats.filter((c) => c.type === "income").map((c) => c.name);

    for (const expected of EXPECTED_EXPENSE) {
      expect(expenseNames).toContain(expected);
    }
    for (const expected of EXPECTED_INCOME) {
      expect(incomeNames).toContain(expected);
    }
  });

  test("creating a category then archiving + restoring it round-trips", async ({
    apiContext,
    registeredUser,
  }) => {
    const api = new ApiClient(apiContext, registeredUser);
    const created = await api.createCategory({
      name: "E2E Custom Cat",
      type: "expense",
      icon: "🧪",
      color: "#888888",
    });

    const cookieHeader = registeredUser.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const headers = { Cookie: cookieHeader, "x-csrf-token": registeredUser.csrfToken };

    let cats = await api.listCategories();
    expect(cats.find((c) => c.id === created.id)).toBeTruthy();

    const archive = await apiContext.delete(`${API_URL}/categories/${created.id}`, { headers });
    expect(archive.ok()).toBe(true);

    cats = await api.listCategories();
    expect(cats.find((c) => c.id === created.id)).toBeUndefined();

    const restore = await apiContext.post(`${API_URL}/categories/${created.id}/restore`, {
      headers: { ...headers, "Content-Type": "application/json" },
      data: {},
    });
    expect(restore.ok()).toBe(true);

    cats = await api.listCategories();
    expect(cats.find((c) => c.id === created.id)).toBeTruthy();
  });
});
