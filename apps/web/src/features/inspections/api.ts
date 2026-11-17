import { api } from "../../lib/api";

export type InspectionStatus =
  | "PENDING"
  | "SCHEDULED"
  | "COMPLETED"
  | "DECLINED"
  | "CONVERTED"
  | "CANCELLED"
  | "NO_SHOW_VISITOR"
  | "NO_SHOW_LANDLORD";

// Plain words for each status, for both the visitor and the landlord.
export const statusLabels: Record<InspectionStatus, string> = {
  PENDING: "Waiting for the landlord",
  SCHEDULED: "Confirmed",
  COMPLETED: "Done",
  DECLINED: "Declined",
  CONVERTED: "Became a tenancy",
  CANCELLED: "Cancelled",
  NO_SHOW_VISITOR: "Visitor did not show",
  NO_SHOW_LANDLORD: "Landlord did not show",
};

export type InspectionRequest = {
  id: string;
  unitId: string;
  name: string;
  // Hidden (null) until the landlord accepts the request.
  email: string | null;
  phone: string | null;
  contactHidden?: boolean;
  message: string | null;
  preferredDate: string | null;
  scheduledFor: string | null;
  rescheduleCount?: number;
  status: InspectionStatus;
  landlordNote: string | null;
  convertedTenancyId: string | null;
  createdAt: string;
  updatedAt: string;
  // How this visitor has done across all landlords. Null on older requests.
  visitorRecord?: { attended: number; missed: number } | null;
  canMarkNoShow?: boolean;
  unit?: {
    id: string;
    label: string;
    property: { id: string; name: string };
  };
};

// The person is signed in, so their name and email come from their account.
export async function requestInspection(
  unitId: string,
  input: { phone: string; message?: string; preferredDate?: string },
) {
  const res = await api.post<{ inspectionRequest: { id: string; status: InspectionStatus } }>(
    `/public/units/${unitId}/inspection-requests`,
    input,
  );
  return res.data.inspectionRequest;
}

export async function listInspections() {
  const res = await api.get<{ inspectionRequests: InspectionRequest[] }>("/inspections");
  return res.data.inspectionRequests;
}

export async function scheduleInspection(inspectionId: string, scheduledFor: string) {
  const res = await api.post<{ inspectionRequest: InspectionRequest }>(
    `/inspections/${inspectionId}/schedule`,
    { scheduledFor },
  );
  return res.data.inspectionRequest;
}

export async function declineInspection(inspectionId: string, landlordNote?: string) {
  const res = await api.post<{ inspectionRequest: InspectionRequest }>(
    `/inspections/${inspectionId}/decline`,
    { landlordNote },
  );
  return res.data.inspectionRequest;
}

export async function completeInspection(inspectionId: string) {
  const res = await api.post<{ inspectionRequest: InspectionRequest }>(
    `/inspections/${inspectionId}/complete`,
  );
  return res.data.inspectionRequest;
}

export async function markVisitorNoShow(inspectionId: string) {
  const res = await api.post<{ inspectionRequest: InspectionRequest }>(`/inspections/${inspectionId}/no-show`);
  return res.data.inspectionRequest;
}

export async function convertInspection(
  inspectionId: string,
  input: { tenantEmail: string; tenantFullName: string; tenantPhone?: string; startDate: string },
) {
  const res = await api.post<{
    tenancy: { id: string };
    tenant: { id: string; email: string; fullName: string };
    inviteLink: string | null;
  }>(`/inspections/${inspectionId}/convert`, input);
  return res.data;
}
