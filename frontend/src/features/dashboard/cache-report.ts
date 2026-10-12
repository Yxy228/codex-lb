import type { RequestLog } from "@/features/dashboard/schemas";

export function requestCacheUsage(request: RequestLog) {
  const { inputTokens, cachedInputTokens } = request;
  if (inputTokens == null || cachedInputTokens == null || inputTokens < 0 || cachedInputTokens < 0) {
    return null;
  }
  const cached = Math.min(inputTokens, cachedInputTokens);
  return {
    input: inputTokens,
    cached,
    uncached: inputTokens - cached,
    percent: inputTokens > 0 ? (cached / inputTokens) * 100 : null,
  };
}

export function summarizeRequestCache(requests: RequestLog[]) {
  let input = 0;
  let cached = 0;
  let count = 0;
  for (const request of requests) {
    const usage = requestCacheUsage(request);
    if (request.status !== "ok" || request.requestKind !== "normal" || !usage || usage.input === 0) {
      continue;
    }
    input += usage.input;
    cached += usage.cached;
    count += 1;
  }
  return { input, cached, count, percent: input > 0 ? (cached / input) * 100 : null };
}

function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? "");
  const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function requestCacheCsv(requests: RequestLog[]): string {
  const headers = ["requested_at", "request_id", "api_key_id", "api_key_name", "model", "status", "request_kind", "input_tokens", "cached_input_tokens", "uncached_input_tokens", "cache_percent", "output_tokens"];
  const rows = requests.map((request) => {
    const usage = requestCacheUsage(request);
    return [request.requestedAt, request.requestId, request.apiKeyId, request.apiKeyName, request.model,
      request.status, request.requestKind, request.inputTokens, usage?.cached ?? request.cachedInputTokens,
      usage?.uncached, usage?.percent?.toFixed(2), request.outputTokensRaw];
  });
  return "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
