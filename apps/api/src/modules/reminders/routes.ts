import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as reminderController from "./controller";

export const remindersRouter = Router();

remindersRouter.use(authenticate);

remindersRouter.get("/", asyncHandler(reminderController.list));
