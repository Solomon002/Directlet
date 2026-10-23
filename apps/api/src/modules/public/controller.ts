import type { Request, Response } from "express";
import * as publicService from "./service";

export async function listProperties(req: Request, res: Response) {
  const result = await publicService.listPublicProperties({
    city: typeof req.query.city === "string" ? req.query.city : undefined,
    area: typeof req.query.area === "string" ? req.query.area : undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
  });
  res.status(200).json(result);
}

export async function getProperty(req: Request, res: Response) {
  const property = await publicService.getPublicProperty(req.params.propertyId as string);
  res.status(200).json({ property });
}

export async function createInspectionRequest(req: Request, res: Response) {
  const inspectionRequest = await publicService.createInspectionRequest(
    req.params.unitId as string,
    req.body,
  );
  res.status(201).json({ inspectionRequest });
}
