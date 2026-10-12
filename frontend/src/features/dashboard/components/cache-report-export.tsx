import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { loadCacheRequests } from "@/features/cache-analysis/data";
import { requestCacheCsv } from "@/features/dashboard/cache-report";
import type { FilterState, RequestLog } from "@/features/dashboard/schemas";

export function CacheReportExport({
  filters,
  requests: loadedRequests,
  compact = false,
}: {
  filters: FilterState;
  requests?: RequestLog[];
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);

  const exportReport = async () => {
    setExporting(true);
    try {
      const now = new Date();
      const requests =
        loadedRequests ??
        (await loadCacheRequests(
          {
            timeframe: filters.timeframe,
            search: filters.search || undefined,
            accountIds: filters.accountIds,
            apiKeyIds: filters.apiKeyIds,
            statuses: filters.statuses,
            modelOptions: filters.modelOptions,
            conversationId: filters.conversationId ?? undefined,
          },
          now,
        ));
      const blob = new Blob([requestCacheCsv(requests)], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cache-report-${now.toISOString().replaceAll(":", "-")}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Allow the browser to start reading the blob before releasing it.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(t("dashboard.cacheReport.failed"), {
        description:
          error instanceof Error && error.message === "cache-limit"
            ? t("dashboard.cacheReport.tooLarge")
            : error instanceof Error
              ? error.message
              : undefined,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={exporting}
      onClick={() => void exportReport()}
    >
      {t(
        exporting
          ? "dashboard.cacheReport.exporting"
          : compact
            ? "cacheAnalysis.export"
            : "dashboard.cacheReport.export",
      )}
    </Button>
  );
}
