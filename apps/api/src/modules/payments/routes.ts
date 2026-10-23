import express, { Router } from "express";
import { createPaymentSchema, rejectPaymentSchema } from "@directlet/shared";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as paymentController from "./controller";
import { PROOF_CONTENT_TYPES, PROOF_SIZE_LIMIT } from "./service";

export const paymentsRouter = Router();

paymentsRouter.use(authenticate);

paymentsRouter.get("/", asyncHandler(paymentController.list));
paymentsRouter.post("/", validate(createPaymentSchema), asyncHandler(paymentController.create));
paymentsRouter.post("/:paymentId/confirm", asyncHandler(paymentController.confirm));
paymentsRouter.post(
  "/:paymentId/reject",
  validate(rejectPaymentSchema),
  asyncHandler(paymentController.reject),
);
paymentsRouter.get("/:paymentId/receipt", asyncHandler(paymentController.downloadReceipt));
paymentsRouter.post(
  "/:paymentId/proof",
  express.raw({ type: PROOF_CONTENT_TYPES, limit: PROOF_SIZE_LIMIT }),
  asyncHandler(paymentController.uploadProof),
);
paymentsRouter.get("/:paymentId/proof", asyncHandler(paymentController.downloadProof));
