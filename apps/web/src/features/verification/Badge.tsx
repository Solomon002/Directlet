import type { PublicLandlord } from "../public/api";

const SHIELD = "M12 3 4.5 6v5.5c0 4.6 3 8 7.5 9.5 4.5-1.5 7.5-4.9 7.5-9.5V6L12 3zM9 12l2.2 2.2L15.5 10";

// Shown next to a listing. A verified landlord gets a green badge; for a company it
// also names the CAC registration so a visitor can look it up themselves.
export function VerifiedBadge({ landlord, detailed = false }: { landlord: PublicLandlord; detailed?: boolean }) {
  if (!landlord.verified) {
    return (
      <span className="inline-flex items-center rounded-full bg-mist px-2.5 py-0.5 text-xs font-bold text-ink/60">
        Not yet verified
      </span>
    );
  }

  const company = landlord.landlordType === "COMPANY" && landlord.cacNumber;
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-direct-green/10 px-2.5 py-0.5 text-xs font-bold text-green-700">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={SHIELD} />
        </svg>
        Verified {company ? "business" : "owner"}
      </span>
      {detailed && company && (
        <span className="text-xs text-ink/70">
          {landlord.registeredName ? `${landlord.registeredName} · ` : ""}CAC {landlord.cacType} {landlord.cacNumber}
        </span>
      )}
    </span>
  );
}

// "Confirmed today", "Confirmed 3 days ago".
export function confirmedText(daysAgo: number | null | undefined) {
  if (daysAgo == null) return null;
  if (daysAgo === 0) return "Availability confirmed today";
  return `Availability confirmed ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
}
