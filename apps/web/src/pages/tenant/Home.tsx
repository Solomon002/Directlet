import { useEffect, useState, type FormEvent } from "react";
import { getMyTenancyAsTenant, type Tenancy } from "../../features/tenancies/api";
import {
  listPayments,
  recordPayment,
  downloadReceipt,
  uploadProof,
  openProof,
  checkProofFile,
  PROOF_ACCEPT,
  type Payment,
  type PaymentMethod,
} from "../../features/payments/api";
import { listComplaints, fileComplaint, type Complaint } from "../../features/complaints/api";
import { listReminders, describeReminder, type Reminder } from "../../features/dashboard/api";
import { parseApiError } from "../../lib/errors";
import StartConversation from "../../features/messages/StartConversation";
import { formatRent } from "../../lib/money";

export default function TenantHome() {
  const [tenancy, setTenancy] = useState<Tenancy | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [paidAt, setPaidAt] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  // Changing the key remounts the file input, which is the only way to clear it.
  const [proofInputKey, setProofInputKey] = useState(0);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [uploadingForId, setUploadingForId] = useState<string | null>(null);

  const [complaintTitle, setComplaintTitle] = useState("");
  const [complaintDescription, setComplaintDescription] = useState("");
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);
  const [complaintError, setComplaintError] = useState<string | null>(null);
  const [complaintSuccess, setComplaintSuccess] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    try {
      const [myTenancy, myPayments, myComplaints, myReminders] = await Promise.all([
        getMyTenancyAsTenant(),
        listPayments(),
        listComplaints(),
        listReminders(),
      ]);
      setTenancy(myTenancy);
      setPayments(myPayments);
      setComplaints(myComplaints);
      setReminders(myReminders);
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
    setFormError(null);
    setFormSuccess(null);

    const fileProblem = proofFile ? checkProofFile(proofFile) : null;
    if (fileProblem) {
      setFormError(fileProblem);
      return;
    }

    setSubmitting(true);
    try {
      const payment = await recordPayment({
        tenancyId: tenancy.id,
        amount: Number(amount),
        method,
        paidAt: paidAt || new Date().toISOString().slice(0, 10),
        reference: reference || undefined,
      });
      setAmount("");
      setReference("");
      setPaidAt("");

      if (proofFile) {
        try {
          await uploadProof(payment.id, proofFile);
          setFormSuccess("Payment and proof sent. Your landlord will confirm it once received.");
        } catch (err) {
          setFormError(
            `Payment recorded, but the proof did not upload: ${parseApiError(err).message} You can add it from your payment history.`,
          );
        }
      } else {
        setFormSuccess("Payment recorded. Your landlord will confirm it once received.");
      }
      setProofFile(null);
      setProofInputKey((key) => key + 1);
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
      setHistoryError(parseApiError(err).message);
    }
  }

  async function handleViewProof(payment: Payment) {
    setHistoryError(null);
    try {
      await openProof(payment.id);
    } catch (err) {
      setHistoryError(parseApiError(err).message);
    }
  }

  async function handleAddProof(payment: Payment, file: File | undefined) {
    if (!file) return;
    setHistoryError(null);
    const fileProblem = checkProofFile(file);
    if (fileProblem) {
      setHistoryError(fileProblem);
      return;
    }
    setUploadingForId(payment.id);
    try {
      await uploadProof(payment.id, file);
      setPayments(await listPayments());
    } catch (err) {
      setHistoryError(parseApiError(err).message);
    } finally {
      setUploadingForId(null);
    }
  }

  async function handleFileComplaint(e: FormEvent) {
    e.preventDefault();
    if (!tenancy) return;
    setComplaintSubmitting(true);
    setComplaintError(null);
    setComplaintSuccess(null);

    try {
      await fileComplaint({
        tenancyId: tenancy.id,
        title: complaintTitle,
        description: complaintDescription,
      });
      setComplaintSuccess("Complaint filed. Your landlord will see it on their dashboard.");
      setComplaintTitle("");
      setComplaintDescription("");
      setComplaints(await listComplaints());
    } catch (err) {
      setComplaintError(parseApiError(err).message);
    } finally {
      setComplaintSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-ink">Loading...</p>
      </div>
    );
  }

  if (!tenancy) {
    return (
      <div className="p-4 sm:p-8">
        <h1 className="font-display text-2xl font-extrabold text-night-blue">Welcome back</h1>
        <p className="mt-2 text-ink">
          {loadError ?? "You do not have an active tenancy yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">
        {tenancy.unit?.property.name} ({tenancy.unit?.label})
      </h1>
      <p className="mt-1 text-ink">
        {formatRent(tenancy.rentAmount, tenancy.rentFrequency)}
      </p>
      <p className="mt-1 font-bold text-ink">Outstanding: NGN {outstanding.toLocaleString()}</p>
      {tenancy.unit && (
        <div className="mt-2">
          <StartConversation
            target={{ propertyId: tenancy.unit.property.id, unitId: tenancy.unit.id }}
            buttonLabel="Message your landlord"
            initialText=""
          />
        </div>
      )}

      {reminders.map((reminder) => (
        <div
          key={reminder.rentChargeId}
          className={
            reminder.kind === "OVERDUE"
              ? "mt-4 max-w-md rounded-xl border-l-4 border-red-600 bg-white p-4 shadow-sm"
              : "mt-4 max-w-md rounded-xl border-l-4 border-trust-blue bg-white p-4 shadow-sm"
          }
        >
          <p className="font-display font-extrabold text-night-blue">{describeReminder(reminder)}</p>
          <p className="text-sm text-ink">
            NGN {Number(reminder.balance).toLocaleString()} for the period starting{" "}
            {new Date(reminder.dueDate).toDateString()}
          </p>
        </div>
      ))}

      <div id="pay" className="mt-8 max-w-md scroll-mt-20 rounded-xl bg-white p-6 shadow-sm">
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

          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Proof of payment <span className="font-normal text-ink/60">(screenshot or PDF, up to 2 MB)</span>
            <input
              key={proofInputKey}
              type="file"
              accept={PROOF_ACCEPT}
              onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              className="font-sans text-sm font-normal text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-mist file:px-3 file:py-2 file:font-bold file:text-night-blue"
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

      <div id="history" className="mt-8 scroll-mt-20">
        <h2 className="font-display text-lg font-extrabold text-night-blue">Payment history</h2>
        {payments.length === 0 && <p className="mt-2 text-ink">No payments recorded yet.</p>}
        {historyError && <p className="mt-2 text-sm font-bold text-red-600">{historyError}</p>}
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
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {payment.receipt && (
                  <button
                    type="button"
                    onClick={() => void handleDownload(payment)}
                    className="text-sm font-bold text-trust-blue hover:underline"
                  >
                    Download receipt
                  </button>
                )}
                {payment.proof && (
                  <button
                    type="button"
                    onClick={() => void handleViewProof(payment)}
                    className="text-sm font-bold text-trust-blue hover:underline"
                  >
                    View proof
                  </button>
                )}
                {payment.status === "PENDING" && (
                  <label className="cursor-pointer text-sm font-bold text-trust-blue hover:underline">
                    {uploadingForId === payment.id
                      ? "Uploading..."
                      : payment.proof
                        ? "Replace proof"
                        : "Add proof"}
                    <input
                      type="file"
                      accept={PROOF_ACCEPT}
                      disabled={uploadingForId === payment.id}
                      onChange={(e) => {
                        void handleAddProof(payment, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div id="complaints" className="mt-8 max-w-md scroll-mt-20 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-extrabold text-night-blue">File a complaint</h2>
        <form onSubmit={handleFileComplaint} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Title
            <input
              value={complaintTitle}
              onChange={(e) => setComplaintTitle(e.target.value)}
              required
              minLength={3}
              className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Description <span className="font-normal text-ink/60">(at least 10 characters)</span>
            <textarea
              value={complaintDescription}
              onChange={(e) => setComplaintDescription(e.target.value)}
              required
              minLength={10}
              rows={3}
              className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
            />
          </label>

          {complaintError && <p className="text-sm font-bold text-red-600">{complaintError}</p>}
          {complaintSuccess && <p className="text-sm font-bold text-direct-green">{complaintSuccess}</p>}

          <button
            type="submit"
            disabled={complaintSubmitting}
            className="mt-2 rounded-xl bg-trust-blue px-5 py-3 font-display font-extrabold text-white disabled:opacity-60"
          >
            {complaintSubmitting ? "Filing..." : "File complaint"}
          </button>
        </form>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-extrabold text-night-blue">Your complaints</h2>
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
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
