import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import * as complaintService from "./service";

function userId(req: Request): string {
  return req.user!.sub;
}

export async function create(req: Request, res: Response) {
  if (req.user!.role !== "TENANT") {
    throw new AppError(403, "Only a tenant can file a complaint", "FORBIDDEN");
  }
  const complaint = await complaintService.fileComplaint(userId(req), req.body);
  res.status(201).json({ complaint });
}

export async function list(req: Request, res: Response) {
  const complaints =
    req.user!.role === "LANDLORD"
      ? await complaintService.listForLandlord(userId(req))
      : await complaintService.listForTenant(userId(req));
  res.status(200).json({ complaints });
}

export async function updateStatus(req: Request, res: Response) {
  if (req.user!.role !== "LANDLORD") {
    throw new AppError(403, "Only a landlord can update a complaint", "FORBIDDEN");
  }
  const complaint = await complaintService.updateStatus(
    userId(req),
    req.params.complaintId as string,
    req.body,
  );
  res.status(200).json({ complaint });
}
