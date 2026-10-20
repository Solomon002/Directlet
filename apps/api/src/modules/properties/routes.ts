import { Router } from "express";
import { createPropertySchema, updatePropertySchema } from "@directlet/shared";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as propertyController from "./controller";
import { unitsRouter } from "../units/routes";

export const propertiesRouter = Router();

propertiesRouter.use(authenticate, requireRole("LANDLORD"));

propertiesRouter.get("/", asyncHandler(propertyController.list));
propertiesRouter.post("/", validate(createPropertySchema), asyncHandler(propertyController.create));
propertiesRouter.get("/:propertyId", asyncHandler(propertyController.getOne));
propertiesRouter.patch(
  "/:propertyId",
  validate(updatePropertySchema),
  asyncHandler(propertyController.update),
);
propertiesRouter.delete("/:propertyId", asyncHandler(propertyController.remove));

propertiesRouter.use("/:propertyId/units", unitsRouter);
