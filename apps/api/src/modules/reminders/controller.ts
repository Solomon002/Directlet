import type { Request, Response } from "express";
import * as reminderService from "./service";

export async function list(req: Request, res: Response) {
  const reminders =
    req.user!.role === "LANDLORD"
      ? await reminderService.remindersForLandlord(req.user!.sub)
      : await reminderService.remindersForTenant(req.user!.sub);
  res.status(200).json({ reminders });
}
