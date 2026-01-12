import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

const prismaMock = {
  category: {
    findMany: vi.fn(),
  },
  emailMessage: {
    count: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

const { getServerSession } = await import("next-auth");
const { POST } = await import("./route");

describe("POST /api/categories/unread-counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null as any);

    const res = await POST(
      new Request("http://localhost/api/categories/unread-counts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categoryIds: ["c1"] }),
      })
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("returns empty counts when no categoryIds provided", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "u1" } } as any);

    const res = await POST(
      new Request("http://localhost/api/categories/unread-counts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, counts: {} });
  });

  it("counts only owned categories and applies lastSeen createdAt filter when valid", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "u1" } } as any);

    prismaMock.category.findMany.mockResolvedValueOnce([{ id: "c1" }]); // only c1 is owned
    prismaMock.emailMessage.count
      .mockResolvedValueOnce(3); // c1

    const res = await POST(
      new Request("http://localhost/api/categories/unread-counts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          categoryIds: ["c1", "c2"],
          lastSeenByCategoryId: {
            c1: "2026-01-01T00:00:00.000Z",
            c2: "2026-01-01T00:00:00.000Z",
          },
        }),
      })
    );

    expect(prismaMock.category.findMany).toHaveBeenCalledWith({
      where: { userId: "u1", id: { in: ["c1", "c2"] } },
      select: { id: true },
    });

    expect(prismaMock.emailMessage.count).toHaveBeenCalledTimes(1);
    expect(prismaMock.emailMessage.count).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        categoryId: "c1",
        createdAt: { gt: new Date("2026-01-01T00:00:00.000Z") },
      },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      counts: { c1: 3 },
    });
  });

  it("treats invalid lastSeen values as null (no createdAt filter)", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "u1" } } as any);

    prismaMock.category.findMany.mockResolvedValueOnce([{ id: "c1" }]);
    prismaMock.emailMessage.count.mockResolvedValueOnce(10);

    const res = await POST(
      new Request("http://localhost/api/categories/unread-counts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          categoryIds: ["c1"],
          lastSeenByCategoryId: { c1: "not-a-date" },
        }),
      })
    );

    expect(prismaMock.emailMessage.count).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        categoryId: "c1",
      },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      counts: { c1: 10 },
    });
  });
});


