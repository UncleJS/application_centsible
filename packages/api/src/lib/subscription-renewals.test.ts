import { describe, expect, it } from "bun:test";
import { getSubscriptionRenewalsInMonth } from "./subscription-renewals";

describe("subscription renewal helper", () => {
  it("keeps end-of-month renewals in shorter months", () => {
    const renewals = getSubscriptionRenewalsInMonth(
      {
        nextRenewalDate: "2026-01-31",
        billingCycle: "monthly",
        autoRenew: true,
      },
      2026,
      2
    );

    expect(renewals).toEqual(["2026-02-28"]);
  });

  it("restores the preferred end-of-month day when available again", () => {
    const renewals = getSubscriptionRenewalsInMonth(
      {
        nextRenewalDate: "2026-01-31",
        billingCycle: "monthly",
        autoRenew: true,
      },
      2026,
      3
    );

    expect(renewals).toEqual(["2026-03-31"]);
  });

  it("uses leap day when available", () => {
    const renewals = getSubscriptionRenewalsInMonth(
      {
        nextRenewalDate: "2024-01-31",
        billingCycle: "monthly",
        autoRenew: true,
      },
      2024,
      2
    );

    expect(renewals).toEqual(["2024-02-29"]);
  });

  it("handles year rollover for end-of-month renewals", () => {
    const renewals = getSubscriptionRenewalsInMonth(
      {
        nextRenewalDate: "2025-12-31",
        billingCycle: "monthly",
        autoRenew: true,
      },
      2026,
      1
    );

    expect(renewals).toEqual(["2026-01-31"]);
  });

  it("returns no renewals when auto-renew is disabled", () => {
    const renewals = getSubscriptionRenewalsInMonth(
      {
        nextRenewalDate: "2026-01-31",
        billingCycle: "monthly",
        autoRenew: false,
      },
      2026,
      2
    );

    expect(renewals).toEqual([]);
  });
});
