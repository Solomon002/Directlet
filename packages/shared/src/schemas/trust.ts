import { z } from "zod";

export const reportReasonValues = [
  "FAKE_LISTING",
  "STOLEN_PHOTOS",
  "ASKED_FOR_MONEY",
  "WRONG_PRICE",
  "ALREADY_LET",
  "ABUSIVE",
  "OTHER",
] as const;

export type ReportReasonValue = (typeof reportReasonValues)[number];

export const createReportSchema = z.object({
  propertyId: z.string().uuid(),
  reason: z.enum(reportReasonValues),
  details: z.string().trim().max(500, "keep it under 500 characters").optional(),
});

export const resolveReportSchema = z.object({
  action: z.enum(["TAKE_DOWN", "DISMISS"]),
  note: z.string().trim().max(300).optional(),
});

export const createReviewSchema = z.object({
  rating: z.number().int().min(1, "choose 1 to 5 stars").max(5, "choose 1 to 5 stars"),
  matchedPhotos: z.boolean(),
  priceAsStated: z.boolean(),
  comment: z.string().trim().max(600, "keep it under 600 characters").optional(),
});

export const landlordResponseSchema = z.object({
  response: z.string().trim().min(2, "write a short reply").max(600, "keep it under 600 characters"),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type LandlordResponseInput = z.infer<typeof landlordResponseSchema>;
