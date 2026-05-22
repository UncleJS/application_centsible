import { test, expect, API_URL } from "./support/auth-fixtures";
import { ApiClient } from "./support/api-client";

const TODAY = new Date().toISOString().slice(0, 10);

test.describe("pagination", () => {
  test("transactions list paginates when there are more than 20 rows", async ({
    page,
    apiContext,
    registeredUser,
  }) => {
    const api = new ApiClient(apiContext, registeredUser);
    const cats = await api.listCategories();
    const cat = cats.find((c) => c.type === "expense")!;

    // Seed 25 rows so default page-size of 20 forces a second page.
    for (let i = 0; i < 25; i += 1) {
      await api.createTransaction({
        categoryId: cat.id,
        type: "expense",
        amount: `${(i + 1).toFixed(2)}`,
        currency: registeredUser.defaultCurrency,
        description: `Row ${String(i).padStart(3, "0")}`,
        date: TODAY,
      });
    }

    await page.goto("/transactions");
    await expect(page.getByText("Page 1 of", { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText(/Page 2 of/).first()).toBeVisible();
  });

  test("transactions endpoint respects page + pageSize", async ({ apiContext, registeredUser }) => {
    const cookieHeader = registeredUser.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const res = await apiContext.get(
      `${API_URL}/transactions?page=1&pageSize=5`,
      { headers: { Cookie: cookieHeader, "x-csrf-token": registeredUser.csrfToken } }
    );
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.pageSize).toBe(5);
    expect(body.page).toBe(1);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
