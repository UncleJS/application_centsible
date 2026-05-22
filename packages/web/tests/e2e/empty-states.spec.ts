import { test, expect } from "./support/auth-fixtures";

// A freshly-registered user has no transactions, budgets, subscriptions,
// recurring income, or savings goals. Each page should render its empty CTA
// without crashing.

test.describe("empty states", () => {
  test("transactions page shows the empty CTA", async ({ page }) => {
    await page.goto("/transactions");
    await expect(page.getByText(/No transactions yet/i)).toBeVisible({ timeout: 15_000 });
  });

  test("budgets page renders for a user with no budgets", async ({ page }) => {
    await page.goto("/budgets");
    await expect(page).toHaveURL(/\/budgets/);
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  });

  test("subscriptions page renders for a user with no subscriptions", async ({ page }) => {
    await page.goto("/recurring/subscriptions");
    await expect(page).toHaveURL(/recurring\/subscriptions/);
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  });

  test("recurring income page renders for a user with no entries", async ({ page }) => {
    await page.goto("/recurring/income");
    await expect(page).toHaveURL(/recurring\/income/);
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  });

  test("savings page renders for a user with no goals", async ({ page }) => {
    await page.goto("/savings");
    await expect(page).toHaveURL(/\/savings/);
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  });
});
