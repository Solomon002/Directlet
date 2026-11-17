import { api } from "../../lib/api";

export type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type LandlordType = "INDIVIDUAL" | "COMPANY";
export type CacType = "RC" | "BN" | "IT";
export type DocKind = "ID" | "OWNERSHIP" | "CAC_CERTIFICATE";

export const docKindLabels: Record<DocKind, string> = {
  ID: "Government ID",
  OWNERSHIP: "Proof you may rent the property out",
  CAC_CERTIFICATE: "CAC certificate",
};

export const docKindHelp: Record<DocKind, string> = {
  ID: "National ID, driver's licence, international passport or voter's card.",
  OWNERSHIP: "Title document, deed of assignment, tenancy agreement with permission to sublet, or a letter from the owner.",
  CAC_CERTIFICATE: "Your certificate of incorporation or business name registration.",
};

export type VerificationDocument = {
  id: string;
  kind: DocKind;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};

export type Verification = {
  id: string;
  status: VerificationStatus;
  landlordType: LandlordType;
  cacType: CacType | null;
  cacNumber: string | null;
  registeredName: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  documents: VerificationDocument[];
  missingDocuments: DocKind[];
};

export type VerificationInput = {
  landlordType: LandlordType;
  cacType?: CacType;
  cacNumber?: string;
  registeredName?: string;
};

export const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;
export const ACCEPTED_DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export async function getMyVerification() {
  const res = await api.get<{ verification: Verification | null }>("/verification");
  return res.data.verification;
}

export async function submitVerification(input: VerificationInput) {
  const res = await api.post<{ verification: Verification }>("/verification", input);
  return res.data.verification;
}

export async function uploadDocument(kind: DocKind, file: File) {
  const res = await api.post<{ document: VerificationDocument }>("/verification/documents", file, {
    params: { kind, name: file.name },
    headers: { "Content-Type": file.type },
  });
  return res.data.document;
}

export async function deleteDocument(documentId: string) {
  await api.delete(`/verification/documents/${documentId}`);
}

// Documents need the sign-in token, so a plain link cannot open them. This fetches
// the file and shows it in a new tab. The tab is opened first, on the click, because
// browsers block a tab that is opened later from asynchronous code.
export async function openDocument(documentId: string) {
  const tab = window.open("", "_blank");
  try {
    const res = await api.get<Blob>(`/verification/documents/${documentId}`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    if (tab) tab.location.href = url;
    // The tab needs the address for a moment while it loads.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

// --- Admin ---

export type AdminVerificationRow = {
  id: string;
  status: VerificationStatus;
  landlordType: LandlordType;
  cacType: CacType | null;
  cacNumber: string | null;
  registeredName: string | null;
  submittedAt: string;
  user: { id: string; fullName: string; email: string };
  documentCount: number;
  missingDocuments: DocKind[];
};

export type AdminVerificationDetail = Verification & {
  reviewer: { fullName: string } | null;
  user: { id: string; fullName: string; email: string; phone: string | null; createdAt: string; _count: { properties: number } };
};

export async function adminListVerifications(params: { status?: VerificationStatus; page: number }) {
  const res = await api.get<{
    verifications: AdminVerificationRow[];
    total: number;
    pending: number;
    page: number;
    pageSize: number;
  }>("/admin/verifications", { params });
  return res.data;
}

export async function adminGetVerification(id: string) {
  const res = await api.get<{ verification: AdminVerificationDetail }>(`/admin/verifications/${id}`);
  return res.data.verification;
}

export async function adminApprove(id: string) {
  await api.post(`/admin/verifications/${id}/approve`);
}

export async function adminReject(id: string, reason: string) {
  await api.post(`/admin/verifications/${id}/reject`, { reason });
}
