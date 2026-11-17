import { Router, type Request, type Response } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import * as viewingService from "./service";

// A visitor's own viewing requests.
export const viewingsRouter = Router();

viewingsRouter.use(authenticate, requireRole("HUNTER", "TENANT"));

viewingsRouter.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({ viewings: await viewingService.listMine(req.user!.sub) });
  }),
);

viewingsRouter.post(
  "/:viewingId/cancel",
  asyncHandler(async (req: Request, res: Response) => {
    await viewingService.cancel(req.user!.sub, req.params.viewingId as string);
    res.status(200).json({ viewing: { id: req.params.viewingId } });
  }),
);

viewingsRouter.post(
  "/:viewingId/report-no-show",
  asyncHandler(async (req: Request, res: Response) => {
    await viewingService.reportLandlordNoShow(req.user!.sub, req.params.viewingId as string);
    res.status(200).json({ viewing: { id: req.params.viewingId } });
  }),
);
