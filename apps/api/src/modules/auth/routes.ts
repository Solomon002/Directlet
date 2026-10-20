import { Router } from "express";
import { registerSchema, loginSchema } from "@directlet/shared";
import { validate } from "../../middleware/validate";
import {
  registerRateLimiter,
  loginIpRateLimiter,
  loginEmailIpRateLimiter,
  loginEmailRateLimiter,
  refreshRateLimiter,
} from "../../middleware/rateLimit";
import { asyncHandler } from "../../utils/asyncHandler";
import * as authController from "./controller";

export const authRouter = Router();

authRouter.post(
  "/register",
  registerRateLimiter,
  validate(registerSchema),
  asyncHandler(authController.register),
);

authRouter.post(
  "/login",
  loginIpRateLimiter,
  loginEmailIpRateLimiter,
  loginEmailRateLimiter,
  validate(loginSchema),
  asyncHandler(authController.login),
);

authRouter.post("/refresh", refreshRateLimiter, asyncHandler(authController.refresh));
