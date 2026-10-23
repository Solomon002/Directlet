import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import * as reminderController from "./controller";

export const remindersRouter = Router();

// House hunters have no payments, complaints or reminders.
remindersRouter.use(authenticate, requireRole("LANDLORD", "TENANT"));

remindersRouter.get("/", asyncHandler(reminderController.list));
