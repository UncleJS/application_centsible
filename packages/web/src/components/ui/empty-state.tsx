import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-14 text-center",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-400">
        <Icon className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-zinc-200">{title}</p>
        <p className="max-w-md text-sm text-zinc-500">{description}</p>
      </div>
      {action}
    </div>
  );
}
