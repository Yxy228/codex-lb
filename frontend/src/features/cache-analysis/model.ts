import {
  requestCacheUsage,
  summarizeRequestCache,
} from "@/features/dashboard/cache-report";
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
export function cacheAnalysisSummary(requests: RequestLog[]) {
  const summary = summarizeRequestCache(requests);
  const hits = requests.filter(
    (request) =>
      request.status === "ok" &&
      request.requestKind === "normal" &&
      cacheState(request) === "hit",
  ).length;
  return { ...summary, hits };
}
export function filterCacheRequests(
  requests: RequestLog[],
  filters: { model: string; apiKey: string; search: string; state: CacheState },
) {
  const search = filters.search.trim().toLowerCase();
  return requests.filter(
    (request) =>
      (!filters.model || request.model === filters.model) &&
      (!filters.apiKey ||
        (filters.apiKey === "unassigned"
          ? !request.apiKeyId
          : request.apiKeyId === filters.apiKey)) &&
      (filters.state === "all" || cacheState(request) === filters.state) &&
      (!search ||
        [request.requestId, request.model, request.apiKeyName].some((value) =>
          value?.toLowerCase().includes(search),
        )),
  );
}
