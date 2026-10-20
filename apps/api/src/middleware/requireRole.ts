import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import type { UserRole } from "../generated/prisma/enums";

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      throw new AppError(403, "You do not have access to this resource", "FORBIDDEN");
    }
    next();
  };
}
