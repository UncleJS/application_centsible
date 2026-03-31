import { expect, test, type Page } from "@playwright/test";

import { mockAuthenticatedApp } from "./helpers";

test.beforeEach(async ({ page }: { page: Page }) => {
  await mockAuthenticatedApp(page);
});

test("settings updates persist across reloads", async ({ page }: { page: Page }) => {
  await page.goto("/settings");

  const nameInput = page.locator("#settings-name");
  const currencyTrigger = page.getByRole("combobox");
  const saveButton = page.getByRole("button", { name: "Save changes" });

  await expect(nameInput).toHaveValue("Smoke Tester");
  await expect(currencyTrigger).toContainText("GBP");
  await expect(saveButton).toBeDisabled();

  await nameInput.fill("Smoke Updated");
  await currencyTrigger.click();
  await page.getByRole("option", { name: "USD" }).click();

  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  await expect(page.getByText("Settings saved.")).toBeVisible();
  await expect(saveButton).toBeDisabled();

  await page.reload();

  await expect(page.locator("#settings-name")).toHaveValue("Smoke Updated");
  await expect(page.getByRole("combobox")).toContainText("USD");
});
