import { expect, test, type Page } from "@playwright/test";

import { expectRedirectUrl, mockAuthenticatedApp } from "./helpers";

interface LegacyRedirectCase {
  from: string;
  to: string;
  heading: string;
  extras: Record<string, string>;
}

test.beforeEach(async ({ page }: { page: Page }) => {
  await mockAuthenticatedApp(page);
});

test("legacy routes redirect to grouped destinations with tracking", async ({ page }: { page: Page }) => {
  const cases: LegacyRedirectCase[] = [
    {
      from: "/subscriptions?ref=sidebar",
      to: "/recurring/subscriptions",
      heading: "Subscriptions",
      extras: {
        ref: "sidebar",
        utm_source: "legacy-route",
        utm_medium: "redirect",
        utm_campaign: "navigation-regrouping",
        utm_content: "subscriptions",
      },
    },
    {
      from: "/reports",
      to: "/insights/reports",
      heading: "Reports & Analytics",
      extras: {
        utm_source: "legacy-route",
        utm_medium: "redirect",
        utm_campaign: "navigation-regrouping",
        utm_content: "reports",
      },
    },
    {
      from: "/forecast",
      to: "/insights/forecast",
      heading: "Forward Forecast",
      extras: {
        utm_source: "legacy-route",
        utm_medium: "redirect",
        utm_campaign: "navigation-regrouping",
        utm_content: "forecast",
      },
    },
    {
      from: "/categories/expense",
      to: "/categories",
      heading: "Categories",
      extras: {
        tab: "expense",
        utm_source: "legacy-route",
        utm_medium: "redirect",
        utm_campaign: "navigation-regrouping",
        utm_content: "categories/expense",
      },
    },
    {
      from: "/categories/income?utm_source=keepme",
      to: "/categories",
      heading: "Categories",
      extras: {
        tab: "income",
        utm_source: "keepme",
        utm_medium: "redirect",
        utm_campaign: "navigation-regrouping",
        utm_content: "categories/income",
      },
    },
  ];

  for (const item of cases) {
    await page.goto(item.from);
    await expectRedirectUrl(page, item.to, item.extras);
    await expect(page.getByRole("heading", { name: item.heading })).toBeVisible();
  }
});

test("grouped routes render and desktop navigation exposes regrouped information architecture", async ({ page }: { page: Page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Categories" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Subscriptions" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Income Sources" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reports" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Forecast" })).toBeVisible();

  await page.goto("/recurring/income");
  await expect(page.getByRole("heading", { name: "Income sources" })).toBeVisible();

  await page.goto("/insights/reports");
  await expect(page.getByRole("heading", { name: "Reports & Analytics" })).toBeVisible();

  await page.goto("/categories?tab=income");
  await expect(page.getByRole("tab", { name: "Income" })).toHaveAttribute("data-state", "active");
});

test("mobile navigation shows primary tabs and overflow destinations", async ({ page }: { page: Page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");

  await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Activity" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Budgets" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Goals" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Insights" })).toBeVisible();

  await page.getByRole("button", { name: "Open navigation menu" }).click();

  await expect(page.getByRole("link", { name: "Categories" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Subscriptions" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Income Sources" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Forecast" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
});
