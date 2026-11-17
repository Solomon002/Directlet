import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router";
import { createReport, reportReasons, type ReportReason } from "./api";
import { parseApiError } from "../../lib/errors";
import { useAuthStore } from "../../stores/authStore";

// "Report this listing": for fakes, stolen photos, requests for money, wrong prices.
// Several reports from different people pause the listing until a person checks it.
export default function ReportListing({ propertyId }: { propertyId: string }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Staff review reports in the admin panel; a landlord reporting their own listing makes no sense.
  if (user?.role === "ADMIN") return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      await createReport(propertyId, reason, details.trim() || undefined);
      setSent(true);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <p className="mt-8 max-w-2xl rounded-xl border-l-4 border-direct-green bg-white p-3 text-sm text-ink shadow-sm">
        <span className="font-bold text-night-blue">Thank you.</span> We will look at this listing. If other people report
        it too, it is paused until we have checked.
      </p>
    );
  }

  return (
    <div className="mt-8 max-w-2xl text-sm">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="font-bold text-red-600 hover:underline">
          Report this listing
        </button>
      ) : !user ? (
        <p className="rounded-xl bg-white p-3 text-ink shadow-sm">
          <Link to="/login" state={{ from: { pathname: location.pathname } }} className="font-bold text-trust-blue hover:underline">
            Log in
          </Link>{" "}
          to report a listing, so reports come from real people.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
          <p className="font-bold text-night-blue">What is wrong with this listing?</p>
          <label className="flex flex-col gap-1 font-bold text-ink">
            Reason
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              required
              className="w-full rounded-lg border border-mist bg-white p-3 font-sans font-normal text-ink focus:border-trust-blue focus:outline-none focus:ring-2 focus:ring-trust-blue"
            >
              <option value="">Choose one</option>
              {reportReasons.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-bold text-ink">
            What happened? <span className="font-normal text-ink/60">(optional)</span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-lg border border-mist p-3 font-sans font-normal text-ink focus:border-trust-blue focus:outline-none focus:ring-2 focus:ring-trust-blue"
            />
          </label>
          {error && (
            <p role="alert" className="font-bold text-red-600">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting || !reason}
              className="rounded-lg bg-red-600 px-5 py-2.5 font-display font-extrabold text-white disabled:opacity-60"
            >
              {submitting ? "Sending..." : "Send report"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="font-bold text-ink/70 hover:underline">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
