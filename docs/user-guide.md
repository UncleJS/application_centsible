# Centsible — User Guide

Centsible is a self-hosted personal finance tracker. This guide walks you through every feature of the application: what it does, how to use it, and the exact rules that govern how every number is calculated.

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
  - [Income Budgets vs Expense Budgets](#income-budgets-vs-expense-budgets)
  - [Budget Summary Cards — Expenses](#budget-summary-cards--expenses)
  - [Budget Summary Cards — Income](#budget-summary-cards--income)
  - [Monthly Recurring Income Card](#monthly-recurring-income-card)
  - [Commitment Cards](#commitment-cards)
  - [Projected Balance](#projected-balance)
  - [How Budget Spending is Calculated](#how-budget-spending-is-calculated)
  - [Budget Colour Indicators](#budget-colour-indicators)
- [Recurring Income](#recurring-income)
  - [Adding a Recurring Income Source](#adding-a-recurring-income-source)
  - [Billing Cycle Normalisation](#billing-cycle-normalisation)
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
  - [Summary Cards](#forecast-summary-cards)
  - [Month Cards — What Each Figure Means](#month-cards--what-each-figure-means)
  - [Month Card Net Total](#month-card-net-total)
  - [The Stacked Bar](#the-stacked-bar)
  - [Item Types and Badges](#item-types-and-badges)
  - [How the Forecast Works](#how-the-forecast-works)
  - [Subscription Costs in the Forecast](#subscription-costs-in-the-forecast)
  - [Expense Budgets in the Forecast](#expense-budgets-in-the-forecast)
  - [Income Budgets in the Forecast](#income-budgets-in-the-forecast)
  - [Recurring Income in the Forecast](#recurring-income-in-the-forecast)
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
- **Logout:** Click the log-out icon at the bottom of the sidebar next to your name.

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

| Card | What it shows | Formula |
|---|---|---|
| **Total Income** | Actual income transactions recorded this month **plus** the normalised monthly equivalent of all recurring income sources | `transactionIncome + recurringIncomeMonthlyEquivalent` |
| **Total Expenses** | Sum of all expense transactions recorded this month | Raw sum of expense transaction amounts |
| **Net Savings** | Money left over after expenses | `Total Income − Total Expenses`. Green when ≥ 0, red when negative. |
| **Budget Usage** | How much of your total budgeted amount has been spent this month | `totalSpent ÷ totalBudgeted × 100`, expressed as a percentage |

**Total Income in detail:**

The dashboard combines two income sources:

1. **Recorded transactions** — every income transaction you have entered for the current month.
2. **Recurring income** — all active recurring income sources, each normalised to a monthly amount using its billing cycle (see [Billing Cycle Normalisation](#billing-cycle-normalisation)).

The subtitle under the Total Income card shows how much of the total comes from recurring income (e.g. "incl. £2,000 recurring").

**Net Savings in detail:**

The Net Savings card also displays a secondary line showing your cumulative savings goal progress: "Saved £X of £Y target" — this is the sum of `currentAmount` across all active savings goals versus the sum of all `targetAmount` values.

**Budget Usage in detail:**

```
budgetUsage% = (sum of spent across all budgets for this month) ÷ (sum of amount across all budgets for this month) × 100
```

Colour thresholds:

| Colour | Threshold |
|---|---|
| Amber (normal) | Less than 75% used |
| Amber (warning) | 75–89% used |
| Red | 90% or more used |

> **Currency note:** All dashboard figures are displayed in your **default currency**. Amounts stored in other currencies are summed using their raw values without conversion — see [Multi-Currency Support](#multi-currency-support).

### Budget Progress

The Budget Progress card lists up to **5 budget categories** for the current month, each showing:

- A progress bar with `spent / budget amount`
- The exact spent and budgeted amounts
- A percentage figure

**Progress bar colours:**

| Colour | Threshold |
|---|---|
| Green | Less than 75% used |
| Amber | 75–89% used |
| Red | 90% or more used |

### Upcoming Subscriptions

Shows subscriptions due to renew within the **next 30 days**, ordered by renewal date. Each row shows the subscription name, renewal amount, billing cycle, and days until renewal.

**Days-remaining colours:**

| Colour | Threshold |
|---|---|
| Red | Fewer than 7 days |
| Amber | 7–13 days |
| Green | 14 or more days |

### Savings Goals Summary

Shows all active savings goals with progress bars and a "£X /mo needed" figure. See [Monthly Saving Needed](#monthly-saving-needed) for how this is calculated.

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

Navigate to **Budgets** in the sidebar. Budgets are per-category, per-month targets.

Use the **month navigation arrows** at the top to move between months. All figures on the page reflect the selected month.

### Setting a Budget

Click **Add Budget** and choose:

| Field | Required | Notes |
|---|---|---|
| Category | Yes | Expense or income categories |
| Year | Yes | 2020–2100 |
| Month | Yes | 1–12 |
| Amount | Yes | The target amount for that category and month |
| Currency | Yes | The currency for this budget |

> **Rule:** Each `(category, year, month)` combination is unique per user. Submitting a budget for an existing combination updates it in place (upsert). You cannot have two budgets for the same category in the same month.

### Income Budgets vs Expense Budgets

The Budgets page handles two distinct types of budget:

- **Expense budgets** — a spending limit for an expense category (e.g. "Food & Groceries: £400"). The `spent` figure tracks actual expense transactions for that category and month.
- **Income budgets** — an expected income amount for an income category (e.g. "Salary: £3,000"). The `spent` (received) figure tracks actual income transactions for that category and month.

Both types are set using the same **Add Budget** form — the category you choose determines which type it becomes.

### Budget Summary Cards — Expenses

Three cards in the first row summarise your expense budgets for the selected month:

| Card | Calculation | Notes |
|---|---|---|
| **Budgeted Expenses** | Sum of all expense budget amounts for the selected month | What you planned to spend |
| **Total Spent** | Sum of actual expense transactions for all budgeted expense categories this month | Updates live as you record transactions. Shown in red if it exceeds Budgeted Expenses. |
| **Remaining** | `Budgeted Expenses − Total Spent` | Green when positive (under budget), red when negative (over budget) |

### Budget Summary Cards — Income

Three cards in the second row summarise your income budgets for the selected month:

| Card | Calculation | Notes |
|---|---|---|
| **Budgeted Income** | Sum of all income budget amounts for the selected month | What you expected to earn from once-off or manually tracked income |
| **Total Received** | Sum of actual income transactions for all budgeted income categories this month | How much income you have actually recorded |
| **Income Surplus** | `Total Received − Budgeted Income` | Positive (green) means you received more than expected; negative (red) means you fell short |

### Monthly Recurring Income Card

A full-width card below the income row shows:

**Monthly Recurring Income** — the normalised monthly equivalent of all your active recurring income sources, regardless of the selected budget month.

```
monthlyRecurringIncome = Σ (recurringIncomeAmount ÷ cycleInMonths)
```

This is an **informational figure** only. It tells you what your standing regular income (salary, freelance retainers, etc.) amounts to per month once spread evenly across billing cycles. It is used in the [Projected Balance](#projected-balance) calculation.

See [Billing Cycle Normalisation](#billing-cycle-normalisation) for the cycle divisors.

### Commitment Cards

Three cards summarise your monthly financial obligations:

| Card | Calculation | Notes |
|---|---|---|
| **Monthly Subscriptions** | Sum of all active subscriptions normalised to a monthly amount | `Σ (amount ÷ cycleInMonths)`, converted to your default currency via live exchange rates. Shows "—" while exchange rates are loading. |
| **Monthly Savings** | Sum of required monthly contributions across all active, incomplete savings goals | `Σ ((targetAmount − currentAmount) ÷ monthsUntilTarget)` relative to the **selected budget month** (minimum 1 month per goal). Goals already reached or overdue are excluded. |
| **Monthly Committed** | `Budgeted Expenses + Monthly Subscriptions + Monthly Savings` | Your total outgoing commitment for the month: planned spending plus recurring charges plus savings obligations |

#### Monthly Subscriptions — billing cycle normalisation

Each subscription is divided by its billing cycle expressed in months:

| Billing cycle | Divisor | Effect |
|---|---|---|
| Weekly | 1 ÷ 4.33 ≈ 0.231 | Amount × 4.33 (fires ~4.33 times per month) |
| Fortnightly | 1 ÷ 2.17 ≈ 0.461 | Amount × 2.17 (fires ~2.17 times per month) |
| Monthly | 1 | Amount unchanged |
| Quarterly | 3 | Amount ÷ 3 |
| Yearly | 12 | Amount ÷ 12 |

If subscriptions exist in a currency different from your default currency, exchange rates are fetched live. While they load, the Monthly Subscriptions and Monthly Committed cards show "—".

#### Monthly Savings — per-goal formula

For each active, incomplete goal where the target date has not yet passed:

```
monthlyNeeded = (targetAmount − currentAmount) ÷ monthsUntilTarget
```

`monthsUntilTarget` is calculated from the **selected budget month** to the goal's target date (minimum 1). This means the figure can differ from what you see on the Savings Goals page, which calculates from **today**.

### Projected Balance

The full-width card at the bottom of the summary section shows the **Projected Balance** for the selected month.

```
Projected Balance = Budgeted Income + Monthly Recurring Income − Monthly Committed
```

Where:
- **Budgeted Income** = sum of all income budget amounts for the selected month (once-off / manually set income expectations)
- **Monthly Recurring Income** = normalised monthly total of all recurring income sources (standing salary, freelance retainers, etc.)
- **Monthly Committed** = `Budgeted Expenses + Monthly Subscriptions + Monthly Savings`

**Colour coding:**

| Colour | Condition |
|---|---|
| Emerald (green) border and text | Projected Balance ≥ 0 (surplus) |
| Red border and text | Projected Balance < 0 (deficit) |

**Interpretation:** A positive Projected Balance means your expected income (both recurring and budgeted once-off) covers all your planned expenses, subscriptions, and savings contributions with money to spare. A negative figure means your commitments exceed your expected income for that month.

> **Note:** The Projected Balance is a forward-looking planning figure. It does not reflect actual transactions — use the **Total Received** and **Total Spent** cards to see what has actually happened.

### How Budget Spending is Calculated

The `spent` figure shown alongside each budget is calculated live from your transactions:

```
spent = SUM of all non-archived transactions
        where category = this budget's category
        AND date falls within this budget's year/month
```

For expense budgets, only expense transactions are counted. For income budgets, only income transactions are counted. The figure updates automatically as you add or delete transactions.

### Budget Colour Indicators

Progress bars on budget cards follow these thresholds:

| Colour | Condition |
|---|---|
| Green | Spent < 75% of budget |
| Amber | Spent 75–89% of budget |
| Red | Spent ≥ 90% of budget |

---

## Recurring Income

Recurring income sources represent predictable income that arrives on a regular schedule — salary paid monthly, a freelance retainer paid fortnightly, dividend income paid quarterly, and so on.

Navigate to **Budgets** and use the **Recurring Income** section (accessible via the button on the Budgets page).

### Adding a Recurring Income Source

| Field | Required | Notes |
|---|---|---|
| Name | Yes | e.g. "Monthly Salary" |
| Amount | Yes | The gross amount received per billing cycle |
| Currency | Yes | Currency of the income |
| Billing cycle | Yes | Weekly, Fortnightly, Monthly, Quarterly, or Yearly |
| Category | No | Links to an income category for reporting purposes |
| Auto-renew | No | Defaults to on. Only auto-renewing sources appear in the forecast. |

### Billing Cycle Normalisation

Recurring income amounts are normalised to a **monthly equivalent** wherever they appear in totals. The normalisation uses the same divisors as subscriptions:

| Billing cycle | Divisor | Monthly equivalent |
|---|---|---|
| Weekly | 1 ÷ 4.33 ≈ 0.231 | Amount × 4.33 |
| Fortnightly | 1 ÷ 2.17 ≈ 0.461 | Amount × 2.17 |
| Monthly | 1 | Amount unchanged |
| Quarterly | 3 | Amount ÷ 3 |
| Yearly | 12 | Amount ÷ 12 |

**Example:** A fortnightly salary of £1,500 has a monthly equivalent of £1,500 × 2.17 ≈ £3,255.

This normalised figure appears in:
- The **Monthly Recurring Income** card on the Budgets page
- The **Total Income** card on the Dashboard (added to recorded income transactions)
- The **Projected Balance** on the Budgets page (as part of the income side)
- The **Total Projected Income** summary card on the Forecast page

---

## Subscriptions

Navigate to **Subscriptions** in the sidebar. Subscriptions track recurring payments (expenses only).

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
| Auto-renew | No | Defaults to on. Only auto-renewing subscriptions appear in the forecast and upcoming-renewals list. |

### Billing Cycles

| Cycle | Period |
|---|---|
| Weekly | Every ~7 days |
| Fortnightly | Every ~14 days |
| Monthly | Every 1 month |
| Quarterly | Every 3 months |
| Yearly | Every 12 months |

### Upcoming Renewals

The **dashboard** shows subscriptions renewing in the next 30 days. The **Subscriptions** page lists all upcoming renewals.

> **Rule:** Only subscriptions with **Auto-renew enabled** appear in the upcoming list and in the forecast. A subscription with auto-renew turned off is treated as a one-off historical record and excluded from all forward projections.

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
| Target date | Yes | The deadline (`YYYY-MM-DD`) |
| Description | No | Optional note |
| Icon | No | A single emoji displayed on the goal card |

### Adding Contributions

Click the **coin icon** on a goal card to record a contribution:

| Field | Required | Notes |
|---|---|---|
| Amount | Yes | Must be a positive number |
| Date | Yes | When the money was set aside |
| Note | No | Optional label (e.g. "Monthly transfer") |

The contribution dialog shows a **live preview** of the goal's balance after the contribution. The `currentAmount` is updated atomically on the server to prevent race conditions.

### Monthly Saving Needed

Both the **Savings Goals page** and the **Dashboard** display a "£X / month needed" figure on each goal card:

```
monthlyNeeded = (targetAmount − currentAmount) ÷ monthsUntilTarget
```

`monthsUntilTarget` is the number of whole months from **today** to the goal's target date (minimum 1).

| Condition | Display |
|---|---|
| `currentAmount >= targetAmount` | "Goal reached!" in green |
| Target date is in the future and goal is incomplete | "£X / month needed" |
| Target date has already passed | "Overdue" badge |

### Goal Status Indicators

Each goal card shows a days-remaining badge:

| Badge | Condition |
|---|---|
| Grey — "Overdue" | Target date has passed |
| Red — "Xd left" | Fewer than 30 days remaining |
| Amber — "Xd left" | 30–59 days remaining |
| Green — "Xd left" | 60 or more days remaining |

Progress bar colours:

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

Navigate to **Categories** in the sidebar. Categories classify transactions and link budgets to spending/income patterns.

### Default Categories

When you register, your account is seeded with the following categories:

**Expense categories (14):**
Food & Groceries, Dining Out, Transport, Bills & Utilities, Entertainment, Shopping, Health, Housing, Insurance, Subscriptions, Personal Care, Education, Gifts & Donations, Other

**Income categories (5):**
Salary, Freelance, Investments, Refunds, Other Income

All default categories are fully editable — you can rename them, change their icon/colour, or archive them.

### Managing Expense Categories

Go to **Categories → Expense** to view, create, edit, and archive expense categories.

- **Create:** Click **Add Category**, enter a name (required), icon (emoji, optional), and colour (hex, optional).
- **Edit:** Click the pencil icon on a category card to update its name, icon, or colour. The `type` (expense vs income) cannot be changed after creation.
- **Archive:** Click the bin icon to archive (soft-delete) a category. Archived categories are hidden from transaction forms but their historical transactions are preserved.

> **Rule:** Category names must be unique per type per user. You cannot have two expense categories both named "Transport".

### Managing Income Categories

Go to **Categories → Income** — identical functionality to expense categories, filtered to income type.

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

Click **Export CSV** to download all transactions for the selected month as a `.csv` file named `centsible-YYYY-MM.csv`.

Columns: `Date, Type, Category, Description, Amount, Currency`

> **Security note:** Cells starting with `=`, `+`, `-`, `@`, a tab, or a carriage return are prefixed with a single quote to prevent formula injection when opened in a spreadsheet application.

---

## Forecast

Navigate to **Forecast** in the sidebar. The forecast projects your expected financial position for up to 12 months ahead, starting from the **current month**.

Use the **Horizon** selector (3, 6, or 12 months) to control how far ahead to project. Click the **refresh** icon to re-fetch the latest data at any time.

### Forecast Summary Cards

Four summary cards span the top of the page, aggregating figures across the entire forecast horizon:

| Card | Calculation | Notes |
|---|---|---|
| **Total Projected Expenses** | `Σ (subscriptionCosts + projectedExpenses + savingsContributions)` across all forecast months | The total outgoings expected across the selected horizon — subscriptions, budgeted expenses, and savings contributions combined |
| **Total Subscription Costs** | `Σ subscriptionCosts` across all forecast months | Total subscription renewal costs over the horizon |
| **Total Savings Contributions** | `Σ savingsContributions` across all forecast months | Total savings goal contributions required over the horizon |
| **Total Projected Income** | `Σ projectedIncome` across all forecast months | Total expected income (recurring + budgeted) over the horizon |

### Month Cards — What Each Figure Means

Each month card shows a breakdown of the five components that make up that month's financial picture:

| Line item | Colour dot | What it represents |
|---|---|---|
| **Subscriptions** | Blue | Sum of all auto-renewing subscription charges falling in this month, at their actual charged amounts |
| **Expenses** | Red | Sum of all current-month expense budget amounts, repeated as a baseline for every forecast month |
| **Savings** | Amber | Required monthly savings contributions across all active goals for this specific forecast month |
| **Income** | Emerald | Total expected income: recurring income sources that fire this month **plus** income budget amounts for the current month |

The **Income** line only appears when the total projected income is greater than zero.

### Month Card Net Total

The large number in the top-right corner of each month card is the **net balance**:

```
Net Total = Total Income − Total Expenses

where:
  Total Income   = recurringIncomeFiringThisMonth + budgetedIncomeForCurrentMonth
  Total Expenses = subscriptionCosts + projectedExpenses + savingsContributions
```

**Colour coding:**

| Colour | Condition |
|---|---|
| Emerald (green) | Net Total ≥ 0 — income covers all commitments |
| Red | Net Total < 0 — commitments exceed expected income |

A green total means your expected income for that month exceeds all outgoings. A red total is a warning that you may need to adjust spending, reduce commitments, or draw on savings to cover the month.

### The Stacked Bar

The horizontal bar inside each month card visualises the **expense** components as proportional segments:

| Segment | Colour | Represents |
|---|---|---|
| Left | Blue | Subscription costs as a proportion of total expenses |
| Middle | Red | Budgeted expenses as a proportion of total expenses |
| Right | Amber | Savings contributions as a proportion of total expenses |

The bar is scaled to total expenses only (not income), so it always fills 100% of its width regardless of the net balance.

### Item Types and Badges

Click **Show items** at the bottom of any month card to expand a line-item list showing every individual entry contributing to that month. Each item shows its name, date, type badge, and amount.

| Badge | Colour | What it represents |
|---|---|---|
| **Subscription** | Blue | A specific subscription renewal charge |
| **Budget** | Emerald | An expense budget category (e.g. "Budget: Food & Groceries") |
| **Income Budget** | Teal | An income budget category (e.g. "Income: Salary") |
| **Recurring Income** | Emerald | A recurring income source that fires this month |
| **Savings** | Amber | A required contribution to a specific savings goal |

> **Note:** "Budget" (emerald) and "Recurring Income" (emerald) badges look similar; the name prefix distinguishes them — budget items are labelled "Budget: [category]" and recurring income items use the income source name directly.

### How the Forecast Works

The forecast is assembled server-side from four data sources each time you load or refresh the page:

1. **Your active subscriptions** — renewal dates are projected forward month by month
2. **Your current month's expense budgets** — used as a recurring expense baseline for every forecast month
3. **Your current month's income budgets** — used as a recurring income baseline for every forecast month
4. **Your active savings goals** — a monthly contribution is calculated per goal per forecast month
5. **Your active recurring income sources** — amounts are applied in the months they fire based on billing cycle

The forecast always uses **today's data as its baseline**. If you change a budget amount, add a subscription, or record a savings contribution, clicking refresh will update all forecast months immediately.

### Subscription Costs in the Forecast

For each forecast month, Centsible walks forward from each subscription's `nextRenewalDate` in steps of the billing cycle, collecting every renewal that falls within that calendar month. Only subscriptions with **auto-renew enabled** are included.

> **Timezone note:** Renewal dates are compared using UTC date strings (e.g. `2026-03-31`) to avoid timezone drift. A renewal on March 31 will always appear in March regardless of the server's timezone.

### Expense Budgets in the Forecast

The **current month's expense budgets** are used as a fixed monthly expense baseline repeated for every forecast month. If you spent £400 on Food & Groceries and budgeted £500 for it this month, the forecast will show £500 as the "Expenses" line for every future month — it uses the **budget amount**, not the actual spend.

If you have no expense budgets set for the current month, the Expenses line will be zero for all forecast months.

> **Why current month?** The forecast assumes your current budgeting reflects your ongoing habits. If you want the forecast to change, update your current month's budgets.

### Income Budgets in the Forecast

The **current month's income budgets** are also projected forward as a fixed monthly income baseline. If you have set a budget of £3,000 for your Salary income category this month, that £3,000 appears in the Income figure for every forecast month.

These represent **expected once-off or manually planned income** — amounts you've deliberately set as income targets for specific categories. They are combined with recurring income to form the total projected income for each month.

If you have no income budgets set for the current month, only recurring income contributes to the income side of the forecast.

### Recurring Income in the Forecast

Each active recurring income source with **auto-renew enabled** is evaluated month by month:

- **Sub-monthly cycles (weekly, fortnightly) and monthly:** fire every month — the full cycle amount is added to that month's income.
- **Supra-monthly cycles (quarterly, yearly):** fire only in the specific months they fall due. The algorithm calculates which months a source fires by checking whether the absolute month index (year × 12 + month) is divisible by the cycle length.

**Example:** A quarterly income source of £3,000 will appear in every third month of the forecast at its full £3,000 value — not £1,000 spread across all three months. This reflects reality: the money arrives in a lump sum.

### Savings Contributions in the Forecast

For each active, incomplete savings goal, the forecast calculates a required monthly contribution for each forecast month:

```
monthlyContribution = remainingAmount ÷ monthsRemaining
```

Where:
- `remainingAmount` = `targetAmount − currentAmount` at the time of the forecast calculation
- `monthsRemaining` = months from **that specific forecast month** to the goal's `targetDate` (minimum 1)

**Important:** Because `monthsRemaining` is calculated relative to each forecast month (not today), the required contribution **increases** as the forecast advances. This reflects growing urgency — the closer the deadline, the more needs to be set aside each month.

**Example:** A goal with £1,200 remaining and a target date 6 months from now:

| Forecast month | Months remaining | Monthly contribution |
|---|---|---|
| Month 1 (now) | 6 | £200 |
| Month 2 | 5 | £240 |
| Month 3 | 4 | £300 |
| Month 4 | 3 | £400 |
| Month 5 | 2 | £600 |
| Month 6 | 1 | £1,200 |

A goal is excluded from a forecast month if the forecast month's start date is after the goal's target date. Goals where `currentAmount >= targetAmount` are always excluded.

---

## Settings

Navigate to **Settings** in the sidebar.

### Changing Your Name

Enter a new name in the **Name** field and click **Save Changes**. The name appears in the dashboard welcome message and in the sidebar.

### Changing Your Default Currency

Select a currency from the **Default Currency** dropdown and click **Save Changes**.

> **Rule:** Changing your default currency does **not** convert any stored amounts — it only changes the currency symbol and code used when displaying totals. Every transaction, budget, subscription, and goal retains its own individual currency.

The **Save Changes** button is only enabled when you have made a change (the form tracks a dirty state).

---

## Multi-Currency Support

Every record in Centsible — transactions, budgets, subscriptions, savings goals, and recurring income — carries its own currency code. You can freely mix currencies.

**Supported currencies (31):**

AUD, BGN, BRL, CAD, CHF, CNY, CZK, DKK, EUR, GBP, HKD, HRK, HUF, IDR, INR, ISK, JPY, KRW, MXN, MYR, NOK, NZD, PHP, PLN, RON, SEK, SGD, THB, TRY, USD, ZAR

**Exchange rates** are fetched from the [Frankfurter API](https://www.frankfurter.app/) on demand and cached locally by date. If the upstream service is unavailable, the most recently cached rate for that date is used.

**Where currency conversion is applied:**

| Feature | Conversion behaviour |
|---|---|
| Dashboard summary cards | Raw amounts summed without conversion |
| Budget summary — Monthly Subscriptions | Subscription amounts converted to your default currency using live rates |
| Budget summary — Projected Balance | Subscription component converted; budget and savings components use raw amounts |
| Forecast | All amounts displayed in the subscription's or goal's own currency (no conversion) |

> **Important:** Dashboard summary figures (Total Income, Total Expenses, Net Savings, Budget Usage) are summed using raw amounts regardless of currency. If you use multiple currencies, interpret these totals accordingly.

---

## Data and Privacy

**No data is permanently deleted.** Every record that can be "deleted" in the UI is archived — its `archivedAt` timestamp is set and it is hidden from all lists and calculations. The data remains in the database and can be restored.

This applies to:
- Transactions
- Budgets
- Subscriptions
- Savings goals (and their contributions)
- Categories
- Recurring income sources

**Your data is yours.** Centsible is self-hosted — all data lives in your own MariaDB database. There is no cloud sync, telemetry, or third-party data sharing. The only external service contacted is the [Frankfurter API](https://www.frankfurter.app/) for exchange rate lookups.
