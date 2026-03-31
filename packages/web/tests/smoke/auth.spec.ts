import { expect, test, type Page } from "@playwright/test";

import { mockAuthenticatedApp, mockUnauthenticatedApp } from "./helpers";

test.describe("protected route redirects", () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await mockUnauthenticatedApp(page);
  });

  test("unauthenticated users are redirected to login from protected routes", async ({
    page,
  }: {
    page: Page;
  }) => {
    for (const route of ["/dashboard", "/budgets", "/recurring/income"]) {
      await page.goto(route);
      await page.waitForURL((url: URL) => url.pathname === "/login");
      await expect(page.getByText("Welcome back")).toBeVisible();
    }
  });
});

test.describe("auth route redirects", () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await mockAuthenticatedApp(page);
  });

  test("authenticated users are redirected away from auth routes", async ({
    page,
  }: {
    page: Page;
  }) => {
    for (const route of ["/login", "/register"]) {
      await page.goto(route);
      await page.waitForURL((url: URL) => url.pathname === "/dashboard");
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    }
  });
});
