import { api } from "../../lib/api";

export type PublicUnit = {
  id: string;
  label: string;
  bedrooms: number;
  bathrooms: number | null;
  rentAmount: string;
  rentFrequency: string;
  description: string | null;
  isVacant: boolean;
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
