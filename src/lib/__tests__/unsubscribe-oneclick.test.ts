import { describe, expect, it } from "vitest";
import { isListUnsubscribeOneClick } from "@/lib/unsubscribe-oneclick";

describe("isListUnsubscribeOneClick", () => {
  it("detects one-click header", () => {
    expect(isListUnsubscribeOneClick("List-Unsubscribe=One-Click")).toBe(true);
  });

  it("is case/whitespace tolerant", () => {
    expect(isListUnsubscribeOneClick(" list-unsubscribe = one-click ")).toBe(true);
  });

  it("returns false for empty/other values", () => {
    expect(isListUnsubscribeOneClick(null)).toBe(false);
    expect(isListUnsubscribeOneClick("")).toBe(false);
    expect(isListUnsubscribeOneClick("nope")).toBe(false);
  });
});


