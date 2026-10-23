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
  _count?: { units: number };
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
};

export type UnitInput = {
  label: string;
  bedrooms: number;
  bathrooms?: number;
  rentAmount: number;
  rentFrequency?: string;
  description?: string;
};

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

export async function createUnit(
  propertyId: string,
  input: {
    label: string;
    bedrooms: number;
    bathrooms?: number;
    rentAmount: number;
    rentFrequency?: string;
    description?: string;
  },
) {
  const res = await api.post<{ unit: Unit }>(`/properties/${propertyId}/units`, input);
  return res.data.unit;
}
