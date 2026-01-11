import { describe, expect, it, vi } from "vitest";
import { signConnectGmailState, verifyConnectGmailState } from "@/lib/oauth-state";

describe("connect gmail oauth state", () => {
  it("signs and verifies", () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    const state = signConnectGmailState("user_123");
    const payload = verifyConnectGmailState(state);
    expect(payload?.userId).toBe("user_123");
    expect(payload?.purpose).toBe("connect-gmail");
  });

  it("rejects expired state", () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000); // fixed
    const state = signConnectGmailState("user_123");

    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000 + 11 * 60 * 1000);
    const payload = verifyConnectGmailState(state);
    expect(payload).toBeNull();
  });
});



