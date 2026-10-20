import { Router } from "express";
import { registerSchema, loginSchema } from "@directlet/shared";
import { validate } from "../../middleware/validate";
import { loginRateLimiter } from "../../middleware/rateLimit";
import { asyncHandler } from "../../utils/asyncHandler";
import * as authController from "./controller";

export const authRouter = Router();

authRouter.post("/register", validate(registerSchema), asyncHandler(authController.register));
authRouter.post("/login", loginRateLimiter, validate(loginSchema), asyncHandler(authController.login));
authRouter.post("/refresh", asyncHandler(authController.refresh));
