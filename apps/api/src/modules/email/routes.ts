import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { emailResendRateLimiter, emailVerifyRateLimiter } from "../../middleware/rateLimit";
import { asyncHandler } from "../../utils/asyncHandler";
import * as emailService from "./service";

export const emailRouter = Router();

const verifySchema = z.object({ token: z.string().min(20).max(100) });

// Opened from the link in the email, so there is no signed-in session to rely on.
emailRouter.post(
  "/verify",
  emailVerifyRateLimiter,
  validate(verifySchema),
  asyncHandler(async (req: Request, res: Response) => {
    await emailService.verify(req.body.token);
    res.status(200).json({ verified: true });
  }),
);

emailRouter.post(
  "/resend",
  authenticate,
  emailResendRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(await emailService.resend(req.user!.sub));
  }),
);
