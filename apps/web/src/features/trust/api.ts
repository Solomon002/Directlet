import { api } from "../../lib/api";

// ---- Email confirmation ----

export async function resendConfirmation() {
  const res = await api.post<{ alreadyVerified: boolean; emailEnabled: boolean }>("/email/resend");
  return res.data;
}

export async function verifyEmail(token: string) {
  await api.post("/email/verify", { token });
}

// ---- Reports ----

export const reportReasons = [
  { value: "FAKE_LISTING", label: "It looks fake or does not exist" },
  { value: "STOLEN_PHOTOS", label: "The photos are not of this place" },
  { value: "ASKED_FOR_MONEY", label: "They asked for money before I saw it" },
  { value: "WRONG_PRICE", label: "The price is not what was advertised" },
  { value: "ALREADY_LET", label: "It is already let" },
  { value: "ABUSIVE", label: "The owner was rude or threatening" },
  { value: "OTHER", label: "Something else" },
] as const;

export type ReportReason = (typeof reportReasons)[number]["value"];

export const reportReasonLabels = Object.fromEntries(reportReasons.map((r) => [r.value, r.label])) as Record<
  ReportReason,
  string
>;

export async function createReport(propertyId: string, reason: ReportReason, details?: string) {
  await api.post("/reports", { propertyId, reason, details: details || undefined });
}

// ---- Reviews ----

export type ReviewInput = { rating: number; matchedPhotos: boolean; priceAsStated: boolean; comment?: string };

export type ReviewEligibility = { eligible: boolean; alreadyReviewed: boolean; reason: string | null };

export async function getReviewEligibility(propertyId: string) {
  const res = await api.get<ReviewEligibility>(`/public/properties/${propertyId}/review-eligibility`);
  return res.data;
}

export async function createReview(propertyId: string, input: ReviewInput) {
  await api.post(`/public/properties/${propertyId}/reviews`, input);
}

export type LandlordReview = {
  id: string;
  rating: number;
  comment: string | null;
  matchedPhotos: boolean;
  priceAsStated: boolean;
  landlordResponse: string | null;
  respondedAt: string | null;
  createdAt: string;
  reviewerName: string;
};

export async function listPropertyReviews(propertyId: string) {
  const res = await api.get<{ reviews: LandlordReview[] }>(`/properties/${propertyId}/reviews`);
  return res.data.reviews;
}

export async function respondToReview(propertyId: string, reviewId: string, response: string) {
  await api.post(`/properties/${propertyId}/reviews/${reviewId}/response`, { response });
}

// ---- Admin ----

export type AdminReportGroup = {
  property: {
    id: string;
    name: string;
    area: string;
    city: string;
    hiddenByAdminAt: string | null;
    hiddenByAdminReason: string | null;
    landlord: { id: string; fullName: string; email: string; suspendedAt: string | null; verified: boolean };
  };
  count: number;
  reports: {
    id: string;
    reason: ReportReason;
    details: string | null;
    status: "OPEN" | "ACTION_TAKEN" | "DISMISSED";
    resolutionNote: string | null;
    createdAt: string;
    reporter: { id: string; fullName: string; createdAt: string };
  }[];
};

export async function adminListReports(params: { handled: boolean; page: number }) {
  const res = await api.get<{ groups: AdminReportGroup[]; total: number; page: number; pageSize: number }>(
    "/admin/reports",
    { params: { status: params.handled ? "handled" : undefined, page: params.page } },
  );
  return res.data;
}

export async function adminResolveReports(propertyId: string, action: "TAKE_DOWN" | "DISMISS", note?: string) {
  await api.post(`/admin/reports/property/${propertyId}/resolve`, { action, note: note || undefined });
}

export type AdminReview = {
  id: string;
  rating: number;
  comment: string | null;
  removedAt: string | null;
  createdAt: string;
  reviewer: { id: string; fullName: string };
};

export async function adminListReviews(propertyId: string) {
  const res = await api.get<{ reviews: AdminReview[] }>(`/admin/properties/${propertyId}/reviews`);
  return res.data.reviews;
}

export async function adminRemoveReview(reviewId: string) {
  await api.post(`/admin/reviews/${reviewId}/remove`);
}
