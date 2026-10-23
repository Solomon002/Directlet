import type { Request, Response } from "express";
import { env } from "../../config/env";
import * as inspectionService from "./service";

function landlordId(req: Request): string {
  return req.user!.sub;
}

export async function list(req: Request, res: Response) {
  const inspectionRequests = await inspectionService.listForLandlord(landlordId(req));
  res.status(200).json({ inspectionRequests });
}

export async function schedule(req: Request, res: Response) {
  const inspectionRequest = await inspectionService.scheduleInspection(
    landlordId(req),
    req.params.inspectionId as string,
    req.body,
  );
  res.status(200).json({ inspectionRequest });
}

export async function decline(req: Request, res: Response) {
  const inspectionRequest = await inspectionService.declineInspection(
    landlordId(req),
    req.params.inspectionId as string,
    req.body,
  );
  res.status(200).json({ inspectionRequest });
}

export async function complete(req: Request, res: Response) {
  const inspectionRequest = await inspectionService.completeInspection(
    landlordId(req),
    req.params.inspectionId as string,
  );
  res.status(200).json({ inspectionRequest });
}

export async function convert(req: Request, res: Response) {
  const { tenancy, tenant, inviteToken } = await inspectionService.convertToTenancy(
    landlordId(req),
    req.params.inspectionId as string,
    req.body,
  );

  const inviteLink = inviteToken ? `${env.WEB_ORIGIN}/invite/${inviteToken}` : null;

  res.status(201).json({
    tenancy,
    tenant: { id: tenant.id, email: tenant.email, fullName: tenant.fullName },
    inviteLink,
  });
}
