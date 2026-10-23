import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

const MINUTE = 60 * 1000;

function tooMany(message: string) {
  return { error: { code: "RATE_LIMITED", message } };
}

function ipKey(req: Request) {
  return ipKeyGenerator(req.ip ?? "unknown");
}

function emailKey(req: Request) {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  if (typeof email !== "string") return "no-email";
  return email.trim().toLowerCase().slice(0, 254);
}

const base = { standardHeaders: true, legacyHeaders: false } as const;

export const registerRateLimiter = rateLimit({
  ...base,
  windowMs: 60 * MINUTE,
  limit: 10,
  keyGenerator: ipKey,
  message: tooMany("Too many accounts created from this network. Try again later."),
});

// Loose, because many phones share one public IP on mobile networks.
export const loginIpRateLimiter = rateLimit({
  ...base,
  windowMs: 15 * MINUTE,
  limit: 50,
  skipSuccessfulRequests: true,
  keyGenerator: ipKey,
  message: tooMany("Too many login attempts. Try again later."),
});

// Strict, but only for one email on one network.
export const loginEmailIpRateLimiter = rateLimit({
  ...base,
  windowMs: 15 * MINUTE,
  limit: 8,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${emailKey(req)}|${ipKey(req)}`,
  message: tooMany("Too many login attempts. Try again later."),
});

// A high ceiling against one account being guessed from many networks.
export const loginEmailRateLimiter = rateLimit({
  ...base,
  windowMs: 60 * MINUTE,
  limit: 50,
  skipSuccessfulRequests: true,
  keyGenerator: emailKey,
  message: tooMany("Too many login attempts. Try again later."),
});

// Per signed-in user. These run after authenticate, so req.user is set.
function userKey(req: Request) {
  return req.user?.sub ?? ipKey(req);
}

// Nominatim allows about one request a second for the whole app.
export const geocodeRateLimiter = rateLimit({
  ...base,
  windowMs: MINUTE,
  limit: 10,
  keyGenerator: userKey,
  message: tooMany("Too many address searches. Wait a minute or drop the pin on the map."),
});

export const messageRateLimiter = rateLimit({
  ...base,
  windowMs: MINUTE,
  limit: 30,
  keyGenerator: userKey,
  message: tooMany("You are sending messages too quickly. Wait a moment."),
});

export const refreshRateLimiter = rateLimit({
  ...base,
  windowMs: 15 * MINUTE,
  limit: 120,
  keyGenerator: ipKey,
  message: tooMany("Too many requests. Try again later."),
});
