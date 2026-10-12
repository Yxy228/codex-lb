import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/test/utils";
import {
  ADMIN_PERMISSIONS,
  createDashboardOverview,
  createDashboardProjections,
} from "@/test/mocks/factories";
import { useAccountMutations } from "@/features/accounts/hooks/use-accounts";
import { useAuthStore } from "@/features/auth/hooks/use-auth";
import { useDashboard, useDashboardProjections } from "@/features/dashboard/hooks/use-dashboard";
import { useRequestLogs } from "@/features/dashboard/hooks/use-request-logs";
import { useConversations } from "@/features/dashboard/hooks/use-conversations";
import { REQUEST_LOG_TABLE_PREFERENCES_STORAGE_KEY } from "@/features/dashboard/hooks/use-request-log-table-preferences";
import { buildDashboardView } from "@/features/dashboard/utils";
import type { AccountListSort } from "@/features/dashboard/components/account-list";
import type { RecentRequestsTableProps } from "@/features/dashboard/components/recent-requests-table";
import { useDashboardPreferencesStore } from "@/hooks/use-dashboard-preferences";

import { DashboardPage } from "./dashboard-page";

const {
  accountCardsSpy,
  accountListSpy,
  accountSummaryLineSpy,
  conversationsViewSpy,
  recentRequestsTableSpy,
} = vi.hoisted(() => ({
  accountCardsSpy: vi.fn(),
  accountListSpy: vi.fn(),
  accountSummaryLineSpy: vi.fn(),
  conversationsViewSpy: vi.fn(),
  recentRequestsTableSpy: vi.fn(),
}));

vi.mock("@/features/accounts/hooks/use-accounts", () => ({
  useAccountMutations: vi.fn(),
}));

vi.mock("@/features/dashboard/hooks/use-dashboard", () => ({
  useDashboard: vi.fn(),
  useDashboardProjections: vi.fn(),
}));

vi.mock("@/features/dashboard/hooks/use-request-logs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/dashboard/hooks/use-request-logs")>();
  return {
    ...actual,
    useRequestLogs: vi.fn(),
  };
});

vi.mock("@/features/dashboard/hooks/use-conversations", () => ({
  useConversations: vi.fn(),
}));

vi.mock("@/features/dashboard/utils", () => ({
  buildDashboardView: vi.fn(),
}));

vi.mock("@/features/dashboard/components/account-cards", () => ({
  AccountCards: ({ accounts }: { accounts: Array<{ accountId: string }> }) => {
    accountCardsSpy(accounts);
    return <div data-testid="account-cards">Cards for {accounts.length} accounts</div>;
  },
}));

vi.mock("@/features/dashboard/components/account-list", () => ({
  AccountList: ({
    accounts,
    sort,
    onSortChange,
  }: {
    accounts: Array<{ accountId: string }>;
    sort: AccountListSort;
    onSortChange: (sort: AccountListSort) => void;
  }) => {
    accountListSpy({ accounts, sort });
    return (
      <button
        type="button"
        data-testid="account-list"
        onClick={() => onSortChange({ key: "purchasedCredits", direction: "desc" })}
      >
        List for {accounts.length} accounts
      </button>
    );
  },
}));

vi.mock("@/features/dashboard/components/account-summary-line", () => ({
  AccountSummaryLine: ({ accounts }: { accounts: Array<{ accountId: string }> }) => {
    accountSummaryLineSpy(accounts);
    return <div data-testid="account-summary-line">Summary for {accounts.length} accounts</div>;
  },
}));

vi.mock("@/features/dashboard/components/dashboard-skeleton", () => ({
  DashboardSkeleton: () => <div data-testid="dashboard-skeleton" />,
}));

vi.mock("@/features/dashboard/components/conversations-view", () => ({
  ConversationsView: (props: { state?: ReturnType<typeof useConversations>; accounts?: unknown[] }) => {
    conversationsViewSpy(props);
    return <div data-testid="conversations-view" />;
  },
}));

vi.mock("@/features/dashboard/components/filters/overview-timeframe-select", () => ({
  OverviewTimeframeSelect: () => <div data-testid="overview-timeframe-select" />,
}));

vi.mock("@/features/dashboard/components/filters/conversation-timeframe-select", () => ({
  ConversationTimeframeSelect: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: "30d") => void;
  }) => (
    <button type="button" data-testid="conversation-timeframe-select" onClick={() => onChange("30d")}>
      {value}
    </button>
  ),
}));

vi.mock("@/features/dashboard/components/filters/request-filters", async () => {
  const actual = await vi.importActual<typeof import("@/features/dashboard/components/filters/request-filters")>("@/features/dashboard/components/filters/request-filters");
  return actual;
});

vi.mock("@/features/dashboard/components/recent-requests-table", () => ({
  RecentRequestsTable: (props: RecentRequestsTableProps) => {
    recentRequestsTableSpy(props);
    return <div data-testid="recent-requests-table" />;
  },
}));

vi.mock("@/features/dashboard/components/stats-grid", () => ({
  StatsGrid: () => <div data-testid="stats-grid" />,
}));

vi.mock("@/features/dashboard/components/usage-donuts", () => ({
  UsageDonuts: () => <div data-testid="usage-donuts" />,
}));

vi.mock("@/features/dashboard/components/weekly-credits-pace-card", () => ({
  WeeklyCreditsPaceCard: () => <div data-testid="weekly-credits-pace-card" />,
}));

const useAccountMutationsMock = vi.mocked(useAccountMutations);
const useDashboardMock = vi.mocked(useDashboard);
const useDashboardProjectionsMock = vi.mocked(useDashboardProjections);
const useRequestLogsMock = vi.mocked(useRequestLogs);
const useConversationsMock = vi.mocked(useConversations);
const buildDashboardViewMock = vi.mocked(buildDashboardView);

type RequestLogsQueryOverrides = {
  data?: undefined;
  error?: Error | null;
  isFetching?: boolean;
  isLoading?: boolean;
  isPending?: boolean;
  isSuccess?: boolean;
};

type ConversationsQueryOverrides = {
  isFetching?: boolean;
};

describe("DashboardPage", () => {
  beforeEach(() => {
    useAuthStore.setState({
      role: "admin",
      permissions: ADMIN_PERMISSIONS,
      canWrite: true,
      initialized: true,
    });
    accountCardsSpy.mockReset();
    accountListSpy.mockReset();
    accountSummaryLineSpy.mockReset();
    conversationsViewSpy.mockReset();
    recentRequestsTableSpy.mockReset();
    useAccountMutationsMock.mockReset();
    useDashboardMock.mockReset();
    useDashboardProjectionsMock.mockReset();
    useRequestLogsMock.mockReset();
    useConversationsMock.mockReset();
    buildDashboardViewMock.mockReset();
    window.localStorage.removeItem(REQUEST_LOG_TABLE_PREFERENCES_STORAGE_KEY);
    useDashboardPreferencesStore.setState({
      accountBurnrateEnabled: true,
      accountViewMode: "cards",
      accountListSort: null,
      initialized: true,
    });
  });

  function mockReadyDashboard(
    logsQueryOverrides: RequestLogsQueryOverrides = {},
    optionsError: Error | null = null,
    conversationsQueryOverrides: ConversationsQueryOverrides = {},
  ) {
    const overview = createDashboardOverview();

    useAccountMutationsMock.mockReturnValue({
      resumeMutation: { mutateAsync: vi.fn() },
      limitWarmupMutation: { mutateAsync: vi.fn() },
    } as unknown as ReturnType<typeof useAccountMutations>);
    useDashboardMock.mockReturnValue({
      data: overview,
      isFetching: false,
      error: null,
    } as ReturnType<typeof useDashboard>);
    useDashboardProjectionsMock.mockReturnValue({
      data: createDashboardProjections(),
      isFetching: false,
      error: null,
    } as ReturnType<typeof useDashboardProjections>);
    useRequestLogsMock.mockReturnValue({
      filters: {
        search: "",
        timeframe: "all",
        accountIds: [],
        apiKeyIds: [],
        modelOptions: [],
        statuses: [],
        limit: 25,
        offset: 0,
      },
      listFilters: {
        search: undefined,
        limit: 25,
        offset: 0,
        accountIds: [],
        apiKeyIds: [],
        statuses: [],
        modelOptions: [],
        since: undefined,
      },
      facetFilters: {
        since: undefined,
        accountIds: [],
        apiKeyIds: [],
        modelOptions: [],
      },
      logsQuery: {
        data: { requests: [], total: 0, hasMore: false },
        isFetching: false,
        error: null,
        isLoading: false,
        isPending: false,
        isSuccess: true,
        refetch: vi.fn(),
        ...logsQueryOverrides,
      },
      optionsQuery: {
        data: { accountIds: [], apiKeys: [], modelOptions: [], statuses: [] },
        error: optionsError,
      },
      updateFilters: vi.fn(),
    } as unknown as ReturnType<typeof useRequestLogs>);
    useConversationsMock.mockReturnValue({
      filters: { search: "", limit: 25, offset: 0 },
      listFilters: { limit: 25, offset: 0 },
      conversationsQuery: {
        data: { conversations: [], total: 0, hasMore: false },
        error: null,
        isFetching: conversationsQueryOverrides.isFetching ?? false,
        isLoading: false,
        isPending: false,
        isSuccess: true,
        refetch: vi.fn(),
      },
      updateFilters: vi.fn(),
    } as unknown as ReturnType<typeof useConversations>);
    buildDashboardViewMock.mockReturnValue({
      stats: [],
      weeklyCreditPace: null,
      primaryUsageItems: [],
      secondaryUsageItems: [],
      primaryTotal: 0,
      secondaryTotal: 0,
      safeLinePrimary: null,
      safeLineSecondary: null,
      requestLogs: [],
    } as ReturnType<typeof buildDashboardView>);

    return overview;
  }

  it("renders only overview and account status without querying request or conversation data", () => {
    mockReadyDashboard();
    renderWithProviders(<DashboardPage />);
    expect(screen.getByTestId("stats-grid")).toBeInTheDocument();
    expect(screen.getByTestId("usage-donuts")).toBeInTheDocument();
    expect(screen.queryByTestId("recent-requests-table")).not.toBeInTheDocument();
    expect(screen.queryByTestId("conversations-view")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Columns/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View reports" })).toHaveAttribute("href", "/reports");
    expect(useRequestLogsMock).not.toHaveBeenCalled();
    expect(useConversationsMock).not.toHaveBeenCalled();
  });

  it("keeps the page-wide skeleton while overview data is unavailable", () => {
    mockReadyDashboard();
    useDashboardMock.mockReturnValue({
      data: undefined,
      isFetching: true,
      error: null,
    } as ReturnType<typeof useDashboard>);

    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId("dashboard-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("stats-grid")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Accounts" })).not.toBeInTheDocument();
  });































  it("renders the account summary line in the Accounts header using overview accounts", () => {
    const overview = mockReadyDashboard();

    renderWithProviders(<DashboardPage />);

    const accountsHeader = screen.getByRole("heading", { name: "Accounts" }).parentElement;

    expect(accountsHeader).not.toBeNull();
    expect(within(accountsHeader as HTMLElement).getByTestId("account-summary-line")).toHaveTextContent(
      "Summary for 2 accounts",
    );
    expect(accountSummaryLineSpy).toHaveBeenCalledWith(overview.accounts);
  });

  it("defaults the Accounts section to card view", () => {
    const overview = mockReadyDashboard();

    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId("account-cards")).toHaveTextContent("Cards for 2 accounts");
    expect(screen.queryByTestId("account-list")).not.toBeInTheDocument();
    expect(accountCardsSpy).toHaveBeenCalledWith(overview.accounts);
    expect(screen.getByRole("radio", { name: "View accounts as cards" })).toHaveAttribute("aria-checked", "true");
  });

  it("switches the Accounts section to list view", async () => {
    const user = userEvent.setup();
    const overview = mockReadyDashboard();

    renderWithProviders(<DashboardPage />);

    await user.click(screen.getByRole("radio", { name: "View accounts as list" }));

    expect(screen.getByTestId("account-list")).toHaveTextContent("List for 2 accounts");
    expect(screen.queryByTestId("account-cards")).not.toBeInTheDocument();
    expect(accountListSpy).toHaveBeenCalledWith({ accounts: overview.accounts, sort: null });
    expect(useDashboardPreferencesStore.getState().accountViewMode).toBe("list");
  });

  it("passes persisted account list sort through and updates it from the list", async () => {
    const user = userEvent.setup();
    const overview = mockReadyDashboard();
    useDashboardPreferencesStore.setState({
      accountBurnrateEnabled: true,
      accountViewMode: "list",
      accountListSort: { key: "quota", direction: "asc" },
      initialized: true,
    });

    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId("account-list")).toHaveTextContent("List for 2 accounts");
    expect(accountListSpy).toHaveBeenCalledWith({
      accounts: overview.accounts,
      sort: { key: "quota", direction: "asc" },
    });

    await user.click(screen.getByTestId("account-list"));

    expect(useDashboardPreferencesStore.getState().accountListSort).toEqual({ key: "purchasedCredits", direction: "desc" });
  });












});
