import { useEffect, useState, type FormEvent } from "react";
import { getMyTenancyAsTenant, type Tenancy } from "../../features/tenancies/api";
import {
  listPayments,
  recordPayment,
  downloadReceipt,
  type Payment,
  type PaymentMethod,
} from "../../features/payments/api";
import { parseApiError } from "../../lib/errors";

export default function TenantHome() {
  const [tenancy, setTenancy] = useState<Tenancy | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [paidAt, setPaidAt] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    try {
      const [myTenancy, myPayments] = await Promise.all([getMyTenancyAsTenant(), listPayments()]);
      setTenancy(myTenancy);
      setPayments(myPayments);
    } catch (err) {
      setLoadError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const outstanding =
    tenancy?.rentCharges?.reduce(
      (sum, charge) => sum + (Number(charge.amount) - Number(charge.amountPaid)),
      0,
    ) ?? 0;

  async function handleRecordPayment(e: FormEvent) {
    e.preventDefault();
    if (!tenancy) return;
    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      await recordPayment({
        tenancyId: tenancy.id,
        amount: Number(amount),
        method,
        paidAt: paidAt || new Date().toISOString().slice(0, 10),
        reference: reference || undefined,
      });
      setFormSuccess("Payment recorded. Your landlord will confirm it once received.");
      setAmount("");
      setReference("");
      setPaidAt("");
      setPayments(await listPayments());
    } catch (err) {
      setFormError(parseApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload(payment: Payment) {
    if (!payment.receipt) return;
    try {
      await downloadReceipt(payment.id, payment.receipt.receiptNumber);
    } catch (err) {
      setLoadError(parseApiError(err).message);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-ink">Loading...</p>
      </div>
    );
  }

  if (!tenancy) {
    return (
      <div className="p-8">
        <h1 className="font-display text-2xl font-extrabold text-night-blue">Welcome back</h1>
        <p className="mt-2 text-ink">
          {loadError ?? "You do not have an active tenancy yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">
        {tenancy.unit?.property.name} ({tenancy.unit?.label})
      </h1>
      <p className="mt-1 text-ink">
        NGN {Number(tenancy.rentAmount).toLocaleString()} / {tenancy.rentFrequency.toLowerCase()}
      </p>
      <p className="mt-1 font-bold text-ink">Outstanding: NGN {outstanding.toLocaleString()}</p>

      <div className="mt-8 max-w-md rounded-xl bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-extrabold text-night-blue">Record a payment</h2>
        <form onSubmit={handleRecordPayment} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Amount (NGN)
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Method
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
            >
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CASH">Cash</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Date paid
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              required
              className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Reference <span className="font-normal text-ink/60">(optional)</span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
            />
          </label>

          {formError && <p className="text-sm font-bold text-red-600">{formError}</p>}
          {formSuccess && <p className="text-sm font-bold text-direct-green">{formSuccess}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-xl bg-trust-blue px-5 py-3 font-display font-extrabold text-white disabled:opacity-60"
          >
            {submitting ? "Recording..." : "Record payment"}
          </button>
        </form>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-extrabold text-night-blue">Payment history</h2>
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
              </p>
              {payment.rejectionReason && (
                <p className="mt-1 text-sm text-red-600">Reason: {payment.rejectionReason}</p>
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
