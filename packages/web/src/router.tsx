import { createBrowserRouter, Navigate } from "react-router";

import { App } from "@/components/layout/app";
import { LegacyRedirect } from "@/components/layout/legacy-redirect";
import { RedirectIfAuthenticated } from "@/components/layout/redirect-if-authenticated";
import { RequireAuth } from "@/components/layout/require-auth";

import BudgetsPage from "@/pages/budgets";
import CategoriesPage from "@/pages/categories";
import DashboardPage from "@/pages/dashboard";
import ForecastPage from "@/pages/forecast";
import LoginPage from "@/pages/login";
import RecurringIncomePage from "@/pages/recurring-income";
import RegisterPage from "@/pages/register";
import ReportsPage from "@/pages/reports";
import SavingsPage from "@/pages/savings";
import SettingsPage from "@/pages/settings";
import SubscriptionsPage from "@/pages/subscriptions";
import TransactionsPage from "@/pages/transactions";

export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      // Auth pages (only available when logged out)
      {
        element: <RedirectIfAuthenticated />,
        children: [
          { path: "/login", element: <LoginPage /> },
          { path: "/register", element: <RegisterPage /> },
        ],
      },

      // Protected routes (require auth, render sidebar/chrome)
      {
        element: <RequireAuth />,
        children: [
          { path: "/", element: <Navigate to="/dashboard" replace /> },
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/transactions", element: <TransactionsPage /> },
          { path: "/budgets", element: <BudgetsPage /> },
          { path: "/categories", element: <CategoriesPage /> },
          { path: "/savings", element: <SavingsPage /> },
          { path: "/settings", element: <SettingsPage /> },
          {
            path: "/recurring",
            element: <Navigate to="/recurring/subscriptions" replace />,
          },
          {
            path: "/recurring/subscriptions",
            element: <SubscriptionsPage />,
          },
          { path: "/recurring/income", element: <RecurringIncomePage /> },
          {
            path: "/insights",
            element: <Navigate to="/insights/reports" replace />,
          },
          { path: "/insights/reports", element: <ReportsPage /> },
          { path: "/insights/forecast", element: <ForecastPage /> },

          // Legacy redirects with UTM preservation
          {
            path: "/forecast",
            element: (
              <LegacyRedirect to="/insights/forecast" content="forecast" />
            ),
          },
          {
            path: "/reports",
            element: <LegacyRedirect to="/insights/reports" content="reports" />,
          },
          {
            path: "/subscriptions",
            element: (
              <LegacyRedirect
                to="/recurring/subscriptions"
                content="subscriptions"
              />
            ),
          },
          {
            path: "/categories/expense",
            element: (
              <LegacyRedirect
                to="/categories?tab=expense"
                content="categories/expense"
              />
            ),
          },
          {
            path: "/categories/income",
            element: (
              <LegacyRedirect
                to="/categories?tab=income"
                content="categories/income"
              />
            ),
          },
        ],
      },

      // Catch-all: bounce to the dashboard (which itself will redirect to /login if needed).
      { path: "*", element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);
