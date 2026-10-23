import { api } from "../../lib/api";

export type InspectionStatus = "PENDING" | "SCHEDULED" | "COMPLETED" | "DECLINED" | "CONVERTED";

export type InspectionRequest = {
  id: string;
  unitId: string;
  name: string;
  email: string;
  phone: string;
  message: string | null;
  preferredDate: string | null;
  scheduledFor: string | null;
  status: InspectionStatus;
  landlordNote: string | null;
  convertedTenancyId: string | null;
  createdAt: string;
  updatedAt: string;
  unit?: {
    id: string;
    label: string;
    property: { id: string; name: string };
  };
};

export async function requestInspection(
  unitId: string,
  input: { name: string; email: string; phone: string; message?: string; preferredDate?: string },
) {
  const res = await api.post<{ inspectionRequest: InspectionRequest }>(
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
