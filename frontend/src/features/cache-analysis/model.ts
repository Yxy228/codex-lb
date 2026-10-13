import { requestCacheUsage } from "@/features/dashboard/cache-report";
import type { RequestLog } from "@/features/dashboard/schemas";

export type CacheState = "all" | "hit" | "miss" | "unknown";
export function cacheState(request: RequestLog): Exclude<CacheState, "all"> {
  const usage = requestCacheUsage(request);
  return usage == null || usage.percent == null
    ? "unknown"
    : usage.cached > 0
      ? "hit"
      : "miss";
}
