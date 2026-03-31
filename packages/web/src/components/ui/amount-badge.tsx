import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AmountBadgeProps {
  amount: string;
  tone?: "income" | "expense" | "neutral";
  className?: string;
}

export function AmountBadge({
  amount,
  tone = "neutral",
  className,
}: AmountBadgeProps) {
  return (
    <Badge
      className={cn(
        "border px-2.5 py-1 font-mono text-xs",
        tone === "income" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
        tone === "expense" && "border-red-500/20 bg-red-500/10 text-red-300",
        tone === "neutral" && "border-zinc-700 bg-zinc-800 text-zinc-200",
        className
      )}
    >
      {amount}
    </Badge>
  );
}
