import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Pager, formatDate } from "../../features/admin/ui";
import {
  adminListReports,
  adminListReviews,
  adminRemoveReview,
  adminResolveReports,
  reportReasonLabels,
  type AdminReportGroup,
  type AdminReview,
} from "../../features/trust/api";
import Stars from "../../features/trust/Stars";
import { parseApiError } from "../../lib/errors";

function ageInDays(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function Reviews({ propertyId }: { propertyId: string }) {
  const [reviews, setReviews] = useState<AdminReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setReviews(await adminListReviews(propertyId));
    } catch (err) {
      setError(parseApiError(err).message);
    }
  }

  useEffect(() => {
    void load();
  }, [propertyId]);

  async function remove(id: string) {
    if (!window.confirm("Remove this review from the listing? It stays on record.")) return;
    try {
      await adminRemoveReview(id);
      await load();
    } catch (err) {
      setError(parseApiError(err).message);
    }
  }

  if (error) return <p className="mt-2 text-sm font-bold text-red-600">{error}</p>;
  if (!reviews) return <p className="mt-2 text-sm text-ink">Loading...</p>;
  if (reviews.length === 0) return <p className="mt-2 text-sm text-ink">No reviews on this listing.</p>;

  return (
    <ul className="mt-2 flex flex-col gap-2">
      {reviews.map((review) => (
        <li key={review.id} className="rounded-lg bg-mist p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Stars value={review.rating} />
              <span className="font-bold text-ink">{review.reviewer.fullName}</span>
            </span>
            {review.removedAt ? (
              <span className="text-xs font-bold text-ink/60">Removed</span>
            ) : (
              <button type="button" onClick={() => void remove(review.id)} className="text-xs font-bold text-red-600 hover:underline">
                Remove
              </button>
            )}
          </div>
          {review.comment && <p className="mt-1 text-ink">{review.comment}</p>}
        </li>
      ))}
    </ul>
  );
}

export default function Reports() {
  const [params, setParams] = useSearchParams();
  const handled = params.get("status") === "handled";
  const page = Number(params.get("page") ?? 1) || 1;

  const [groups, setGroups] = useState<AdminReportGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reviewsFor, setReviewsFor] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setLoading(true);
    adminListReports({ handled, page })
      .then((result) => {
        setGroups(result.groups);
        setTotal(result.total);
        setPageSize(result.pageSize);
        setError(null);
      })
      .catch((err: unknown) => setError(parseApiError(err).message))
      .finally(() => setLoading(false));
  }, [handled, page, reload]);

  async function decide(group: AdminReportGroup, action: "TAKE_DOWN" | "DISMISS") {
    const note = window.prompt(
      action === "TAKE_DOWN"
        ? `Take down "${group.property.name}"? The landlord sees your note, and cannot re-list it until you restore it.\n\nNote:`
        : `Dismiss these reports on "${group.property.name}"? If it was only paused automatically, it goes back up.\n\nNote (kept on record):`,
    );
    if (note === null) return;
    setBusy(group.property.id);
    setError(null);
    try {
      await adminResolveReports(group.property.id, action, note.trim() || undefined);
      setReload((n) => n + 1);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-4 sm:p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">Reported listings</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink">
        Listings that people have reported, grouped. A listing is paused automatically once several established accounts
        report it. Decide here: take it down, or dismiss the reports.
      </p>

      <div className="mt-4 inline-flex rounded-xl bg-white p-1 shadow-sm">
        {[
          { handled: false, label: "To review" },
          { handled: true, label: "Handled" },
        ].map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setParams(tab.handled ? { status: "handled" } : {})}
            className={`rounded-lg px-4 py-1.5 text-sm font-bold ${handled === tab.handled ? "bg-trust-blue text-white" : "text-ink"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-4 text-sm font-bold text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-ink">Loading...</p>}
      {!loading && !error && groups.length === 0 && <p className="mt-4 text-ink">Nothing here.</p>}

      <ul className="mt-4 flex max-w-3xl flex-col gap-4">
        {groups.map((group) => (
          <li key={group.property.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display text-lg font-extrabold text-night-blue">{group.property.name}</p>
                <p className="text-sm text-ink">
                  {group.property.area}, {group.property.city} · owner{" "}
                  <Link to={`/admin/users/${group.property.landlord.id}`} className="font-bold text-trust-blue hover:underline">
                    {group.property.landlord.fullName}
                  </Link>
                  {group.property.landlord.verified ? " (verified)" : " (not verified)"}
                </p>
              </div>
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
                {group.count} report{group.count === 1 ? "" : "s"}
              </span>
            </div>

            {group.property.hiddenByAdminAt && (
              <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900">
                Not shown publicly now{group.property.hiddenByAdminReason ? `: ${group.property.hiddenByAdminReason}` : "."}
              </p>
            )}

            <ul className="mt-3 flex flex-col gap-2">
              {group.reports.map((report) => (
                <li key={report.id} className="rounded-lg bg-mist p-3 text-sm">
                  <p className="font-bold text-ink">{reportReasonLabels[report.reason]}</p>
                  {report.details && <p className="mt-0.5 text-ink">{report.details}</p>}
                  <p className="mt-1 text-xs text-ink/60">
                    {report.reporter.fullName} · account {ageInDays(report.reporter.createdAt)} day
                    {ageInDays(report.reporter.createdAt) === 1 ? "" : "s"} old · {formatDate(report.createdAt)}
                    {report.status !== "OPEN" ? ` · ${report.status === "ACTION_TAKEN" ? "action taken" : "dismissed"}` : ""}
                  </p>
                  {report.resolutionNote && <p className="mt-1 text-xs text-ink">Note: {report.resolutionNote}</p>}
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap gap-3">
              {!handled && (
                <>
                  <button
                    type="button"
                    disabled={busy === group.property.id}
                    onClick={() => void decide(group, "TAKE_DOWN")}
                    className="rounded-xl bg-red-600 px-4 py-2 font-display font-extrabold text-white disabled:opacity-60"
                  >
                    Take down
                  </button>
                  <button
                    type="button"
                    disabled={busy === group.property.id}
                    onClick={() => void decide(group, "DISMISS")}
                    className="rounded-xl border-2 border-trust-blue px-4 py-2 font-display font-extrabold text-trust-blue disabled:opacity-60"
                  >
                    Dismiss
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setReviewsFor((current) => (current === group.property.id ? null : group.property.id))}
                className="px-2 py-2 text-sm font-bold text-trust-blue hover:underline"
              >
                {reviewsFor === group.property.id ? "Hide reviews" : "Reviews on this listing"}
              </button>
            </div>
            {reviewsFor === group.property.id && <Reviews propertyId={group.property.id} />}
          </li>
        ))}
      </ul>

      <Pager page={page} pageSize={pageSize} total={total} onPage={(next) => setParams({ ...(handled ? { status: "handled" } : {}), page: String(next) })} />
    </div>
  );
}
