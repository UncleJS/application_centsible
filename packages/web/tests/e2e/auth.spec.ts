import { test, expect, API_URL } from "./support/auth-fixtures";

test.describe("authentication", () => {
  test("unauthenticated visit redirects to /login", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test("register a new account lands on /dashboard", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    const email = `e2e-reg-${id}@e2e.local`;
    await page.goto("/register");
    await page.getByLabel("Full name").fill(`Reg User ${id}`);
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("e2e-test-password-1");
    await page.getByLabel("Confirm password").fill("e2e-test-password-1");
    await page.getByRole("button", { name: /Create account/ }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await context.close();
  });

  test("login with valid credentials lands on /dashboard", async ({ browser, registeredUser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email address").fill(registeredUser.email);
    await page.getByLabel("Password").fill(registeredUser.password);
    await page.getByRole("button", { name: /Sign in/ }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await context.close();
  });

  test("logout clears the session and redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await page.getByRole("button", { name: "Log out" }).first().click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await expect(page.getByText("Welcome back")).toBeVisible();
  });

  test("registering with a duplicate email returns 409", async ({ apiContext, registeredUser }) => {
    const res = await apiContext.post(`${API_URL}/auth/register`, {
      data: {
        email: registeredUser.email,
        password: "e2e-test-password-1",
        name: "Duplicate",
        defaultCurrency: "GBP",
      },
    });
    expect(res.status()).toBe(409);
  });

  test("login with wrong password returns 401", async ({ apiContext, registeredUser }) => {
    const res = await apiContext.post(`${API_URL}/auth/login`, {
      data: { email: registeredUser.email, password: "wrong-password-1" },
    });
    expect(res.status()).toBe(401);
  });
});
