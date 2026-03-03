"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Target,
  CreditCard,
  BarChart3,
  TrendingUp,
  Settings,
  LogOut,
  Tag,
  TrendingDown,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type NavItem =
  | { href: string; label: string; icon: React.ElementType; children?: never }
  | {
      href?: never;
      label: string;
      icon: React.ElementType;
      children: { href: string; label: string; icon: React.ElementType }[];
    };

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/savings", label: "Savings Goals", icon: Target },
  {
    label: "Categories",
    icon: Tag,
    children: [
      { href: "/categories/expense", label: "Expense", icon: TrendingDown },
      { href: "/categories/income", label: "Income", icon: TrendingUp },
    ],
  },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/forecast", label: "Forecast", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-zinc-800 bg-zinc-950">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-zinc-800 px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-lg font-bold text-white">
          ¢
        </div>
        <span className="text-lg font-bold text-zinc-100">Centsible</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          if (item.children) {
            const groupActive = item.children.some(
              (c) => pathname === c.href || pathname.startsWith(c.href + "/")
            );
            return (
              <div key={item.label}>
                {/* Group header — not a link */}
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                    groupActive ? "text-zinc-100" : "text-zinc-400"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
                {/* Sub-items */}
                <div className="ml-4 space-y-0.5 border-l border-zinc-800 pl-3">
                  {item.children.map((child) => {
                    const isActive =
                      pathname === child.href ||
                      pathname.startsWith(child.href + "/");
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-zinc-800 text-zinc-100"
                            : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                        )}
                      >
                        <child.icon className="h-3.5 w-3.5" />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }

          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-zinc-800 p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-sm font-medium text-zinc-300">
            {user?.name?.charAt(0).toUpperCase() || "?"}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium text-zinc-200">
              {user?.name}
            </p>
            <p className="truncate text-xs text-zinc-500">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
