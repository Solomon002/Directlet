import { Router } from "express";
import { createTenancySchema } from "@directlet/shared";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as tenancyController from "./controller";

export const tenanciesRouter = Router();

tenanciesRouter.use(authenticate, requireRole("LANDLORD"));

tenanciesRouter.get("/", asyncHandler(tenancyController.list));
tenanciesRouter.post("/", validate(createTenancySchema), asyncHandler(tenancyController.create));
tenanciesRouter.get("/:tenancyId", asyncHandler(tenancyController.getOne));
tenanciesRouter.post("/:tenancyId/end", asyncHandler(tenancyController.end));
