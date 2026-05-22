import { useEffect } from "react";
import { Outlet } from "react-router";

import { useAuthStore } from "@/lib/store";
import { Toaster } from "@/components/ui/sonner";

export function App() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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

  return (
    <>
      <Outlet />
      <Toaster richColors position="top-right" />
    </>
  );
}
