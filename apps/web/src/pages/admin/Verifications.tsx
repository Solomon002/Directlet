import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Pager, formatDate } from "../../features/admin/ui";
import {
  adminListVerifications,
  docKindLabels,
  type AdminVerificationRow,
  type VerificationStatus,
} from "../../features/verification/api";
import { parseApiError } from "../../lib/errors";

const tabs: { value: VerificationStatus; label: string }[] = [
  { value: "PENDING", label: "To review" },
  { value: "VERIFIED", label: "Verified" },
  { value: "REJECTED", label: "Rejected" },
];

export default function Verifications() {
  const [params, setParams] = useSearchParams();
  const status = (tabs.find((tab) => tab.value === params.get("status"))?.value ?? "PENDING") as VerificationStatus;
  const page = Number(params.get("page") ?? 1) || 1;

  const [rows, setRows] = useState<AdminVerificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    adminListVerifications({ status, page })
      .then((result) => {
        setRows(result.verifications);
        setTotal(result.total);
        setPageSize(result.pageSize);
        setPending(result.pending);
        setError(null);
      })
      .catch((err: unknown) => setError(parseApiError(err).message))
      .finally(() => setLoading(false));
  }, [status, page]);

  return (
    <div className="p-4 sm:p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">Landlord verification</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink">
        Check each application against its documents, and for companies against the CAC public register. Oldest first.
      </p>

      <div className="mt-4 inline-flex rounded-xl bg-white p-1 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setParams(tab.value === "PENDING" ? {} : { status: tab.value })}
            className={`rounded-lg px-4 py-1.5 text-sm font-bold ${status === tab.value ? "bg-trust-blue text-white" : "text-ink"}`}
          >
            {tab.label}
            {tab.value === "PENDING" && pending > 0 ? ` (${pending})` : ""}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm font-bold text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-ink">Loading...</p>}
      {!loading && !error && rows.length === 0 && <p className="mt-4 text-ink">Nothing here.</p>}

      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.id}>
            <Link to={`/admin/verifications/${row.id}`} className="block rounded-xl bg-white p-4 shadow-sm hover:shadow">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display font-extrabold text-night-blue">{row.user.fullName}</p>
                  <p className="truncate text-sm text-ink">{row.user.email}</p>
                </div>
                <p className="text-sm text-ink/60">Sent {formatDate(row.submittedAt)}</p>
              </div>
              <p className="mt-2 text-sm text-ink">
                {row.landlordType === "COMPANY"
                  ? `${row.registeredName ?? "Company"} · CAC ${row.cacType} ${row.cacNumber}`
                  : "Individual owner"}
              </p>
              <p className="mt-1 text-sm">
                {row.missingDocuments.length > 0 ? (
                  <span className="font-bold text-red-600">
                    Incomplete, missing: {row.missingDocuments.map((kind) => docKindLabels[kind]).join(", ")}
                  </span>
                ) : (
                  <span className="font-bold text-direct-green">{row.documentCount} documents, ready to review</span>
                )}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <Pager page={page} pageSize={pageSize} total={total} onPage={(next) => setParams({ ...(status !== "PENDING" ? { status } : {}), page: String(next) })} />
    </div>
  );
}
