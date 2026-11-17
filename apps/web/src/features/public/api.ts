import { api } from "../../lib/api";
import { API_URL } from "../../lib/authApi";

// A picture is a plain image address, so <img> can load it and browsers cache it.
export function photoUrl(photoId: string) {
  return `${API_URL}/public/photos/${photoId}`;
}

export type PublicUnit = {
  id: string;
  label: string;
  bedrooms: number;
  bathrooms: number | null;
  rentAmount: string;
  rentFrequency: string;
  description: string | null;
  // AVAILABLE can be viewed now. UNCONFIRMED is vacant, but the landlord has not
  // vouched for it lately. LET has a tenant.
  availability: "AVAILABLE" | "UNCONFIRMED" | "LET";
  isVacant: boolean;
  availabilityConfirmedDaysAgo: number;
  availableFrom: string | null;
  fees: { key: string; label: string; amount: string | null }[];
  unstatedFees: string[];
  // Rent plus every fee the landlord has stated: the first payment.
  moveInTotal: string;
};

export type PublicReviews = {
  count: number;
  average: number | null;
  matchedPhotosPercent: number | null;
  priceAsStatedPercent: number | null;
  items: {
    id: string;
    rating: number;
    comment: string | null;
    matchedPhotos: boolean;
    priceAsStated: boolean;
    landlordResponse: string | null;
    respondedAt: string | null;
    createdAt: string;
    reviewerName: string;
  }[];
};

export type PublicLandlord =
  | { verified: false }
  | {
      verified: true;
      landlordType: "INDIVIDUAL" | "COMPANY";
      verifiedAt: string | null;
      // Companies only.
      cacType?: "RC" | "BN" | "IT" | null;
      cacNumber?: string | null;
      registeredName?: string | null;
    };

export type PublicProperty = {
  id: string;
  name: string;
  address: string;
  area: string;
  city: string;
  state: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  landlord: PublicLandlord;
  // List: average rating and count (null when there are none).
  rating?: { average: number; count: number } | null;
  // Detail: the rating summary and the latest reviews.
  reviews?: PublicReviews;
  // List: the cover and how many pictures. Detail: all of them, cover first.
  coverPhotoId?: string | null;
  photoCount?: number;
  photos?: { id: string; unitId: string | null }[];
  // Listing list only: how long ago the landlord last vouched for the flats on offer.
  availabilityConfirmedDaysAgo?: number | null;
  // Listing-card summary (list endpoint only), from the vacant flats when there
  // are any, otherwise from all flats.
  bedroomsMin?: number | null;
  bedroomsMax?: number | null;
  priceFrom?: { amount: string; frequency: string } | null;
  unitCount?: number;
  vacantUnitCount?: number;
  units?: PublicUnit[];
};

type ListResponse = {
  properties: PublicProperty[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listPublicProperties(params?: { city?: string; area?: string }) {
  const res = await api.get<ListResponse>("/public/properties", { params });
  return res.data;
}

export async function getPublicProperty(propertyId: string) {
  const res = await api.get<{ property: PublicProperty }>(`/public/properties/${propertyId}`);
  return res.data.property;
}
