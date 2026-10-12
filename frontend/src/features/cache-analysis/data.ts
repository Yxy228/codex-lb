import {
  getRequestLogs,
  type RequestLogsListFilters,
} from "@/features/dashboard/api";
import type {
  RequestLog,
  RequestLogTimeframe,
} from "@/features/dashboard/schemas";

export type CacheLoadFilters = Omit<
  RequestLogsListFilters,
  "limit" | "offset" | "timeframe" | "since" | "until"
> & { timeframe: RequestLogTimeframe };

export async function loadCacheRequests(
  filters: CacheLoadFilters,
  now = new Date(),
): Promise<RequestLog[]> {
  const { timeframe, ...params } = filters;
  const hours = { "1h": 1, "24h": 24, "7d": 168 };
  const since =
    timeframe === "all"
      ? undefined
      : new Date(now.getTime() - hours[timeframe] * 3600000).toISOString();
  const requests: RequestLog[] = [];
  let offset = 0;
  while (true) {
    const page = await getRequestLogs({
      ...params,
      since,
      until: now.toISOString(),
      limit: 1000,
      offset,
    });
    if (page.total > 100000 || requests.length + page.requests.length > 100000)
      throw new Error("cache-limit");
    requests.push(...page.requests);
    if (!page.hasMore) return requests;
    if (page.requests.length === 0) throw new Error("cache-incomplete");
    offset += page.requests.length;
  }
}
