import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import * as dashboardController from "./controller";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate, requireRole("LANDLORD"));

dashboardRouter.get("/", asyncHandler(dashboardController.totals));
dashboardRouter.get("/activity", asyncHandler(dashboardController.activity));
