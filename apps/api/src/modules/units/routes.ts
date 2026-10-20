import { Router } from "express";
import { createUnitSchema, updateUnitSchema } from "@directlet/shared";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as unitController from "./controller";

// mergeParams lets this router read :propertyId from the parent router.
export const unitsRouter = Router({ mergeParams: true });

unitsRouter.get("/", asyncHandler(unitController.list));
unitsRouter.post("/", validate(createUnitSchema), asyncHandler(unitController.create));
unitsRouter.patch("/:unitId", validate(updateUnitSchema), asyncHandler(unitController.update));
unitsRouter.delete("/:unitId", asyncHandler(unitController.remove));
