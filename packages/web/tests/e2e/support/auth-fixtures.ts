import { test as base, expect, type APIRequestContext, type Cookie } from "@playwright/test";

const API_URL = process.env.E2E_API_URL || "http://127.0.0.1:4001";

export interface RegisteredUser {
  id: number;
  email: string;
  name: string;
  password: string;
  defaultCurrency: string;
  cookies: Cookie[];
  csrfToken: string;
}

interface RegisterOptions {
  defaultCurrency?: string;
  emailPrefix?: string;
}

function parseSingleCookie(rawHeader: string): Cookie | null {
  const segments = rawHeader.split(";").map((s) => s.trim());
  const [first, ...rest] = segments;
  if (!first) return null;
  const eq = first.indexOf("=");
  if (eq <= 0) return null;
  const cookie: Cookie = {
    name: first.slice(0, eq),
    value: first.slice(eq + 1),
    domain: "127.0.0.1",
    path: "/",
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: "Strict",
  };
  for (const attr of rest) {
    const [k, v] = attr.split("=");
    const key = k.toLowerCase();
    if (key === "path") cookie.path = v || "/";
    else if (key === "httponly") cookie.httpOnly = true;
    else if (key === "secure") cookie.secure = true;
    else if (key === "samesite") {
      const sv = (v || "").toLowerCase();
      cookie.sameSite =
        sv === "lax" ? "Lax" : sv === "none" ? "None" : "Strict";
    } else if (key === "max-age") {
      const seconds = Number(v);
      if (!Number.isNaN(seconds) && seconds > 0) {
        cookie.expires = Math.floor(Date.now() / 1000) + seconds;
      }
    }
  }
  return cookie;
}

async function registerViaApi(
  request: APIRequestContext,
  options: RegisterOptions = {}
): Promise<RegisteredUser> {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const prefix = options.emailPrefix ?? "e2e";
  const email = `${prefix}-${id}@e2e.local`;
  const password = "e2e-test-password-1";
  const name = `E2E Tester ${id}`;
  const defaultCurrency = options.defaultCurrency ?? "GBP";

  const response = await request.post(`${API_URL}/auth/register`, {
    data: { email, password, name, defaultCurrency },
  });

  expect(response.status(), `register ${email} should return 201`).toBe(201);
  const body = await response.json();
  const userId = body.data.user.id as number;

  // headersArray() preserves each Set-Cookie as its own entry, so we don't
  // have to deal with comma-joined cookie strings.
  const setCookieEntries = response
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value);

  const cookies: Cookie[] = [];
  for (const entry of setCookieEntries) {
    const parsed = parseSingleCookie(entry);
    if (parsed && parsed.name.startsWith("centsible_")) cookies.push(parsed);
  }

  if (cookies.length === 0) {
    throw new Error("No centsible_* cookies in Set-Cookie headers after register");
  }
  const csrf = cookies.find((c) => c.name === "centsible_csrf_token");
  if (!csrf) {
    throw new Error("CSRF cookie missing from register response");
  }

  return {
    id: userId,
    email,
    name,
    password,
    defaultCurrency,
    cookies,
    csrfToken: csrf.value,
  };
}

export interface AuthFixtures {
  apiContext: APIRequestContext;
  registeredUser: RegisteredUser;
  registerUser: (options?: RegisterOptions) => Promise<RegisteredUser>;
}

export const test = base.extend<AuthFixtures>({
  apiContext: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({
      baseURL: API_URL,
      ignoreHTTPSErrors: true,
    });
    await use(ctx);
    await ctx.dispose();
  },

  registeredUser: async ({ apiContext }, use) => {
    const user = await registerViaApi(apiContext);
    await use(user);
  },

  registerUser: async ({ apiContext }, use) => {
    await use((options?: RegisterOptions) => registerViaApi(apiContext, options));
  },

  context: async ({ context, registeredUser }, use) => {
    await context.addCookies(registeredUser.cookies);
    await context.addInitScript((user) => {
      window.localStorage.setItem(
        "centsible-user",
        JSON.stringify({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            defaultCurrency: user.defaultCurrency,
          },
        })
      );
    }, registeredUser);
    await use(context);
  },
});

export { expect };
export { API_URL };
