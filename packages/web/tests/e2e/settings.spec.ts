import { test, expect } from "./support/auth-fixtures";
import { pages } from "./support/pages";

test.describe("settings", () => {
  test("updating the name persists across reloads", async ({ page }) => {
    const ui = pages(page);
    await ui.settings.goto();
    await ui.settings.nameInput().fill("Renamed User");
    await ui.settings.saveProfile();

    // Wait for the toast or for the dirty flag to clear by reloading.
    await page.reload();
    await expect(ui.settings.nameInput()).toHaveValue("Renamed User");
  });

  test("changing the default currency persists across reloads", async ({ page, registeredUser }) => {
    const target = registeredUser.defaultCurrency === "USD" ? "EUR" : "USD";
    const ui = pages(page);
    await ui.settings.goto();
    await ui.settings.setCurrency(target);
    await ui.settings.saveProfile();

    await page.reload();
    await expect(ui.settings.currencyTrigger()).toContainText(target);
  });
});
