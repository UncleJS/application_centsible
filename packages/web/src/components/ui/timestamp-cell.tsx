import { formatTimestamp } from "@/lib/format";

interface TimestampCellProps {
  value: string;
  className?: string;
}

export function TimestampCell({ value, className }: TimestampCellProps) {
  return (
    <span className={className ?? "font-mono text-xs text-zinc-500"}>
      {formatTimestamp(value)}
    </span>
  );
}
