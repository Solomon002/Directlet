import type { Request, Response } from "express";
import * as propertyService from "./service";

function landlordId(req: Request): string {
  return req.user!.sub;
}

export async function list(req: Request, res: Response) {
  const properties = await propertyService.listMyProperties(landlordId(req));
  res.status(200).json({ properties });
}

export async function getOne(req: Request, res: Response) {
  const property = await propertyService.getMyProperty(
    landlordId(req),
    req.params.propertyId as string,
  );
  res.status(200).json({ property });
}

export async function create(req: Request, res: Response) {
  const property = await propertyService.createProperty(landlordId(req), req.body);
  res.status(201).json({ property });
}

export async function update(req: Request, res: Response) {
  const property = await propertyService.updateProperty(
    landlordId(req),
    req.params.propertyId as string,
    req.body,
  );
  res.status(200).json({ property });
}

export async function remove(req: Request, res: Response) {
  await propertyService.deleteProperty(landlordId(req), req.params.propertyId as string);
  res.status(204).send();
}
