import { Router } from "express";
import { createInspectionRequestSchema, createReviewSchema } from "@directlet/shared";
import * as reviewService from "../reviews/service";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";
import { reviewRateLimiter, viewingRequestRateLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { getPublicPhoto } from "../photos/service";
import * as publicController from "./controller";

export const publicRouter = Router();

publicRouter.get("/properties", asyncHandler(publicController.listProperties));
publicRouter.get("/properties/:propertyId", asyncHandler(publicController.getProperty));
// Reviews need an account and a real visit (checked in the service).
publicRouter.get(
  "/properties/:propertyId/review-eligibility",
  authenticate,
  asyncHandler(async (req, res) => {
    res.status(200).json(await reviewService.eligibility(req.user!.sub, req.params.propertyId as string));
  }),
);
publicRouter.post(
  "/properties/:propertyId/reviews",
  authenticate,
  requireRole("HUNTER", "TENANT"),
  reviewRateLimiter,
  validate(createReviewSchema),
  asyncHandler(async (req, res) => {
    const review = await reviewService.createReview(req.user!.sub, req.params.propertyId as string, req.body);
    res.status(201).json({ review });
  }),
);

// A picture. Its id never points at different bytes, so it can be cached for good.
publicRouter.get(
  "/photos/:photoId",
  asyncHandler(async (req, res) => {
    const photo = await getPublicPhoto(req.params.photoId as string);
    res.setHeader("Content-Type", photo.contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    // Helmet blocks other origins from embedding by default; a listing picture is meant to be shown.
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.send(Buffer.from(photo.data));
  }),
);
// Needs an account (a house hunter or a tenant): requests are tied to a real person,
// limited per person, and their contact details are held back until the landlord accepts.
publicRouter.post(
  "/units/:unitId/inspection-requests",
  authenticate,
  requireRole("HUNTER", "TENANT"),
  viewingRequestRateLimiter,
  validate(createInspectionRequestSchema),
  asyncHandler(publicController.createInspectionRequest),
);
