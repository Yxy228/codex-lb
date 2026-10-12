import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils";
import { createRequestLogEntry } from "@/test/mocks/factories";
import { useAuthStore } from "@/features/auth/hooks/use-auth";
import { routePermission } from "@/components/layout/nav-items";
import { loadCacheRequests } from "./data";
import { CacheAnalysisPage } from "./cache-analysis-page";

const { exportSpy } = vi.hoisted(() => ({ exportSpy: vi.fn() }));
vi.mock("./data", () => ({ loadCacheRequests: vi.fn() }));
vi.mock("@/features/dashboard/components/cache-report-export", () => ({
  CacheReportExport: (props: unknown) => {
    exportSpy(props);
    return <button>Export CSV</button>;
  },
}));
const load = vi.mocked(loadCacheRequests);
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
  apiKeyId: null,
  apiKeyName: null,
});

beforeEach(() => {
  load.mockReset();
  exportSpy.mockClear();
  window.history.replaceState({}, "", "/reports/cache");
  useAuthStore.setState({
    permissions: ["dashboard:read:all", "api_keys:read:all"],
  });
});

async function waitForRecords() {
  return screen.findByRole("table", { name: "Request records" });
}

describe("CacheAnalysisPage", () => {
  it("summarizes the full range independently of display pagination", async () => {
    load.mockResolvedValue([
      ...Array.from({ length: 15 }, (_, index) =>
        createRequestLogEntry({
          requestId: `hit-${index}`,
          inputTokens: 100,
          cachedInputTokens: 100,
        }),
      ),
      createRequestLogEntry({
        requestId: "last",
        inputTokens: 1000,
        cachedInputTokens: 0,
      }),
    ]);
    renderWithProviders(<CacheAnalysisPage />);
    await waitForRecords();
    const overview = screen.getByRole("region", { name: "Cache overview" });
    expect(overview).toHaveTextContent("60.0");
    expect(overview).toHaveTextContent("16 eligible requests");
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      16,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      2,
    );
    expect(overview).toHaveTextContent("60.0");
    expect(exportSpy.mock.lastCall?.[0].requests).toHaveLength(16);
  });

  it("filters unknown usage without confusing genuine misses and excludes warmups from summary", async () => {
    load.mockResolvedValue([
      hit,
      miss,
      unknown,
      createRequestLogEntry({
        requestId: "warmup",
        requestKind: "prewarm",
        inputTokens: 9000,
        cachedInputTokens: 0,
      }),
    ]);
    renderWithProviders(<CacheAnalysisPage />);
    await waitForRecords();
    const overview = screen.getByRole("region", { name: "Cache overview" });
    expect(overview).toHaveTextContent("72.7");
    expect(overview).toHaveTextContent("2 eligible requests");
    fireEvent.click(screen.getByRole("button", { name: "Unknown" }));
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByText("Unknown usage")).toBeInTheDocument();
    expect(
      exportSpy.mock.lastCall?.[0].requests.map(
        (request: { requestId: string }) => request.requestId,
      ),
    ).toEqual(["unknown"]);
  });

  it("applies model and search filters to overview, records and export", async () => {
    load.mockResolvedValue([hit, miss]);
    renderWithProviders(<CacheAnalysisPage />);
    await waitForRecords();
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "model-a" },
    });
    expect(
      screen.getByRole("region", { name: "Cache overview" }),
    ).toHaveTextContent("80.0");
    expect(exportSpy.mock.lastCall?.[0].requests).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Find a request"), {
      target: { value: "nonexistent" },
    });
    expect(screen.getByText("No matching requests")).toBeInTheDocument();
    expect(exportSpy.mock.lastCall?.[0].requests).toHaveLength(0);
  });

  it("opens exact cache details from a request row", async () => {
    load.mockResolvedValue([hit]);
    renderWithProviders(<CacheAnalysisPage />);
    const table = await waitForRecords();
    fireEvent.click(within(table).getByRole("button", { name: "Details hit" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("1,000")).toBeInTheDocument();
    expect(within(dialog).getByText("800")).toBeInTheDocument();
    expect(within(dialog).getByText("200")).toBeInTheDocument();
    expect(within(dialog).getByText("40")).toBeInTheDocument();
  });

  it("hides key filters without key-read permission and inherits the report route guard", async () => {
    useAuthStore.setState({ permissions: ["dashboard:read:all"] });
    load.mockResolvedValue([hit]);
    renderWithProviders(<CacheAnalysisPage />);
    await waitForRecords();
    expect(screen.queryByLabelText("API Key")).not.toBeInTheDocument();
    expect(routePermission("/reports/cache")).toBe("dashboard:read");
  });

  it("changes the time range and does not show a partial successful report after a load failure", async () => {
    load
      .mockResolvedValueOnce([hit])
      .mockRejectedValueOnce(new Error("cache-incomplete"));
    renderWithProviders(<CacheAnalysisPage />);
    await waitForRecords();
    fireEvent.change(screen.getByLabelText("Time range"), {
      target: { value: "1h" },
    });
    await waitFor(() =>
      expect(load).toHaveBeenLastCalledWith({ timeframe: "1h" }),
    );
    expect(
      await screen.findByText(
        "Could not load complete cache data. Please refresh.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
