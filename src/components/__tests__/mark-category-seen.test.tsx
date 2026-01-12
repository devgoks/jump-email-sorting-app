import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MarkCategorySeen } from "@/components/mark-category-seen";

describe("MarkCategorySeen", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("writes a last-seen timestamp to localStorage for the category", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");

    render(<MarkCategorySeen categoryId="cat_123" />);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toBe("jump:lastSeenCategory:cat_123");
    expect(typeof spy.mock.calls[0]?.[1]).toBe("string");
  });
});


