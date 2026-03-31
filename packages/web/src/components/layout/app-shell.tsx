"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, hydrate } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const isAuthPage = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isLoading) return;
    // Redirect unauthenticated users to login (except on auth pages)
    if (!isAuthenticated && !isAuthPage) {
      router.push("/login");
    }
    // Redirect authenticated users away from auth pages
    if (isAuthenticated && isAuthPage) {
      router.push("/dashboard");
    }
  }, [isLoading, isAuthenticated, isAuthPage, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
          <p className="text-sm text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Auth pages - no sidebar
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950 md:flex">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <MobileNav />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl px-4 py-5 pb-24 sm:px-6 sm:py-6 md:px-8 md:py-8 md:pb-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
