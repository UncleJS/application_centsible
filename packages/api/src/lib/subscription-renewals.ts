import { BILLING_CYCLE_MONTHS } from "@centsible/shared";

const DAY_MS = 24 * 60 * 60 * 1000;

function lastUtcDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addMonthsClamped(date: Date, months: number, preferredDay: number): Date {
  const absoluteMonth = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const targetYear = Math.floor(absoluteMonth / 12);
  const targetMonthIndex = absoluteMonth % 12;
  const targetDay = Math.min(
    preferredDay,
    lastUtcDayOfMonth(targetYear, targetMonthIndex)
  );

  return new Date(Date.UTC(targetYear, targetMonthIndex, targetDay));
}

export function getSubscriptionRenewalsInMonth(
  sub: {
    nextRenewalDate: string;
    billingCycle: string;
    autoRenew: boolean;
  },
  year: number,
  month: number
): string[] {
  if (!sub.autoRenew) return [];

  const renewals: string[] = [];
  const cycleMonths = BILLING_CYCLE_MONTHS[sub.billingCycle] || 1;

  if (cycleMonths <= 0) return [];

  const monthStartStr = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDayUtc = new Date(Date.UTC(year, month, 0));
  const monthEndStr = lastDayUtc.toISOString().slice(0, 10);

  let current = new Date(`${sub.nextRenewalDate}T00:00:00Z`);
  const preferredDay = current.getUTCDate();
  let iterations = 0;

  while (iterations < 200) {
    iterations++;
    const currentStr = current.toISOString().slice(0, 10);

    if (currentStr > monthEndStr) break;

    if (currentStr >= monthStartStr && currentStr <= monthEndStr) {
      renewals.push(currentStr);
    }

    if (cycleMonths >= 1) {
      current = addMonthsClamped(current, Math.round(cycleMonths), preferredDay);
    } else {
      const days = Math.max(1, Math.round(cycleMonths * 30.44));
      current = new Date(current.getTime() + days * DAY_MS);
    }
  }

  return renewals;
}
