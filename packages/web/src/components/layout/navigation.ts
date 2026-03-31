import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BarChart3,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  PiggyBank,
  Settings,
  Tag,
  Target,
  TrendingUp,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  matchPrefixes?: string[];
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Money In / Out",
    icon: ArrowLeftRight,
    items: [
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { href: "/budgets", label: "Budgets", icon: PiggyBank },
      {
        href: "/categories",
        label: "Categories",
        icon: Tag,
        matchPrefixes: ["/categories/expense", "/categories/income"],
      },
    ],
  },
  {
    label: "Recurring",
    icon: FolderKanban,
    items: [
      {
        href: "/recurring/subscriptions",
        label: "Subscriptions",
        icon: CreditCard,
        matchPrefixes: ["/subscriptions"],
      },
      {
        href: "/recurring/income",
        label: "Income Sources",
        icon: TrendingUp,
      },
    ],
  },
  {
    label: "Goals",
    icon: Target,
    items: [{ href: "/savings", label: "Savings Goals", icon: Target }],
  },
  {
    label: "Insights",
    icon: BarChart3,
    items: [
      {
        href: "/insights/reports",
        label: "Reports",
        icon: BarChart3,
        matchPrefixes: ["/reports"],
      },
      {
        href: "/insights/forecast",
        label: "Forecast",
        icon: TrendingUp,
        matchPrefixes: ["/forecast"],
      },
    ],
  },
  {
    label: "Account",
    icon: Settings,
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

export const mobilePrimaryNav: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/transactions", label: "Activity", icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/savings", label: "Goals", icon: Target },
  {
    href: "/insights/reports",
    label: "Insights",
    icon: BarChart3,
    matchPrefixes: ["/reports", "/forecast", "/insights/forecast", "/insights"],
  },
];

export const mobileOverflowNav: NavItem[] = [
  {
    href: "/categories",
    label: "Categories",
    icon: Tag,
    matchPrefixes: ["/categories/expense", "/categories/income"],
  },
  {
    href: "/recurring/subscriptions",
    label: "Subscriptions",
    icon: CreditCard,
    matchPrefixes: ["/subscriptions"],
  },
  { href: "/recurring/income", label: "Income Sources", icon: TrendingUp },
  {
    href: "/insights/forecast",
    label: "Forecast",
    icon: TrendingUp,
    matchPrefixes: ["/forecast"],
  },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  const matches = [item.href, ...(item.matchPrefixes ?? [])];
  return matches.some(
    (match) => pathname === match || pathname.startsWith(`${match}/`)
  );
}

export function getCurrentPageTitle(pathname: string): string {
  const item = navGroups.flatMap((group) => group.items).find((entry) => isNavItemActive(pathname, entry));
  return item?.label ?? "Centsible";
}
