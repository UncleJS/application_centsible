import { BILLING_CYCLE_MONTHS } from "@centsible/shared";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

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

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));

  // Weekly/fortnightly: count actual date-based occurrences.
  if (cycleMonths < 1) {
    const cycleDays = Math.max(1, Math.round(cycleMonths * 30.44));
    const anchor = startOfUtcDay(new Date(inc.createdAt));

    if (anchor > monthEnd) return 0;

    let current = anchor;
    if (current < monthStart) {
      const daysUntilMonthStart = Math.floor(
        (monthStart.getTime() - current.getTime()) / DAY_MS
      );
      const skippedIntervals = Math.floor(daysUntilMonthStart / cycleDays);
      current = new Date(current.getTime() + skippedIntervals * cycleDays * DAY_MS);

      while (current < monthStart) {
        current = new Date(current.getTime() + cycleDays * DAY_MS);
      }
    }

    let count = 0;
    while (current <= monthEnd) {
      count++;
      current = new Date(current.getTime() + cycleDays * DAY_MS);
    }

    return count;
  }

  // Supra-monthly cycles: anchor to creation month to avoid epoch drift.
  const anchor = new Date(inc.createdAt);
  const anchorIndex = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth();
  const targetIndex = year * 12 + (month - 1);
  if (targetIndex < anchorIndex) return 0;

  if (cycleMonths === 1) return 1;

  return (targetIndex - anchorIndex) % Math.round(cycleMonths) === 0 ? 1 : 0;
}
