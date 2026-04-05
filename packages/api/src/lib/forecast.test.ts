import { describe, expect, it } from "bun:test";
import { getRecurringIncomeOccurrencesInMonth } from "./forecast";

describe("forecast recurring income occurrences", () => {
  it("counts actual weekly occurrences in a 5-week month", () => {
    const occurrences = getRecurringIncomeOccurrencesInMonth(
      {
        billingCycle: "weekly",
        autoRenew: true,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      2026,
      1
    );

    expect(occurrences).toBe(5);
  });

  it("counts actual fortnightly occurrences in a long month", () => {
    const occurrences = getRecurringIncomeOccurrencesInMonth(
      {
        billingCycle: "fortnightly",
        autoRenew: true,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      2026,
      1
    );

    expect(occurrences).toBe(3);
  });

  it("returns zero before a weekly income starts", () => {
    const occurrences = getRecurringIncomeOccurrencesInMonth(
      {
        billingCycle: "weekly",
        autoRenew: true,
        createdAt: new Date("2026-02-10T00:00:00Z"),
      },
      2026,
      1
    );

    expect(occurrences).toBe(0);
  });

  it("counts only in-month occurrences after a mid-month start", () => {
    const occurrences = getRecurringIncomeOccurrencesInMonth(
      {
        billingCycle: "weekly",
        autoRenew: true,
        createdAt: new Date("2026-02-10T00:00:00Z"),
      },
      2026,
      2
    );

    expect(occurrences).toBe(3);
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

  it("anchors yearly cycles to the creation month", () => {
    const inc = {
      billingCycle: "yearly",
      autoRenew: true,
      createdAt: new Date("2026-02-10T00:00:00Z"),
    };

    expect(getRecurringIncomeOccurrencesInMonth(inc, 2027, 1)).toBe(0);
    expect(getRecurringIncomeOccurrencesInMonth(inc, 2027, 2)).toBe(1);
  });

  it("returns zero when auto-renew is disabled", () => {
    const occurrences = getRecurringIncomeOccurrencesInMonth(
      {
        billingCycle: "monthly",
        autoRenew: false,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      2026,
      1
    );

    expect(occurrences).toBe(0);
  });
});
