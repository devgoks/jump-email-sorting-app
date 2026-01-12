import { describe, expect, it, vi, beforeEach } from "vitest";

const syncAllUsersInboxesMock = vi.fn();

vi.mock("@/lib/sync-all-users", () => ({
  syncAllUsersInboxes: syncAllUsersInboxesMock,
}));

const { POST } = await import("./route");

describe("POST /api/cron/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await POST(
      new Request("http://localhost/api/cron/sync", { method: "POST" })
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "unauthorized" });
    expect(syncAllUsersInboxesMock).not.toHaveBeenCalled();
  });

  it("returns 401 when token does not match CRON_SECRET", async () => {
    const res = await POST(
      new Request("http://localhost/api/cron/sync", {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
      })
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "unauthorized" });
    expect(syncAllUsersInboxesMock).not.toHaveBeenCalled();
  });

  it("calls syncAllUsersInboxes when authorized and returns results", async () => {
    syncAllUsersInboxesMock.mockResolvedValueOnce([{ ok: true }]);

    const res = await POST(
      new Request("http://localhost/api/cron/sync", {
        method: "POST",
        headers: { authorization: "Bearer test-secret" },
      })
    );

    expect(syncAllUsersInboxesMock).toHaveBeenCalledWith({ maxPerInbox: 10 });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, results: [{ ok: true }] });
  });
});


