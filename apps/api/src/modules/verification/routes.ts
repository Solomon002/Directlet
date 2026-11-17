import express, { Router, type Request, type Response } from "express";
import { z } from "zod";
import { submitVerificationSchema, verificationDocKindValues } from "@directlet/shared";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";
import { validate } from "../../middleware/validate";
import { documentUploadRateLimiter } from "../../middleware/rateLimit";
import { FILE_CONTENT_TYPES } from "../../lib/fileTypes";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import * as verificationService from "./service";

// The landlord's side: apply, add documents, see the outcome.
export const verificationRouter = Router();

verificationRouter.use(authenticate);

const uploadQuerySchema = z.object({
  kind: z.enum(verificationDocKindValues),
  name: z.string().trim().max(200).optional(),
});

verificationRouter.get(
  "/",
  requireRole("LANDLORD"),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({ verification: await verificationService.getMine(req.user!.sub) });
  }),
);

verificationRouter.post(
  "/",
  requireRole("LANDLORD"),
  validate(submitVerificationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({ verification: await verificationService.submit(req.user!.sub, req.body) });
  }),
);

verificationRouter.post(
  "/documents",
  requireRole("LANDLORD"),
  documentUploadRateLimiter,
  express.raw({ type: FILE_CONTENT_TYPES, limit: verificationService.MAX_DOCUMENT_BYTES }),
  asyncHandler(async (req: Request, res: Response) => {
    const query = uploadQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new AppError(400, "Say which document this is (ID, OWNERSHIP or CAC_CERTIFICATE)", "VALIDATION_ERROR");
    }
    // express.raw leaves an empty object when the Content-Type is not an accepted file type.
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new AppError(415, "Upload a JPG, PNG, WebP image or a PDF", "UNSUPPORTED_FILE_TYPE");
    }
    const document = await verificationService.addDocument(
      req.user!.sub,
      query.data.kind,
      query.data.name ?? "document",
      req.body,
    );
    res.status(201).json({ document });
  }),
);

verificationRouter.delete(
  "/documents/:documentId",
  requireRole("LANDLORD"),
  asyncHandler(async (req: Request, res: Response) => {
    await verificationService.removeDocument(req.user!.sub, req.params.documentId as string);
    res.status(204).send();
  }),
);

// The landlord who uploaded it, or an admin (the check is in the service).
verificationRouter.get(
  "/documents/:documentId",
  asyncHandler(async (req: Request, res: Response) => {
    const document = await verificationService.getDocument(req.user!, req.params.documentId as string);
    res.setHeader("Content-Type", document.contentType);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(Buffer.from(document.data));
  }),
);
