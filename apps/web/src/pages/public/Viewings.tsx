import { useEffect, useState } from "react";
import { Link } from "react-router";
import { cancelViewing, listMyViewings, reportLandlordNoShow, type Viewing } from "../../features/viewings/api";
import { statusLabels, type InspectionStatus } from "../../features/inspections/api";
import { parseApiError } from "../../lib/errors";
import { formatRent } from "../../lib/money";

// Viewing days are stored as a date with no time zone, so they are shown as that same
// date wherever the visitor is.
export function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const statusStyle: Record<InspectionStatus, string> = {
  PENDING: "bg-mist text-ink/70",
  SCHEDULED: "bg-trust-blue/10 text-trust-blue",
  COMPLETED: "bg-direct-green/10 text-green-700",
  CONVERTED: "bg-direct-green/10 text-green-700",
  DECLINED: "bg-red-50 text-red-600",
  CANCELLED: "bg-mist text-ink/60",
  NO_SHOW_VISITOR: "bg-red-50 text-red-600",
  NO_SHOW_LANDLORD: "bg-amber-100 text-amber-800",
};

export default function Viewings() {
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      setViewings(await listMyViewings());
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function act(id: string, action: () => Promise<void>) {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusyId(null);
    }
  }

  function handleCancel(viewing: Viewing) {
    if (!window.confirm(`Cancel your viewing request for ${viewing.unit.property.name} (${viewing.unit.label})?`)) return;
    void act(viewing.id, () => cancelViewing(viewing.id));
  }

  function handleNoShow(viewing: Viewing) {
    if (!window.confirm("Tell DirectLet the landlord was not there on the agreed day? This is kept on record.")) return;
    void act(viewing.id, () => reportLandlordNoShow(viewing.id));
  }

  return (
    <div className="p-4 sm:p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">My viewings</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink">
        Your phone number is only shared with a landlord once they accept. If you cannot make a viewing, cancel it so
        the landlord is not left waiting. Missing several in a row pauses new requests.
      </p>

      <p className="mt-4 max-w-2xl rounded-xl border-l-4 border-trust-blue bg-white p-3 text-sm text-ink shadow-sm">
        <span className="font-bold text-night-blue">Stay safe:</span> meet the owner at the property. Do not pay a deposit
        or any fee before you have seen it and met them, and pay in a way you can trace.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-600">
          {error}
        </p>
      )}
      {loading && <p className="mt-4 text-ink">Loading...</p>}
      {!loading && viewings.length === 0 && (
        <p className="mt-4 text-ink">
          You have not asked to view anything yet.{" "}
          <Link to="/compounds" className="font-bold text-trust-blue hover:underline">
            Browse listings
          </Link>
        </p>
      )}

      <ul className="mt-4 flex max-w-3xl flex-col gap-3">
        {viewings.map((viewing) => (
          <li key={viewing.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  to={`/compounds/${viewing.unit.property.id}`}
                  className="font-display font-extrabold text-night-blue hover:underline"
                >
                  {viewing.unit.property.name}
                </Link>
                <p className="text-sm text-ink">
                  {viewing.unit.label} · {viewing.unit.property.area}, {viewing.unit.property.city}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle[viewing.status]}`}>
                {statusLabels[viewing.status]}
              </span>
            </div>

            {viewing.status === "SCHEDULED" && viewing.scheduledFor && (
              <p className="mt-2 text-sm font-bold text-trust-blue">Viewing on {formatDay(viewing.scheduledFor)}</p>
            )}
            {viewing.rescheduleCount > 0 && viewing.status === "SCHEDULED" && (
              <p className="text-xs text-ink/70">
                The landlord has moved this date {viewing.rescheduleCount} time{viewing.rescheduleCount === 1 ? "" : "s"}.
              </p>
            )}
            {viewing.status === "PENDING" && viewing.preferredDate && (
              <p className="mt-2 text-sm text-ink">You asked for {formatDay(viewing.preferredDate)}.</p>
            )}
            {viewing.landlordNote && viewing.status === "DECLINED" && (
              <p className="mt-2 text-sm text-ink">Landlord's note: {viewing.landlordNote}</p>
            )}

            {viewing.rent.askedAt && (
              <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900">
                <span className="font-bold">The rent has changed since you asked.</span> It was{" "}
                {formatRent(viewing.rent.askedAt.amount, viewing.rent.askedAt.frequency)}, and is now{" "}
                {formatRent(viewing.rent.current.amount, viewing.rent.current.frequency)}. Make sure you are still happy
                with it before you go.
              </p>
            )}

            {(viewing.canCancel || viewing.canReportNoShow) && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {viewing.canCancel && (
                  <button
                    type="button"
                    disabled={busyId === viewing.id}
                    onClick={() => handleCancel(viewing)}
                    className="text-sm font-bold text-red-600 hover:underline disabled:opacity-60"
                  >
                    Cancel request
                  </button>
                )}
                {viewing.canReportNoShow && (
                  <button
                    type="button"
                    disabled={busyId === viewing.id}
                    onClick={() => handleNoShow(viewing)}
                    className="text-sm font-bold text-trust-blue hover:underline disabled:opacity-60"
                  >
                    The landlord did not show up
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
