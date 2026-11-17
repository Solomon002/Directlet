// How fresh a landlord's "this flat is available" has to be. A listing nobody has
// vouched for in a month is probably let already, and a visitor who books a viewing
// for it wastes everyone's time.
export const REMINDER_AFTER_DAYS = 14;
export const STALE_AFTER_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export type AvailabilityState = "CONFIRMED" | "DUE" | "STALE";

export function daysSince(date: Date, now = new Date()) {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

// CONFIRMED  recent, shown as normal
// DUE        the landlord is asked to confirm, but visitors still see it
// STALE      not offered to visitors until the landlord confirms again
export function availabilityState(confirmedAt: Date, now = new Date()): AvailabilityState {
  const days = daysSince(confirmedAt, now);
  if (days >= STALE_AFTER_DAYS) return "STALE";
  if (days >= REMINDER_AFTER_DAYS) return "DUE";
  return "CONFIRMED";
}
