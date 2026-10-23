import type { Request, Response } from "express";
import * as dashboardService from "./service";

function landlordId(req: Request): string {
  return req.user!.sub;
}

export async function totals(req: Request, res: Response) {
  const totals = await dashboardService.getTotals(landlordId(req));
  res.status(200).json({ totals });
}

export async function activity(req: Request, res: Response) {
  const activity = await dashboardService.listActivity(landlordId(req));
  res.status(200).json({ activity });
}
