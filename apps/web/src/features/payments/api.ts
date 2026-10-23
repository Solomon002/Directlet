import { api } from "../../lib/api";

export type PaymentMethod = "BANK_TRANSFER" | "CASH" | "OTHER";
export type PaymentStatus = "PENDING" | "CONFIRMED" | "REJECTED";

export type Payment = {
  id: string;
  tenancyId: string;
  amount: string;
  method: PaymentMethod;
  paidAt: string;
  reference: string | null;
  status: PaymentStatus;
  recordedById: string;
  confirmedById: string | null;
  confirmedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  receipt?: { id: string; receiptNumber: string; issuedAt: string } | null;
  proof?: { id: string; contentType: string; sizeBytes: number; createdAt: string } | null;
  tenancy?: {
    id: string;
    unit?: { id: string; label: string; property: { id: string; name: string } };
    tenant?: { id: string; fullName: string; email: string };
  };
};

export async function listPayments() {
  const res = await api.get<{ payments: Payment[] }>("/payments");
  return res.data.payments;
}

export async function recordPayment(input: {
  tenancyId: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  reference?: string;
}) {
  const res = await api.post<{ payment: Payment }>("/payments", input);
  return res.data.payment;
}

export async function confirmPayment(paymentId: string) {
  const res = await api.post<{ payment: Payment }>(`/payments/${paymentId}/confirm`);
  return res.data.payment;
}

export async function rejectPayment(paymentId: string, rejectionReason?: string) {
  const res = await api.post<{ payment: Payment }>(`/payments/${paymentId}/reject`, { rejectionReason });
  return res.data.payment;
}

export const PROOF_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
export const PROOF_MAX_BYTES = 2 * 1024 * 1024;

// Returns an error message, or null when the file is fine to upload.
export function checkProofFile(file: File): string | null {
  if (!PROOF_ACCEPT.split(",").includes(file.type)) return "Upload a JPG, PNG, WebP image or a PDF";
  if (file.size > PROOF_MAX_BYTES) return "That file is over 2 MB. Try a screenshot instead.";
  return null;
}

export async function uploadProof(paymentId: string, file: File) {
  const res = await api.post(`/payments/${paymentId}/proof`, file, {
    headers: { "Content-Type": file.type },
  });
  return res.data;
}

// Opens the tab before the download starts, so popup blockers allow it.
export async function openProof(paymentId: string) {
  const tab = window.open("", "_blank");
  try {
    const res = await api.get(`/payments/${paymentId}/proof`, { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data as Blob);
    if (tab) {
      tab.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (err) {
    tab?.close();
    throw err;
  }
}

export async function downloadReceipt(paymentId: string, receiptNumber: string) {
  const res = await api.get(`/payments/${paymentId}/receipt`, { responseType: "blob" });
  const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${receiptNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
