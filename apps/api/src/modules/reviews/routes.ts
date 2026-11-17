import { Router, type Request, type Response } from "express";
import { landlordResponseSchema } from "@directlet/shared";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as reviewService from "./service";

// The landlord's side of reviews. Mounted under /properties/:propertyId/reviews, which
// already requires a signed-in landlord.
export const landlordReviewsRouter = Router({ mergeParams: true });

landlordReviewsRouter.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      reviews: await reviewService.listForLandlord(req.user!.sub, req.params.propertyId as string),
    });
  }),
);

landlordReviewsRouter.post(
  "/:reviewId/response",
  validate(landlordResponseSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await reviewService.respond(
      req.user!.sub,
      req.params.propertyId as string,
      req.params.reviewId as string,
      req.body.response,
    );
    res.status(200).json({ review: { id: req.params.reviewId } });
  }),
);
