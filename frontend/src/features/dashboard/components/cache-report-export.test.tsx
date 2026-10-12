import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRequestLogs } from "@/features/dashboard/api";
import { CacheReportExport } from "@/features/dashboard/components/cache-report-export";
import {
  RequestLogSchema,
  type FilterState,
} from "@/features/dashboard/schemas";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("@/features/dashboard/api", () => ({ getRequestLogs: vi.fn() }));

const filters: FilterState = {
  search: "cache",
  timeframe: "24h",
  accountIds: ["account"],
  apiKeyIds: ["key"],
  statuses: [],
  modelOptions: [],
  conversationId: null,
  limit: 25,
  offset: 25,
};
const request = RequestLogSchema.parse({
  requestedAt: "2026-01-01T12:00:00Z",
  requestId: "request",
  model: "gpt-5.1",
  status: "ok",
  accountId: null,
  errorCode: null,
  errorMessage: null,
  reasoningEffort: null,
  costUsd: null,
  latencyMs: null,
  tokens: 110,
  inputTokens: 100,
  cachedInputTokens: 80,
  outputTokens: 10,
  outputTokensRaw: 10,
});

const api = vi.mocked(getRequestLogs);
let click: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  api.mockReset();
  toastError.mockReset();
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:report"),
      revokeObjectURL: vi.fn(),
    }),
  );
  click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
});

describe("CacheReportExport", () => {
  it("exports the full already-filtered dataset without rereading the server", async () => {
    render(
      <CacheReportExport
        filters={filters}
        requests={[request, { ...request, requestId: "second" }]}
        compact
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(api).not.toHaveBeenCalled();
  });

  it("rejects an empty intermediate page without downloading partial results", async () => {
    api.mockResolvedValueOnce({
      requests: [request],
      total: 2,
      hasMore: true,
      conversation: null,
    });
    api.mockResolvedValueOnce({
      requests: [],
      total: 2,
      hasMore: true,
      conversation: null,
    });
    render(<CacheReportExport filters={filters} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(click).not.toHaveBeenCalled();
  });

  it("exports every filtered page from offset zero with a fixed interval", async () => {
    api.mockResolvedValueOnce({
      requests: [request],
      total: 2,
      hasMore: true,
      conversation: null,
    });
    api.mockResolvedValueOnce({
      requests: [
        {
          ...request,
          requestId: "second",
          inputTokens: null,
          cachedInputTokens: null,
        },
      ],
      total: 2,
      hasMore: false,
      conversation: null,
    });
    render(<CacheReportExport filters={filters} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Export filtered cache report (CSV)",
      }),
    );
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(api).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        offset: 0,
        limit: 1000,
        search: "cache",
        apiKeyIds: ["key"],
        accountIds: ["account"],
      }),
    );
    const first = api.mock.calls[0][0]!;
    const second = api.mock.calls[1][0]!;
    expect(second.offset).toBe(1);
    expect(second.since).toBe(first.since);
    expect(second.until).toBe(first.until);
    expect(
      new Date(first.until!).getTime() - new Date(first.since!).getTime(),
    ).toBe(86400000);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("does not download partial results on a pagination failure", async () => {
    api.mockResolvedValueOnce({
      requests: [request],
      total: 2,
      hasMore: true,
      conversation: null,
    });
    api.mockRejectedValueOnce(new Error("Offline"));
    render(<CacheReportExport filters={filters} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Export filtered cache report (CSV)",
      }),
    );
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(click).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("rejects oversized exports instead of silently truncating", async () => {
    api.mockResolvedValueOnce({
      requests: [request],
      total: 100001,
      hasMore: true,
      conversation: null,
    });
    render(<CacheReportExport filters={filters} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(click).not.toHaveBeenCalled();
  });
});
