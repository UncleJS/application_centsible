import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  eyebrow,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-[0_0_0_1px_rgba(24,24,27,0.35)] sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-400/80">
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            {title}
          </h1>
          {description ? <p className="max-w-2xl text-sm text-zinc-400">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
