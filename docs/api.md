# API Reference

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey?style=flat)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.0-6ba539?style=flat&logo=openapiinitiative)](https://www.openapis.org)
[![Swagger UI](https://img.shields.io/badge/Swagger%20UI-%2Fdocs-85ea2d?style=flat&logo=swagger)](http://localhost:4000/docs)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat&logo=typescript)](https://www.typescriptlang.org)

Base URL (development): `http://localhost:4000`  
Base URL (production): `http://localhost:10301`

Interactive Swagger UI is available at `/docs` in any non-production environment. The raw OpenAPI spec is at `/docs/json` (redirected from `/openapi.json`).

## Table of Contents

- [Authentication Model](#authentication-model)
- [Global Conventions](#global-conventions)
- [Rate Limiting](#rate-limiting)
- [Health Check](#health-check)
- [Auth](#auth)
- [Categories](#categories)
- [Transactions](#transactions)
- [Budgets](#budgets)
- [Savings Goals](#savings-goals)
- [Subscriptions](#subscriptions)
- [Recurring Income](#recurring-income)
- [Reports](#reports)
- [Exchange Rates](#exchange-rates)

---

## Authentication Model

### Session Cookies

All auth endpoints issue three cookies on success:

| Cookie | HttpOnly | TTL | Purpose |
|---|---|---|---|
| `centsible_access_token` | Yes | 15 min | JWT used to authenticate API requests |
| `centsible_refresh_token` | Yes | 7 days | JWT used to rotate the session |
| `centsible_csrf_token` | No | 7 days | Double-submit CSRF token (readable by JS) |

Web clients must send `credentials: "include"` on every fetch so cookies are attached.

### CSRF Protection

For every **state-changing request** (`POST`, `PATCH`, `DELETE`) that is authenticated via cookie (not `Authorization: Bearer`), the API requires:

```
X-CSRF-Token: <value of centsible_csrf_token cookie>
```

If the header is missing or doesn't match the cookie, the API returns `403 Forbidden`.

`GET` and `HEAD` requests never require a CSRF token.

### Bearer Token (alternative)

Clients that cannot use cookies (e.g. mobile apps, CLI tools) may send the access token as:

```
Authorization: Bearer <access_token>
```

Bearer-authenticated requests skip the CSRF check entirely.

### Token Refresh

When any request returns `401`, send a `POST /auth/refresh` (no body required for cookie clients). On success the API rotates the session cookies and returns `200`. The old refresh token is revoked (its Argon2 hash is marked as revoked in the database) and pruned on the next login.

[↑ Go to TOC](#table-of-contents)

---

## Global Conventions

### Success responses

```jsonc
// Single resource
{ "data": { /* object */ } }

// List
{ "data": [ /* array */ ] }

// Paginated list
{
  "data": [ /* array */ ],
  "total": 47,
  "page": 1,
  "pageSize": 20,
  "totalPages": 3
}

// Action with no meaningful return value
{ "data": { "message": "..." } }
```

### Error responses

```jsonc
{ "error": "Human-readable error message" }
```

### Field types

| Type | Format | Example |
|---|---|---|
| Amounts | Decimal string, up to 2 dp | `"1234.56"` |
| Dates | ISO 8601 date string | `"2026-03-15"` |
| Timestamps | ISO 8601 datetime | `"2026-03-15T10:30:00.000Z"` |
| IDs | Integer | `42` |
| Currency codes | ISO 4217, 3 uppercase chars | `"GBP"` |

### HTTP status codes used

| Code | Meaning |
|---|---|
| `200` | OK |
| `201` | Created |
| `400` | Bad request (validation error or business rule violation) |
| `401` | Unauthorized — missing or expired access token |
| `403` | Forbidden — invalid CSRF token |
| `404` | Resource not found (or belongs to a different user) |
| `409` | Conflict — duplicate resource |
| `429` | Too many requests |
| `502` | Upstream service unavailable (exchange rate API) |
| `500` | Internal server error |

[↑ Go to TOC](#table-of-contents)

---

## Rate Limiting

All requests are rate-limited by IP address using an in-memory sliding window:

| Endpoint group | Limit |
|---|---|
| `POST /auth/*` | 10 requests / minute |
| Everything else | 100 requests / minute |

Exceeded limits return `429 Too Many Requests`.

The limiter reads `X-Forwarded-For` (first value) then `X-Real-IP` to identify the client behind a reverse proxy.

[↑ Go to TOC](#table-of-contents)

---

## Health Check

### `GET /health`

Public. No authentication required.

**Response `200`**
```json
{
  "status": "ok",
  "timestamp": "2026-03-15T10:30:00.000Z"
}
```

[↑ Go to TOC](#table-of-contents)

---

## Auth

All auth endpoints share the `/auth` prefix.  
Rate limit: **10 requests / minute / IP**.

---

### `POST /auth/register`

Create a new user account. Seeds 14 default expense categories and 5 income categories for the new user.

**Request body**

```jsonc
{
  "email": "user@example.com",        // required, valid email
  "password": "securepassword",       // required, 8–128 characters
  "name": "Jane Smith",               // required
  "defaultCurrency": "GBP"           // optional, ISO 4217, default "GBP"
}
```

**Response `201`**

Sets `centsible_access_token`, `centsible_refresh_token`, and `centsible_csrf_token` cookies.

```json
{
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "Jane Smith",
      "defaultCurrency": "GBP"
    }
  }
}
```

**Errors**

| Status | Condition |
|---|---|
| `400` | Validation failure (invalid email, password too short/long) |
| `409` | Email already registered |

---

### `POST /auth/login`

Authenticate with email and password.

**Request body**

```jsonc
{
  "email": "user@example.com",
  "password": "securepassword"        // 8–128 characters
}
```

**Response `200`**

Sets session cookies. Also prunes expired/revoked refresh tokens for the user.

```json
{
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "Jane Smith",
      "defaultCurrency": "GBP"
    }
  }
}
```

**Errors**

| Status | Condition |
|---|---|
| `400` | Validation failure or invalid credentials |

---

### `POST /auth/refresh`

Rotate the session. Validates the refresh token against its stored Argon2 hash, revokes it, and issues a new token pair.

Cookie clients send an empty body. Bearer clients may supply the refresh token in the body.

**Request body** *(all optional)*

```jsonc
{
  "refreshToken": "eyJ..."  // optional — uses cookie if omitted
}
```

**Response `200`**

Replaces all three session cookies.

```json
{ "data": { "ok": true } }
```

**Errors**

| Status | Condition |
|---|---|
| `401` | Refresh token missing, invalid, expired, or revoked |

---

### `POST /auth/logout`

Revoke the current refresh token and clear all session cookies. Always returns success (to avoid information leaks).

**Request body** *(all optional)*

```jsonc
{
  "refreshToken": "eyJ..."  // optional — uses cookie if omitted
}
```

Cookie clients: Include `X-CSRF-Token` header.

**Response `200`**

```json
{ "data": { "message": "Logged out successfully" } }
```

---

### `GET /auth/me`

Returns the authenticated user's profile. Requires a valid session.

**Response `200`**

```json
{
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "Jane Smith",
      "defaultCurrency": "GBP"
    }
  }
}
```

---

### `PATCH /auth/me`

Update the authenticated user's profile. All fields are optional; only supplied fields are changed.

Cookie clients must include `X-CSRF-Token`.

**Request body** *(all optional)*

```jsonc
{
  "name": "Jane Doe",             // 1–100 characters
  "defaultCurrency": "EUR"        // ISO 4217 3-char code
}
```

**Response `200`** — returns the updated user object (same shape as `GET /auth/me`).

**Errors**

| Status | Condition |
|---|---|
| `400` | Validation failure (name too long, unsupported currency code) |

[↑ Go to TOC](#table-of-contents)

---

## Categories

All endpoints require authentication.

---

### `GET /categories`

List all active (non-archived) categories for the authenticated user, ordered by name.

**Response `200`**

```json
{
  "data": [
    {
      "id": 1,
      "userId": 1,
      "name": "Food & Groceries",
      "icon": "🛒",
      "color": "#22c55e",
      "type": "expense",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "archivedAt": null
    }
  ]
}
```

---

### `POST /categories`

Create a new category. Rejects duplicates with the same `name` + `type` combination for the user.

**Request body**

```jsonc
{
  "name": "Side Projects",            // required, 1–50 characters
  "type": "income",                   // required, "income" | "expense"
  "icon": "💻",                       // optional, max 10 characters
  "color": "#3b82f6"                  // optional, hex color #RRGGBB
}
```

**Response `201`**

```json
{
  "data": {
    "id": 15,
    "userId": 1,
    "name": "Side Projects",
    "icon": "💻",
    "color": "#3b82f6",
    "type": "income",
    "createdAt": "2026-03-15T10:00:00.000Z",
    "updatedAt": "2026-03-15T10:00:00.000Z",
    "archivedAt": null
  }
}
```

**Errors**

| Status | Condition |
|---|---|
| `409` | An `income` category named "Side Projects" already exists |

---

### `PATCH /categories/:id`

Update a category's name, icon, or color. The `type` field cannot be changed after creation.

**Request body** *(all optional)*

```jsonc
{
  "name": "Freelance",
  "icon": "🖥️",
  "color": "#6366f1"
}
```

**Response `200`** — returns the updated category object.

**Errors**

| Status | Condition |
|---|---|
| `404` | Category not found or belongs to another user |

---

### `DELETE /categories/:id`

Archive (soft-delete) a category. Transactions linked to this category are unaffected.

> Archiving only sets `archivedAt` on the category row — it does not cascade to linked transactions, budgets, or subscriptions.

**Response `200`**

```json
{ "data": { "message": "Category archived" } }
```

---

### `POST /categories/:id/restore`

Restore an archived category (sets `archivedAt = null`).

**Response `200`** — returns the restored category object.

**Errors**

| Status | Condition |
|---|---|
| `400` | Category is not archived |
| `404` | Category not found |

[↑ Go to TOC](#table-of-contents)

---

## Transactions

All endpoints require authentication.

---

### `GET /transactions`

List transactions with optional filtering and pagination. Results are ordered by `date DESC`, then `id DESC`.

**Query parameters** *(all optional)*

| Parameter | Type | Description |
|---|---|---|
| `type` | `income` \| `expense` | Filter by transaction type |
| `categoryId` | integer | Filter by category ID |
| `dateFrom` | `YYYY-MM-DD` | Include transactions on or after this date (also accepts `from`) |
| `dateTo` | `YYYY-MM-DD` | Include transactions on or before this date (also accepts `to`) |
| `search` | string | Case-insensitive description contains search (truncated to 100 chars) |
| `page` | integer | Page number, default `1` |
| `pageSize` | integer | Results per page, default `20`, max `100` |

**Response `200`**

```json
{
  "data": [
    {
      "id": 42,
      "userId": 1,
      "categoryId": 3,
      "categoryName": "Food & Groceries",
      "categoryIcon": "🛒",
      "categoryColor": "#22c55e",
      "type": "expense",
      "amount": "45.00",
      "currency": "GBP",
      "convertedAmount": null,
      "description": "Weekly shop",
      "date": "2026-03-14",
      "subscriptionId": null,
      "createdAt": "2026-03-14T09:00:00.000Z",
      "updatedAt": "2026-03-14T09:00:00.000Z"
    }
  ],
  "total": 128,
  "page": 1,
  "pageSize": 20,
  "totalPages": 7
}
```

---

### `POST /transactions`

Create a transaction. The `type` must match the `type` of the specified category.

**Request body**

```jsonc
{
  "categoryId": 3,                    // required, must belong to authenticated user
  "type": "expense",                  // required, "income" | "expense"
  "amount": "45.00",                  // required, decimal string ≥ 0, max 2 dp
  "currency": "GBP",                  // required, ISO 4217 3-char code
  "date": "2026-03-14",               // required, YYYY-MM-DD
  "description": "Weekly shop",       // optional, max 255 characters
  "subscriptionId": null              // optional, link to a subscription
}
```

**Response `201`** — returns the created transaction object (same shape as list items, without category join fields).

**Errors**

| Status | Condition |
|---|---|
| `400` | Category not found, category is archived, or `type` doesn't match category type |

---

### `PATCH /transactions/:id`

Partially update a transaction. All fields are optional.

**Request body** *(all optional)*

```jsonc
{
  "categoryId": 5,
  "type": "expense",
  "amount": "50.00",
  "currency": "GBP",
  "description": "Updated description",
  "date": "2026-03-15",
  "subscriptionId": null
}
```

**Response `200`** — returns the updated transaction object.

**Errors**

| Status | Condition |
|---|---|
| `400` | New `categoryId` not found or `type` mismatch |
| `404` | Transaction not found or belongs to another user |

---

### `DELETE /transactions/:id`

Archive (soft-delete) a transaction.

**Response `200`**

```json
{ "data": { "message": "Transaction archived" } }
```

[↑ Go to TOC](#table-of-contents)

---

## Budgets

All endpoints require authentication.

Budgets can be set for any category type (`income` or `expense`). Expense budgets are used for spending tracking and expense projections in the forecast; income budgets feed into projected income in the forecast.

---

### `GET /budgets`

List budgets for a given month. Each expense-category row includes `spent` — the sum of all non-archived expense transactions for that category in the period.

**Query parameters** *(all optional, default to current year/month)*

| Parameter | Type | Validation |
|---|---|---|
| `year` | integer | 2020–2100 |
| `month` | integer | 1–12 |

**Response `200`**

```json
{
  "data": [
    {
      "id": 7,
      "userId": 1,
      "categoryId": 3,
      "categoryName": "Food & Groceries",
      "categoryIcon": "🛒",
      "categoryColor": "#22c55e",
      "year": 2026,
      "month": 3,
      "amount": "300.00",
      "currency": "GBP",
      "spent": "128.50",
      "createdAt": "2026-03-01T00:00:00.000Z",
      "updatedAt": "2026-03-01T00:00:00.000Z"
    }
  ]
}
```

---

### `POST /budgets`

Create or update a budget (upsert). The unique constraint is `(userId, categoryId, year, month)` — if a budget already exists for that combination it is updated in place.

**Request body**

```jsonc
{
  "categoryId": 3,        // required, must belong to user
  "year": 2026,           // required, 2020–2100
  "month": 3,             // required, 1–12
  "amount": "300.00",     // required, decimal string
  "currency": "GBP"       // required
}
```

**Response `200`** — returns the upserted budget row (without `spent`).

---

### `PATCH /budgets/:id`

Update the amount of an existing budget.

**Request body**

```jsonc
{
  "amount": "350.00"    // required
}
```

**Response `200`** — returns the updated budget row.

**Errors**

| Status | Condition |
|---|---|
| `404` | Budget not found |

---

### `DELETE /budgets/:id`

Archive a budget.

**Response `200`**

```json
{ "data": { "message": "Budget archived" } }
```

[↑ Go to TOC](#table-of-contents)

---

## Savings Goals

All endpoints require authentication.

---

### `GET /savings-goals`

List all active savings goals for the user, ordered by `targetDate` ascending.

**Response `200`**

```json
{
  "data": [
    {
      "id": 2,
      "userId": 1,
      "name": "Emergency Fund",
      "description": "3 months of expenses",
      "targetAmount": "5000.00",
      "currentAmount": "2150.00",
      "currency": "GBP",
      "targetDate": "2026-12-31",
      "icon": "🏦",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-03-01T00:00:00.000Z",
      "archivedAt": null
    }
  ]
}
```

---

### `GET /savings-goals/:id`

Get a single savings goal with its full contribution history.

**Response `200`**

```json
{
  "data": {
    "id": 2,
    "name": "Emergency Fund",
    "targetAmount": "5000.00",
    "currentAmount": "2150.00",
    "currency": "GBP",
    "targetDate": "2026-12-31",
    "contributions": [
      {
        "id": 1,
        "savingsGoalId": 2,
        "amount": "500.00",
        "currency": "GBP",
        "note": "January transfer",
        "date": "2026-01-31",
        "createdAt": "2026-01-31T18:00:00.000Z",
        "archivedAt": null
      }
    ]
  }
}
```

---

### `POST /savings-goals`

Create a new savings goal.

**Request body**

```jsonc
{
  "name": "New Car",              // required, 1–100 characters
  "targetAmount": "10000.00",     // required, decimal string
  "currency": "GBP",              // required
  "targetDate": "2027-06-01",     // required, YYYY-MM-DD
  "description": "Used car",      // optional, max 500 characters
  "icon": "🚗"                    // optional, max 10 characters
}
```

**Response `201`** — returns the created goal object.

---

### `PATCH /savings-goals/:id`

Update a savings goal. All fields optional.

**Request body** *(all optional)*

```jsonc
{
  "name": "New Car Fund",
  "targetAmount": "12000.00",
  "currency": "GBP",
  "targetDate": "2027-09-01",
  "description": "Updated",
  "icon": "🚙"
}
```

**Response `200`** — returns the updated goal object.

---

### `POST /savings-goals/:id/contribute`

Add a contribution to a savings goal. The goal's `currentAmount` is incremented atomically using a SQL expression to avoid race conditions.

**Request body**

```jsonc
{
  "amount": "250.00",         // required, decimal string
  "currency": "GBP",          // required
  "note": "March top-up",     // optional, max 255 characters
  "date": "2026-03-15"        // optional, YYYY-MM-DD, defaults to today
}
```

**Response `201`** — returns the created contribution object.

---

### `DELETE /savings-goals/:id`

Archive a savings goal.

**Response `200`**

```json
{ "data": { "message": "Savings goal archived" } }
```

[↑ Go to TOC](#table-of-contents)

---

## Subscriptions

All endpoints require authentication.

---

### `GET /subscriptions`

List all active subscriptions, ordered by `nextRenewalDate` ascending. Includes joined category name and icon.

**Response `200`**

```json
{
  "data": [
    {
      "id": 5,
      "userId": 1,
      "categoryId": 10,
      "categoryName": "Subscriptions",
      "categoryIcon": "📱",
      "name": "Netflix",
      "description": null,
      "amount": "17.99",
      "currency": "GBP",
      "billingCycle": "monthly",
      "nextRenewalDate": "2026-04-01",
      "startDate": "2024-01-01",
      "url": "https://netflix.com",
      "autoRenew": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2026-03-01T00:00:00.000Z"
    }
  ]
}
```

---

### `GET /subscriptions/upcoming`

List subscriptions renewing within the next N days.

**Query parameters**

| Parameter | Default | Description |
|---|---|---|
| `days` | `30` | Look-ahead window in days |

**Response `200`** — array of compact subscription objects:

```json
{
  "data": [
    {
      "id": 5,
      "name": "Netflix",
      "amount": "17.99",
      "currency": "GBP",
      "billingCycle": "monthly",
      "nextRenewalDate": "2026-03-20",
      "categoryName": "Subscriptions",
      "categoryIcon": "📱"
    }
  ]
}
```

---

### `POST /subscriptions`

Create a new subscription.

**Request body**

```jsonc
{
  "name": "Spotify",                    // required, 1–100 characters
  "amount": "11.99",                    // required, decimal string
  "currency": "GBP",                    // required
  "billingCycle": "monthly",            // required: "weekly" | "fortnightly" | "monthly" | "quarterly" | "yearly"
  "nextRenewalDate": "2026-04-05",      // required, YYYY-MM-DD
  "startDate": "2023-04-05",           // required, YYYY-MM-DD
  "categoryId": 10,                     // optional, must belong to user
  "description": null,                  // optional, max 500 characters
  "url": "https://spotify.com",         // optional, must start with http:// or https://
  "autoRenew": true                     // optional, default true
}
```

**Response `201`** — returns the created subscription object.

---

### `PATCH /subscriptions/:id`

Update a subscription. All fields optional.

**Request body** — same fields as `POST`, all optional.

**Response `200`** — returns the updated subscription object.

---

### `DELETE /subscriptions/:id`

Archive a subscription.

**Response `200`**

```json
{ "data": { "message": "Subscription archived" } }
```

[↑ Go to TOC](#table-of-contents)

---

## Recurring Income

All endpoints require authentication.

Recurring income sources represent predictable income streams (e.g. salary, pension, freelance retainer). Unlike subscriptions, they have no renewal dates — they recur on a billing cycle and are projected forward in the forecast.

---

### `GET /recurring-income`

List all active (non-archived) recurring income sources for the user, ordered by name. Includes joined category name and icon.

**Response `200`**

```json
{
  "data": [
    {
      "id": 3,
      "userId": 1,
      "categoryId": 1,
      "categoryName": "Salary",
      "categoryIcon": "💼",
      "name": "Monthly Salary",
      "description": null,
      "amount": "3500.00",
      "currency": "GBP",
      "billingCycle": "monthly",
      "autoRenew": true,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "archivedAt": null
    }
  ]
}
```

---

### `POST /recurring-income`

Create a new recurring income source.

**Request body**

```jsonc
{
  "name": "Monthly Salary",             // required, 1–100 characters
  "amount": "3500.00",                  // required, decimal string (≥0, max 2 dp)
  "currency": "GBP",                    // required, ISO 4217 3-char code
  "billingCycle": "monthly",            // required: "weekly" | "fortnightly" | "monthly" | "quarterly" | "yearly"
  "categoryId": 1,                      // optional, must belong to user and be active
  "description": null,                  // optional, max 500 characters
  "autoRenew": true                     // optional, default true; false excludes from forecasts
}
```

**Response `201`** — returns the created recurring income object (same shape as list items, without category join fields).

**Errors**

| Status | Condition |
|---|---|
| `400` | `categoryId` not found, archived, or belongs to another user |

---

### `PATCH /recurring-income/:id`

Update a recurring income source. All fields optional.

**Request body** *(all optional)*

```jsonc
{
  "name": "Salary (updated)",
  "amount": "3800.00",
  "currency": "GBP",
  "billingCycle": "monthly",
  "categoryId": 2,
  "description": "Post-raise salary",
  "autoRenew": true
}
```

**Response `200`** — returns the updated recurring income object.

**Errors**

| Status | Condition |
|---|---|
| `400` | `categoryId` not found, archived, or belongs to another user |
| `404` | Recurring income source not found or belongs to another user |

---

### `DELETE /recurring-income/:id`

Archive (soft-delete) a recurring income source. The record is preserved in the database with `archivedAt` set.

**Response `200`**

```json
{ "data": { "message": "Recurring income archived" } }
```

**Errors**

| Status | Condition |
|---|---|
| `404` | Recurring income source not found or belongs to another user |

[↑ Go to TOC](#table-of-contents)

---

## Reports

All endpoints require authentication.

---

### `GET /reports/summary`

Monthly income/expense summary with per-category breakdown and budget utilisation percentages.

**Query parameters** *(default to current year/month)*

| Parameter | Type | Validation |
|---|---|---|
| `year` | integer | 2000–2100 |
| `month` | integer | 1–12 |

**Response `200`**

```json
{
  "data": {
    "year": 2026,
    "month": 3,
    "totalIncome": "3500.00",
    "totalExpenses": "1823.45",
    "netAmount": "1676.55",
    "byCategory": [
      {
        "categoryId": 3,
        "categoryName": "Food & Groceries",
        "categoryIcon": "🛒",
        "categoryColor": "#22c55e",
        "type": "expense",
        "totalAmount": "128.50",
        "budgetAmount": "300.00",
        "percentUsed": 43,
        "transactionCount": 6
      }
    ]
  }
}
```

`budgetAmount` is `null` if no budget is set for that category/month. `percentUsed` is `null` when `budgetAmount` is `null`.

---

### `GET /reports/forecast`

Forward-looking financial forecast using current budgets (expense and income), subscriptions, recurring income sources, and savings goal contribution schedules.

**Query parameters**

| Parameter | Default | Constraints |
|---|---|---|
| `months` | `3` | 1–12 |

**Response `200`**

```json
{
  "data": [
    {
      "year": 2026,
      "month": 4,
      "projectedExpenses": "850.00",
      "projectedIncome": "3500.00",
      "subscriptionCosts": "47.98",
      "recurringIncomeSources": "3500.00",
      "savingsContributions": "416.67",
      "totalProjected": "2233.35",
      "items": [
        {
          "name": "Monthly Salary",
          "amount": "3500.00",
          "currency": "GBP",
          "date": "2026-04-01",
          "type": "recurring-income",
          "sourceId": 3
        },
        {
          "name": "Income: Freelance",
          "amount": "500.00",
          "currency": "GBP",
          "date": "2026-04-01",
          "type": "income-budget",
          "sourceId": 8
        },
        {
          "name": "Netflix",
          "amount": "17.99",
          "currency": "GBP",
          "date": "2026-04-01",
          "type": "subscription",
          "sourceId": 5
        },
        {
          "name": "Budget: Food & Groceries",
          "amount": "300.00",
          "currency": "GBP",
          "date": "2026-04-01",
          "type": "budget",
          "sourceId": 3
        },
        {
          "name": "Savings: Emergency Fund",
          "amount": "416.67",
          "currency": "GBP",
          "date": "2026-04-01",
          "type": "savings",
          "sourceId": 2
        }
      ]
    }
  ]
}
```

#### Response fields

| Field | Description |
|---|---|
| `projectedExpenses` | Total of expense-category budget allocations |
| `projectedIncome` | Total of all projected income (`recurringIncomeSources + budgetedIncome`) |
| `subscriptionCosts` | Total of subscription renewal amounts for the month |
| `recurringIncomeSources` | Total from recurring income sources only |
| `savingsContributions` | Total of projected savings goal contributions |
| `totalProjected` | **Net figure**: `projectedIncome − (projectedExpenses + subscriptionCosts + savingsContributions)`. Positive = surplus, negative = deficit. |
| `items` | Individual line items sorted by date ascending |

#### Forecast item `type` values

| Value | Side | Description |
|---|---|---|
| `"recurring-income"` | income | A recurring income source firing this month |
| `"income-budget"` | income | An income-category budget allocation |
| `"subscription"` | expense | A subscription renewal occurring this month |
| `"budget"` | expense | An expense-category budget allocation |
| `"savings"` | expense | Projected savings goal contribution |

#### Subscription renewal logic

`getSubscriptionRenewalsInMonth()` steps through actual calendar dates starting from `nextRenewalDate`, advancing by the billing cycle, and collects every date that falls within the target month.

- Subscriptions with `autoRenew: false` are excluded entirely.
- Weekly and fortnightly subscriptions advance by the exact number of days; monthly and longer advance by whole calendar months.
- A subscription can produce **multiple renewal items** in one month (e.g. a weekly subscription renews 4–5 times).

#### Recurring income firing logic

- `autoRenew: false` → excluded entirely.
- `billingCycle` with `cycleMonths ≤ 1` (weekly, fortnightly, monthly) → fires every forecast month.
- `billingCycle` with `cycleMonths > 1` (quarterly = 3, yearly = 12) → fires when `(year × 12 + month − 1) % round(cycleMonths) === 0`.

#### Savings contribution calculation

For each forecast month, the projected contribution per goal is:

```
monthlyContribution = remainingAmount / monthsRemaining
```

Where:
- `remainingAmount` = `targetAmount − currentAmount`
- `monthsRemaining` = months from **the forecast month** to `targetDate` (minimum 1)

Because `monthsRemaining` shrinks as the forecast advances into the future, the projected monthly contribution **increases over time** — reflecting the reality that the closer a deadline gets, the more needs to be set aside each month to stay on track.

A goal only appears in a forecast month if `forecastMonthStart ≤ targetDate` (i.e. the deadline has not yet passed). Goals where `currentAmount ≥ targetAmount` are excluded entirely.

---

### `GET /reports/trend`

Historical income and expense totals by month, in chronological order. Returns zeroes for months with no transactions.

**Query parameters**

| Parameter | Default | Constraints |
|---|---|---|
| `months` | `6` | 1–24 |

**Response `200`**

```json
{
  "data": [
    {
      "year": 2025,
      "month": 10,
      "income": "3200.00",
      "expenses": "1945.22",
      "net": "1254.78"
    },
    {
      "year": 2025,
      "month": 11,
      "income": "0.00",
      "expenses": "0.00",
      "net": "0.00"
    }
  ]
}
```

---

### `GET /reports/export`

Export a month's transactions as a CSV file. The response has `Content-Type: text/csv` and a `Content-Disposition: attachment` header.

**Query parameters** *(default to current year/month)*

| Parameter | Type |
|---|---|
| `year` | integer |
| `month` | integer |

**Response `200`**

```
Date,Type,Category,Description,Amount,Currency
2026-03-14,expense,Food & Groceries,Weekly shop,45.00,GBP
2026-03-10,income,Salary,March salary,3500.00,GBP
```

CSV cells starting with `=`, `+`, `-`, `@`, tab, or carriage return are prefixed with a single quote to prevent formula injection when opened in spreadsheet applications.

**Filename:** `centsible-YYYY-MM.csv`

[↑ Go to TOC](#table-of-contents)

---

## Exchange Rates

All endpoints require authentication. Exchange rates are fetched from [Frankfurter API](https://www.frankfurter.app/) and cached locally by date. If the upstream service is unavailable, the API falls back to cached rates.

---

### `GET /exchange-rates/latest`

Fetch and cache today's rates from a base currency. Optionally filter to a single target currency.

**Query parameters**

| Parameter | Default | Description |
|---|---|---|
| `base` | `GBP` | Base currency (ISO 4217) |
| `target` | *(all)* | Optional target currency |

**Response `200`**

```json
{
  "data": {
    "base": "GBP",
    "date": "2026-03-15",
    "rates": {
      "USD": 1.2647,
      "EUR": 1.1832
    }
  }
}
```

When served from the local cache (upstream unavailable), the response includes `"cached": true`.

**Errors**

| Status | Condition |
|---|---|
| `400` | Unsupported currency code |
| `502` | Upstream unavailable and no cached data |

---

### `GET /exchange-rates/convert`

Convert an amount between two currencies.

**Query parameters** *(all required)*

| Parameter | Description |
|---|---|
| `from` | Source currency |
| `to` | Target currency |
| `amount` | Amount to convert (positive number, max 1,000,000,000) |

**Response `200`**

```json
{
  "data": {
    "base": "GBP",
    "date": "2026-03-15",
    "rates": {
      "USD": 158.09
    }
  }
}
```

*(Response shape is the raw Frankfurter API response.)*

**Errors**

| Status | Condition |
|---|---|
| `400` | Missing parameters, unsupported currency, non-positive or over-limit amount |
| `502` | Upstream unavailable |

---

### `GET /exchange-rates/currencies`

List all supported currency codes.

**Response `200`**

```json
{
  "data": [
    "GBP", "USD", "EUR", "CAD", "AUD", "NZD", "CHF", "JPY",
    "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON", "BGN",
    "HRK", "ISK", "TRY", "ZAR", "BRL", "MXN", "SGD", "HKD",
    "KRW", "INR", "CNY", "THB", "MYR", "PHP", "IDR"
  ]
}
```

[↑ Go to TOC](#table-of-contents)

---

&copy; 2026 UncleJs — Licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
