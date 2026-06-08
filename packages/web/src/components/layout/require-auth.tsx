import { Navigate, Outlet, useLocation } from "react-router";

import { useAuthStore } from "@/lib/store";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";

export function RequireAuth() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="min-h-screen bg-background md:flex">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <MobileNav />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl px-4 py-5 pb-24 sm:px-6 sm:py-6 md:px-8 md:py-8 md:pb-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
