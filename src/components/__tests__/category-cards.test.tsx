import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CategoryCards } from "@/components/category-cards";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("CategoryCards", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("fetches unread counts and shows a badge when count > 0", async () => {
    localStorage.setItem("jump:lastSeenCategory:c1", "2026-01-01T00:00:00.000Z");
    localStorage.setItem("jump:lastSeenCategory:c2", "2026-01-01T00:00:00.000Z");

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      expect(body.categoryIds).toEqual(["c1", "c2"]);
      expect(body.lastSeenByCategoryId).toEqual({
        c1: "2026-01-01T00:00:00.000Z",
        c2: "2026-01-01T00:00:00.000Z",
      });

      return new Response(
        JSON.stringify({ ok: true, counts: { c1: 3, c2: 0 } }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    vi.stubGlobal("fetch", fetchMock as any);

    render(
      <CategoryCards
        categories={[
          { id: "c1", name: "Bills", description: "Bills + invoices" },
          { id: "c2", name: "Work", description: "Work mail" },
        ]}
      />
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Badge shows only for c1
    expect(await screen.findByText("3 new")).toBeInTheDocument();
    expect(screen.queryByText("0 new")).toBeNull();
  });

  it("formats large counts as 99+", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({ ok: true, counts: { c1: 120 } }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock as any);

    render(
      <CategoryCards
        categories={[{ id: "c1", name: "Promotions", description: "Deals" }]}
      />
    );

    expect(await screen.findByText("99+ new")).toBeInTheDocument();
  });
});


