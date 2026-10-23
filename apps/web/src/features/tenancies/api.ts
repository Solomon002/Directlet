import { api } from "../../lib/api";

export type Tenancy = {
  id: string;
  unitId: string;
  tenantId: string;
  rentAmount: string;
  rentFrequency: string;
  startDate: string;
  rentExpiryDate: string | null;
  status: "ACTIVE" | "ENDED";
  endedAt: string | null;
  unit?: {
    id: string;
    label: string;
    property: { id: string; name: string };
  };
  tenant?: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
  };
  rentCharges?: {
    id: string;
    periodStart: string;
    periodEnd: string;
    dueDate: string;
    amount: string;
    amountPaid: string;
  }[];
};

export async function listMyTenancies() {
  const res = await api.get<{ tenancies: Tenancy[] }>("/tenancies");
  return res.data.tenancies;
}

export async function getMyTenancy(tenancyId: string) {
  const res = await api.get<{ tenancy: Tenancy }>(`/tenancies/${tenancyId}`);
  return res.data.tenancy;
}

export async function createTenancy(input: {
  unitId: string;
  tenantEmail: string;
  tenantFullName: string;
  tenantPhone?: string;
  startDate: string;
}) {
  const res = await api.post<{
    tenancy: Tenancy;
    tenant: { id: string; email: string; fullName: string };
    inviteLink: string | null;
  }>("/tenancies", input);
  return res.data;
}

export async function endTenancy(tenancyId: string) {
  const res = await api.post<{ tenancy: Tenancy }>(`/tenancies/${tenancyId}/end`);
  return res.data.tenancy;
}

export async function getMyTenancyAsTenant() {
  const res = await api.get<{ tenancy: Tenancy }>("/tenancies/mine");
  return res.data.tenancy;
}
