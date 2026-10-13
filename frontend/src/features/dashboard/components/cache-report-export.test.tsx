import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCacheRecords } from "@/features/cache-analysis/api";
import { CacheReportExport } from "@/features/dashboard/components/cache-report-export";
import { createRequestLogEntry } from "@/test/mocks/factories";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("@/features/cache-analysis/api", () => ({ getCacheRecords: vi.fn() }));
const api = vi.mocked(getCacheRecords);
const request = createRequestLogEntry({
  requestId: "first",
  inputTokens: 100,
  cachedInputTokens: 80,
});
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
  it("exports successive bounded cursor pages of the same filtered snapshot without loading other report ranges", async () => {
    api.mockResolvedValueOnce({
      requests: [request],
      total: 2,
      nextCursor: "next",
    });
    api.mockResolvedValueOnce({
      requests: [{ ...request, requestId: "second" }],
      total: 2,
      nextCursor: null,
    });
    render(<CacheReportExport snapshot="fixed-snapshot" state="hit" compact />);
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(api).toHaveBeenNthCalledWith(1, "fixed-snapshot", "hit", null, 1000);
    expect(api).toHaveBeenNthCalledWith(
      2,
      "fixed-snapshot",
      "hit",
      "next",
      1000,
    );
    expect(toastError).not.toHaveBeenCalled();
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/csv;charset=utf-8");
  });

  it("does not download partial CSV when an intermediate request fails", async () => {
    api
      .mockResolvedValueOnce({
        requests: [request],
        total: 2,
        nextCursor: "next",
      })
      .mockRejectedValueOnce(new Error("Offline"));
    render(<CacheReportExport snapshot="snapshot" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(click).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("rejects empty or repeated cursor pages without downloading", async () => {
    api.mockResolvedValueOnce({
      requests: [request],
      total: 2,
      nextCursor: "next",
    });
    api.mockResolvedValueOnce({ requests: [], total: 2, nextCursor: "next" });
    render(<CacheReportExport snapshot="snapshot" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(click).not.toHaveBeenCalled();
  });
  it("rejects a shortened export if retained records change during pagination", async () => {
    api.mockResolvedValue({ requests: [request], total: 2, nextCursor: null });
    render(<CacheReportExport snapshot="snapshot" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(click).not.toHaveBeenCalled();
  });
});
