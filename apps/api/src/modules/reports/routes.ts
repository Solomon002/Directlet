import { Router, type Request, type Response } from "express";
import { createReportSchema } from "@directlet/shared";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";
import { validate } from "../../middleware/validate";
import { reportRateLimiter } from "../../middleware/rateLimit";
import { asyncHandler } from "../../utils/asyncHandler";
import * as reportService from "./service";

// Anyone signed in (except staff) can report a listing. Reports are acted on only by admins.
export const reportsRouter = Router();

reportsRouter.post(
  "/",
  authenticate,
  requireRole("HUNTER", "TENANT", "LANDLORD"),
  reportRateLimiter,
  validate(createReportSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ report: await reportService.createReport(req.user!.sub, req.body) });
  }),
);
