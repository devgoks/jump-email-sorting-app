import { describe, expect, it } from "vitest";
import { parseFromHeader } from "@/lib/gmail";

describe("parseFromHeader", () => {
  it("parses Name <email>", () => {
    expect(parseFromHeader("Alice Example <alice@example.com>")).toEqual({
      fromName: "Alice Example",
      fromEmail: "alice@example.com",
    });
  });

  it("parses quoted name", () => {
    expect(parseFromHeader("\"Alice, Inc.\" <billing@alice.com>")).toEqual({
      fromName: "Alice, Inc.",
      fromEmail: "billing@alice.com",
    });
  });

  it("parses bare email", () => {
    expect(parseFromHeader("noreply@service.com")).toEqual({
      fromName: undefined,
      fromEmail: "noreply@service.com",
    });
  });
});




