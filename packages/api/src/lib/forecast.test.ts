import { describe, expect, it } from "bun:test";
import { getRecurringIncomeOccurrencesInMonth } from "./forecast";

describe("forecast recurring income occurrences", () => {
  it("estimates weekly occurrences per month", () => {
    const occurrences = getRecurringIncomeOccurrencesInMonth(
      {
        billingCycle: "weekly",
        autoRenew: true,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      2026,
      1
    );

    expect(occurrences).toBe(4);
  });

  it("estimates fortnightly occurrences per month", () => {
    const occurrences = getRecurringIncomeOccurrencesInMonth(
      {
        billingCycle: "fortnightly",
        autoRenew: true,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      2026,
      1
    );

    expect(occurrences).toBe(2);
  });

  it("anchors quarterly cycles to creation month", () => {
    const inc = {
      billingCycle: "quarterly",
      autoRenew: true,
      createdAt: new Date("2026-02-10T00:00:00Z"),
    };

    expect(getRecurringIncomeOccurrencesInMonth(inc, 2026, 2)).toBe(1);
    expect(getRecurringIncomeOccurrencesInMonth(inc, 2026, 3)).toBe(0);
    expect(getRecurringIncomeOccurrencesInMonth(inc, 2026, 5)).toBe(1);
  });
});
