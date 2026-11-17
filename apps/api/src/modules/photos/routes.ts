import express, { Router, type Request, type Response } from "express";
import { z } from "zod";
import { photoUploadRateLimiter } from "../../middleware/rateLimit";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import * as photoService from "./service";

// A landlord's photos for one property. Mounted under /properties/:propertyId/photos,
// which already requires a signed-in landlord.
export const photosRouter = Router({ mergeParams: true });

const uploadQuerySchema = z.object({ unitId: z.string().uuid().optional() });

photosRouter.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({ photos: await photoService.listPhotos(req.user!.sub, req.params.propertyId as string) });
  }),
);

photosRouter.post(
  "/",
  photoUploadRateLimiter,
  express.raw({ type: photoService.PHOTO_CONTENT_TYPES, limit: photoService.MAX_PHOTO_BYTES }),
  asyncHandler(async (req: Request, res: Response) => {
    const query = uploadQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new AppError(400, "That flat id is not valid", "VALIDATION_ERROR");
    }
    // express.raw leaves an empty object when the Content-Type is not an accepted picture type.
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new AppError(415, "Upload a JPG, PNG or WebP picture", "UNSUPPORTED_FILE_TYPE");
    }
    const photo = await photoService.addPhoto(
      req.user!.sub,
      req.params.propertyId as string,
      query.data.unitId,
      req.body,
    );
    res.status(201).json({ photo });
  }),
);

photosRouter.post(
  "/:photoId/cover",
  asyncHandler(async (req: Request, res: Response) => {
    await photoService.makeCover(req.user!.sub, req.params.propertyId as string, req.params.photoId as string);
    res.status(200).json({ photo: { id: req.params.photoId } });
  }),
);

photosRouter.delete(
  "/:photoId",
  asyncHandler(async (req: Request, res: Response) => {
    await photoService.removePhoto(req.user!.sub, req.params.propertyId as string, req.params.photoId as string);
    res.status(204).send();
  }),
);
