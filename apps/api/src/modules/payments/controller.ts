import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import { streamReceiptPdf } from "../../lib/pdf";
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

export async function uploadProof(req: Request, res: Response) {
  if (req.user!.role !== "TENANT") {
    throw new AppError(403, "Only a tenant can add proof of payment", "FORBIDDEN");
  }
  // express.raw leaves an empty object when the Content-Type is not an accepted file type.
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new AppError(415, "Upload a JPG, PNG, WebP image or a PDF", "UNSUPPORTED_FILE_TYPE");
  }
  const proof = await paymentService.attachProof(userId(req), req.params.paymentId as string, req.body);
  res.status(201).json({ proof });
}

export async function downloadProof(req: Request, res: Response) {
  const proof = await paymentService.getProof(userId(req), req.params.paymentId as string);
  res.setHeader("Content-Type", proof.contentType);
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("Cache-Control", "private, no-store");
  res.send(Buffer.from(proof.data));
}

export async function downloadReceipt(req: Request, res: Response) {
  const payment = await paymentService.getReceiptForDownload(userId(req), req.params.paymentId as string);

  streamReceiptPdf(res, {
    receiptNumber: payment.receipt!.receiptNumber,
    issuedAt: payment.receipt!.issuedAt,
    tenantName: payment.tenancy.tenant.fullName,
    propertyName: payment.tenancy.unit.property.name,
    unitLabel: payment.tenancy.unit.label,
    address: `${payment.tenancy.unit.property.address}, ${payment.tenancy.unit.property.area}, ${payment.tenancy.unit.property.city}`,
    amount: payment.amount.toString(),
    method: payment.method,
    paidAt: payment.paidAt,
    periods: payment.allocations.map((allocation) => ({
      start: allocation.rentCharge.periodStart,
      end: allocation.rentCharge.periodEnd,
      amount: allocation.amount.toString(),
    })),
  });
}
