import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as publicController from "./controller";

export const publicRouter = Router();

publicRouter.get("/properties", asyncHandler(publicController.listProperties));
publicRouter.get("/properties/:propertyId", asyncHandler(publicController.getProperty));
