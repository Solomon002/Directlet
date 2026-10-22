import type { Request, Response } from "express";
import { env } from "../../config/env";
import * as tenancyService from "./service";

function landlordId(req: Request): string {
  return req.user!.sub;
}

export async function list(req: Request, res: Response) {
  const tenancies = await tenancyService.listMyTenancies(landlordId(req));
  res.status(200).json({ tenancies });
}

export async function getOne(req: Request, res: Response) {
  const tenancy = await tenancyService.getMyTenancy(landlordId(req), req.params.tenancyId as string);
  res.status(200).json({ tenancy });
}

export async function create(req: Request, res: Response) {
  const { tenancy, tenant, inviteToken } = await tenancyService.createTenancy(landlordId(req), req.body);

  const inviteLink = inviteToken ? `${env.WEB_ORIGIN}/invite/${inviteToken}` : null;

  res.status(201).json({
    tenancy,
    tenant: { id: tenant.id, email: tenant.email, fullName: tenant.fullName },
    inviteLink,
  });
}

export async function end(req: Request, res: Response) {
  const tenancy = await tenancyService.endTenancy(landlordId(req), req.params.tenancyId as string);
  res.status(200).json({ tenancy });
}

export async function getMine(req: Request, res: Response) {
  const tenancy = await tenancyService.getMyActiveTenancyAsTenant(req.user!.sub);
  res.status(200).json({ tenancy });
}
