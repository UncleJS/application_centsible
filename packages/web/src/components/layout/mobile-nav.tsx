import { useState } from "react";
import { Link, useLocation } from "react-router";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getCurrentPageTitle,
  isNavItemActive,
  mobileOverflowNav,
  mobilePrimaryNav,
} from "./navigation";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = useLocation().pathname;
  const [open, setOpen] = useState(false);
  const title = getCurrentPageTitle(pathname);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-800/80 bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-sm font-black text-primary-foreground shadow-[0_0_24px_rgba(16,185,129,0.35)]">
            ¢
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-foreground">
              Centsible
            </p>
            <p className="text-sm font-semibold text-foreground">{title}</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="text-foreground hover:bg-zinc-900 hover:text-foreground"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </Button>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="border-zinc-800 bg-background text-foreground"
        >
          <SheetHeader className="border-b border-zinc-800 px-0 pb-4">
            <SheetTitle className="px-6 text-foreground">More sections</SheetTitle>
            <SheetDescription className="px-6 text-foreground">
              Jump to categories, recurring items, forecast, and settings.
            </SheetDescription>
          </SheetHeader>

          <nav className="flex flex-col gap-2 px-4 py-6">
            {mobileOverflowNav.map((item) => {
              const isActive = isNavItemActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "border-emerald-500/30 bg-emerald-500/10 text-foreground"
                      : "border-zinc-800 bg-zinc-900/70 text-foreground hover:bg-zinc-900 hover:text-foreground"
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800/80 bg-background/95 px-2 py-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobilePrimaryNav.map((item) => {
            const isActive = isNavItemActive(pathname, item);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors",
                  isActive
                    ? "bg-zinc-800 text-foreground"
                    : "text-foreground hover:bg-zinc-900 hover:text-foreground"
                )}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
