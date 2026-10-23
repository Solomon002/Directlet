import type { RentFrequency } from "../generated/prisma/enums";

const DAY_MS = 24 * 60 * 60 * 1000;

// Rent dates are stored as @db.Date (UTC midnight), so all math is done in UTC.
export function addRentPeriod(date: Date, frequency: RentFrequency): Date {
  const result = new Date(date);
  switch (frequency) {
    case "MONTHLY":
      result.setUTCMonth(result.getUTCMonth() + 1);
      break;
    case "QUARTERLY":
      result.setUTCMonth(result.getUTCMonth() + 3);
      break;
    case "BIANNUAL":
      result.setUTCMonth(result.getUTCMonth() + 6);
      break;
    case "ANNUAL":
      result.setUTCFullYear(result.getUTCFullYear() + 1);
      break;
  }
  return result;
}

export function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}
