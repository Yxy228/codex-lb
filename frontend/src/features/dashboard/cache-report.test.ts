import { describe, expect, it } from "vitest";
import { requestCacheCsv } from "@/features/dashboard/cache-report";
import { RequestLogSchema } from "@/features/dashboard/schemas";

const request = RequestLogSchema.parse({
  requestedAt: "2026-01-01T12:00:00Z", requestId: "request", model: "gpt-5.1", status: "ok",
  accountId: null, errorCode: null, errorMessage: null, reasoningEffort: null, costUsd: null, latencyMs: null,
  tokens: 110, inputTokens: 100, cachedInputTokens: 80, outputTokens: 10, outputTokensRaw: 10,
});

describe("cache report CSV", () => {
  it("exports exact counts, blank unknown usage, BOM and escaped spreadsheet cells", () => {
    const csv = requestCacheCsv([
      { ...request, apiKeyName: '=SUM(1,2)"quoted"' },
      { ...request, requestId: "unknown", inputTokens: null, cachedInputTokens: null, outputTokensRaw: null },
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"100","80","20","80.00","10"');
    expect(csv).toContain('"unknown","","","gpt-5.1","ok","normal","","","","",""');
    expect(csv).toContain(`"'=SUM(1,2)""quoted"""`);
    expect(csv).toContain("\r\n");
  });
});
