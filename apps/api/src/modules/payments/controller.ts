import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import * as paymentService from "./service";

function userId(req: Request): string {
  return req.user!.sub;
}

export async function create(req: Request, res: Response) {
  if (req.user!.role !== "TENANT") {
    throw new AppError(403, "Only a tenant can record a payment", "FORBIDDEN");
  }
  const payment = await paymentService.recordPayment(userId(req), req.body);
  res.status(201).json({ payment });
}

export async function list(req: Request, res: Response) {
  const payments =
    req.user!.role === "LANDLORD"
      ? await paymentService.listForLandlord(userId(req))
      : await paymentService.listForTenant(userId(req));
  res.status(200).json({ payments });
}

export async function confirm(req: Request, res: Response) {
  if (req.user!.role !== "LANDLORD") {
    throw new AppError(403, "Only a landlord can confirm a payment", "FORBIDDEN");
  }
  const payment = await paymentService.confirmPayment(userId(req), req.params.paymentId as string);
  res.status(200).json({ payment });
}

export async function reject(req: Request, res: Response) {
  if (req.user!.role !== "LANDLORD") {
    throw new AppError(403, "Only a landlord can reject a payment", "FORBIDDEN");
  }
  const { rejectionReason } = req.body as { rejectionReason?: string };
  const payment = await paymentService.rejectPayment(
    userId(req),
    req.params.paymentId as string,
    rejectionReason,
  );
  res.status(200).json({ payment });
}
