import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { getMyTenancy, type Tenancy } from "../../features/tenancies/api";
import {
  listPayments,
  confirmPayment,
  rejectPayment,
  downloadReceipt,
  type Payment,
} from "../../features/payments/api";
import {
  listComplaints,
  updateComplaintStatus,
  type Complaint,
  type ComplaintStatus,
} from "../../features/complaints/api";
import { parseApiError } from "../../lib/errors";

export default function TenancyDetail() {
  const { tenancyId } = useParams<{ tenancyId: string }>();
  const [tenancy, setTenancy] = useState<Tenancy | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [rejectReasonDraft, setRejectReasonDraft] = useState<Record<string, string>>({});

  const [complaintActionError, setComplaintActionError] = useState<string | null>(null);
  const [complaintActingOnId, setComplaintActingOnId] = useState<string | null>(null);
  const [complaintStatusDraft, setComplaintStatusDraft] = useState<Record<string, ComplaintStatus>>({});
  const [complaintNoteDraft, setComplaintNoteDraft] = useState<Record<string, string>>({});

  async function loadData() {
    if (!tenancyId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [myTenancy, allPayments, allComplaints] = await Promise.all([
        getMyTenancy(tenancyId),
        listPayments(),
        listComplaints(),
      ]);
      setTenancy(myTenancy);
      setPayments(allPayments.filter((payment) => payment.tenancyId === tenancyId));
      setComplaints(allComplaints.filter((complaint) => complaint.tenancyId === tenancyId));
    } catch (err) {
      setLoadError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [tenancyId]);

  async function handleConfirm(paymentId: string) {
    setActingOnId(paymentId);
    setActionError(null);
    try {
      await confirmPayment(paymentId);
      await loadData();
    } catch (err) {
      setActionError(parseApiError(err).message);
    } finally {
      setActingOnId(null);
    }
  }

  async function handleReject(paymentId: string) {
    setActingOnId(paymentId);
    setActionError(null);
    try {
      await rejectPayment(paymentId, rejectReasonDraft[paymentId] || undefined);
      await loadData();
    } catch (err) {
      setActionError(parseApiError(err).message);
    } finally {
      setActingOnId(null);
    }
  }

  async function handleDownload(payment: Payment) {
    if (!payment.receipt) return;
    try {
      await downloadReceipt(payment.id, payment.receipt.receiptNumber);
    } catch (err) {
      setActionError(parseApiError(err).message);
    }
  }

  async function handleUpdateComplaintStatus(complaint: Complaint) {
    setComplaintActingOnId(complaint.id);
    setComplaintActionError(null);
    try {
      await updateComplaintStatus(complaint.id, {
        status: complaintStatusDraft[complaint.id] ?? complaint.status,
        landlordNote: complaintNoteDraft[complaint.id] || undefined,
      });
      await loadData();
    } catch (err) {
      setComplaintActionError(parseApiError(err).message);
    } finally {
      setComplaintActingOnId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-ink">Loading...</p>
      </div>
    );
  }

  if (loadError || !tenancy) {
    return (
      <div className="p-8">
        <Link to="/landlord/tenancies" className="text-sm font-bold text-trust-blue">
          Back to tenancies
        </Link>
        <p className="mt-4 text-sm font-bold text-red-600">{loadError ?? "Tenancy not found"}</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <Link to="/landlord/tenancies" className="text-sm font-bold text-trust-blue">
        Back to tenancies
      </Link>

      <h1 className="mt-4 font-display text-2xl font-extrabold text-night-blue">
        {tenancy.tenant?.fullName} - {tenancy.unit?.property.name} ({tenancy.unit?.label})
      </h1>
      <p className="mt-1 text-ink">{tenancy.tenant?.email}</p>
      <p className="mt-1 text-ink">
        NGN {Number(tenancy.rentAmount).toLocaleString()} / {tenancy.rentFrequency.toLowerCase()} - {tenancy.status}
      </p>

      <div className="mt-8">
        <h2 className="font-display text-lg font-extrabold text-night-blue">Rent charges</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {tenancy.rentCharges?.map((charge) => (
            <li key={charge.id} className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-ink">
                {new Date(charge.periodStart).toDateString()} to {new Date(charge.periodEnd).toDateString()}
              </p>
              <p className="font-display font-extrabold text-night-blue">
                NGN {Number(charge.amountPaid).toLocaleString()} / {Number(charge.amount).toLocaleString()} paid
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-extrabold text-night-blue">Payments</h2>
        {actionError && <p className="mt-2 text-sm font-bold text-red-600">{actionError}</p>}
        {payments.length === 0 && <p className="mt-2 text-ink">No payments recorded yet.</p>}
        <ul className="mt-3 flex flex-col gap-3">
          {payments.map((payment) => (
            <li key={payment.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-display font-extrabold text-night-blue">
                  NGN {Number(payment.amount).toLocaleString()}
                </p>
                <span
                  className={
                    payment.status === "CONFIRMED"
                      ? "text-sm font-bold text-direct-green"
                      : payment.status === "REJECTED"
                        ? "text-sm font-bold text-red-600"
                        : "text-sm font-bold text-ink/60"
                  }
                >
                  {payment.status}
                </span>
              </div>
              <p className="text-sm text-ink">
                {payment.method.replace("_", " ")} - {new Date(payment.paidAt).toDateString()}
                {payment.reference ? ` - Ref: ${payment.reference}` : ""}
              </p>

              {payment.status === "PENDING" && (
                <div className="mt-3 flex flex-col gap-2">
                  <input
                    placeholder="Rejection reason (optional)"
                    value={rejectReasonDraft[payment.id] ?? ""}
                    onChange={(e) =>
                      setRejectReasonDraft((prev) => ({ ...prev, [payment.id]: e.target.value }))
                    }
                    className="rounded-lg border border-mist px-3 py-2 font-sans text-sm text-ink"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={actingOnId === payment.id}
                      onClick={() => void handleConfirm(payment.id)}
                      className="rounded-xl bg-direct-green px-4 py-2 font-display font-extrabold text-white disabled:opacity-60"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={actingOnId === payment.id}
                      onClick={() => void handleReject(payment.id)}
                      className="rounded-xl bg-red-600 px-4 py-2 font-display font-extrabold text-white disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {payment.rejectionReason && (
                <p className="mt-2 text-sm text-red-600">Reason: {payment.rejectionReason}</p>
              )}

              {payment.receipt && (
                <button
                  type="button"
                  onClick={() => void handleDownload(payment)}
                  className="mt-2 text-sm font-bold text-trust-blue hover:underline"
                >
                  Download receipt
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-extrabold text-night-blue">Complaints</h2>
        {complaintActionError && (
          <p className="mt-2 text-sm font-bold text-red-600">{complaintActionError}</p>
        )}
        {complaints.length === 0 && <p className="mt-2 text-ink">No complaints filed yet.</p>}
        <ul className="mt-3 flex flex-col gap-3">
          {complaints.map((complaint) => (
            <li key={complaint.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-display font-extrabold text-night-blue">{complaint.title}</p>
                <span
                  className={
                    complaint.status === "RESOLVED"
                      ? "text-sm font-bold text-direct-green"
                      : complaint.status === "IN_PROGRESS"
                        ? "text-sm font-bold text-trust-blue"
                        : "text-sm font-bold text-ink/60"
                  }
                >
                  {complaint.status.replace("_", " ")}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink">{complaint.description}</p>
              {complaint.landlordNote && (
                <p className="mt-1 text-sm text-ink">Note: {complaint.landlordNote}</p>
              )}

              <div className="mt-3 flex flex-col gap-2">
                <select
                  value={complaintStatusDraft[complaint.id] ?? complaint.status}
                  onChange={(e) =>
                    setComplaintStatusDraft((prev) => ({
                      ...prev,
                      [complaint.id]: e.target.value as ComplaintStatus,
                    }))
                  }
                  className="rounded-lg border border-mist px-3 py-2 font-sans text-sm text-ink"
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
                <input
                  placeholder="Note (optional)"
                  value={complaintNoteDraft[complaint.id] ?? ""}
                  onChange={(e) =>
                    setComplaintNoteDraft((prev) => ({ ...prev, [complaint.id]: e.target.value }))
                  }
                  className="rounded-lg border border-mist px-3 py-2 font-sans text-sm text-ink"
                />
                <button
                  type="button"
                  disabled={complaintActingOnId === complaint.id}
                  onClick={() => void handleUpdateComplaintStatus(complaint)}
                  className="rounded-xl bg-trust-blue px-4 py-2 font-display font-extrabold text-white disabled:opacity-60"
                >
                  Update status
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
