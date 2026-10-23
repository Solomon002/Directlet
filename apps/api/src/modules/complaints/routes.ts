import { Router } from "express";
import { createComplaintSchema, updateComplaintStatusSchema } from "@directlet/shared";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as complaintController from "./controller";

export const complaintsRouter = Router();

complaintsRouter.use(authenticate);

complaintsRouter.get("/", asyncHandler(complaintController.list));
complaintsRouter.post("/", validate(createComplaintSchema), asyncHandler(complaintController.create));
complaintsRouter.post(
  "/:complaintId/status",
  validate(updateComplaintStatusSchema),
  asyncHandler(complaintController.updateStatus),
);
