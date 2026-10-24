import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { getUser, roleNames, suspendUser, unsuspendUser, type AdminUserDetail } from "../../features/admin/api";
import { Section, Stat, formatDate, timeAgo } from "../../features/admin/ui";
import { formatRent } from "../../lib/money";
import { parseApiError } from "../../lib/errors";

export default function UserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    if (!userId) return;
    try {
      setUser(await getUser(userId));
    } catch (err) {
      setError(parseApiError(err).message);
    }
  }

  useEffect(() => {
    void load();
  }, [userId]);

  async function handleSuspend() {
    if (!user) return;
    if (!window.confirm(`Suspend ${user.fullName}? They are signed out and cannot log in, and their listings leave the marketplace.`)) return;
    setActing(true);
    setActionError(null);
    try {
      await suspendUser(user.id, reason.trim() || undefined);
      setReason("");
      await load();
    } catch (err) {
      setActionError(parseApiError(err).message);
    } finally {
      setActing(false);
    }
  }

  async function handleUnsuspend() {
    if (!user) return;
    setActing(true);
    setActionError(null);
    try {
      await unsuspendUser(user.id);
      await load();
    } catch (err) {
      setActionError(parseApiError(err).message);
    } finally {
      setActing(false);
    }
  }

  if (error) return <p className="p-4 text-sm font-bold text-red-600 sm:p-8">{error}</p>;
  if (!user) return <p className="p-4 text-ink sm:p-8">Loading...</p>;

  return (
    <div className="p-4 sm:p-8">
      <Link to="/admin/users" className="text-sm font-bold text-trust-blue">
        Back to users
      </Link>
      <h1 className="mt-3 font-display text-2xl font-extrabold text-night-blue">{user.fullName}</h1>
      <p className="mt-1 text-sm text-ink">
        {roleNames[user.role]} · {user.email}
        {user.phone ? ` · ${user.phone}` : ""}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Joined" value={formatDate(user.createdAt)} />
        <Stat label="Last active" value={timeAgo(user.lastActiveAt)} />
        <Stat label="Messages sent" value={user.messagesSent} />
        <Stat
          label="Status"
          value={user.suspendedAt ? "Suspended" : user.activated ? "Active" : "Invited"}
          tone={user.suspendedAt ? "alert" : "good"}
          note={
            user.suspendedAt
              ? `Since ${formatDate(user.suspendedAt)}${user.suspendedReason ? `: ${user.suspendedReason}` : ""}`
              : !user.activated
                ? `Invite expires ${formatDate(user.inviteExpiresAt)}`
                : undefined
          }
        />
      </div>

      {user.role !== "ADMIN" && (
        <div className="mt-4 max-w-md rounded-xl bg-white p-4 shadow-sm">
          {user.suspendedAt ? (
            <button
              type="button"
              disabled={acting}
              onClick={() => void handleUnsuspend()}
              className="rounded-xl bg-direct-green px-4 py-2 font-display font-extrabold text-white disabled:opacity-60"
            >
              Lift suspension
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                placeholder="Reason (kept on record, e.g. fake listing reports)"
                className="rounded-lg border border-mist px-3 py-2 text-sm text-ink"
              />
              <button
                type="button"
                disabled={acting}
                onClick={() => void handleSuspend()}
                className="self-start rounded-xl border-2 border-red-600 px-4 py-2 font-display font-extrabold text-red-600 disabled:opacity-60"
              >
                Suspend account
              </button>
            </div>
          )}
          {actionError && <p className="mt-2 text-sm font-bold text-red-600">{actionError}</p>}
        </div>
      )}

      {user.properties.length > 0 && (
        <Section title="Properties">
          <ul className="flex flex-col gap-2">
            {user.properties.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm shadow-sm">
                <span>
                  <span className="font-bold text-night-blue">{p.name}</span> · {p.area}, {p.city} · {p._count.units} flats
                </span>
                <span className={p.hiddenByAdminAt ? "font-bold text-red-600" : p.isPublic ? "text-direct-green" : "text-ink/60"}>
                  {p.hiddenByAdminAt ? "Taken down" : p.isPublic ? "Listed" : "Hidden by owner"}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {user.tenancies.length > 0 && (
        <Section title="Tenancies">
          <ul className="flex flex-col gap-2">
            {user.tenancies.map((t) => (
              <li key={t.id} className="rounded-xl bg-white p-3 text-sm shadow-sm">
                <span className="font-bold text-night-blue">
                  {t.unit.property.name} ({t.unit.label})
                </span>{" "}
                · {formatRent(t.rentAmount, t.rentFrequency)} · from {formatDate(t.startDate)} · {t.status.toLowerCase()}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="Recent actions"
        action={
          <Link to={`/admin/activity?userId=${user.id}`} className="text-sm font-bold text-trust-blue hover:underline">
            Full history
          </Link>
        }
      >
        {user.recentActivity.length === 0 ? (
          <p className="text-sm text-ink/60">Nothing recorded yet.</p>
        ) : (
          <ul className="divide-y divide-mist rounded-xl bg-white text-sm shadow-sm">
            {user.recentActivity.map((a) => (
              <li key={a.id} className="flex justify-between gap-3 px-4 py-2">
                <span className="truncate font-mono text-xs">
                  {a.method} {a.path}
                </span>
                <span className={`shrink-0 text-xs ${a.statusCode >= 400 ? "font-bold text-red-600" : "text-ink/60"}`}>
                  {a.statusCode} · {timeAgo(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
