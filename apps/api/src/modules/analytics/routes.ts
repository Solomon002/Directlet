import { createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { startOfTodayUtc } from "../../lib/rentPeriod";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";

export const analyticsRouter = Router();

const pageViewSchema = z.object({
  path: z.string().startsWith("/").max(300),
  referrer: z.string().max(500).optional(),
});

// Crawlers and link-preview bots are not visitors.
const BOT_PATTERN = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse/i;

const pageViewRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  // Silently drop instead of erroring: a counter must never bother a visitor.
  handler: (_req, res) => {
    res.status(204).end();
  },
});

// Same visitor, same day -> same hash. Tomorrow the salt changes, so visits
// cannot be linked across days, and the IP itself is never stored.
function visitorHash(req: Request, day: Date) {
  return createHash("sha256")
    .update(`${env.JWT_ACCESS_SECRET}|${day.toISOString().slice(0, 10)}|${req.ip ?? ""}|${req.headers["user-agent"] ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}

// Keeps only the host of the referring site ("google.com"), never the full URL.
function referrerHost(referrer: string | undefined) {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).host;
    return host && host !== new URL(env.WEB_ORIGIN).host ? host : null;
  } catch {
    return null;
  }
}

analyticsRouter.post(
  "/pageview",
  pageViewRateLimiter,
  validate(pageViewSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userAgent = req.headers["user-agent"] ?? "";
    if (userAgent && !BOT_PATTERN.test(userAgent)) {
      const day = startOfTodayUtc();
      const { path, referrer } = req.body as z.infer<typeof pageViewSchema>;
      await prisma.pageView.create({
        data: {
          day,
          path: path.split("?")[0],
          referrer: referrerHost(referrer),
          visitorHash: visitorHash(req, day),
        },
      });
    }
    res.status(204).end();
  }),
);
