import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock OpenAI client so no network calls happen.
const createMock = vi.fn();

vi.mock("openai", () => {
  class OpenAI {
    chat = {
      completions: {
        create: createMock,
      },
    };
    constructor(_opts: any) {}
  }
  return { default: OpenAI };
});

describe("classifyAndSummarizeEmail", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...OLD_ENV };
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "test-model";
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("falls back when model response is not valid JSON", async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: "not json" } }],
    });

    const { classifyAndSummarizeEmail } = await import("@/lib/ai");

    const out = await classifyAndSummarizeEmail({
      categories: [{ id: "c1", name: "Bills", description: "Bills" }],
      email: { snippet: "Pay invoice" },
    });

    expect(out.categoryId).toBe("c1");
    expect(out.summary).toBe("Pay invoice");
    expect(out.unsubscribeUrls).toEqual([]);
    expect(out.raw).toBe("not json");
  });

  it("parses fenced JSON, matches categoryName to id, trims summary, and filters unsubscribeUrls", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: [
              "```json",
              JSON.stringify({
                categoryName: "Work",
                summary: "  Please review the doc.  ",
                unsubscribeUrls: [
                  "https://example.com/unsub",
                  "ftp://bad.example.com/x",
                  "not-a-url",
                ],
              }),
              "```",
            ].join("\n"),
          },
        },
      ],
    });

    const { classifyAndSummarizeEmail } = await import("@/lib/ai");

    const out = await classifyAndSummarizeEmail({
      categories: [
        { id: "c1", name: "Bills", description: "Bills" },
        { id: "c2", name: "Work", description: "Work" },
      ],
      email: {
        subject: "Quarterly report",
        fromEmail: "boss@company.com",
        snippet: "Please review",
      },
    });

    expect(out.categoryId).toBe("c2");
    expect(out.summary).toBe("Please review the doc.");
    expect(out.unsubscribeUrls).toEqual(["https://example.com/unsub"]);
  });
});


