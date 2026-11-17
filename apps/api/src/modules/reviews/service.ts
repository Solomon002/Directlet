import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { CreateReviewInput } from "@directlet/shared";

const PUBLIC_REVIEW_LIMIT = 20;

// "Ada Okafor" -> "Ada O." Enough to feel real without naming someone to the world.
function displayName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}

// Only people who really saw the place can review it: they went to a viewing that was
// completed (or became a tenancy), or they have rented there. That is what stops fake
// reviews, good or bad.
export async function eligibility(userId: string, propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { landlordId: true } });
  if (!property) {
    throw new AppError(404, "Listing not found", "NOT_FOUND");
  }
  if (property.landlordId === userId) {
    return { eligible: false, alreadyReviewed: false, reason: "You cannot review your own listing." };
  }

  const existing = await prisma.review.findUnique({
    where: { reviewerId_propertyId: { reviewerId: userId, propertyId } },
    select: { id: true },
  });
  if (existing) {
    return { eligible: false, alreadyReviewed: true, reason: "You have already reviewed this place." };
  }

  const [viewings, tenancies] = await Promise.all([
    prisma.inspectionRequest.count({
      where: { requesterId: userId, status: { in: ["COMPLETED", "CONVERTED"] }, unit: { propertyId } },
    }),
    prisma.tenancy.count({ where: { tenantId: userId, unit: { propertyId } } }),
  ]);

  return viewings + tenancies > 0
    ? { eligible: true, alreadyReviewed: false, reason: null }
    : {
        eligible: false,
        alreadyReviewed: false,
        reason: "You can review a place after the landlord marks your viewing as done, or once you have rented there.",
      };
}

export async function createReview(userId: string, propertyId: string, input: CreateReviewInput) {
  const check = await eligibility(userId, propertyId);
  if (!check.eligible) {
    throw new AppError(403, check.reason ?? "You cannot review this place", "NOT_ELIGIBLE");
  }
  return prisma.review.create({
    data: {
      propertyId,
      reviewerId: userId,
      rating: input.rating,
      matchedPhotos: input.matchedPhotos,
      priceAsStated: input.priceAsStated,
      comment: input.comment || null,
    },
    select: { id: true, rating: true, createdAt: true },
  });
}

// What the listing page shows: the average, how often the place matched its photos and
// price, and the latest reviews with the landlord's replies.
export async function publicSummary(propertyId: string) {
  const where = { propertyId, removedAt: null };
  const [aggregate, matched, priced, items] = await Promise.all([
    prisma.review.aggregate({ where, _avg: { rating: true }, _count: true }),
    prisma.review.count({ where: { ...where, matchedPhotos: true } }),
    prisma.review.count({ where: { ...where, priceAsStated: true } }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PUBLIC_REVIEW_LIMIT,
      select: {
        id: true,
        rating: true,
        comment: true,
        matchedPhotos: true,
        priceAsStated: true,
        landlordResponse: true,
        respondedAt: true,
        createdAt: true,
        reviewer: { select: { fullName: true } },
      },
    }),
  ]);

  const count = aggregate._count;
  return {
    count,
    average: count ? Math.round((aggregate._avg.rating ?? 0) * 10) / 10 : null,
    matchedPhotosPercent: count ? Math.round((matched / count) * 100) : null,
    priceAsStatedPercent: count ? Math.round((priced / count) * 100) : null,
    items: items.map(({ reviewer, ...item }) => ({ ...item, reviewerName: displayName(reviewer.fullName) })),
  };
}

// For the cards on the marketplace: just the average and count per listing.
export async function ratingsFor(propertyIds: string[]) {
  if (propertyIds.length === 0) return new Map<string, { average: number; count: number }>();
  const rows = await prisma.review.groupBy({
    by: ["propertyId"],
    where: { propertyId: { in: propertyIds }, removedAt: null },
    _avg: { rating: true },
    _count: true,
  });
  return new Map(
    rows.map((row) => [row.propertyId, { average: Math.round((row._avg.rating ?? 0) * 10) / 10, count: row._count }]),
  );
}

// --- Landlord ---

async function assertOwns(landlordId: string, propertyId: string) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, landlordId }, select: { id: true } });
  if (!property) {
    throw new AppError(404, "Property not found", "NOT_FOUND");
  }
}

export async function listForLandlord(landlordId: string, propertyId: string) {
  await assertOwns(landlordId, propertyId);
  const rows = await prisma.review.findMany({
    where: { propertyId, removedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      rating: true,
      comment: true,
      matchedPhotos: true,
      priceAsStated: true,
      landlordResponse: true,
      respondedAt: true,
      createdAt: true,
      reviewer: { select: { fullName: true } },
    },
  });
  return rows.map(({ reviewer, ...row }) => ({ ...row, reviewerName: displayName(reviewer.fullName) }));
}

// A landlord can answer a review, once or again, but never delete it.
export async function respond(landlordId: string, propertyId: string, reviewId: string, response: string) {
  await assertOwns(landlordId, propertyId);
  const { count } = await prisma.review.updateMany({
    where: { id: reviewId, propertyId, removedAt: null },
    data: { landlordResponse: response, respondedAt: new Date() },
  });
  if (count === 0) {
    throw new AppError(404, "Review not found", "NOT_FOUND");
  }
}

// --- Admin ---

export async function listForAdmin(propertyId: string) {
  const rows = await prisma.review.findMany({
    where: { propertyId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      rating: true,
      comment: true,
      removedAt: true,
      createdAt: true,
      reviewer: { select: { id: true, fullName: true } },
    },
  });
  return rows;
}

// For abusive or false reviews. Kept in the database (hidden), not erased.
export async function removeAsAdmin(reviewId: string) {
  const { count } = await prisma.review.updateMany({ where: { id: reviewId, removedAt: null }, data: { removedAt: new Date() } });
  if (count === 0) {
    throw new AppError(404, "Review not found", "NOT_FOUND");
  }
}
