import { test, expect } from "./support/auth-fixtures";
import { ApiClient } from "./support/api-client";

test.describe("recurring income", () => {
  test("create a recurring income entry and see it on the page", async ({
    page,
    apiContext,
    registeredUser,
  }) => {
    const api = new ApiClient(apiContext, registeredUser);
    const cats = await api.listCategories();
    const incomeCat = cats.find((c) => c.type === "income")!;

    await api.createRecurringIncome({
      name: "Day-job salary E2E",
      amount: "4200.00",
      currency: registeredUser.defaultCurrency,
      billingCycle: "monthly",
      categoryId: incomeCat.id,
    });

    await page.goto("/recurring/income");
    await expect(page.getByText("Day-job salary E2E")).toBeVisible({ timeout: 15_000 });
  });
});
