import { Router } from "express";
import {
  scheduleInspectionSchema,
  declineInspectionSchema,
  convertInspectionSchema,
} from "@directlet/shared";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as inspectionController from "./controller";

export const inspectionsRouter = Router();

inspectionsRouter.use(authenticate, requireRole("LANDLORD"));

inspectionsRouter.get("/", asyncHandler(inspectionController.list));
inspectionsRouter.post(
  "/:inspectionId/schedule",
  validate(scheduleInspectionSchema),
  asyncHandler(inspectionController.schedule),
);
inspectionsRouter.post(
  "/:inspectionId/decline",
  validate(declineInspectionSchema),
  asyncHandler(inspectionController.decline),
);
inspectionsRouter.post("/:inspectionId/complete", asyncHandler(inspectionController.complete));
inspectionsRouter.post(
  "/:inspectionId/convert",
  validate(convertInspectionSchema),
  asyncHandler(inspectionController.convert),
);
