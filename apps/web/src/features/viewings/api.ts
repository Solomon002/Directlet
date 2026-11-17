import { api } from "../../lib/api";
import type { InspectionStatus } from "../inspections/api";

export type Viewing = {
  id: string;
  status: InspectionStatus;
  message: string | null;
  preferredDate: string | null;
  scheduledFor: string | null;
  rescheduleCount: number;
  landlordNote: string | null;
  createdAt: string;
  unit: { id: string; label: string; property: { id: string; name: string; area: string; city: string } };
  rent: {
    current: { amount: string; frequency: string };
    // Present only when the rent has changed since they asked: what it was then.
    askedAt: { amount: string; frequency: string } | null;
  };
  canCancel: boolean;
  canReportNoShow: boolean;
};

export async function listMyViewings() {
  const res = await api.get<{ viewings: Viewing[] }>("/viewings");
  return res.data.viewings;
}

export async function cancelViewing(id: string) {
  await api.post(`/viewings/${id}/cancel`);
}

export async function reportLandlordNoShow(id: string) {
  await api.post(`/viewings/${id}/report-no-show`);
}
