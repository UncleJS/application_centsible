import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  accentClassName?: string;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accentClassName,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
            {label}
          </p>
          <p className={cn("mt-2 text-2xl font-semibold text-zinc-50", accentClassName)}>
            {value}
          </p>
        </div>
        {Icon ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
            <Icon className="size-5" />
          </div>
        ) : null}
      </div>
      {hint ? <p className="text-sm text-zinc-500">{hint}</p> : null}
    </div>
  );
}
