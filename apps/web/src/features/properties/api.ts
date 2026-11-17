import { api } from "../../lib/api";

export type Unit = {
  id: string;
  propertyId: string;
  label: string;
  bedrooms: number;
  bathrooms: number | null;
  rentAmount: string;
  rentFrequency: string;
  description: string | null;
  // One-off costs on top of the rent. null = not stated yet.
  cautionDeposit: string | null;
  agreementFee: string | null;
  serviceCharge: string | null;
  agencyFee: string | null;
  availableFrom: string | null;
  availabilityConfirmedAt: string;
  // CONFIRMED: recent. DUE: asks the landlord to confirm. STALE: hidden from viewings.
  availability: { state: "CONFIRMED" | "DUE" | "STALE"; daysSinceConfirmed: number };
  // Whether a tenant lives there now (single-property endpoint only).
  occupied?: boolean;
};

export type Property = {
  id: string;
  name: string;
  address: string;
  area: string;
  city: string;
  state: string;
  description: string | null;
  isPublic: boolean;
  latitude: number | null;
  longitude: number | null;
  hiddenByAdminAt?: string | null;
  hiddenByAdminReason?: string | null;
  _count?: { units: number };
  // List endpoint only: vacant flats whose "still available" is due or has lapsed.
  needsConfirmation?: number;
  unconfirmed?: number;
  units?: Unit[];
};

export async function listMyProperties() {
  const res = await api.get<{ properties: Property[] }>("/properties");
  return res.data.properties;
}

export async function getMyProperty(propertyId: string) {
  const res = await api.get<{ property: Property }>(`/properties/${propertyId}`);
  return res.data.property;
}

export async function createProperty(input: {
  name: string;
  address: string;
  area: string;
  city: string;
  state: string;
  description?: string;
  isPublic?: boolean;
}) {
  const res = await api.post<{ property: Property }>("/properties", input);
  return res.data.property;
}

export type PropertyInput = {
  name: string;
  address: string;
  area: string;
  city: string;
  state: string;
  description?: string;
  isPublic?: boolean;
  latitude?: number | null;
  longitude?: number | null;
};

export type GeocodeResult = { label: string; latitude: number; longitude: number };

export async function geocode(query: string) {
  const res = await api.get<{ results: GeocodeResult[] }>("/properties/geocode", { params: { q: query } });
  return res.data.results;
}

export type UnitInput = {
  label: string;
  bedrooms: number;
  bathrooms?: number;
  rentAmount: number;
  rentFrequency?: string;
  description?: string;
  // null (or blank) = not stated; 0 = no such fee.
  cautionDeposit?: number | null;
  agreementFee?: number | null;
  serviceCharge?: number | null;
  agencyFee?: number | null;
  availableFrom?: string | null;
};

export type PropertyPhoto = {
  id: string;
  unitId: string | null;
  position: number;
  sizeBytes: number;
  createdAt: string;
};

export async function listPhotos(propertyId: string) {
  const res = await api.get<{ photos: PropertyPhoto[] }>(`/properties/${propertyId}/photos`);
  return res.data.photos;
}

export async function uploadPhoto(propertyId: string, file: Blob, unitId?: string) {
  const res = await api.post<{ photo: PropertyPhoto }>(`/properties/${propertyId}/photos`, file, {
    params: { unitId },
    headers: { "Content-Type": file.type },
  });
  return res.data.photo;
}

export async function deletePhoto(propertyId: string, photoId: string) {
  await api.delete(`/properties/${propertyId}/photos/${photoId}`);
}

export async function makeCoverPhoto(propertyId: string, photoId: string) {
  await api.post(`/properties/${propertyId}/photos/${photoId}/cover`);
}

export async function confirmUnit(propertyId: string, unitId: string) {
  await api.post(`/properties/${propertyId}/units/${unitId}/confirm`);
}

export async function confirmAllUnits(propertyId: string) {
  await api.post(`/properties/${propertyId}/units/confirm-all`);
}

export async function updateProperty(propertyId: string, input: Partial<PropertyInput>) {
  const res = await api.patch<{ property: Property }>(`/properties/${propertyId}`, input);
  return res.data.property;
}

export async function deleteProperty(propertyId: string) {
  await api.delete(`/properties/${propertyId}`);
}

export async function updateUnit(propertyId: string, unitId: string, input: Partial<UnitInput>) {
  const res = await api.patch<{ unit: Unit }>(`/properties/${propertyId}/units/${unitId}`, input);
  return res.data.unit;
}

export async function deleteUnit(propertyId: string, unitId: string) {
  await api.delete(`/properties/${propertyId}/units/${unitId}`);
}

export async function createUnit(propertyId: string, input: UnitInput) {
  const res = await api.post<{ unit: Unit }>(`/properties/${propertyId}/units`, input);
  return res.data.unit;
}
