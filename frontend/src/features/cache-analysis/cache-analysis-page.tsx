import { CacheRequestRow, ROW_GRID } from "./cache-request-row";
import { CacheRequestDetail } from "./cache-request-detail";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Database,
  Download,
  RefreshCw,
  Search,
} from "lucide-react";

import { AlertMessage } from "@/components/alert-message";
import { Button } from "@/components/ui/button";
import { usePermission } from "@/features/auth/hooks/use-auth";
import { CacheReportExport } from "@/features/dashboard/components/cache-report-export";
import { requestCacheUsage } from "@/features/dashboard/cache-report";
import type {
  FilterState,
  RequestLog,
  RequestLogTimeframe,
} from "@/features/dashboard/schemas";
import { ReportsNavigation } from "@/features/reports/components/reports-navigation";
import { formatCompactNumber } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { loadCacheRequests } from "./data";
import {
  cacheAnalysisSummary,
  filterCacheRequests,
  type CacheState,
} from "./model";

const RANGE_OPTIONS = ["1h", "24h", "7d", "all"] as const;
const CACHE_STATES = ["all", "hit", "miss", "unknown"] as const;

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-0 rounded-lg border bg-background px-3 text-sm font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CacheAnalysisPage() {
  const { t, i18n } = useTranslation();
  const canReadKeys = usePermission("api_keys:read");
  const [timeframe, setTimeframe] = useState<RequestLogTimeframe>("24h");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [search, setSearch] = useState("");
  const [state, setState] = useState<CacheState>("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<RequestLog | null>(null);
  const query = useQuery({
    queryKey: ["cache-analysis", timeframe],
    queryFn: () => loadCacheRequests({ timeframe }),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const requests = useMemo(() => query.data ?? [], [query.data]);
  const matching = useMemo(
    () =>
      filterCacheRequests(requests, {
        model,
        apiKey: canReadKeys ? apiKey : "",
        search,
        state,
      }),
    [requests, model, apiKey, canReadKeys, search, state],
  );
  const summary = cacheAnalysisSummary(matching);
  const models = [...new Set(requests.map((request) => request.model))].sort();
  const keys = new Map(
    requests
      .filter((request) => request.apiKeyId)
      .map((request) => [
        request.apiKeyId!,
        request.apiKeyName || request.apiKeyId!,
      ]),
  );
  const trend = matching
    .filter(
      (request) =>
        request.status === "ok" &&
        request.requestKind === "normal" &&
        requestCacheUsage(request)?.percent != null,
    )
    .slice(0, 40)
    .reverse();
  const pageSize = 15;
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(matching.length / pageSize) - 1),
  );
  const rows = matching.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );
  const exportFilters: FilterState = {
    timeframe,
    search: "",
    accountIds: [],
    apiKeyIds: [],
    modelOptions: [],
    statuses: [],
    conversationId: null,
    limit: pageSize,
    offset: 0,
  };
  const number = (value: number | null | undefined) =>
    value == null ? "—" : value.toLocaleString(i18n.language);
  const updateFilter = (update: () => void) => {
    update();
    setPage(0);
  };
  const ready = query.isSuccess;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-12">
      <ReportsNavigation active="cache" />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t("cacheAnalysis.live")}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("cacheAnalysis.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("cacheAnalysis.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", query.isFetching && "animate-spin")}
            />
            {t("cacheAnalysis.refresh")}
          </Button>
          {ready ? (
            <CacheReportExport
              filters={exportFilters}
              requests={matching}
              compact
            />
          ) : (
            <Button variant="outline" size="sm" disabled>
              <Download className="h-3.5 w-3.5" />
              {t("cacheAnalysis.export")}
            </Button>
          )}
        </div>
      </header>
      <section
        aria-label={t("cacheAnalysis.filters")}
        className="grid grid-cols-2 gap-4 rounded-2xl border bg-card p-5 md:grid-cols-4"
      >
        <FilterSelect
          label={t("cacheAnalysis.timeRange")}
          value={timeframe}
          onChange={(value) =>
            updateFilter(() => setTimeframe(value as RequestLogTimeframe))
          }
          options={RANGE_OPTIONS.map((value) => ({
            value,
            label: t(`cacheAnalysis.range.${value}`),
          }))}
        />
        <FilterSelect
          label={t("dashboard.requests.columns.model")}
          value={model}
          onChange={(value) => updateFilter(() => setModel(value))}
          options={[
            { value: "", label: t("cacheAnalysis.allModels") },
            ...models.map((value) => ({ value, label: value })),
          ]}
        />
        {canReadKeys ? (
          <FilterSelect
            label="API Key"
            value={apiKey}
            onChange={(value) => updateFilter(() => setApiKey(value))}
            options={[
              { value: "", label: t("cacheAnalysis.allKeys") },
              { value: "unassigned", label: t("cacheAnalysis.unassigned") },
              ...[...keys].map(([value, label]) => ({ value, label })),
            ]}
          />
        ) : null}
        <label
          className={cn(
            "flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted-foreground",
            !canReadKeys && "md:col-span-2",
          )}
        >
          {t("cacheAnalysis.search")}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4" />
            <input
              value={search}
              onChange={(event) =>
                updateFilter(() => setSearch(event.target.value))
              }
              placeholder={t("cacheAnalysis.searchPlaceholder")}
              className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>
        </label>
      </section>
      {query.error ? (
        <AlertMessage variant="error">
          {t(
            query.error.message === "cache-limit"
              ? "dashboard.cacheReport.tooLarge"
              : "cacheAnalysis.loadError",
          )}
        </AlertMessage>
      ) : null}
      {query.isPending ? (
        <div className="rounded-2xl border bg-card p-16 text-center text-muted-foreground">
          {t("cacheAnalysis.loading")}
        </div>
      ) : null}
      {ready ? (
        <>
          <section
            aria-label={t("cacheAnalysis.overview")}
            className="grid gap-4 md:grid-cols-4"
          >
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-50/60 p-6 md:col-span-2 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("cacheAnalysis.coverage")}
                  </p>
                  <div className="mt-3 text-5xl font-semibold tracking-tight tabular-nums">
                    {summary.percent == null ? "—" : summary.percent.toFixed(1)}
                    <span className="ml-1 text-2xl text-muted-foreground">
                      {summary.percent != null ? "%" : ""}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {t("cacheAnalysis.coverageExplanation")}
                  </p>
                </div>
                <div
                  className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(#10b981 ${(summary.percent ?? 0) * 3.6}deg, rgb(148 163 184 / .15) 0deg)`,
                  }}
                  aria-hidden="true"
                >
                  <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-background">
                    <Database className="h-7 w-7 text-emerald-500" />
                  </div>
                </div>
              </div>
              <p className="mt-5 border-t border-emerald-500/15 pt-3 text-[11px] text-muted-foreground">
                {t("cacheAnalysis.scope", { count: summary.count })}
              </p>
            </div>
            <div className="flex flex-col justify-between rounded-2xl border bg-card p-6">
              <p className="text-sm font-medium text-muted-foreground">
                {t("cacheAnalysis.requestHits")}
              </p>
              <div className="my-4">
                <span className="text-3xl font-semibold tabular-nums">
                  {number(summary.hits)}
                </span>
                <span className="ml-2 text-sm text-muted-foreground">
                  / {number(summary.count)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("cacheAnalysis.requestHitExplanation", {
                  percent: summary.count
                    ? `${((summary.hits / summary.count) * 100).toFixed(1)}%`
                    : "—",
                })}
              </p>
            </div>
            <div className="flex flex-col justify-between rounded-2xl border bg-card p-6">
              <p className="text-sm font-medium text-muted-foreground">
                {t("cacheAnalysis.reusedInput")}
              </p>
              <div
                className="my-4 text-3xl font-semibold tabular-nums"
                title={number(summary.cached)}
              >
                {formatCompactNumber(summary.cached)}
              </div>
              <div className="text-xs leading-5 text-muted-foreground">
                <p>
                  {t("cacheAnalysis.totalInput", {
                    count: number(summary.input),
                  })}
                </p>
                <p>
                  {t("cacheAnalysis.freshInput", {
                    count: number(summary.input - summary.cached),
                  })}
                </p>
              </div>
            </div>
          </section>
          <section
            className="rounded-2xl border bg-card p-5"
            aria-label={t("cacheAnalysis.trend")}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">
                  {t("cacheAnalysis.trend")}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("cacheAnalysis.trendDescription", { count: trend.length })}
                </p>
              </div>
              <div className="flex gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {t("cacheAnalysis.highCoverage")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  {t("cacheAnalysis.lowCoverage")}
                </span>
              </div>
            </div>
            {trend.length ? (
              <div
                className="mt-5 flex h-24 items-end gap-1.5"
                aria-label={t("cacheAnalysis.trend")}
              >
                {trend.map((request, index) => {
                  const percent = requestCacheUsage(request)!.percent!;
                  return (
                    <button
                      key={`${request.requestId}-${index}`}
                      title={`${new Date(request.requestedAt).toLocaleTimeString(i18n.language)} · ${request.model} · ${percent.toFixed(1)}%`}
                      aria-label={`${t("cacheAnalysis.details")} ${request.requestId}`}
                      onClick={() => setSelected(request)}
                      className={cn(
                        "min-w-0 flex-1 rounded-t-sm outline-offset-4 transition-opacity hover:opacity-60",
                        percent >= 80 ? "bg-emerald-500/80" : "bg-amber-400",
                      )}
                      style={{ height: `${Math.max(4, percent)}%` }}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("cacheAnalysis.noEligible")}
              </p>
            )}
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
              <span>{t("cacheAnalysis.older")}</span>
              <span>{t("cacheAnalysis.newer")}</span>
            </div>
          </section>
          <section
            className="overflow-hidden rounded-2xl border bg-card"
            aria-label={t("cacheAnalysis.records")}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div className="flex items-baseline gap-2">
                <h2 className="font-semibold">{t("cacheAnalysis.records")}</h2>
                <span className="text-xs text-muted-foreground">
                  {t("cacheAnalysis.recordCount", { count: matching.length })}
                </span>
              </div>
              <div
                className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1"
                role="group"
                aria-label={t("cacheAnalysis.cacheFilter")}
              >
                {CACHE_STATES.map((value) => (
                  <button
                    key={value}
                    aria-pressed={state === value}
                    onClick={() => updateFilter(() => setState(value))}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      state === value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(`cacheAnalysis.state.${value}`)}
                  </button>
                ))}
              </div>
            </div>
            <div role="table" aria-label={t("cacheAnalysis.records")}>
              <div
                role="row"
                className={cn(
                  "hidden items-center gap-x-3 border-b bg-muted/20 px-5 py-3 text-[11px] font-medium text-muted-foreground md:grid",
                  ROW_GRID,
                )}
              >
                {[
                  "dashboard.requests.columns.time",
                  "dashboard.requests.columns.model",
                  "dashboard.cacheReport.input",
                  "dashboard.cacheReport.cached",
                  "dashboard.requests.columns.cache",
                  "dashboard.cacheReport.output",
                  "cacheAnalysis.details",
                ].map((key, index) => (
                  <div
                    role="columnheader"
                    key={key}
                    className={
                      index === 2 || index === 3 || index === 5
                        ? "text-right"
                        : ""
                    }
                  >
                    {t(key)}
                  </div>
                ))}
              </div>
              {rows.map((request, index) => (
                <CacheRequestRow
                  key={`${request.requestId}-${index}`}
                  request={request}
                  onSelect={setSelected}
                />
              ))}
            </div>
            {!rows.length ? (
              <div className="px-5 py-14 text-center">
                <p className="text-sm font-medium">
                  {t("cacheAnalysis.empty")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("cacheAnalysis.emptyHint")}
                </p>
              </div>
            ) : null}
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-xs text-muted-foreground">
              <span>
                {t("cacheAnalysis.pageRange", {
                  start: matching.length ? currentPage * pageSize + 1 : 0,
                  end: Math.min((currentPage + 1) * pageSize, matching.length),
                  total: matching.length,
                })}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  {t("cacheAnalysis.previous")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={(currentPage + 1) * pageSize >= matching.length}
                  onClick={() => setPage(currentPage + 1)}
                >
                  {t("cacheAnalysis.next")}
                </Button>
              </div>
            </footer>
          </section>
          {canReadKeys && requests.some((request) => !request.apiKeyId) ? (
            <p className="text-xs text-muted-foreground">
              {t("cacheAnalysis.unassignedExplanation")}
            </p>
          ) : null}
        </>
      ) : null}
      <CacheRequestDetail
        selected={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
