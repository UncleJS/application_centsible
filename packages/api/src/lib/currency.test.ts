import { describe, expect, it } from "bun:test";
import { convertToBaseCurrency, toFixed2 } from "./currency";

describe("currency helpers", () => {
  it("keeps value unchanged for same currency", () => {
    const rates = new Map<string, number>();
    const result = convertToBaseCurrency("123.45", "GBP", "GBP", rates);
    expect(result.value).toBe(123.45);
    expect(result.warning).toBeUndefined();
  });

  it("converts foreign amount to base by dividing rate", () => {
    const rates = new Map<string, number>([["USD", 1.25]]);
    const result = convertToBaseCurrency("125.00", "USD", "GBP", rates);
    expect(toFixed2(result.value)).toBe("100.00");
    expect(result.warning).toBeUndefined();
  });

  it("returns warning when rate is missing", () => {
    const rates = new Map<string, number>();
    const result = convertToBaseCurrency("10.00", "EUR", "GBP", rates);
    expect(result.warning).toEqual({
      from: "EUR",
      to: "GBP",
      reason: "missing-rate",
    });
  });
});
