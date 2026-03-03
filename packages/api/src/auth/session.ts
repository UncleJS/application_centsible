import { config } from "../config";

export const ACCESS_TOKEN_COOKIE = "centsible_access_token";
export const REFRESH_TOKEN_COOKIE = "centsible_refresh_token";
export const CSRF_TOKEN_COOKIE = "centsible_csrf_token";

const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;
const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

type CookieValue = {
  value?: unknown;
  set: (config: Record<string, unknown>) => unknown;
};

type CookieJar = Record<string, CookieValue>;

function commonCookieOptions() {
  return {
    path: "/",
    sameSite: "strict" as const,
    secure: config.isProduction,
  };
}

export function generateCsrfToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function setSessionCookies(
  cookie: CookieJar,
  accessToken: string,
  refreshToken: string,
  csrfToken: string
): void {
  cookie[ACCESS_TOKEN_COOKIE].set({
    ...commonCookieOptions(),
    value: accessToken,
    httpOnly: true,
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
  });

  cookie[REFRESH_TOKEN_COOKIE].set({
    ...commonCookieOptions(),
    value: refreshToken,
    httpOnly: true,
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  });

  cookie[CSRF_TOKEN_COOKIE].set({
    ...commonCookieOptions(),
    value: csrfToken,
    httpOnly: false,
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookies(cookie: CookieJar): void {
  const expired = {
    ...commonCookieOptions(),
    value: "",
    maxAge: 0,
    expires: new Date(0),
  };

  cookie[ACCESS_TOKEN_COOKIE].set({
    ...expired,
    httpOnly: true,
  });

  cookie[REFRESH_TOKEN_COOKIE].set({
    ...expired,
    httpOnly: true,
  });

  cookie[CSRF_TOKEN_COOKIE].set({
    ...expired,
    httpOnly: false,
  });
}
