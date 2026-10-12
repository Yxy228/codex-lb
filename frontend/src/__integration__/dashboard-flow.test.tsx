import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";

import App from "@/App";
import {
  createDashboardOverview,
  createConversationEntry,
  createConversationsResponse,
  createDefaultRequestLogs,
  createRequestLogEntry,
  createRequestLogFilterOptions,
  createRequestLogsResponse,
} from "@/test/mocks/factories";
import { queryClient } from "@/lib/query-client";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils";

if (!HTMLElement.prototype.scrollIntoView) {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: () => {},
  });
}

const REQUEST_LOG_OUTAGE_MESSAGE = "forced request-log outage";

afterEach(() => {
  queryClient.clear();
});

describe("request records and dashboard flow integration", () => {
  it("loads records, refetches overview on timeframe changes, and isolates request-log refetches", async () => {
    const user = userEvent.setup({ delay: null });
    const logs = createDefaultRequestLogs();

    let overviewCalls = 0;
    let requestLogCalls = 0;
    const overviewTimeframes: string[] = [];

    server.use(
      http.get("/api/dashboard/overview", ({ request }) => {
        overviewCalls += 1;
        const timeframe = (new URL(request.url).searchParams.get("timeframe") ?? "7d") as "1d" | "7d" | "30d";
        overviewTimeframes.push(timeframe);
        return HttpResponse.json(createDashboardOverview({
          timeframe:
            timeframe === "1d"
              ? { key: "1d", windowMinutes: 1440, bucketSeconds: 3600, bucketCount: 24 }
              : timeframe === "30d"
                ? { key: "30d", windowMinutes: 43200, bucketSeconds: 86400, bucketCount: 30 }
                : { key: "7d", windowMinutes: 10080, bucketSeconds: 21600, bucketCount: 28 },
        }));
      }),
      http.get("/api/request-logs", ({ request }) => {
        requestLogCalls += 1;
        const url = new URL(request.url);
        const limit = Number(url.searchParams.get("limit") ?? "25");
        const offset = Number(url.searchParams.get("offset") ?? "0");
        const page = logs.slice(offset, Math.min(logs.length, offset + limit));
        return HttpResponse.json(createRequestLogsResponse(page, 100, true));
      }),
      http.get("/api/request-logs/options", () =>
        HttpResponse.json(createRequestLogFilterOptions()),
      ),
    );

    window.history.pushState({}, "", "/reports/requests");
    renderWithProviders(<App />);

    expect(await screen.findByRole("heading", { name: "Request records" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Request Logs" })).toBeInTheDocument();

    await waitFor(() => {
      expect(overviewCalls).toBeGreaterThan(0);
      expect(requestLogCalls).toBeGreaterThan(0);
    });

    const overviewAfterLoad = overviewCalls;
    const logsAfterLoad = requestLogCalls;
    expect(overviewTimeframes.at(-1)).toBe("7d");

    act(() => {
      window.history.pushState({}, "", "/reports/requests?overviewTimeframe=30d");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => {
      expect(overviewCalls).toBeGreaterThan(overviewAfterLoad);
    });
    expect(requestLogCalls).toBe(logsAfterLoad);
    expect(overviewTimeframes.at(-1)).toBe("30d");

    const overviewAfterTimeframe = overviewCalls;

    await user.type(
      screen.getByPlaceholderText("Search request id, account, API key, model, error..."),
      "quota",
    );

    await waitFor(() => {
      expect(requestLogCalls).toBeGreaterThan(logsAfterLoad);
    });
    expect(overviewCalls).toBe(overviewAfterTimeframe);

    const logsAfterFilter = requestLogCalls;
    await user.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() => {
      expect(requestLogCalls).toBeGreaterThan(logsAfterFilter);
    });
    expect(overviewCalls).toBe(overviewAfterTimeframe);
  });

  it("keeps dashboard independent of a log outage and recovers logs on the records page", async () => {
    const user = userEvent.setup({ delay: null });
    let requestLogCalls = 0;
    let requestLogsAvailable = false;
    server.use(
      http.get("/api/request-logs", () => {
        requestLogCalls += 1;
        if (!requestLogsAvailable) {
          return HttpResponse.json(
            { error: { code: "forced_request_log_outage", message: REQUEST_LOG_OUTAGE_MESSAGE } },
            { status: 500 },
          );
        }
        return HttpResponse.json(createRequestLogsResponse([
          createRequestLogEntry({ requestId: "req_recovered", apiKeyName: "Recovered API Key" }),
        ], 1, false));
      }),
    );
    window.history.pushState({}, "", "/dashboard");
    renderWithProviders(<App />);
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "5-Hour Credits" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Request Logs" })).not.toBeInTheDocument();
    expect(requestLogCalls).toBe(0);

    act(() => {
      window.history.pushState({}, "", "/reports/requests");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    const heading = await screen.findByRole("heading", { name: "Request Logs" });
    const requestLogs = within(heading.closest("section")!);
    expect(await requestLogs.findByRole("alert")).toHaveTextContent(REQUEST_LOG_OUTAGE_MESSAGE);
    requestLogsAvailable = true;
    const retry = requestLogs.getByRole("button", { name: "Retry" });
    retry.focus();
    await user.keyboard("{Enter}");
    expect(await requestLogs.findByText("Recovered API Key")).toBeVisible();
    expect(requestLogs.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps retained request-log rows through failed refresh and Retry recovery", async () => {
    const user = userEvent.setup({ delay: null });
    let requestLogsAvailable = true;
    let recovered = false;
    let requestLogCalls = 0;
    const retainedLog = createRequestLogEntry({
      requestId: "req_retained_refresh",
      apiKeyName: "Retained API Key",
    });
    const recoveredLog = createRequestLogEntry({
      requestId: "req_recovered_refresh",
      apiKeyName: "Recovered API Key",
    });

    server.use(
      http.get("/api/request-logs", () => {
        requestLogCalls += 1;
        if (!requestLogsAvailable) {
          return HttpResponse.json(
            {
              error: {
                code: "forced_background_refresh_failure",
                message: REQUEST_LOG_OUTAGE_MESSAGE,
              },
            },
            { status: 503 },
          );
        }
        return HttpResponse.json(
          createRequestLogsResponse([recovered ? recoveredLog : retainedLog], 1, false),
        );
      }),
    );

    window.history.pushState({}, "", "/reports/requests");
    const { queryClient: testQueryClient } = renderWithProviders(<App />);

    expect(await screen.findByText("Retained API Key")).toBeInTheDocument();
    const section = screen.getByRole("heading", { name: "Request Logs" }).closest("section");
    expect(section).not.toBeNull();
    const requestLogs = within(section as HTMLElement);
    expect(requestLogs.getByRole("table")).toBeVisible();

    const callsBeforeRefresh = requestLogCalls;
    requestLogsAvailable = false;
    await act(async () => {
      await testQueryClient.invalidateQueries({
        queryKey: ["dashboard", "request-logs"],
      });
    });
    await waitFor(() => expect(requestLogCalls).toBeGreaterThan(callsBeforeRefresh));
    const alert = await requestLogs.findByRole("alert");

    expect(alert).toHaveTextContent(REQUEST_LOG_OUTAGE_MESSAGE);
    expect(requestLogs.getByRole("table")).toBeVisible();
    expect(requestLogs.getByText("Retained API Key")).toBeVisible();

    requestLogsAvailable = true;
    recovered = true;
    const retry = requestLogs.getByRole("button", { name: "Retry" });
    retry.focus();
    await user.keyboard("{Enter}");

    expect(await requestLogs.findByText("Recovered API Key")).toBeVisible();
    expect(requestLogs.queryByText("Retained API Key")).not.toBeInTheDocument();
    expect(requestLogs.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("switches to conversations without reinterpreting request-log URL state", async () => {
    const user = userEvent.setup({ delay: null });
    server.use(
      http.get("/api/conversations", () =>
        HttpResponse.json(
          createConversationsResponse([
            createConversationEntry({ conversationId: "opencode_conversation" }),
          ], 1, false),
        ),
      ),
    );
    window.history.pushState(
      {},
      "",
      "/reports/requests?search=requestlog&limit=10&offset=25&conversationSearch=opencode&conversationLimit=15&conversationOffset=7",
    );

    renderWithProviders(<App />);

    expect(await screen.findByRole("heading", { name: "Request Logs" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Request Logs" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Conversations" }));

    expect(await screen.findByText("opencode_conversation")).toBeInTheDocument();
    expect(window.location.search).toContain("view=conversations");
    expect(window.location.search).toContain("search=requestlog");
    expect(window.location.search).toContain("limit=10");
    expect(window.location.search).toContain("offset=25");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(window.location.search).toContain("conversationSearch=opencode");
    expect(window.location.search).toContain("conversationLimit=15");
    expect(window.location.search).toContain("conversationOffset=7");

    await user.click(screen.getByRole("button", { name: "Conversations" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Request Logs" }));

    await waitFor(() => expect(window.location.search).not.toContain("view=conversations"));
    expect(window.location.search).toContain("search=requestlog");
    expect(window.location.search).toContain("limit=10");
    expect(window.location.search).toContain("offset=25");
    expect(window.location.search).toContain("conversationSearch=opencode");
    expect(window.location.search).toContain("conversationLimit=15");
    expect(window.location.search).toContain("conversationOffset=7");
  });

  it("refetches the overview when the conversation timeframe changes", async () => {
    const user = userEvent.setup({ delay: null });

    let overviewCalls = 0;
    const overviewTimeframes: string[] = [];

    server.use(
      http.get("/api/dashboard/overview", ({ request }) => {
        overviewCalls += 1;
        const timeframe = (new URL(request.url).searchParams.get("timeframe") ?? "7d") as string;
        overviewTimeframes.push(timeframe);
        return HttpResponse.json(createDashboardOverview({
          timeframe:
            timeframe === "1d"
              ? { key: "1d", windowMinutes: 1440, bucketSeconds: 3600, bucketCount: 24 }
              : timeframe === "30d"
                ? { key: "30d", windowMinutes: 43200, bucketSeconds: 86400, bucketCount: 30 }
                : { key: "7d", windowMinutes: 10080, bucketSeconds: 21600, bucketCount: 28 },
        }));
      }),
      http.get("/api/conversations", () =>
        HttpResponse.json(createConversationsResponse([
          createConversationEntry({ conversationId: "opencode_conversation" }),
        ], 1, false)),
      ),
    );

    window.history.pushState({}, "", "/reports/requests?view=conversations&overviewTimeframe=1d");
    renderWithProviders(<App />);

    expect(await screen.findByRole("heading", { name: "Request records" })).toBeInTheDocument();
    await waitFor(() => expect(overviewCalls).toBeGreaterThan(0));
    expect(overviewTimeframes.at(-1)).toBe("7d");

    const overviewAfterLoad = overviewCalls;

    // Change the date range from the conversations-mode selector (top right).
    const timeframeSelect = screen.getByRole("combobox", { name: "Conversation timeframe" });
    await user.click(timeframeSelect);
    await user.click(await screen.findByRole("option", { name: "30d" }));

    // The supporting overview query follows the active conversation timeframe.
    await waitFor(() => {
      expect(overviewCalls).toBeGreaterThan(overviewAfterLoad);
    });
    expect(overviewTimeframes.at(-1)).toBe("30d");
    expect(window.location.search).toContain("conversationTimeframe=30d");
    expect(window.location.search).toContain("overviewTimeframe=1d");
    expect(window.location.search).not.toContain("overviewTimeframe=30d");

    await user.click(screen.getByRole("button", { name: "Conversations" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Request Logs" }));

    await waitFor(() => {
      expect(overviewTimeframes.at(-1)).toBe("1d");
    });
  });
});
