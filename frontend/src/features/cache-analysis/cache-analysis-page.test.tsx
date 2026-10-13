import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils";
import { createRequestLogEntry } from "@/test/mocks/factories";
import { useAuthStore } from "@/features/auth/hooks/use-auth";
import { routePermission } from "@/components/layout/nav-items";
import { getCacheSummary, getCacheRecords } from "./api";
import { CacheAnalysisPage } from "./cache-analysis-page";

const { exportSpy } = vi.hoisted(() => ({ exportSpy: vi.fn() }));
vi.mock("./api", () => ({
  getCacheSummary: vi.fn(),
  getCacheRecords: vi.fn(),
}));
vi.mock("@/features/dashboard/components/cache-report-export", () => ({
  CacheReportExport: (props: unknown) => {
    exportSpy(props);
    return <button>Export CSV</button>;
  },
}));
const summaryApi = vi.mocked(getCacheSummary);
const recordsApi = vi.mocked(getCacheRecords);
const hit = createRequestLogEntry({
  requestId: "hit",
  inputTokens: 1000,
  cachedInputTokens: 800,
  outputTokensRaw: 40,
  model: "model-a",
});
const miss = createRequestLogEntry({
  requestId: "miss",
  inputTokens: 100,
  cachedInputTokens: 0,
  model: "model-b",
});
const unknown = createRequestLogEntry({
  requestId: "unknown",
  status: "cancelled",
  inputTokens: null,
  cachedInputTokens: null,
});
const report = {
  snapshot: "snapshot-1",
  capturedAt: "2026-10-12T10:00:00Z",
  since: "2026-10-11T10:00:00Z",
  scope: "assigned" as const,
  summary: {
    input: 1100,
    cached: 800,
    count: 2,
    hits: 1,
    total: 3,
    percent: (800 / 1100) * 100,
  },
  trend: [hit, miss],
  models: ["model-a", "model-b"],
  apiKeys: [{ id: "key_1", name: "Self" }],
};

beforeEach(() => {
  summaryApi.mockReset().mockResolvedValue(report);
  recordsApi
    .mockReset()
    .mockResolvedValue({
      requests: [hit, miss, unknown],
      total: 3,
      nextCursor: null,
    });
  exportSpy.mockClear();
  window.history.replaceState({}, "", "/reports/cache");
  useAuthStore.setState({
    permissions: ["dashboard:read:all", "api_keys:read:all"],
  });
});

async function waitForRecords() {
  const table = await screen.findByRole("table", { name: "Request records" });
  await waitFor(() =>
    expect(within(table).getAllByRole("row").length).toBeGreaterThan(1),
  );
  return table;
}

describe("CacheAnalysisPage", () => {
  it("defaults to assigned keys and uses full server totals with one bounded page", async () => {
    summaryApi.mockResolvedValue({
      ...report,
      summary: { ...report.summary, count: 100001, total: 100001, percent: 60 },
    });
    recordsApi.mockResolvedValue({
      requests: Array.from({ length: 15 }, (_, i) => ({
        ...hit,
        requestId: `row-${i}`,
      })),
      total: 100001,
      nextCursor: "next",
    });
    renderWithProviders(<CacheAnalysisPage />);
    await waitForRecords();
    expect(screen.getByLabelText("API Key")).toHaveValue("assigned");
    expect(summaryApi).toHaveBeenCalledWith(
      { timeframe: "24h", model: "", apiKey: "assigned", search: "" },
      expect.any(AbortSignal),
    );
    expect(recordsApi).toHaveBeenCalledOnce();
    expect(recordsApi).toHaveBeenCalledWith(
      "snapshot-1",
      "all",
      null,
      15,
      expect.any(AbortSignal),
    );
    expect(
      screen.getByRole("region", { name: "Cache overview" }),
    ).toHaveTextContent("60.0");
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      16,
    );
    expect(exportSpy.mock.lastCall?.[0]).toMatchObject({
      snapshot: "snapshot-1",
      state: "all",
    });
  });

  it("filters cache states only in records and export, preserving overview and trend", async () => {
    renderWithProviders(<CacheAnalysisPage />);
    await waitForRecords();
    const calls = summaryApi.mock.calls.length;
    recordsApi.mockResolvedValue({
      requests: [unknown],
      total: 1,
      nextCursor: null,
    });
    fireEvent.click(screen.getByRole("button", { name: "Unknown" }));
    await waitFor(() =>
      expect(recordsApi).toHaveBeenLastCalledWith(
        "snapshot-1",
        "unknown",
        null,
        15,
        expect.any(AbortSignal),
      ),
    );
    expect(
      screen.getByRole("region", { name: "Cache overview" }),
    ).toHaveTextContent("72.7");
    expect(
      screen.getByRole("region", { name: "Cache overview" }),
    ).toHaveTextContent("2 eligible requests");
    expect(summaryApi).toHaveBeenCalledTimes(calls);
    expect(exportSpy.mock.lastCall?.[0]).toMatchObject({
      snapshot: "snapshot-1",
      state: "unknown",
    });
  });

  it("navigates using cursors and does not refetch summary when paging", async () => {
    recordsApi
      .mockResolvedValueOnce({
        requests: [hit],
        total: 2,
        nextCursor: "page-2",
      })
      .mockResolvedValue({ requests: [miss], total: 2, nextCursor: null });
    renderWithProviders(<CacheAnalysisPage />);
    await waitForRecords();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(recordsApi).toHaveBeenLastCalledWith(
        "snapshot-1",
        "all",
        "page-2",
        15,
        expect.any(AbortSignal),
      ),
    );
    expect(summaryApi).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("region", { name: "Cache overview" }),
    ).toHaveTextContent("72.7");
  });

  it("applies key/model/search scope to server summary and its new snapshot", async () => {
    renderWithProviders(<CacheAnalysisPage />);
    await waitForRecords();
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "key_1" },
    });
    await waitFor(() =>
      expect(summaryApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ apiKey: "key_1" }),
        expect.any(AbortSignal),
      ),
    );
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "model-a" },
    });
    await waitFor(() =>
      expect(summaryApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ apiKey: "key_1", model: "model-a" }),
        expect.any(AbortSignal),
      ),
    );
    fireEvent.change(screen.getByLabelText("Find a request"), {
      target: { value: "hit" },
    });
    await waitFor(() =>
      expect(summaryApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "hit" }),
        expect.any(AbortSignal),
      ),
    );
  });

  it("opens exact cache details from a request row", async () => {
    renderWithProviders(<CacheAnalysisPage />);
    const table = await waitForRecords();
    fireEvent.click(within(table).getByRole("button", { name: "Details hit" }));
    const dialog = screen.getByRole("dialog");
    for (const value of ["1,000", "800", "200", "40"])
      expect(within(dialog).getByText(value)).toBeInTheDocument();
  });

  it("hides key controls without key-read permission", async () => {
    useAuthStore.setState({ permissions: ["dashboard:read:all"] });
    renderWithProviders(<CacheAnalysisPage />);
    await waitForRecords();
    expect(screen.queryByLabelText("API Key")).not.toBeInTheDocument();
    expect(routePermission("/reports/cache")).toBe("dashboard:read");
  });

  it("does not show a successful report after a summary failure", async () => {
    summaryApi.mockRejectedValue(new Error("Offline"));
    renderWithProviders(<CacheAnalysisPage />);
    expect(
      await screen.findByText(
        "Could not load complete cache data. Please refresh.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(recordsApi).not.toHaveBeenCalled();
  });
  it("polls only a summary and the active bounded page", async () => {
    vi.useFakeTimers();
    try {
      summaryApi
        .mockResolvedValueOnce(report)
        .mockResolvedValue({ ...report, snapshot: "snapshot-2" });
      renderWithProviders(<CacheAnalysisPage />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(summaryApi).toHaveBeenCalledOnce();
      expect(recordsApi).toHaveBeenCalledOnce();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });
      expect(summaryApi).toHaveBeenCalledTimes(2);
      expect(recordsApi).toHaveBeenCalledTimes(2);
      expect(recordsApi).toHaveBeenLastCalledWith(
        "snapshot-2",
        "all",
        null,
        15,
        expect.any(AbortSignal),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
