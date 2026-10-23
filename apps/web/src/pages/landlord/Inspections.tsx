import { useEffect, useState, type FormEvent } from "react";
import {
  listInspections,
  scheduleInspection,
  declineInspection,
  completeInspection,
  convertInspection,
  type InspectionRequest,
} from "../../features/inspections/api";
import { parseApiError } from "../../lib/errors";

export default function Inspections() {
  const [inspections, setInspections] = useState<InspectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingOnId, setActingOnId] = useState<string | null>(null);

  const [scheduleDateDraft, setScheduleDateDraft] = useState<Record<string, string>>({});
  const [declineNoteDraft, setDeclineNoteDraft] = useState<Record<string, string>>({});

  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertTenantEmail, setConvertTenantEmail] = useState("");
  const [convertTenantFullName, setConvertTenantFullName] = useState("");
  const [convertTenantPhone, setConvertTenantPhone] = useState("");
  const [convertStartDate, setConvertStartDate] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLinkForId, setInviteLinkForId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    try {
      setInspections(await listInspections());
    } catch (err) {
      setLoadError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleSchedule(id: string) {
    setActingOnId(id);
    setActionError(null);
    try {
      await scheduleInspection(id, scheduleDateDraft[id]);
      await loadData();
    } catch (err) {
      setActionError(parseApiError(err).message);
    } finally {
      setActingOnId(null);
    }
  }

  async function handleDecline(id: string) {
    setActingOnId(id);
    setActionError(null);
    try {
      await declineInspection(id, declineNoteDraft[id] || undefined);
      await loadData();
    } catch (err) {
      setActionError(parseApiError(err).message);
    } finally {
      setActingOnId(null);
    }
  }

  async function handleComplete(id: string) {
    setActingOnId(id);
    setActionError(null);
    try {
      await completeInspection(id);
      await loadData();
    } catch (err) {
      setActionError(parseApiError(err).message);
    } finally {
      setActingOnId(null);
    }
  }

  function toggleConvert(id: string) {
    setConvertingId((current) => (current === id ? null : id));
    setConvertTenantEmail("");
    setConvertTenantFullName("");
    setConvertTenantPhone("");
    setConvertStartDate("");
    setActionError(null);
  }

  async function handleConvert(e: FormEvent, id: string) {
    e.preventDefault();
    setActingOnId(id);
    setActionError(null);
    try {
      const result = await convertInspection(id, {
        tenantEmail: convertTenantEmail,
        tenantFullName: convertTenantFullName,
        tenantPhone: convertTenantPhone || undefined,
        startDate: convertStartDate,
      });
      setInviteLink(result.inviteLink);
      setInviteLinkForId(id);
      setConvertingId(null);
      await loadData();
    } catch (err) {
      setActionError(parseApiError(err).message);
    } finally {
      setActingOnId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-ink">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">Inspection requests</h1>

      {loadError && <p className="mt-4 text-sm font-bold text-red-600">{loadError}</p>}
      {actionError && <p className="mt-4 text-sm font-bold text-red-600">{actionError}</p>}
      {inspections.length === 0 && !loadError && (
        <p className="mt-4 text-ink">No inspection requests yet.</p>
      )}

      <ul className="mt-6 flex flex-col gap-3">
        {inspections.map((inspection) => (
          <li key={inspection.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="font-display font-extrabold text-night-blue">
                {inspection.name} - {inspection.unit?.property.name} ({inspection.unit?.label})
              </p>
              <span
                className={
                  inspection.status === "CONVERTED" || inspection.status === "COMPLETED"
                    ? "text-sm font-bold text-direct-green"
                    : inspection.status === "DECLINED"
                      ? "text-sm font-bold text-red-600"
                      : inspection.status === "SCHEDULED"
                        ? "text-sm font-bold text-trust-blue"
                        : "text-sm font-bold text-ink/60"
                }
              >
                {inspection.status}
              </span>
            </div>
            <p className="text-sm text-ink">
              {inspection.email} - {inspection.phone}
            </p>
            {inspection.message && <p className="mt-1 text-sm text-ink">{inspection.message}</p>}
            {inspection.preferredDate && (
              <p className="mt-1 text-xs text-ink/60">
                Preferred date: {new Date(inspection.preferredDate).toDateString()}
              </p>
            )}
            {inspection.scheduledFor && (
              <p className="mt-1 text-sm font-bold text-trust-blue">
                Scheduled for {new Date(inspection.scheduledFor).toDateString()}
              </p>
            )}
            {inspection.landlordNote && (
              <p className="mt-1 text-sm text-ink">Note: {inspection.landlordNote}</p>
            )}

            {(inspection.status === "PENDING" || inspection.status === "SCHEDULED") && (
              <div className="mt-3 flex flex-col gap-2">
                {inspection.status === "PENDING" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={scheduleDateDraft[inspection.id] ?? ""}
                      onChange={(e) =>
                        setScheduleDateDraft((prev) => ({ ...prev, [inspection.id]: e.target.value }))
                      }
                      className="rounded-lg border border-mist px-3 py-2 font-sans text-sm text-ink"
                    />
                    <button
                      type="button"
                      disabled={actingOnId === inspection.id || !scheduleDateDraft[inspection.id]}
                      onClick={() => void handleSchedule(inspection.id)}
                      className="rounded-xl bg-trust-blue px-4 py-2 font-display font-extrabold text-white disabled:opacity-60"
                    >
                      Schedule
                    </button>
                  </div>
                )}

                {inspection.status === "SCHEDULED" && (
                  <button
                    type="button"
                    disabled={actingOnId === inspection.id}
                    onClick={() => void handleComplete(inspection.id)}
                    className="self-start rounded-xl bg-direct-green px-4 py-2 font-display font-extrabold text-white disabled:opacity-60"
                  >
                    Mark complete
                  </button>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    placeholder="Decline reason (optional)"
                    value={declineNoteDraft[inspection.id] ?? ""}
                    onChange={(e) =>
                      setDeclineNoteDraft((prev) => ({ ...prev, [inspection.id]: e.target.value }))
                    }
                    className="rounded-lg border border-mist px-3 py-2 font-sans text-sm text-ink"
                  />
                  <button
                    type="button"
                    disabled={actingOnId === inspection.id}
                    onClick={() => void handleDecline(inspection.id)}
                    className="rounded-xl bg-red-600 px-4 py-2 font-display font-extrabold text-white disabled:opacity-60"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            {inspection.status !== "CONVERTED" && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => toggleConvert(inspection.id)}
                  className="text-sm font-bold text-trust-blue hover:underline"
                >
                  {convertingId === inspection.id ? "Cancel" : "Convert to tenancy"}
                </button>

                {convertingId === inspection.id && (
                  <form
                    onSubmit={(e) => void handleConvert(e, inspection.id)}
                    className="mt-3 flex max-w-sm flex-col gap-3 rounded-xl bg-mist p-4"
                  >
                    <label className="flex flex-col gap-1 text-sm font-bold text-ink">
                      Tenant full name
                      <input
                        value={convertTenantFullName}
                        onChange={(e) => setConvertTenantFullName(e.target.value)}
                        required
                        className="rounded-lg border border-mist bg-white px-3 py-2 font-sans text-ink"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-bold text-ink">
                      Tenant email
                      <input
                        type="email"
                        value={convertTenantEmail}
                        onChange={(e) => setConvertTenantEmail(e.target.value)}
                        required
                        className="rounded-lg border border-mist bg-white px-3 py-2 font-sans text-ink"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-bold text-ink">
                      Tenant phone <span className="font-normal text-ink/60">(optional)</span>
                      <input
                        type="tel"
                        value={convertTenantPhone}
                        onChange={(e) => setConvertTenantPhone(e.target.value)}
                        className="rounded-lg border border-mist bg-white px-3 py-2 font-sans text-ink"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-bold text-ink">
                      Start date
                      <input
                        type="date"
                        value={convertStartDate}
                        onChange={(e) => setConvertStartDate(e.target.value)}
                        required
                        className="rounded-lg border border-mist bg-white px-3 py-2 font-sans text-ink"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={actingOnId === inspection.id}
                      className="mt-1 rounded-xl bg-direct-green px-4 py-2 font-display font-extrabold text-white disabled:opacity-60"
                    >
                      Create tenancy
                    </button>
                  </form>
                )}
              </div>
            )}

            {inviteLinkForId === inspection.id && inviteLink && (
              <div className="mt-3 rounded-xl bg-direct-green/10 p-4 text-sm text-ink">
                <p className="font-bold">Converted. Share this invite link with the tenant:</p>
                <p className="mt-1 break-all font-sans text-trust-blue">{inviteLink}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
