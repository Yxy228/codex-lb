import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CopyButton } from "@/components/copy-button";
import { requestCacheUsage } from "@/features/dashboard/cache-report";
import type { RequestLog } from "@/features/dashboard/schemas";
import { CoverageBar } from "./cache-coverage-bar";

export function CacheRequestDetail({
  selected,
  onClose,
}: {
  selected: RequestLog | null;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const selectedUsage = selected ? requestCacheUsage(selected) : null;
  const number = (value: number | null | undefined) =>
    value == null ? "—" : value.toLocaleString(i18n.language);
  return (
    <Dialog
      open={selected !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("cacheAnalysis.requestDetail")}</DialogTitle>
          <DialogDescription>
            {selected?.model} ·{" "}
            {selected
              ? new Date(selected.requestedAt).toLocaleString(i18n.language)
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-muted/30 p-5">
          <p className="text-xs text-muted-foreground">
            {t("cacheAnalysis.coverage")}
          </p>
          <div className="my-3 text-4xl font-semibold tabular-nums">
            {selectedUsage?.percent != null
              ? `${selectedUsage.percent.toFixed(1)}%`
              : t("dashboard.cacheReport.unknown")}
          </div>
          <CoverageBar percent={selectedUsage?.percent ?? null} />
        </div>
        <dl className="grid grid-cols-2 gap-4">
          {[
            ["dashboard.cacheReport.input", selected?.inputTokens],
            [
              "dashboard.cacheReport.cached",
              selectedUsage?.cached ?? selected?.cachedInputTokens,
            ],
            ["dashboard.cacheReport.uncached", selectedUsage?.uncached],
            ["dashboard.cacheReport.output", selected?.outputTokensRaw],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border p-4">
              <dt className="text-xs text-muted-foreground">
                {t(String(label))}
              </dt>
              <dd className="mt-2 font-mono text-lg font-semibold">
                {number(value as number | null | undefined)}
              </dd>
            </div>
          ))}
        </dl>
        <div className="space-y-2 border-t pt-4 text-xs text-muted-foreground">
          <p>
            API Key · {selected?.apiKeyName || t("cacheAnalysis.unassigned")}
          </p>
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate font-mono">
              {selected?.requestId}
            </span>
            <CopyButton
              value={selected?.requestId ?? ""}
              label={t("dashboard.requestDetails.copyRequestId")}
            />
          </div>
          <p>{t("cacheAnalysis.detailExplanation")}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
