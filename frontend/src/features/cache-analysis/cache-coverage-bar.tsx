import { cn } from "@/lib/utils";

export function CoverageBar({ percent }: { percent: number | null }) {
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-muted"
      aria-hidden="true"
    >
      <div
        className={cn(
          "h-full rounded-full",
          percent != null && percent >= 80 ? "bg-emerald-500" : "bg-amber-400",
        )}
        style={{ width: `${percent ?? 0}%` }}
      />
    </div>
  );
}
