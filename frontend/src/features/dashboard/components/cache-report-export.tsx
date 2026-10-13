import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getCacheRecords } from "@/features/cache-analysis/api";
import type { CacheState } from "@/features/cache-analysis/model";
import { requestCacheCsv } from "@/features/dashboard/cache-report";

export function CacheReportExport({
  compact = false,
  snapshot,
  state = "all",
}: {
  compact?: boolean;
  snapshot: string;
  state?: CacheState;
}) {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);

  const exportReport = async () => {
    setExporting(true);
    try {
      const now = new Date();
      const chunks: string[] = [];
      chunks.push(requestCacheCsv([]));
      let cursor: string | null = null;
      const seen = new Set<string>();
      let expectedTotal: number | null = null;
      let exportedCount = 0;
      do {
        const page = await getCacheRecords(snapshot, state, cursor, 1000);
        expectedTotal ??= page.total;
        if (page.total !== expectedTotal) throw new Error("cache-incomplete");
        exportedCount += page.requests.length;
        const csv = requestCacheCsv(page.requests);
        chunks.push(csv.slice(csv.indexOf("\r\n") + 2));
        cursor = page.nextCursor;
        if (cursor && (seen.has(cursor) || page.requests.length === 0))
          throw new Error("cache-incomplete");
        if (cursor) seen.add(cursor);
      } while (cursor);
      if (exportedCount !== expectedTotal) throw new Error("cache-incomplete");
      const blob = new Blob(chunks, { type: "text/csv;charset=utf-8" });
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
        description: error instanceof Error ? error.message : undefined,
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
