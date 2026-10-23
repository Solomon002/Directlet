import { Router } from "express";
import { createInspectionRequestSchema } from "@directlet/shared";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as publicController from "./controller";

export const publicRouter = Router();

publicRouter.get("/properties", asyncHandler(publicController.listProperties));
publicRouter.get("/properties/:propertyId", asyncHandler(publicController.getProperty));
publicRouter.post(
  "/units/:unitId/inspection-requests",
  validate(createInspectionRequestSchema),
  asyncHandler(publicController.createInspectionRequest),
);
