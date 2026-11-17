import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { rejectVerificationSchema } from "@directlet/shared";
import * as adminService from "./service";
import * as verificationService from "../verification/service";

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole("ADMIN"));

const reasonSchema = z.object({ reason: z.string().trim().max(300).optional() });
const roleSchema = z.enum(["LANDLORD", "TENANT", "HUNTER", "ADMIN"]);

function page(req: Request) {
  const value = Number(req.query.page ?? 1);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 100) : undefined;
}

adminRouter.get(
  "/overview",
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json({ overview: await adminService.getOverview() });
  }),
);

adminRouter.get(
  "/users",
  asyncHandler(async (req: Request, res: Response) => {
    const role = req.query.role ? roleSchema.safeParse(req.query.role) : null;
    if (role && !role.success) {
      throw new AppError(400, "Unknown role", "VALIDATION_ERROR");
    }
    res.status(200).json(
      await adminService.listUsers({
        q: text(req.query.q),
        role: role?.data,
        suspended: req.query.suspended === "true",
        page: page(req),
      }),
    );
  }),
);

adminRouter.get(
  "/users/:userId",
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({ user: await adminService.getUser(req.params.userId as string) });
  }),
);

adminRouter.post(
  "/users/:userId/suspend",
  validate(reasonSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await adminService.suspendUser(req.user!.sub, req.params.userId as string, req.body.reason);
    res.status(200).json({ user: { id: req.params.userId } });
  }),
);

adminRouter.post(
  "/users/:userId/unsuspend",
  asyncHandler(async (req: Request, res: Response) => {
    await adminService.unsuspendUser(req.params.userId as string);
    res.status(200).json({ user: { id: req.params.userId } });
  }),
);

adminRouter.get(
  "/properties",
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(
      await adminService.listProperties({
        q: text(req.query.q),
        hidden: req.query.hidden === "true",
        page: page(req),
      }),
    );
  }),
);

adminRouter.post(
  "/properties/:propertyId/hide",
  validate(reasonSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await adminService.setPropertyHidden(req.params.propertyId as string, true, req.body.reason);
    res.status(200).json({ property: { id: req.params.propertyId } });
  }),
);

adminRouter.post(
  "/properties/:propertyId/unhide",
  asyncHandler(async (req: Request, res: Response) => {
    await adminService.setPropertyHidden(req.params.propertyId as string, false);
    res.status(200).json({ property: { id: req.params.propertyId } });
  }),
);

// --- Landlord verification ---

const verificationStatusSchema = z.enum(["PENDING", "VERIFIED", "REJECTED"]);

adminRouter.get(
  "/verifications",
  asyncHandler(async (req: Request, res: Response) => {
    const status = req.query.status ? verificationStatusSchema.safeParse(req.query.status) : null;
    if (status && !status.success) {
      throw new AppError(400, "Unknown status", "VALIDATION_ERROR");
    }
    res.status(200).json(await verificationService.listForAdmin({ status: status?.data, page: page(req) }));
  }),
);

adminRouter.get(
  "/verifications/:id",
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({ verification: await verificationService.getForAdmin(req.params.id as string) });
  }),
);

adminRouter.post(
  "/verifications/:id/approve",
  asyncHandler(async (req: Request, res: Response) => {
    await verificationService.approve(req.user!.sub, req.params.id as string);
    res.status(200).json({ verification: { id: req.params.id } });
  }),
);

adminRouter.post(
  "/verifications/:id/reject",
  validate(rejectVerificationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await verificationService.reject(req.user!.sub, req.params.id as string, req.body.reason);
    res.status(200).json({ verification: { id: req.params.id } });
  }),
);

adminRouter.get(
  "/activity",
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(
      await adminService.listActivity({
        userId: text(req.query.userId),
        failedOnly: req.query.failed === "true",
        page: page(req),
      }),
    );
  }),
);
