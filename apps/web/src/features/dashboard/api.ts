import { api } from "../../lib/api";

export type DashboardTotals = {
  collected: string;
  collectedThisYear: string;
  outstanding: string;
  overdue: string;
  pendingPayments: { count: number; amount: string };
  properties: number;
  units: number;
  occupiedUnits: number;
  vacantUnits: number;
  openComplaints: number;
  pendingInspections: number;
};

export type Reminder = {
  rentChargeId: string;
  tenancyId: string;
  kind: "OVERDUE" | "DUE_SOON";
  dueDate: string;
  daysUntilDue: number;
  balance: string;
  propertyName: string;
  unitLabel: string;
  tenantName: string;
};

export type ActivityEntry = {
  id: string;
  method: string;
  path: string;
  entity: string | null;
  entityId: string | null;
  createdAt: string;
  user: { id: string; fullName: string; role: "LANDLORD" | "TENANT" } | null;
};

export async function getDashboardTotals() {
  const res = await api.get<{ totals: DashboardTotals }>("/dashboard");
  return res.data.totals;
}

export async function listActivity() {
  const res = await api.get<{ activity: ActivityEntry[] }>("/dashboard/activity");
  return res.data.activity;
}

export async function listReminders() {
  const res = await api.get<{ reminders: Reminder[] }>("/reminders");
  return res.data.reminders;
}

export function describeReminder(reminder: Reminder) {
  if (reminder.kind === "OVERDUE") {
    const days = -reminder.daysUntilDue;
    return `Overdue by ${days} day${days === 1 ? "" : "s"}`;
  }
  if (reminder.daysUntilDue === 0) return "Due today";
  return `Due in ${reminder.daysUntilDue} day${reminder.daysUntilDue === 1 ? "" : "s"}`;
}

const ACTION_LABELS: Record<string, string> = {
  "POST /properties": "added a property",
  "PATCH /properties/:id": "edited a property",
  "DELETE /properties/:id": "deleted a property",
  "POST /properties/:id/units": "added a unit",
  "PATCH /properties/:id/units/:id": "edited a unit",
  "DELETE /properties/:id/units/:id": "deleted a unit",
  "POST /tenancies": "created a tenancy",
  "POST /tenancies/:id/end": "ended a tenancy",
  "POST /payments": "recorded a payment",
  "POST /payments/:id/confirm": "confirmed a payment",
  "POST /payments/:id/reject": "rejected a payment",
  "POST /payments/:id/proof": "uploaded proof of payment",
  "POST /complaints": "filed a complaint",
  "POST /complaints/:id/status": "updated a complaint",
  "POST /inspections/:id/schedule": "scheduled a viewing",
  "POST /inspections/:id/decline": "declined a viewing",
  "POST /inspections/:id/complete": "completed a viewing",
  "POST /inspections/:id/convert": "converted a viewing to a tenancy",
};

export function describeActivity(entry: ActivityEntry) {
  const key = `${entry.method} ${entry.path}`;
  return ACTION_LABELS[key] ?? `${entry.method} ${entry.path}`;
}
