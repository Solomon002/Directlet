import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router";
import { getPublicProperty, photoUrl, type PublicProperty, type PublicUnit } from "../../features/public/api";
import { requestInspection } from "../../features/inspections/api";
import { parseApiError } from "../../lib/errors";
import { DirectionsPanel } from "../../features/maps/LocationTools";
import { hasLocation } from "../../features/maps/geo";
import StartConversation from "../../features/messages/StartConversation";
import { useAuthStore } from "../../stores/authStore";
import { formatRent, naira } from "../../lib/money";
import { bedroomLabel } from "../../lib/rooms";
import { VerifiedBadge, confirmedText } from "../../features/verification/Badge";
import ReviewsSection from "../../features/trust/ReviewsSection";
import ReportListing from "../../features/trust/ReportListing";
import ConfirmEmail from "../../features/trust/ConfirmEmail";
import Stars from "../../features/trust/Stars";

// One large picture with a strip of the rest to switch between. Pictures of a single
// flat say which one, so a visitor knows what they are looking at.
function Gallery({ property }: { property: PublicProperty }) {
  const photos = property.photos ?? [];
  const [selected, setSelected] = useState(0);

  if (photos.length === 0) {
    return (
      <p className="mt-4 max-w-2xl rounded-xl border-l-4 border-amber-500 bg-white p-3 text-sm text-ink shadow-sm">
        <span className="font-bold text-night-blue">No photos yet.</span> Ask the owner for pictures or a video call
        before you travel to see it.
      </p>
    );
  }

  const current = photos[Math.min(selected, photos.length - 1)];
  const flat = property.units?.find((unit) => unit.id === current.unitId)?.label;

  return (
    <div className="mt-4 max-w-2xl">
      <img
        src={photoUrl(current.id)}
        alt={flat ? `${property.name}, ${flat}` : property.name}
        className="aspect-[4/3] w-full rounded-xl bg-mist object-cover shadow-sm"
      />
      <p className="mt-1 text-xs text-ink/60">
        {flat ?? "The property"} · photo {selected + 1} of {photos.length}
      </p>
      {photos.length > 1 && (
        <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo, index) => (
            <li key={photo.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-label={`Show photo ${index + 1}`}
                aria-current={index === selected}
                className={`block overflow-hidden rounded-lg border-2 ${index === selected ? "border-trust-blue" : "border-transparent"}`}
              >
                <img src={photoUrl(photo.id)} alt="" loading="lazy" className="h-16 w-20 bg-mist object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// "a, b and c"
function joinWithAnd(items: string[]) {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : (items[0] ?? "");
}

// The flat's rent and every one-off cost on one card, so there are no surprises
// at the door. A fee the landlord has not stated is shown as such, never as free.
function PriceBreakdown({ unit }: { unit: PublicUnit }) {
  return (
    <div className="mt-3 max-w-sm rounded-xl border border-mist p-3 text-sm">
      <dl className="flex flex-col gap-1">
        <div className="flex justify-between gap-3">
          <dt className="text-ink">Rent</dt>
          <dd className="font-bold text-ink">{formatRent(unit.rentAmount, unit.rentFrequency)}</dd>
        </div>
        {unit.fees.map((fee) => (
          <div key={fee.key} className="flex justify-between gap-3">
            <dt className="text-ink">{fee.label}</dt>
            <dd className={fee.amount === null ? "text-ink/60" : "font-bold text-ink"}>
              {fee.amount === null ? "Ask landlord" : Number(fee.amount) === 0 ? "None" : naira(fee.amount)}
            </dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between gap-3 border-t border-mist pt-2">
          <dt className="font-bold text-night-blue">Total to move in</dt>
          <dd className="font-display font-extrabold text-night-blue">{naira(unit.moveInTotal)}</dd>
        </div>
      </dl>
      {unit.unstatedFees.length > 0 && (
        <p className="mt-2 text-xs text-ink/70">
          The total does not include {joinWithAnd(unit.unstatedFees.map((fee) => fee.toLowerCase()))}, which the landlord
          has not stated. Ask before you commit.
        </p>
      )}
    </div>
  );
}

export default function CompoundPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const [property, setProperty] = useState<PublicProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [openUnitId, setOpenUnitId] = useState<string | null>(null);
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorMessage, setVisitorMessage] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  async function load() {
    if (!propertyId) return;
    try {
      setProperty(await getPublicProperty(propertyId));
    } catch (err) {
      setLoadError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [propertyId]);

  function toggleForm(unitId: string) {
    setOpenUnitId((current) => (current === unitId ? null : unitId));
    setFormError(null);
    setFormSuccess(null);
  }

  async function handleRequestInspection(e: FormEvent, unitId: string) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      await requestInspection(unitId, {
        phone: visitorPhone,
        message: visitorMessage || undefined,
        preferredDate: preferredDate || undefined,
      });
      setFormSuccess("Request sent. The landlord will confirm a day. You can follow it under My viewings.");
      setVisitorPhone("");
      setVisitorMessage("");
      setPreferredDate("");
    } catch (err) {
      setFormError(parseApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-4 sm:p-8 text-ink">Loading...</div>;
  }

  if (loadError || !property) {
    return <div className="p-4 sm:p-8 text-sm font-bold text-red-600">{loadError ?? "Listing not found."}</div>;
  }

  return (
    <div className="p-4 sm:p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">{property.name}</h1>
      <p className="mt-1 text-sm text-ink">
        {property.address}, {property.area}, {property.city}, {property.state}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <VerifiedBadge landlord={property.landlord} detailed />
        {property.reviews && property.reviews.count > 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm text-ink">
            <Stars value={property.reviews.average ?? 0} />
            <span className="font-bold">{property.reviews.average}</span>
            <span className="text-ink/60">({property.reviews.count})</span>
          </span>
        )}
      </div>
      <Gallery property={property} />
      {property.description && <p className="mt-2 text-ink">{property.description}</p>}

      <p className="mt-4 max-w-2xl rounded-xl border-l-4 border-trust-blue bg-white p-3 text-sm text-ink shadow-sm">
        <span className="font-bold text-night-blue">Stay safe:</span> view the property and meet the owner before you
        pay anything. Never pay a deposit or fee to someone you have not met, and pay in a way you can trace.
      </p>

      {hasLocation(property) && (
        <div className="mt-6 max-w-2xl">
          <h2 className="font-display text-lg font-extrabold text-night-blue">Location</h2>
          <div className="mt-3">
            <DirectionsPanel place={property} label={property.name} />
          </div>
        </div>
      )}

      <h2 className="mt-8 font-display text-lg font-extrabold text-night-blue">Flats</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {property.units?.map((unit) => (
          <li key={unit.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display font-extrabold text-night-blue">{unit.label}</p>
              <span
                className={
                  unit.availability === "AVAILABLE"
                    ? "rounded-full bg-direct-green/10 px-3 py-1 text-xs font-bold text-direct-green"
                    : unit.availability === "UNCONFIRMED"
                      ? "rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800"
                      : "rounded-full bg-mist px-3 py-1 text-xs font-bold text-ink/60"
                }
              >
                {unit.availability === "AVAILABLE" ? "Available" : unit.availability === "UNCONFIRMED" ? "Not confirmed" : "Let"}
              </span>
            </div>
            <p className="text-sm text-ink">
              {bedroomLabel(unit.bedrooms)}{unit.bathrooms != null ? ` - ${unit.bathrooms} bath` : ""} -{" "}
              <span className="font-bold text-trust-blue">{formatRent(unit.rentAmount, unit.rentFrequency)}</span>
            </p>
            {unit.availability !== "LET" && <PriceBreakdown unit={unit} />}
            {unit.availability === "AVAILABLE" && (
              <p className="mt-2 text-xs text-ink/60">{confirmedText(unit.availabilityConfirmedDaysAgo)}</p>
            )}
            {unit.availability === "UNCONFIRMED" && (
              <p className="mt-2 text-sm text-ink">
                The landlord has not confirmed this flat is still available. Message them to check before you plan a
                visit.
              </p>
            )}
            {unit.availability === "LET" && unit.availableFrom && (
              <p className="mt-1 text-sm text-ink">
                Free from {new Date(unit.availableFrom).toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}

            {unit.availability !== "LET" && (
              <div className="mt-2 flex flex-wrap items-start gap-x-6 gap-y-2">
                {unit.isVacant && user?.role !== "LANDLORD" && user?.role !== "ADMIN" && (
                  <button
                    type="button"
                    onClick={() => toggleForm(unit.id)}
                    className="text-sm font-bold text-trust-blue hover:underline"
                  >
                    {openUnitId === unit.id ? "Cancel" : "Request a viewing"}
                  </button>
                )}
                {user?.role !== "LANDLORD" && (
                  <StartConversation
                    target={{ propertyId: property.id, unitId: unit.id }}
                    buttonLabel="Message owner"
                    initialText={`Hello, is ${unit.label} at ${property.name} still available?`}
                  />
                )}
              </div>
            )}

            {unit.isVacant && openUnitId === unit.id && !user && (
              <div className="mt-3 max-w-sm rounded-xl bg-mist p-4 text-sm text-ink">
                <p className="font-bold text-night-blue">Sign in to request a viewing</p>
                <p className="mt-1">
                  A free account lets landlords know you are a real person, and keeps your phone number private until
                  they accept.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to="/login"
                    state={{ from: { pathname: location.pathname } }}
                    className="rounded-lg bg-trust-blue px-4 py-2 font-display font-extrabold text-white"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/register"
                    state={{ from: { pathname: location.pathname } }}
                    className="rounded-lg border-2 border-trust-blue px-4 py-2 font-display font-extrabold text-trust-blue"
                  >
                    Sign up
                  </Link>
                </div>
              </div>
            )}

            {unit.isVacant && openUnitId === unit.id && user?.needsEmailConfirmation && (
              <div className="mt-3 max-w-sm">
                <ConfirmEmail compact />
              </div>
            )}

            {unit.isVacant && openUnitId === unit.id && user && !user.needsEmailConfirmation && (
              <form
                onSubmit={(e) => void handleRequestInspection(e, unit.id)}
                className="mt-3 flex max-w-sm flex-col gap-3 rounded-xl bg-mist p-4"
              >
                <p className="text-sm text-ink">
                  Asking as <span className="font-bold">{user.fullName}</span> ({user.email}).
                </p>
                <label className="flex flex-col gap-1 text-sm font-bold text-ink">
                  Phone
                  <input
                    type="tel"
                    value={visitorPhone}
                    onChange={(e) => setVisitorPhone(e.target.value)}
                    required
                    minLength={7}
                    className="w-full rounded-lg border border-mist bg-white px-3 py-2 font-sans text-ink"
                  />
                  <span className="text-xs font-normal text-ink/60">
                    Shared with the landlord only if they accept your request.
                  </span>
                </label>
                <label className="flex flex-col gap-1 text-sm font-bold text-ink">
                  Preferred date <span className="font-normal text-ink/60">(optional)</span>
                  <input
                    type="date"
                    value={preferredDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full rounded-lg border border-mist bg-white px-3 py-2 font-sans text-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-bold text-ink">
                  Message <span className="font-normal text-ink/60">(optional)</span>
                  <textarea
                    value={visitorMessage}
                    onChange={(e) => setVisitorMessage(e.target.value)}
                    rows={2}
                    className="rounded-lg border border-mist bg-white px-3 py-2 font-sans text-ink"
                  />
                </label>

                <p className="rounded-lg bg-white p-2.5 text-xs text-ink">
                  <span className="font-bold text-night-blue">Before you go:</span> meet the owner at the property, and
                  do not pay anything until you have seen it and met them.
                </p>

                {formError && <p role="alert" className="text-sm font-bold text-red-600">{formError}</p>}
                {formSuccess && (
                  <p className="text-sm font-bold text-direct-green">
                    {formSuccess}{" "}
                    <Link to="/viewings" className="underline">
                      My viewings
                    </Link>
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-1 rounded-xl bg-trust-blue px-5 py-3 font-display font-extrabold text-white disabled:opacity-60"
                >
                  {submitting ? "Sending..." : "Send request"}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>

      {property.reviews && <ReviewsSection propertyId={property.id} reviews={property.reviews} onPosted={() => void load()} />}
      <ReportListing propertyId={property.id} />
    </div>
  );
}
