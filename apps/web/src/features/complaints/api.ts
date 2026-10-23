import { api } from "../../lib/api";

export type ComplaintStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export type Complaint = {
  id: string;
  tenancyId: string;
  raisedById: string;
  title: string;
  description: string;
  status: ComplaintStatus;
  landlordNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tenancy?: {
    id: string;
    unit?: { id: string; label: string; property: { id: string; name: string } };
    tenant?: { id: string; fullName: string; email: string };
  };
};

export async function listComplaints() {
  const res = await api.get<{ complaints: Complaint[] }>("/complaints");
  return res.data.complaints;
}

export async function fileComplaint(input: { tenancyId: string; title: string; description: string }) {
  const res = await api.post<{ complaint: Complaint }>("/complaints", input);
  return res.data.complaint;
}

export async function updateComplaintStatus(
  complaintId: string,
  input: { status: ComplaintStatus; landlordNote?: string },
) {
  const res = await api.post<{ complaint: Complaint }>(`/complaints/${complaintId}/status`, input);
  return res.data.complaint;
}
