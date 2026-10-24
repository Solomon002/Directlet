import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getOverview, type AdminOverview } from "../../features/admin/api";
import { DailyBars, Section, Stat } from "../../features/admin/ui";
import { naira } from "../../lib/money";
import { parseApiError } from "../../lib/errors";

export default function Overview() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOverview()
      .then(setData)
      .catch((err: unknown) => setError(parseApiError(err).message));
  }, []);

  if (error) return <p className="p-4 text-sm font-bold text-red-600 sm:p-8">{error}</p>;
  if (!data) return <p className="p-4 text-ink sm:p-8">Loading...</p>;

  const { users, properties, money, traffic, messaging, tenancies } = data;
  const role = (r: keyof typeof users.byRole) => users.byRole[r] ?? 0;
  const newIn = (window: typeof users.new7d) =>
    (window.LANDLORD ?? 0) + (window.HUNTER ?? 0) + (window.TENANT ?? 0);
  const occupancy = properties.units ? Math.round((properties.occupiedUnits / properties.units) * 100) : 0;

  return (
    <div className="p-4 sm:p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">Overview</h1>
      <p className="mt-1 text-sm text-ink/70">Everything on DirectLet, across all landlords.</p>

      <Section title="Visitors">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Visitors today" value={traffic.visitorsToday} note={`${traffic.viewsToday} page views`} />
          <Stat label="Visitors, 7 days" value={traffic.visitors7d} note={`${traffic.views7d} page views`} />
          <Stat label="Visitors, 30 days" value={traffic.visitors30d} note={`${traffic.views30d} page views`} />
          <Stat
            label="Pages per visit"
            value={traffic.visitors30d ? (traffic.views30d / traffic.visitors30d).toFixed(1) : "-"}
            note="30-day average"
          />
        </div>
        <div className="mt-3">
          <DailyBars points={data.series.map((d) => ({ day: d.day, value: d.visitors }))} unit="visitors" />
        </div>
        <p className="mt-2 text-xs text-ink/60">
          A visitor is one browser on one day. No cookies; your own admin pages are not counted.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-ink/60">Top pages, 30 days</p>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {traffic.topPages.length === 0 && <li className="text-ink/60">No visits yet.</li>}
              {traffic.topPages.map((p) => (
                <li key={p.path} className="flex justify-between gap-3">
                  <span className="truncate">{p.label ? `${p.label} (compound)` : p.path}</span>
                  <span className="shrink-0 font-bold">{p.views}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-ink/60">Where visitors came from</p>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {traffic.topReferrers.length === 0 && (
                <li className="text-ink/60">No outside links yet (typed address or bookmarks only).</li>
              )}
              {traffic.topReferrers.map((r) => (
                <li key={r.referrer} className="flex justify-between gap-3">
                  <span className="truncate">{r.referrer}</span>
                  <span className="shrink-0 font-bold">{r.views}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section
        title="People"
        action={
          <Link to="/admin/users" className="text-sm font-bold text-trust-blue hover:underline">
            All users
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Landlords" value={role("LANDLORD")} note={`+${users.new30d.LANDLORD ?? 0} in 30 days`} />
          <Stat label="House hunters" value={role("HUNTER")} note={`+${users.new30d.HUNTER ?? 0} in 30 days`} />
          <Stat label="Tenants" value={role("TENANT")} note={`+${users.new30d.TENANT ?? 0} in 30 days`} />
          <Stat
            label="New sign-ups"
            value={newIn(users.new7d)}
            note={`this week · ${users.suspended} suspended`}
            tone={users.suspended ? "alert" : undefined}
          />
        </div>
        <div className="mt-3">
          <DailyBars
            points={data.series.map((d) => ({
              day: d.day,
              value: d.signups.LANDLORD + d.signups.HUNTER + d.signups.TENANT,
            }))}
            color="bg-direct-green"
            unit="sign-ups"
          />
        </div>
      </Section>

      <Section
        title="Listings"
        action={
          <Link to="/admin/properties" className="text-sm font-bold text-trust-blue hover:underline">
            All properties
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Properties" value={properties.total} note={`${properties.listed} live on the marketplace`} />
          <Stat
            label="Flats"
            value={properties.units}
            note={`${properties.occupiedUnits} let · ${properties.vacantUnits} vacant`}
          />
          <Stat label="Occupancy" value={`${occupancy}%`} note={`${tenancies.active} active tenancies`} />
          <Stat
            label="Taken down"
            value={properties.hiddenByAdmin}
            note={`${properties.total - properties.withMapPin} without a map pin`}
            tone={properties.hiddenByAdmin ? "alert" : undefined}
          />
        </div>
      </Section>

      <Section title="Rent">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Rent recorded" value={naira(money.confirmedTotal)} note={`${money.confirmedCount} confirmed payments`} tone="good" />
          <Stat label="Last 30 days" value={naira(money.confirmed30d)} note="confirmed" />
          <Stat label="Outstanding" value={naira(money.outstanding)} note={`${naira(money.overdue)} overdue`} tone={Number(money.overdue) > 0 ? "alert" : undefined} />
          <Stat label="Awaiting landlords" value={naira(money.pendingAmount)} note={`${money.pendingCount} payments to review`} />
        </div>
        <p className="mt-2 text-xs text-ink/60">
          Rent tenants recorded and landlords confirmed. It does not pass through DirectLet.
        </p>
      </Section>

      <Section title="Activity">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Messages" value={messaging.messages} note={`${messaging.messages7d} this week · ${messaging.conversations} chats`} />
          <Stat
            label="Viewing requests"
            value={Object.values(data.inspections).reduce((a, b) => a + (b ?? 0), 0)}
            note={`${data.inspections.PENDING ?? 0} waiting · ${data.inspections.CONVERTED ?? 0} became tenancies`}
          />
          <Stat
            label="Open complaints"
            value={(data.complaints.OPEN ?? 0) + (data.complaints.IN_PROGRESS ?? 0)}
            note={`${data.complaints.RESOLVED ?? 0} resolved`}
          />
          <Stat label="Ended tenancies" value={tenancies.ended} />
        </div>
      </Section>
    </div>
  );
}
