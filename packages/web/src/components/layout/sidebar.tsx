"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { isNavItemActive, navGroups } from "./navigation";

const STORAGE_KEY = "centsible-sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  });
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  const expanded = !collapsed || hovered;

  return (
    <aside
      className={cn(
        "hidden h-screen shrink-0 flex-col border-r border-zinc-800/90 bg-zinc-950/95 backdrop-blur transition-[width] duration-300 md:flex",
        expanded ? "w-64" : "w-[72px]"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-3 border-b border-zinc-800/90 px-4 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-sm font-black text-zinc-950 shadow-[0_0_24px_rgba(16,185,129,0.35)]">
          ¢
        </div>
        {expanded ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-50">Centsible</p>
            <p className="truncate text-xs text-zinc-500">Personal finance cockpit</p>
          </div>
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-5">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-2">
              {expanded ? (
                <div className="flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  <group.icon className="size-3.5" />
                  <span>{group.label}</span>
                </div>
              ) : (
                <div className="mx-auto h-px w-8 bg-zinc-800" />
              )}

              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = isNavItemActive(pathname, item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      className={cn(
                        "flex items-center rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium transition-colors",
                        expanded ? "gap-3" : "justify-center px-0",
                        isActive
                          ? "border-emerald-500/20 bg-emerald-500/10 text-zinc-50"
                          : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {expanded ? (
                        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                          <span className="truncate">{item.label}</span>
                          {isActive ? <ChevronLeft className="size-4 rotate-180 text-emerald-400" /> : null}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-zinc-800/90 p-3">
        <div className={cn("flex items-center rounded-2xl bg-zinc-900/80", expanded ? "gap-3 px-3 py-3" : "justify-center px-0 py-3")}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-300">
            {user?.name?.charAt(0).toUpperCase() || "?"}
          </div>
          {expanded ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-100">{user?.name}</p>
              <p className="truncate text-xs text-zinc-500">{user?.email}</p>
            </div>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={logout}
            title="Log out"
            aria-label="Log out"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
