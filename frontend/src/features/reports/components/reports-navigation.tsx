import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function ReportsNavigation({
  active,
}: {
  active: "usage" | "cache" | "requests";
}) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("cacheAnalysis.reportNavigation")}
      className="flex w-fit gap-1 rounded-xl border bg-muted/40 p-1"
    >
      {(
        [
          ["usage", "/reports", "cacheAnalysis.usageReport"],
          ["cache", "/reports/cache", "cacheAnalysis.title"],
          ["requests", "/reports/requests", "recordsPage.title"],
        ] as const
      ).map(([id, to, label]) => (
        <Link
          key={id}
          to={to}
          aria-current={active === id ? "page" : undefined}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            active === id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(label)}
        </Link>
      ))}
    </nav>
  );
}
