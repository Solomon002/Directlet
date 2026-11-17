import { createHash } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { detectContentType } from "../../lib/fileTypes";
import { AppError } from "../../utils/AppError";

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const MAX_PHOTOS_PER_PROPERTY = 12;
export const PHOTO_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];

// The listing never carries the picture itself; only /public/photos/:id does.
const photoSummary = { id: true, unitId: true, position: true, sizeBytes: true, createdAt: true } as const;

async function assertOwnsProperty(landlordId: string, propertyId: string) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, landlordId }, select: { id: true } });
  if (!property) {
    throw new AppError(404, "Property not found", "NOT_FOUND");
  }
}

export async function listPhotos(landlordId: string, propertyId: string) {
  await assertOwnsProperty(landlordId, propertyId);
  return prisma.propertyPhoto.findMany({
    where: { propertyId },
    orderBy: { position: "asc" },
    select: photoSummary,
  });
}

export async function addPhoto(landlordId: string, propertyId: string, unitId: string | undefined, data: Buffer) {
  await assertOwnsProperty(landlordId, propertyId);

  if (unitId) {
    const unit = await prisma.unit.findFirst({ where: { id: unitId, propertyId }, select: { id: true } });
    if (!unit) {
      throw new AppError(404, "Flat not found on this property", "NOT_FOUND");
    }
  }

  // Judged by the file's first bytes, not the type the browser claimed. A PDF is a
  // valid upload elsewhere, but not a photo.
  const contentType = detectContentType(data);
  if (!contentType || !PHOTO_CONTENT_TYPES.includes(contentType)) {
    throw new AppError(415, "Upload a JPG, PNG or WebP picture", "UNSUPPORTED_FILE_TYPE");
  }

  const existing = await prisma.propertyPhoto.aggregate({
    where: { propertyId },
    _count: true,
    _max: { position: true },
  });
  if (existing._count >= MAX_PHOTOS_PER_PROPERTY) {
    throw new AppError(
      409,
      `You can add up to ${MAX_PHOTOS_PER_PROPERTY} photos per property. Remove one first.`,
      "TOO_MANY_PHOTOS",
    );
  }

  const contentHash = createHash("sha256").update(data).digest("hex");
  const duplicate = await prisma.propertyPhoto.findFirst({
    where: { contentHash },
    select: { property: { select: { landlordId: true } }, propertyId: true },
  });
  if (duplicate && duplicate.property.landlordId !== landlordId) {
    throw new AppError(
      409,
      "This exact picture is already used on another landlord's listing. Upload your own photos of this property.",
      "PHOTO_IN_USE",
    );
  }
  if (duplicate?.propertyId === propertyId) {
    throw new AppError(409, "You already added this picture to this property", "DUPLICATE_PHOTO");
  }

  // Copying into a plain Uint8Array gives Prisma the ArrayBuffer-backed bytes it expects.
  const bytes = new Uint8Array(data);
  return prisma.propertyPhoto.create({
    data: {
      propertyId,
      unitId: unitId ?? null,
      position: (existing._max.position ?? -1) + 1,
      contentType,
      sizeBytes: bytes.length,
      contentHash,
      data: bytes,
    },
    select: photoSummary,
  });
}

export async function removePhoto(landlordId: string, propertyId: string, photoId: string) {
  await assertOwnsProperty(landlordId, propertyId);
  const { count } = await prisma.propertyPhoto.deleteMany({ where: { id: photoId, propertyId } });
  if (count === 0) {
    throw new AppError(404, "Photo not found", "NOT_FOUND");
  }
}

// The cover is whichever photo comes first, so making one the cover puts it in front.
export async function makeCover(landlordId: string, propertyId: string, photoId: string) {
  await assertOwnsProperty(landlordId, propertyId);
  const photo = await prisma.propertyPhoto.findFirst({ where: { id: photoId, propertyId }, select: { id: true } });
  if (!photo) {
    throw new AppError(404, "Photo not found", "NOT_FOUND");
  }
  const first = await prisma.propertyPhoto.aggregate({ where: { propertyId }, _min: { position: true } });
  await prisma.propertyPhoto.update({
    where: { id: photoId },
    data: { position: (first._min.position ?? 0) - 1 },
  });
}

// What a visitor's browser asks for. Photos of a listing an admin took down, or of a
// suspended landlord, stop being served. The id is random, so a landlord's own
// unlisted property can still show its pictures to them.
export async function getPublicPhoto(photoId: string) {
  const photo = await prisma.propertyPhoto.findFirst({
    where: { id: photoId, property: { hiddenByAdminAt: null, landlord: { suspendedAt: null } } },
    select: { contentType: true, data: true },
  });
  if (!photo) {
    throw new AppError(404, "Photo not found", "NOT_FOUND");
  }
  return photo;
}
