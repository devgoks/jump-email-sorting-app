import { describe, expect, it } from "vitest";
import { extractUnsubscribeLinks } from "@/lib/unsubscribe";

describe("extractUnsubscribeLinks", () => {
  it("extracts List-Unsubscribe links", () => {
    const links = extractUnsubscribeLinks({
      listUnsubscribe:
        "<mailto:unsubscribe@example.com?subject=unsubscribe>, <https://example.com/unsub?id=123>",
    });
    expect(links.mailtoLinks[0]).toContain("mailto:unsubscribe@example.com");
    expect(links.httpLinks[0]).toBe("https://example.com/unsub?id=123");
  });

  it("guesses links from body", () => {
    const links = extractUnsubscribeLinks({
      bodyText:
        "If you no longer want these, unsubscribe here: https://x.com/unsubscribe?u=1",
    });
    expect(links.guessedLinks).toEqual(["https://x.com/unsubscribe?u=1"]);
  });
});





