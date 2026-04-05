import { BILLING_CYCLE_MONTHS } from "@centsible/shared";

export function getRecurringIncomeOccurrencesInMonth(
  inc: {
    billingCycle: string;
    autoRenew: boolean;
    createdAt: Date;
  },
  year: number,
  month: number
): number {
  if (!inc.autoRenew) return 0;

  const cycleMonths = BILLING_CYCLE_MONTHS[inc.billingCycle] || 1;
  if (cycleMonths <= 0) return 0;

  // Weekly/fortnightly: approximate number of occurrences within the month.
  if (cycleMonths < 1) {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const cycleDays = Math.max(1, Math.round(cycleMonths * 30.44));
    return Math.max(1, Math.floor(daysInMonth / cycleDays));
  }

  if (cycleMonths === 1) return 1;

  // Supra-monthly cycles: anchor to creation month to avoid epoch drift.
  const anchor = new Date(inc.createdAt);
  const anchorIndex = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth();
  const targetIndex = year * 12 + (month - 1);
  if (targetIndex < anchorIndex) return 0;

  return (targetIndex - anchorIndex) % Math.round(cycleMonths) === 0 ? 1 : 0;
}
