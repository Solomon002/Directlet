import { Router } from "express";
import { registerSchema, loginSchema, acceptInviteSchema } from "@directlet/shared";
import { validate } from "../../middleware/validate";
import { requireTrustedOrigin } from "../../middleware/requireTrustedOrigin";
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

authRouter.post(
  "/refresh",
  refreshRateLimiter,
  requireTrustedOrigin,
  asyncHandler(authController.refresh),
);

authRouter.post(
  "/logout",
  refreshRateLimiter,
  requireTrustedOrigin,
  asyncHandler(authController.logout),
);

authRouter.get("/invite/:token", asyncHandler(authController.getInvite));

authRouter.post(
  "/invite/:token/accept",
  registerRateLimiter,
  validate(acceptInviteSchema),
  asyncHandler(authController.acceptInvite),
);
