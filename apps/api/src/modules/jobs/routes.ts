import { timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { asyncHandler } from "../../utils/asyncHandler";
import { runRentRoll } from "../../jobs/rentRoll";

export const jobsRouter = Router();

function matchesSecret(header: string | undefined, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Called once a day by Vercel's scheduler, which sends the CRON_SECRET as a
// bearer token. Anyone else gets a plain 404, so the route does not advertise itself.
jobsRouter.get(
  "/rent-roll",
  asyncHandler(async (req: Request, res: Response) => {
    if (!env.CRON_SECRET || !matchesSecret(req.headers.authorization, env.CRON_SECRET)) {
      throw new AppError(404, "Route not found", "NOT_FOUND");
    }
    res.status(200).json(await runRentRoll());
  }),
);
