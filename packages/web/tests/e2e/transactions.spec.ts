import { test, expect } from "./support/auth-fixtures";
import { ApiClient } from "./support/api-client";
import { pages } from "./support/pages";

const TODAY = new Date().toISOString().slice(0, 10);

test.describe("transactions CRUD", () => {
  test("create an expense via the dialog", async ({ page, apiContext, registeredUser }) => {
    const api = new ApiClient(apiContext, registeredUser);
    const cats = await api.listCategories();
    const groceries = cats.find((c) => c.type === "expense" && /grocer/i.test(c.name));
    expect(groceries, "default seed should include a groceries-style expense category").toBeTruthy();

    const ui = pages(page);
    await ui.transactions.goto();
    await ui.transactions.openAddDialog();
    await ui.transactions.fillDialog({
      description: "Weekly food shop",
      amount: "42.50",
      type: "expense",
      categoryName: groceries!.name,
      date: TODAY,
    });
    await ui.transactions.submitDialog();

    await expect(ui.transactions.rowByDescription("Weekly food shop")).toBeVisible();
  });

  test("edit a transaction's description", async ({ page, apiContext, registeredUser }) => {
    const api = new ApiClient(apiContext, registeredUser);
    const cats = await api.listCategories();
    const cat = cats.find((c) => c.type === "expense")!;
    await api.createTransaction({
      categoryId: cat.id,
      type: "expense",
      amount: "10.00",
      currency: registeredUser.defaultCurrency,
      description: "Original description",
      date: TODAY,
    });

    const ui = pages(page);
    await ui.transactions.goto();
    await ui.transactions.editRow("Original description");
    await page.locator("#tx-description").fill("Updated description");
    await ui.transactions.submitDialog(true);

    await expect(ui.transactions.rowByDescription("Updated description")).toBeVisible();
    await expect(ui.transactions.rowByDescription("Original description")).toHaveCount(0);
  });

  test("delete a transaction", async ({ page, apiContext, registeredUser }) => {
    const api = new ApiClient(apiContext, registeredUser);
    const cats = await api.listCategories();
    const cat = cats.find((c) => c.type === "expense")!;
    await api.createTransaction({
      categoryId: cat.id,
      type: "expense",
      amount: "5.00",
      currency: registeredUser.defaultCurrency,
      description: "Disposable row",
      date: TODAY,
    });

    const ui = pages(page);
    await ui.transactions.goto();
    await expect(ui.transactions.rowByDescription("Disposable row")).toBeVisible();
    await ui.transactions.deleteRow("Disposable row");
  });

  test("filter by type narrows the list", async ({ page, apiContext, registeredUser }) => {
    const api = new ApiClient(apiContext, registeredUser);
    const cats = await api.listCategories();
    const expenseCat = cats.find((c) => c.type === "expense")!;
    const incomeCat = cats.find((c) => c.type === "income")!;
    await api.createTransaction({
      categoryId: expenseCat.id,
      type: "expense",
      amount: "10.00",
      currency: registeredUser.defaultCurrency,
      description: "Expense row",
      date: TODAY,
    });
    await api.createTransaction({
      categoryId: incomeCat.id,
      type: "income",
      amount: "100.00",
      currency: registeredUser.defaultCurrency,
      description: "Income row",
      date: TODAY,
    });

    const ui = pages(page);
    await ui.transactions.goto();
    await expect(ui.transactions.rowByDescription("Expense row")).toBeVisible();
    await expect(ui.transactions.rowByDescription("Income row")).toBeVisible();

    await ui.transactions.filterByType("income");
    await expect(ui.transactions.rowByDescription("Expense row")).toHaveCount(0);
    await expect(ui.transactions.rowByDescription("Income row")).toBeVisible();
  });
});
