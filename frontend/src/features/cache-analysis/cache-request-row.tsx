import { useTranslation } from "react-i18next";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestCacheUsage } from "@/features/dashboard/cache-report";
import type { RequestLog } from "@/features/dashboard/schemas";
import { cn } from "@/lib/utils";
import { cacheState } from "./model";
import { CoverageBar } from "./cache-coverage-bar";

export const ROW_GRID =
  "md:grid-cols-[140px_minmax(150px,1fr)_110px_110px_150px_90px_44px]";

export function CacheRequestRow({
  request,
  onSelect,
}: {
  request: RequestLog;
  onSelect: (request: RequestLog) => void;
}) {
  const { t, i18n } = useTranslation();
  const usage = requestCacheUsage(request);
  const state = cacheState(request);
  const number = (value: number | null | undefined) =>
    value == null ? "—" : value.toLocaleString(i18n.language);
  const time = new Date(request.requestedAt);
  return (
    <div
      role="row"
      className={cn(
        "grid grid-cols-2 items-center gap-x-4 gap-y-4 border-b px-5 py-4 last:border-0 md:gap-x-3 md:py-3.5",
        ROW_GRID,
      )}
    >
      <div role="cell" className="text-sm tabular-nums">
        <div className="font-medium">
          {time.toLocaleTimeString(i18n.language, { hour12: false })}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {time.toLocaleDateString(i18n.language)} ·{" "}
          {t(`dashboard.requestStatus.${request.status}`, {
            defaultValue: request.status,
          })}
        </div>
      </div>
      <div role="cell" className="min-w-0 text-right md:text-left">
        <div
          className="truncate font-mono text-xs font-semibold"
          title={request.model}
        >
          {request.model}
        </div>
        <div className="mt-1 truncate text-[11px] text-muted-foreground">
          {request.apiKeyName || t("cacheAnalysis.unassigned")}
          {request.requestKind !== "normal"
            ? ` · ${t("cacheAnalysis.warmup")}`
            : ""}
        </div>
      </div>
      <div role="cell" className="text-sm tabular-nums md:text-right">
        <span className="mb-1 block text-[11px] text-muted-foreground md:hidden">
          {t("dashboard.cacheReport.input")}
        </span>
        {number(request.inputTokens)}
      </div>
      <div role="cell" className="text-sm tabular-nums md:text-right">
        <span className="mb-1 block text-[11px] text-muted-foreground md:hidden">
          {t("dashboard.cacheReport.cached")}
        </span>
        {number(usage?.cached ?? request.cachedInputTokens)}
      </div>
      <div role="cell" className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <strong
            className={cn(
              "text-sm tabular-nums",
              state === "hit" && "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {usage?.percent != null ? `${usage.percent.toFixed(1)}%` : "—"}
          </strong>
          <span className="text-[11px] text-muted-foreground">
            {t(`dashboard.cacheReport.${state}`)}
          </span>
        </div>
        <CoverageBar percent={usage?.percent ?? null} />
      </div>
      <div role="cell" className="text-sm tabular-nums md:text-right">
        <span className="mb-1 block text-[11px] text-muted-foreground md:hidden">
          {t("dashboard.cacheReport.output")}
        </span>
        {number(request.outputTokensRaw)}
      </div>
      <div role="cell" className="col-span-2 md:col-span-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full md:w-8"
          aria-label={`${t("cacheAnalysis.details")} ${request.requestId}`}
          onClick={() => onSelect(request)}
        >
          <span className="md:hidden">{t("cacheAnalysis.details")}</span>
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
