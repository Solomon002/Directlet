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
import { parseApiError } from "../../lib/errors";

export default function TenancyDetail() {
  const { tenancyId } = useParams<{ tenancyId: string }>();
  const [tenancy, setTenancy] = useState<Tenancy | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [rejectReasonDraft, setRejectReasonDraft] = useState<Record<string, string>>({});

  async function loadData() {
    if (!tenancyId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [myTenancy, allPayments] = await Promise.all([getMyTenancy(tenancyId), listPayments()]);
      setTenancy(myTenancy);
      setPayments(allPayments.filter((payment) => payment.tenancyId === tenancyId));
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
    </div>
  );
}
