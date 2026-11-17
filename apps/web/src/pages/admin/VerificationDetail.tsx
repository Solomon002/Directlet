import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { formatDate } from "../../features/admin/ui";
import {
  adminApprove,
  adminGetVerification,
  adminReject,
  docKindLabels,
  openDocument,
  type AdminVerificationDetail,
} from "../../features/verification/api";
import { parseApiError } from "../../lib/errors";

const statusStyle = {
  PENDING: "bg-trust-blue/10 text-trust-blue",
  VERIFIED: "bg-direct-green/10 text-green-700",
  REJECTED: "bg-red-50 text-red-600",
} as const;

export default function VerificationDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AdminVerificationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  async function load() {
    if (!id) return;
    try {
      setData(await adminGetVerification(id));
      setError(null);
    } catch (err) {
      setError(parseApiError(err).message);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function handleApprove() {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      await adminApprove(data.id);
      await load();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      await adminReject(data.id, reason);
      setRejecting(false);
      setReason("");
      await load();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleOpen(documentId: string) {
    try {
      await openDocument(documentId);
    } catch (err) {
      setError(parseApiError(err).message);
    }
  }

  if (!data) {
    return <div className={`p-4 sm:p-8 ${error ? "text-sm font-bold text-red-600" : "text-ink"}`}>{error ?? "Loading..."}</div>;
  }

  const company = data.landlordType === "COMPANY";

  return (
    <div className="p-4 sm:p-8">
      <Link to="/admin/verifications" className="text-sm font-bold text-trust-blue">
        Back to verification
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-extrabold text-night-blue">{data.user.fullName}</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle[data.status]}`}>{data.status}</span>
      </div>
      <p className="mt-1 text-sm text-ink">
        {data.user.email}
        {data.user.phone ? ` · ${data.user.phone}` : ""} · joined {formatDate(data.user.createdAt)} ·{" "}
        {data.user._count.properties} propert{data.user._count.properties === 1 ? "y" : "ies"}
      </p>
      <p className="mt-1 text-sm">
        <Link to={`/admin/users/${data.user.id}`} className="font-bold text-trust-blue hover:underline">
          Open user
        </Link>
      </p>

      <div className="mt-6 max-w-2xl rounded-xl bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-ink/60">Applying as</p>
        <p className="mt-1 font-display text-lg font-extrabold text-night-blue">
          {company ? "Company or registered business" : "Individual owner"}
        </p>
        {company && (
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-bold text-ink/60">CAC number</dt>
              <dd className="text-ink">
                {data.cacType} {data.cacNumber}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-ink/60">Registered name given</dt>
              <dd className="text-ink">{data.registeredName}</dd>
            </div>
          </dl>
        )}
        {company && (
          <p className="mt-3 text-sm text-ink">
            <a
              href="https://search.cac.gov.ng"
              target="_blank"
              rel="noreferrer"
              className="font-bold text-trust-blue hover:underline"
            >
              Open the CAC public search
            </a>{" "}
            and look up {data.cacType} {data.cacNumber}.
          </p>
        )}
      </div>

      <div className="mt-4 max-w-2xl rounded-xl bg-white p-5 shadow-sm">
        <p className="font-display font-extrabold text-night-blue">Check before approving</p>
        <ul className="mt-2 list-disc pl-5 text-sm text-ink">
          <li>The name on the ID matches the account name.</li>
          <li>The ownership proof is genuine and covers renting the property out.</li>
          {company && (
            <>
              <li>The CAC search shows this number under the registered name given above.</li>
              <li>The CAC status is Active, and the certificate matches the search result.</li>
            </>
          )}
          <li>Nothing looks edited, blurred or reused from elsewhere.</li>
        </ul>
        <p className="mt-2 text-xs text-ink/60">Being on the CAC register shows a business exists, not that it is honest.</p>
      </div>

      <h2 className="mt-6 font-display text-lg font-extrabold text-night-blue">Documents</h2>
      {data.missingDocuments.length > 0 && (
        <p className="mt-2 text-sm font-bold text-red-600">
          Missing: {data.missingDocuments.map((kind) => docKindLabels[kind]).join(", ")}
        </p>
      )}
      <ul className="mt-3 flex max-w-2xl flex-col gap-2">
        {data.documents.length === 0 && <li className="text-sm text-ink">No documents uploaded.</li>}
        {data.documents.map((document) => (
          <li key={document.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm">
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">{docKindLabels[document.kind]}</p>
              <p className="truncate text-xs text-ink/60">{document.fileName}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleOpen(document.id)}
              className="shrink-0 rounded-lg border-2 border-trust-blue px-3 py-1.5 text-sm font-bold text-trust-blue"
            >
              Open
            </button>
          </li>
        ))}
      </ul>

      {data.status === "REJECTED" && data.rejectionReason && (
        <p className="mt-4 max-w-2xl rounded-xl border-l-4 border-red-600 bg-white p-3 text-sm text-ink shadow-sm">
          Rejected{data.reviewer ? ` by ${data.reviewer.fullName}` : ""}: {data.rejectionReason}
        </p>
      )}
      {data.status === "VERIFIED" && (
        <p className="mt-4 text-sm text-ink">
          Approved {formatDate(data.verifiedAt)}
          {data.reviewer ? ` by ${data.reviewer.fullName}` : ""}.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 max-w-2xl rounded-lg bg-red-50 p-3 text-sm font-bold text-red-600">
          {error}
        </p>
      )}

      <div className="mt-6 flex max-w-2xl flex-wrap gap-3">
        {data.status !== "VERIFIED" && (
          <button
            type="button"
            disabled={busy || data.missingDocuments.length > 0}
            onClick={() => void handleApprove()}
            className="rounded-xl bg-direct-green px-5 py-3 font-display font-extrabold text-night-blue disabled:opacity-50"
          >
            Approve
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => setRejecting((v) => !v)}
          className="rounded-xl border-2 border-red-600 px-5 py-3 font-display font-extrabold text-red-600 disabled:opacity-50"
        >
          {data.status === "VERIFIED" ? "Take verification back" : "Reject"}
        </button>
      </div>

      {rejecting && (
        <form onSubmit={handleReject} className="mt-4 flex max-w-2xl flex-col gap-3 rounded-xl bg-white p-5 shadow-sm">
          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Reason (the landlord sees this)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              minLength={3}
              maxLength={300}
              placeholder="e.g. The ID photo is blurred. Please upload a clearer one."
              className="w-full rounded-lg border border-mist p-3 font-sans font-normal text-ink focus:border-trust-blue focus:outline-none focus:ring-2 focus:ring-trust-blue"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-red-600 px-5 py-3 font-display font-extrabold text-white disabled:opacity-60"
          >
            {busy ? "Saving..." : "Send rejection"}
          </button>
        </form>
      )}
    </div>
  );
}
