import { z } from "zod";
import { get } from "@/lib/api-client";
import {
  RequestLogSchema,
  type RequestLogTimeframe,
} from "@/features/dashboard/schemas";
import type { CacheState } from "./model";

export const CacheSummaryResponseSchema = z.object({
  snapshot: z.string(),
  capturedAt: z.string(),
  since: z.string().nullable(),
  scope: z.enum(["assigned", "all", "unassigned", "key"]),
  summary: z.object({
    input: z.number(),
    cached: z.number(),
    count: z.number(),
    hits: z.number(),
    total: z.number(),
    percent: z.number().nullable(),
  }),
  trend: z.array(RequestLogSchema),
  models: z.array(z.string()),
  apiKeys: z.array(z.object({ id: z.string(), name: z.string() })),
});
export const CacheRecordsResponseSchema = z.object({
  requests: z.array(RequestLogSchema),
  total: z.number(),
  nextCursor: z.string().nullable(),
});

export function getCacheSummary(
  filters: {
    timeframe: RequestLogTimeframe;
    apiKey: string;
    model: string;
    search: string;
  },
  signal?: AbortSignal,
) {
  const scope = ["assigned", "all", "unassigned"].includes(filters.apiKey)
    ? filters.apiKey
    : "key";
  const params = new URLSearchParams({ timeframe: filters.timeframe, scope });
  if (scope === "key") params.set("apiKeyId", filters.apiKey);
  if (filters.model) params.set("model", filters.model);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  return get(
    `/api/request-logs/cache-summary?${params}`,
    CacheSummaryResponseSchema,
    { signal },
  );
}

export function getCacheRecords(
  snapshot: string,
  state: CacheState,
  cursor: string | null = null,
  limit = 15,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ snapshot, state, limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return get(
    `/api/request-logs/cache-records?${params}`,
    CacheRecordsResponseSchema,
    { signal },
  );
}
