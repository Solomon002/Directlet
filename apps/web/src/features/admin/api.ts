import { api } from "../../lib/api";
import type { UserRole } from "../../stores/authStore";

type ByRole = Partial<Record<UserRole, number>>;

export type AdminOverview = {
  users: { byRole: ByRole; suspended: number; new7d: ByRole; new30d: ByRole };
  properties: {
    total: number;
    listed: number;
    hiddenByAdmin: number;
    withMapPin: number;
    units: number;
    occupiedUnits: number;
    vacantUnits: number;
  };
  tenancies: { active: number; ended: number };
  money: {
    confirmedTotal: string;
    confirmedCount: number;
    confirmed30d: string;
    pendingAmount: string;
    pendingCount: number;
    outstanding: string;
    overdue: string;
  };
  complaints: Partial<Record<"OPEN" | "IN_PROGRESS" | "RESOLVED", number>>;
  inspections: Partial<Record<"PENDING" | "SCHEDULED" | "COMPLETED" | "DECLINED" | "CONVERTED", number>>;
  messaging: { conversations: number; messages: number; messages7d: number };
  traffic: {
    viewsToday: number;
    visitorsToday: number;
    views7d: number;
    visitors7d: number;
    views30d: number;
    visitors30d: number;
    topPages: { path: string; label: string | null; views: number }[];
    topReferrers: { referrer: string; views: number }[];
  };
  series: {
    day: string;
    views: number;
    visitors: number;
    signups: { LANDLORD: number; HUNTER: number; TENANT: number };
  }[];
};

export type AdminUserRow = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  createdAt: string;
  suspendedAt: string | null;
  activated: boolean;
  properties: number;
  tenancies: number;
  lastActiveAt: string | null;
};

export type AdminUserDetail = Omit<AdminUserRow, "properties" | "tenancies"> & {
  suspendedReason: string | null;
  inviteExpiresAt: string | null;
  messagesSent: number;
  complaintsRaised: number;
  properties: {
    id: string;
    name: string;
    area: string;
    city: string;
    isPublic: boolean;
    hiddenByAdminAt: string | null;
    _count: { units: number };
  }[];
  tenancies: {
    id: string;
    status: "ACTIVE" | "ENDED";
    startDate: string;
    rentAmount: string;
    rentFrequency: string;
    unit: { label: string; property: { id: string; name: string } };
  }[];
  recentActivity: { id: string; method: string; path: string; statusCode: number; createdAt: string }[];
};

export type AdminPropertyRow = {
  id: string;
  name: string;
  area: string;
  city: string;
  isPublic: boolean;
  hiddenByAdminAt: string | null;
  hiddenByAdminReason: string | null;
  createdAt: string;
  landlord: { id: string; fullName: string; email: string; suspendedAt: string | null };
  hasMapPin: boolean;
  units: number;
  occupiedUnits: number;
  visibleToPublic: boolean;
};

export type AdminActivityEntry = {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  entity: string | null;
  entityId: string | null;
  createdAt: string;
  user: { id: string; fullName: string; role: UserRole } | null;
};

export type Paged<K extends string, T> = { [key in K]: T[] } & { total: number; page: number; pageSize: number };

export async function getOverview() {
  const res = await api.get<{ overview: AdminOverview }>("/admin/overview");
  return res.data.overview;
}

export async function listUsers(params: { q?: string; role?: string; suspended?: boolean; page: number }) {
  const res = await api.get<Paged<"users", AdminUserRow>>("/admin/users", {
    params: { ...params, suspended: params.suspended ? "true" : undefined },
  });
  return res.data;
}

export async function getUser(userId: string) {
  const res = await api.get<{ user: AdminUserDetail }>(`/admin/users/${userId}`);
  return res.data.user;
}

export async function suspendUser(userId: string, reason?: string) {
  await api.post(`/admin/users/${userId}/suspend`, { reason });
}

export async function unsuspendUser(userId: string) {
  await api.post(`/admin/users/${userId}/unsuspend`);
}

export async function listProperties(params: { q?: string; hidden?: boolean; page: number }) {
  const res = await api.get<Paged<"properties", AdminPropertyRow>>("/admin/properties", {
    params: { ...params, hidden: params.hidden ? "true" : undefined },
  });
  return res.data;
}

export async function hideProperty(propertyId: string, reason?: string) {
  await api.post(`/admin/properties/${propertyId}/hide`, { reason });
}

export async function unhideProperty(propertyId: string) {
  await api.post(`/admin/properties/${propertyId}/unhide`);
}

export async function listActivity(params: { userId?: string; failed?: boolean; page: number }) {
  const res = await api.get<Paged<"entries", AdminActivityEntry>>("/admin/activity", {
    params: { ...params, failed: params.failed ? "true" : undefined },
  });
  return res.data;
}

export const roleNames: Record<UserRole, string> = {
  LANDLORD: "Landlord",
  TENANT: "Tenant",
  HUNTER: "House hunter",
  ADMIN: "Admin",
};
