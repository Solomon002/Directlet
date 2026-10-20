import type { Request, Response } from "express";
import * as unitService from "./service";

function landlordId(req: Request): string {
  return req.user!.sub;
}

export async function list(req: Request, res: Response) {
  const units = await unitService.listUnits(landlordId(req), req.params.propertyId as string);
  res.status(200).json({ units });
}

export async function create(req: Request, res: Response) {
  const unit = await unitService.createUnit(
    landlordId(req),
    req.params.propertyId as string,
    req.body,
  );
  res.status(201).json({ unit });
}

export async function update(req: Request, res: Response) {
  const unit = await unitService.updateUnit(
    landlordId(req),
    req.params.propertyId as string,
    req.params.unitId as string,
    req.body,
  );
  res.status(200).json({ unit });
}

export async function remove(req: Request, res: Response) {
  await unitService.deleteUnit(
    landlordId(req),
    req.params.propertyId as string,
    req.params.unitId as string,
  );
  res.status(204).send();
}
