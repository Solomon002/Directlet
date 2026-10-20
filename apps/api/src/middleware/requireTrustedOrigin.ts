import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";

// Blocks cross-site requests to routes that rely on a cookie. Browsers always send
// the Origin header on a POST, so a missing or different value is rejected.
export function requireTrustedOrigin(req: Request, _res: Response, next: NextFunction) {
  if (req.headers.origin !== env.WEB_ORIGIN) {
    throw new AppError(403, "Request origin not allowed", "FORBIDDEN_ORIGIN");
  }
  next();
}
