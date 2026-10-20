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
