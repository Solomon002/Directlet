import { Router } from "express";
import { createTenancySchema } from "@directlet/shared";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as tenancyController from "./controller";

export const tenanciesRouter = Router();

tenanciesRouter.use(authenticate);

tenanciesRouter.get("/mine", requireRole("TENANT"), asyncHandler(tenancyController.getMine));
tenanciesRouter.get("/", requireRole("LANDLORD"), asyncHandler(tenancyController.list));
tenanciesRouter.post(
  "/",
  requireRole("LANDLORD"),
  validate(createTenancySchema),
  asyncHandler(tenancyController.create),
);
tenanciesRouter.get("/:tenancyId", requireRole("LANDLORD"), asyncHandler(tenancyController.getOne));
tenanciesRouter.post(
  "/:tenancyId/end",
  requireRole("LANDLORD"),
  asyncHandler(tenancyController.end),
);
