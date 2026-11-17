// Rules for viewing requests, kept in one place so the visitor's and the landlord's
// sides agree.

// How many requests one person can have open at the same time. Stops one account
// from tying up many landlords.
export const MAX_ACTIVE_REQUESTS_PER_USER = 5;

// A visitor who has missed this many viewings in the window cannot book more until
// the oldest one ages out. Landlords' time is not free.
export const RESTRICT_AFTER_MISSED = 3;
export const RESTRICT_WINDOW_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

// Viewings are booked for a day, not a time, so "did not show" can only be said once
// that whole day has passed.
export function scheduledDayHasPassed(scheduledFor: Date | null, now = new Date()) {
  return scheduledFor !== null && scheduledFor.getTime() + DAY_MS <= now.getTime();
}

// A viewing cannot be set for a day that has already gone.
export function isBeforeToday(date: Date, now = new Date()) {
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return date.getTime() < startOfToday;
}
