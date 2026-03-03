# Centsible — User Guide

Centsible is a self-hosted personal finance tracker. This guide walks you through every feature of the application: what it does, how to use it, and the rules that govern how numbers are calculated.

## Table of Contents

- [Getting Started](#getting-started)
  - [Creating an Account](#creating-an-account)
  - [Logging In and Out](#logging-in-and-out)
  - [Sessions and Security](#sessions-and-security)
- [Dashboard](#dashboard)
  - [Summary Cards](#summary-cards)
  - [Budget Progress](#budget-progress)
  - [Upcoming Subscriptions](#upcoming-subscriptions)
  - [Savings Goals Summary](#savings-goals-summary)
- [Transactions](#transactions)
  - [Recording a Transaction](#recording-a-transaction)
  - [Editing and Deleting](#editing-and-deleting)
  - [Filtering and Searching](#filtering-and-searching)
- [Budgets](#budgets)
  - [Setting a Budget](#setting-a-budget)
  - [How Budget Spending is Calculated](#how-budget-spending-is-calculated)
  - [Budget Colour Indicators](#budget-colour-indicators)
- [Subscriptions](#subscriptions)
  - [Adding a Subscription](#adding-a-subscription)
  - [Billing Cycles](#billing-cycles)
  - [Upcoming Renewals](#upcoming-renewals)
- [Savings Goals](#savings-goals)
  - [Creating a Goal](#creating-a-goal)
  - [Adding Contributions](#adding-contributions)
  - [Monthly Saving Needed](#monthly-saving-needed)
  - [Goal Status Indicators](#goal-status-indicators)
- [Categories](#categories)
  - [Default Categories](#default-categories)
  - [Managing Expense Categories](#managing-expense-categories)
  - [Managing Income Categories](#managing-income-categories)
- [Reports](#reports)
  - [Monthly Summary](#monthly-summary)
  - [Trend Chart](#trend-chart)
  - [CSV Export](#csv-export)
- [Forecast](#forecast)
  - [How the Forecast Works](#how-the-forecast-works)
  - [Subscription Costs in the Forecast](#subscription-costs-in-the-forecast)
  - [Budget Costs in the Forecast](#budget-costs-in-the-forecast)
  - [Savings Contributions in the Forecast](#savings-contributions-in-the-forecast)
- [Settings](#settings)
  - [Changing Your Name](#changing-your-name)
  - [Changing Your Default Currency](#changing-your-default-currency)
- [Multi-Currency Support](#multi-currency-support)
- [Data and Privacy](#data-and-privacy)

---

## Getting Started

### Creating an Account

Navigate to `/register`. Fill in:

| Field | Required | Notes |
|---|---|---|
| Name | Yes | Your display name shown on the dashboard and in the sidebar |
| Email address | Yes | Used to log in; must be unique |
| Password | Yes | 8–128 characters |
| Default currency | No | ISO 4217 code (e.g. `GBP`, `USD`, `ZAR`); defaults to `GBP` if omitted |

After registering you are automatically logged in and taken to the dashboard. Your account is seeded with **14 default expense categories** and **5 default income categories** — see [Default Categories](#default-categories).

### Logging In and Out

- **Login:** `/login` — enter your email and password.
- **Logout:** Click the log-out icon (→) at the bottom of the sidebar next to your name.

### Sessions and Security

Centsible uses HttpOnly cookie-based authentication. Two tokens are issued on login:

| Token | Lifetime | Stored as |
|---|---|---|
| Access token | 15 minutes | HttpOnly cookie — not readable by JavaScript |
| Refresh token | 7 days | HttpOnly cookie — not readable by JavaScript |

When the access token expires, the app silently requests a new one in the background. You will only be asked to log in again if the refresh token also expires (after 7 days of inactivity) or if you log out explicitly.

---

## Dashboard

The dashboard (`/dashboard`) gives you a real-time snapshot of your finances for the **current calendar month**.

### Summary Cards

Four cards appear across the top of the page:

| Card | What it shows |
|---|---|
| **Total Income** | Sum of all income transactions recorded this month |
| **Total Expenses** | Sum of all expense transactions recorded this month |
| **Net Savings** | `Total Income − Total Expenses` for the month. Green when positive, red when negative. Also shows your total saved across all active savings goals vs the combined target amount (e.g. "Saved £2,150 of £7,500 target") |
| **Budget Usage** | `Total spent ÷ Total budgeted × 100` across all budget categories for this month, expressed as a percentage |

> **Currency note:** All dashboard figures are displayed in your **default currency**. If individual transactions or goals use different currencies, their amounts are shown as-is without conversion — see [Multi-Currency Support](#multi-currency-support).

### Budget Progress

The Budget Progress card lists up to **5 budget categories** for the current month, each with:

- A progress bar showing `spent / budget amount`
- The exact spent and budget amounts
- A percentage figure

**Progress bar colours:**

| Colour | Threshold |
|---|---|
| Green | Less than 75% used |
| Amber | 75–89% used |
| Red | 90% or more used |

### Upcoming Subscriptions

Shows subscriptions due to renew within the **next 30 days**, ordered by renewal date. For each subscription you see the name, renewal amount, billing cycle, and how many days until renewal.

**Days-remaining colours:**

| Colour | Threshold |
|---|---|
| Red | Fewer than 7 days |
| Amber | 7–13 days |
| Green | 14 or more days |

### Savings Goals Summary

Shows all active savings goals with progress bars and a "X /mo needed" figure. See [Monthly Saving Needed](#monthly-saving-needed) for how this number is calculated.

---

## Transactions

Navigate to **Transactions** in the sidebar.

### Recording a Transaction

Click **Add Transaction** and fill in:

| Field | Required | Notes |
|---|---|---|
| Type | Yes | `Income` or `Expense` |
| Category | Yes | Must match the transaction type — expense categories for expenses, income categories for income |
| Amount | Yes | Positive number, up to 2 decimal places |
| Currency | Yes | Any supported currency code |
| Date | Yes | The date the transaction occurred (`YYYY-MM-DD`) |
| Description | No | Free-text note, up to 255 characters |

> **Rule:** The category's type must match the transaction's type. You cannot assign an income category to an expense transaction and vice versa.

### Editing and Deleting

- Click the **pencil icon** on any transaction row to edit it.
- Click the **bin icon** to delete (archive) it. Archived transactions are hidden from all views but are not permanently destroyed — they remain in the database with an `archivedAt` timestamp.

### Filtering and Searching

The transactions list supports:

- **Type filter** — show only income or only expense records
- **Category filter** — show transactions for a specific category
- **Date range** — from/to date pickers
- **Search** — case-insensitive match on the description field

Results are paginated (20 per page by default, up to 100).

---

## Budgets

Navigate to **Budgets** in the sidebar. Budgets are per-category, per-month spending limits.

### Setting a Budget

Click **Add Budget** and choose:

| Field | Required | Notes |
|---|---|---|
| Category | Yes | Expense categories only |
| Year | Yes | 2020–2100 |
| Month | Yes | 1–12 |
| Amount | Yes | The spending limit for that category and month |
| Currency | Yes | The currency for this budget |

> **Rule:** Each `(category, year, month)` combination is unique per user. If you submit a budget for a combination that already exists, it will be **updated in place** (upsert). You cannot have two budgets for the same category in the same month.

### How Budget Spending is Calculated

The `spent` figure shown alongside each budget is calculated live from your transactions:

```
spent = SUM of all non-archived expense transactions
        where category = this budget's category
        AND date is within this budget's year/month
```

This figure updates automatically as you add or delete transactions.

### Budget Colour Indicators

The progress bar and percentage colour on the dashboard and budgets page follow the same thresholds:

| Colour | Condition |
|---|---|
| Green | Spent < 75% of budget |
| Amber | Spent 75–89% of budget |
| Red | Spent ≥ 90% of budget |

---

## Subscriptions

Navigate to **Subscriptions** in the sidebar. Subscriptions track recurring payments.

### Adding a Subscription

Click **Add Subscription** and fill in:

| Field | Required | Notes |
|---|---|---|
| Name | Yes | e.g. "Netflix" |
| Amount | Yes | The amount charged per billing cycle |
| Currency | Yes | Currency of the charge |
| Billing cycle | Yes | Weekly, Fortnightly, Monthly, Quarterly, or Yearly |
| Next renewal date | Yes | The date of the next upcoming charge (`YYYY-MM-DD`) |
| Start date | Yes | When the subscription began |
| Category | No | Links to an expense category (e.g. "Subscriptions") |
| URL | No | Must start with `http://` or `https://` |
| Auto-renew | No | Defaults to on. Only auto-renewing subscriptions appear in the forecast and upcoming-renewals list |

### Billing Cycles

| Cycle | Approximate period |
|---|---|
| Weekly | Every ~7 days |
| Fortnightly | Every ~14 days |
| Monthly | Every 1 month |
| Quarterly | Every 3 months |
| Yearly | Every 12 months |

### Upcoming Renewals

The **dashboard** shows subscriptions renewing in the next 30 days. The **Subscriptions** page has an `/subscriptions/upcoming` query that can look ahead by a configurable number of days.

> **Rule:** Only subscriptions with **Auto-renew enabled** appear in the upcoming list and in the forecast. If you turn off auto-renew on a subscription, it is treated as a one-off and excluded from forward projections.

---

## Savings Goals

Navigate to **Savings Goals** in the sidebar.

### Creating a Goal

Click **Add Goal** and fill in:

| Field | Required | Notes |
|---|---|---|
| Name | Yes | e.g. "Emergency Fund" |
| Target amount | Yes | The total amount you want to save |
| Currency | Yes | Currency of the goal |
| Target date | Yes | The deadline by which you want to reach the target (`YYYY-MM-DD`) |
| Description | No | Optional note |
| Icon | No | A single emoji displayed on the goal card (e.g. 🏖️) |

### Adding Contributions

Click the **coin icon** on a goal card to record a contribution. Each contribution requires:

| Field | Required | Notes |
|---|---|---|
| Amount | Yes | Must be a positive number |
| Date | Yes | When the money was set aside |
| Note | No | Optional label (e.g. "Monthly transfer") |

The contribution dialog shows a **live preview** of the goal's balance after the contribution is applied.

> **Rule:** `currentAmount` is incremented atomically on the server using a SQL expression (`currentAmount + contribution`) to prevent race conditions if two contributions are submitted simultaneously.

### Monthly Saving Needed

Both the **Savings Goals page** and the **Dashboard** display a "X / month needed" figure on each goal card. This is calculated as:

```
monthlyNeeded = (targetAmount − currentAmount) ÷ monthsUntilTarget
```

Where `monthsUntilTarget` is the number of whole months from today to the goal's target date (minimum 1 month). This figure tells you how much you need to set aside **each month from now** to reach your target on time.

**Display rules:**

| Condition | What is shown |
|---|---|
| `currentAmount >= targetAmount` | "Goal reached!" in green |
| Target date is in the future and goal is incomplete | "£X / month needed" |
| Target date has already passed | "Overdue" badge (grey) |

### Goal Status Indicators

Each goal card on the Savings Goals page shows a coloured badge indicating days remaining:

| Badge | Condition |
|---|---|
| Grey — "Overdue" | Target date has passed |
| Red — "Xd left" | Fewer than 30 days remaining |
| Amber — "Xd left" | 30–59 days remaining |
| Green — "Xd left" | 60 or more days remaining |

The progress bar colour also changes:

| Colour | Condition |
|---|---|
| Blue | Less than 50% of target saved |
| Emerald | 50–99% of target saved |
| Green | 100% or more saved |

The three summary tiles at the top of the page show:

- **Total Saved** — sum of `currentAmount` across all active goals
- **Active Goals** — count of non-archived goals
- **Nearest Deadline** — the goal with the soonest upcoming (non-overdue) target date

---

## Categories

Navigate to **Categories** in the sidebar. Categories are used to classify transactions.

### Default Categories

When you register, your account is seeded with the following categories:

**Expense categories (14):**
Food & Groceries, Dining Out, Transport, Bills & Utilities, Entertainment, Shopping, Health, Housing, Insurance, Subscriptions, Personal Care, Education, Gifts & Donations, Other

**Income categories (5):**
Salary, Freelance, Investments, Refunds, Other Income

All default categories are fully editable — you can rename them, change their icon/colour, or archive them.

### Managing Expense Categories

Go to **Categories → Expense** to view, create, edit, and archive your expense categories.

- **Create:** Click **Add Category**, enter a name (required), icon (emoji, optional), and colour (hex, optional).
- **Edit:** Click the pencil icon on a category card to update its name, icon, or colour. The category `type` (expense vs income) cannot be changed after creation.
- **Archive:** Click the bin icon to archive (soft-delete) a category. Archived categories are hidden from transaction forms but their historical transactions are preserved. Archiving a category does **not** affect existing transactions linked to it.

> **Rule:** Category names must be unique per type per user. You cannot have two expense categories both named "Transport".

### Managing Income Categories

Go to **Categories → Income** — identical functionality to expense categories, but filtered to income type.

---

## Reports

Navigate to **Reports** in the sidebar.

### Monthly Summary

Displays income, expenses, and net for a selected month, broken down by category. Each category row shows:

- Total amount spent/earned in that category
- Number of transactions
- Budget amount (if a budget exists for that category/month)
- Percentage of budget used (`percentUsed` is null if no budget is set)

Use the **year** and **month** selectors to navigate between months.

### Trend Chart

Shows income and expenses month by month for the last N months (default 6, up to 24). Months with no transactions appear as zero — no data gaps are skipped.

### CSV Export

Click **Export CSV** on the Reports page to download all transactions for the selected month as a `.csv` file.

The file is named `centsible-YYYY-MM.csv` and has the columns:
`Date, Type, Category, Description, Amount, Currency`

> **Security note:** Cells that start with `=`, `+`, `-`, `@`, a tab, or a carriage return are prefixed with a single quote to prevent formula injection when the file is opened in a spreadsheet application.

---

## Forecast

Navigate to **Forecast** in the sidebar. The forecast projects your expected outgoings for up to 12 months ahead, starting from the **current month**.

Use the **months** selector (1–12) to control how far ahead to look.

Each forecast month card shows:

| Figure | What it includes |
|---|---|
| **Projected Expenses** | Sum of all budget amounts for the current month (used as a recurring baseline) |
| **Subscription Costs** | Sum of auto-renewing subscription renewals falling in that month |
| **Savings Contributions** | Projected amount to set aside for savings goals that month |
| **Total Projected** | Sum of all three above |

Clicking a month card expands a line-item table showing every individual item contributing to that month's total, with its date, type badge, and amount.

### How the Forecast Works

The forecast is built from three data sources:

1. **Your current month's budgets** — used as a fixed monthly expense baseline for every forecast month
2. **Your active subscriptions** — renewal dates are projected forward by billing cycle
3. **Your active savings goals** — a monthly contribution is calculated per goal

### Subscription Costs in the Forecast

For each forecast month, Centsible walks forward from the subscription's `nextRenewalDate` in steps of the billing cycle until it finds renewals that fall within that month. Only subscriptions with **auto-renew enabled** are included.

> **Timezone note:** Renewal dates are compared using UTC date strings (e.g. `2026-03-31`) to avoid timezone drift on servers in non-UTC timezones. A renewal on March 31 will always appear in March regardless of where the server is hosted.

### Budget Costs in the Forecast

The budgets used are those set for the **current month**. The same amounts are repeated for every forecast month. If you have no budgets set for the current month, this figure will be zero.

### Savings Contributions in the Forecast

For each goal that has not yet reached its target date, Centsible calculates a projected monthly contribution:

```
monthlyContribution = remainingAmount ÷ monthsRemaining
```

Where:
- `remainingAmount` = `targetAmount − currentAmount`
- `monthsRemaining` = months from **that specific forecast month** to the goal's `targetDate` (minimum 1)

**Important:** Because `monthsRemaining` is calculated relative to each forecast month (not today), the projected contribution **increases** as the forecast advances further into the future. This reflects the growing urgency of the deadline — the closer the target date gets, the more needs to be saved each month to stay on track.

**Example:** A goal with £1,200 remaining and a target date 6 months from now would show:

| Forecast month | Months remaining | Monthly contribution |
|---|---|---|
| Month 1 (now) | 6 | £200 |
| Month 2 | 5 | £240 |
| Month 3 | 4 | £300 |
| Month 4 | 3 | £400 |
| Month 5 | 2 | £600 |
| Month 6 | 1 | £1,200 |

A goal is excluded from a forecast month if the forecast month's start date is after the goal's target date (i.e. the deadline has already passed for that month). Goals where `currentAmount >= targetAmount` are always excluded.

---

## Settings

Navigate to **Settings** in the sidebar.

### Changing Your Name

Enter a new name in the **Name** field and click **Save Changes**. The name appears in the dashboard welcome message and in the sidebar.

### Changing Your Default Currency

Select a currency from the **Default Currency** dropdown and click **Save Changes**. The default currency controls how amounts are displayed on the dashboard and savings pages.

> **Rule:** Changing your default currency does **not** convert any stored transaction or goal amounts — it only changes the currency symbol and code used when displaying totals. Each transaction, budget, subscription, and goal retains its own currency.

The **Save Changes** button is only enabled when you have made a change (the form tracks a "dirty" state).

---

## Multi-Currency Support

Every record in Centsible — transactions, budgets, subscriptions, and savings goals — carries its own currency code. You can freely mix currencies.

**Supported currencies (31):**

AUD, BGN, BRL, CAD, CHF, CNY, CZK, DKK, EUR, GBP, HKD, HRK, HUF, IDR, INR, ISK, JPY, KRW, MXN, MYR, NOK, NZD, PHP, PLN, RON, SEK, SGD, THB, TRY, USD, ZAR

**Exchange rates** are fetched from the [Frankfurter API](https://www.frankfurter.app/) on demand and cached locally by date. If the upstream service is unavailable, the most recently cached rate for that date is used.

> **Important:** Centsible does **not** automatically convert amounts when displaying totals. Dashboard summary figures (Total Income, Total Expenses, Net Savings, Budget Usage) are summed using raw amounts regardless of currency. If you use multiple currencies, dashboard totals should be interpreted with this in mind. The `convertedAmount` field on transactions is available for future conversion display, but is not currently populated automatically.

---

## Data and Privacy

**No data is permanently deleted.** Every record that can be "deleted" in the UI is actually archived — its `archivedAt` timestamp is set and it is hidden from all lists and calculations. The data remains in the database and can be restored if needed.

This applies to:
- Transactions
- Budgets
- Subscriptions
- Savings goals
- Categories

The only exception is savings goal **contributions**, which are also archived (soft-deleted) via the same mechanism.

**Your data is yours.** Centsible is self-hosted — all data lives in your own MariaDB database. There is no cloud sync, telemetry, or third-party data sharing. The only external service contacted is the [Frankfurter API](https://www.frankfurter.app/) for exchange rate lookups.
