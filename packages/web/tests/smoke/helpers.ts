import type { Page } from "@playwright/test";

const AUTH_USER = {
  id: 1,
  email: "smoke@example.com",
  name: "Smoke Tester",
  defaultCurrency: "GBP",
};

interface MockAppOptions {
  authenticated: boolean;
}

async function mockApp(page: Page, options: MockAppOptions) {
  await page.addInitScript(
    ({
      storageKey,
      user,
      authenticated,
    }: {
      storageKey: string;
      user: typeof AUTH_USER;
      authenticated: boolean;
    }) => {
      const readStoredUser = () => {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return null;
        try {
          return JSON.parse(raw)?.user ?? null;
        } catch {
          return null;
        }
      };

      const writeStoredUser = (nextUser: typeof user | null) => {
        if (nextUser) {
          window.localStorage.setItem(storageKey, JSON.stringify({ user: nextUser }));
        } else {
          window.localStorage.removeItem(storageKey);
        }
      };

      if (authenticated) {
        writeStoredUser(readStoredUser() ?? user);
      } else {
        writeStoredUser(null);
      }

      let currentUser = authenticated ? (readStoredUser() ?? user) : null;

      const apiOrigin = "http://localhost:4000";
      const originalFetch = window.fetch.bind(window);

      const jsonResponse = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        });

      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

        if (!requestUrl.startsWith(apiOrigin)) {
          return originalFetch(input, init);
        }

        const url = new URL(requestUrl);
        const method = (init?.method || (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET") || "GET").toUpperCase();

        if (url.pathname === "/auth/me" && method === "PATCH") {
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          currentUser = {
            ...(currentUser ?? user),
            ...body,
          };
          writeStoredUser(currentUser);
          return jsonResponse({ data: { user: currentUser } });
        }

        if (method !== "GET") {
          return jsonResponse({ data: { ok: true }, message: "ok" });
        }

        switch (url.pathname) {
          case "/auth/me":
            return authenticated
              ? jsonResponse({ data: { user: currentUser ?? user } })
              : jsonResponse({ error: "Unauthorized" }, 401);
          case "/auth/refresh":
            return authenticated
              ? jsonResponse({ ok: true })
              : jsonResponse({ error: "Unauthorized" }, 401);
          case "/categories":
            return jsonResponse({
              data: [
                { id: 1, name: "Salary", type: "income", icon: "💼", color: "#10b981", archivedAt: null },
                { id: 2, name: "Groceries", type: "expense", icon: "🛒", color: "#ef4444", archivedAt: null },
              ],
            });
          case "/subscriptions":
          case "/subscriptions/upcoming":
            return jsonResponse({ data: [] });
          case "/budgets":
            return jsonResponse({ data: [] });
          case "/savings-goals":
            return jsonResponse({ data: [] });
          case "/recurring-income":
            return jsonResponse({ data: [] });
          case "/reports/summary":
            return jsonResponse({
              data: {
                year: 2026,
                month: 3,
                totalIncome: "0.00",
                totalExpenses: "0.00",
                netAmount: "0.00",
                byCategory: [],
              },
            });
          case "/reports/trend":
          case "/reports/forecast":
            return jsonResponse({ data: [] });
          case "/exchange-rates/latest":
            return jsonResponse({
              data: {
                base: "GBP",
                date: "2026-03-31",
                rates: { GBP: 1, USD: 1.28, EUR: 1.16 },
              },
              cached: false,
            });
          case "/transactions":
            return jsonResponse({
              data: [],
              total: 0,
              page: 1,
              pageSize: 50,
              totalPages: 0,
            });
          default:
            return jsonResponse({ data: [] });
        }
      };
    },
    { storageKey: "centsible-user", user: AUTH_USER, authenticated: options.authenticated }
  );
}

export async function mockAuthenticatedApp(page: Page) {
  await mockApp(page, { authenticated: true });
}

export async function mockUnauthenticatedApp(page: Page) {
  await mockApp(page, { authenticated: false });
}

export async function expectRedirectUrl(
  page: Page,
  pathname: string,
  extras: Record<string, string>
) {
  await page.waitForURL((value: URL) => value.pathname === pathname);
  const url = new URL(page.url());

  for (const [key, expected] of Object.entries(extras)) {
    if (url.searchParams.get(key) !== expected) {
      throw new Error(`Expected query param ${key}=${expected}, received ${url.searchParams.get(key)}`);
    }
  }
}
