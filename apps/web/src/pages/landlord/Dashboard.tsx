import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  getDashboardTotals,
  listActivity,
  listReminders,
  describeActivity,
  describeReminder,
  type ActivityEntry,
  type DashboardTotals,
  type Reminder,
} from "../../features/dashboard/api";
import { listMyProperties } from "../../features/properties/api";
import { getMyVerification, type Verification } from "../../features/verification/api";
import { parseApiError } from "../../lib/errors";

function naira(amount: string) {
  return `NGN ${Number(amount).toLocaleString()}`;
}

export default function Dashboard() {
  const [totals, setTotals] = useState<DashboardTotals | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [myTotals, myReminders, myActivity] = await Promise.all([
          getDashboardTotals(),
          listReminders(),
          listActivity(),
        ]);
        setTotals(myTotals);
        setReminders(myReminders);
        setActivity(myActivity);
        // The trust prompts are extras: if they fail to load, the dashboard still works.
        const [myVerification, myProperties] = await Promise.all([
          getMyVerification().catch(() => null),
          listMyProperties().catch(() => []),
        ]);
        setVerification(myVerification);
        setNeedsConfirmation(
          myProperties.reduce((sum, property) => sum + (property.needsConfirmation ?? 0) + (property.unconfirmed ?? 0), 0),
        );
      } catch (err) {
        setLoadError(parseApiError(err).message);
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, []);

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-ink">Loading...</p>
      </div>
    );
  }

  if (loadError || !totals) {
    return (
      <div className="p-4 sm:p-8">
        <h1 className="font-display text-2xl font-extrabold text-night-blue">Landlord dashboard</h1>
        <p className="mt-2 text-sm font-bold text-red-600">{loadError ?? "Could not load your dashboard"}</p>
      </div>
    );
  }

  const moneyCards = [
    { label: "Collected", value: naira(totals.collected), note: `${naira(totals.collectedThisYear)} this year` },
    { label: "Outstanding", value: naira(totals.outstanding), note: "All unpaid rent billed so far" },
    { label: "Overdue", value: naira(totals.overdue), note: "Unpaid past the due date", alert: Number(totals.overdue) > 0 },
    {
      label: "Awaiting confirmation",
      value: naira(totals.pendingPayments.amount),
      note: `${totals.pendingPayments.count} payment${totals.pendingPayments.count === 1 ? "" : "s"} to review`,
    },
  ];

  const countCards = [
    { label: "Properties", value: totals.properties, to: "/landlord/properties" },
    { label: "Occupied units", value: `${totals.occupiedUnits} / ${totals.units}`, to: "/landlord/tenancies" },
    { label: "Vacant units", value: totals.vacantUnits, to: "/landlord/properties" },
    { label: "Open complaints", value: totals.openComplaints, to: "/landlord/tenancies" },
    { label: "Viewings to handle", value: totals.pendingInspections, to: "/landlord/inspections" },
  ];

  return (
    <div className="p-4 sm:p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">Landlord dashboard</h1>

      {(verification?.status !== "VERIFIED" || needsConfirmation > 0) && (
        <div className="mt-4 flex flex-col gap-3">
          {verification?.status !== "VERIFIED" && (
            <Link
              to="/landlord/verification"
              className="rounded-xl border-l-4 border-trust-blue bg-white p-4 shadow-sm hover:shadow"
            >
              <p className="font-display font-extrabold text-night-blue">
                {!verification
                  ? "Get verified"
                  : verification.status === "REJECTED"
                    ? "Your verification needs attention"
                    : verification.missingDocuments.length > 0
                      ? "Finish your verification"
                      : "Verification under review"}
              </p>
              <p className="mt-0.5 text-sm text-ink">
                {!verification
                  ? "Verified landlords get a badge and are shown first. It takes about five minutes."
                  : verification.status === "REJECTED"
                    ? (verification.rejectionReason ?? "Tap to see what to fix.")
                    : verification.missingDocuments.length > 0
                      ? "Add your documents so we can review it."
                      : "We will check your documents and update you here."}
              </p>
            </Link>
          )}
          {needsConfirmation > 0 && (
            <Link
              to="/landlord/properties"
              className="rounded-xl border-l-4 border-amber-500 bg-white p-4 shadow-sm hover:shadow"
            >
              <p className="font-display font-extrabold text-night-blue">
                {needsConfirmation} flat{needsConfirmation === 1 ? "" : "s"} to confirm
              </p>
              <p className="mt-0.5 text-sm text-ink">
                Tap "Still available" on each one. Flats you have not confirmed for 30 days are hidden from viewing
                requests.
              </p>
            </Link>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {moneyCards.map((card) => (
          <div key={card.label} className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-ink/60">{card.label}</p>
            <p
              className={
                card.alert
                  ? "mt-1 font-display text-xl font-extrabold text-red-600"
                  : "mt-1 font-display text-xl font-extrabold text-night-blue"
              }
            >
              {card.value}
            </p>
            <p className="mt-1 text-sm text-ink">{card.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {countCards.map((card) => (
          <Link key={card.label} to={card.to} className="rounded-xl bg-white p-4 shadow-sm hover:shadow">
            <p className="text-sm font-bold text-ink/60">{card.label}</p>
            <p className="mt-1 font-display text-lg font-extrabold text-night-blue">{card.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-extrabold text-night-blue">Rent reminders</h2>
        {reminders.length === 0 && <p className="mt-2 text-ink">No rent due in the next 30 days.</p>}
        <ul className="mt-3 flex flex-col gap-3">
          {reminders.map((reminder) => (
            <li key={reminder.rentChargeId} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-display font-extrabold text-night-blue">
                    {reminder.tenantName} - {reminder.propertyName} ({reminder.unitLabel})
                  </p>
                  <p className="text-sm text-ink">
                    {naira(reminder.balance)} due {new Date(reminder.dueDate).toDateString()}
                  </p>
                </div>
                <span
                  className={
                    reminder.kind === "OVERDUE"
                      ? "shrink-0 text-sm font-bold text-red-600"
                      : "shrink-0 text-sm font-bold text-trust-blue"
                  }
                >
                  {describeReminder(reminder)}
                </span>
              </div>
              <Link
                to={`/landlord/tenancies/${reminder.tenancyId}`}
                className="mt-2 inline-block text-sm font-bold text-trust-blue hover:underline"
              >
                View tenancy
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-extrabold text-night-blue">Recent activity</h2>
        {activity.length === 0 && <p className="mt-2 text-ink">Nothing yet.</p>}
        <ul className="mt-3 flex flex-col divide-y divide-mist rounded-xl bg-white shadow-sm">
          {activity.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <p className="text-sm text-ink">
                <span className="font-bold">
                  {entry.user ? (entry.user.role === "LANDLORD" ? "You" : entry.user.fullName) : "Someone"}
                </span>{" "}
                {describeActivity(entry)}
              </p>
              <p className="shrink-0 text-sm text-ink/60">{new Date(entry.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
