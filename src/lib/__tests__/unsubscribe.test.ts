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

  it("handles unbracketed List-Unsubscribe header values (comma-separated)", () => {
    const links = extractUnsubscribeLinks({
      listUnsubscribe:
        "mailto:unsubscribe@example.com?subject=unsubscribe, https://example.com/unsub?id=123",
    });
    expect(links.mailtoLinks).toEqual([
      "mailto:unsubscribe@example.com?subject=unsubscribe",
    ]);
    expect(links.httpLinks).toEqual(["https://example.com/unsub?id=123"]);
  });

  it("dedupes repeated links in List-Unsubscribe", () => {
    const links = extractUnsubscribeLinks({
      listUnsubscribe:
        "<https://example.com/unsub>, <https://example.com/unsub>, <mailto:unsubscribe@example.com>",
    });
    expect(links.httpLinks).toEqual(["https://example.com/unsub"]);
    expect(links.mailtoLinks).toEqual(["mailto:unsubscribe@example.com"]);
  });

  it("extracts guessed unsubscribe links from HTML body while ignoring scripts/styles", () => {
    const links = extractUnsubscribeLinks({
      bodyHtml: [
        "<html><body>",
        "<a href='https://example.com/preferences'>preferences</a>",
        "<a href='https://example.com/unsubscribe?x=1'>unsubscribe</a>",
        "<script>var x = 'https://evil.com/unsubscribe';</script>",
        "<style>.x{background:url(https://evil.com/unsubscribe)}</style>",
        "</body></html>",
      ].join(""),
    });
    expect(links.guessedLinks).toEqual(["https://example.com/unsubscribe?x=1"]);
  });

  it("guesses links from body", () => {
    const links = extractUnsubscribeLinks({
      bodyText:
        "If you no longer want these, unsubscribe here: https://x.com/unsubscribe?u=1",
    });
    expect(links.guessedLinks).toEqual(["https://x.com/unsubscribe?u=1"]);
  });

  it("only guesses URLs containing 'unsub' (heuristic)", () => {
    const links = extractUnsubscribeLinks({
      bodyText:
        "Links: https://example.com/account and https://example.com/unsub-me and https://example.com/help",
    });
    expect(links.guessedLinks).toEqual(["https://example.com/unsub-me"]);
  });
});





