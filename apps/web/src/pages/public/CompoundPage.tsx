import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router";
import { getPublicProperty, type PublicProperty } from "../../features/public/api";
import { requestInspection } from "../../features/inspections/api";
import { parseApiError } from "../../lib/errors";

export default function CompoundPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [property, setProperty] = useState<PublicProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [openUnitId, setOpenUnitId] = useState<string | null>(null);
  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorMessage, setVisitorMessage] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    void (async () => {
      try {
        const data = await getPublicProperty(propertyId);
        setProperty(data);
      } catch (err) {
        setLoadError(parseApiError(err).message);
      } finally {
        setLoading(false);
      }
    })();
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
        name: visitorName,
        email: visitorEmail,
        phone: visitorPhone,
        message: visitorMessage || undefined,
        preferredDate: preferredDate || undefined,
      });
      setFormSuccess("Request sent. The landlord will reach out to confirm a time.");
      setVisitorName("");
      setVisitorEmail("");
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
      {property.description && <p className="mt-2 text-ink">{property.description}</p>}

      <h2 className="mt-8 font-display text-lg font-extrabold text-night-blue">Flats</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {property.units?.map((unit) => (
          <li key={unit.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display font-extrabold text-night-blue">{unit.label}</p>
              <span
                className={
                  unit.isVacant
                    ? "rounded-full bg-direct-green/10 px-3 py-1 text-xs font-bold text-direct-green"
                    : "rounded-full bg-mist px-3 py-1 text-xs font-bold text-ink/60"
                }
              >
                {unit.isVacant ? "Vacant" : "Let"}
              </span>
            </div>
            <p className="text-sm text-ink">
              {unit.bedrooms} bed - {unit.bathrooms ?? "?"} bath - NGN {Number(unit.rentAmount).toLocaleString()} / {unit.rentFrequency.toLowerCase()}
            </p>

            {unit.isVacant && (
              <button
                type="button"
                onClick={() => toggleForm(unit.id)}
                className="mt-2 text-sm font-bold text-trust-blue hover:underline"
              >
                {openUnitId === unit.id ? "Cancel" : "Request a viewing"}
              </button>
            )}

            {unit.isVacant && openUnitId === unit.id && (
              <form
                onSubmit={(e) => void handleRequestInspection(e, unit.id)}
                className="mt-3 flex max-w-sm flex-col gap-3 rounded-xl bg-mist p-4"
              >
                <label className="flex flex-col gap-1 text-sm font-bold text-ink">
                  Your name
                  <input
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    required
                    className="rounded-lg border border-mist bg-white px-3 py-2 font-sans text-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-bold text-ink">
                  Email
                  <input
                    type="email"
                    value={visitorEmail}
                    onChange={(e) => setVisitorEmail(e.target.value)}
                    required
                    className="rounded-lg border border-mist bg-white px-3 py-2 font-sans text-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-bold text-ink">
                  Phone
                  <input
                    type="tel"
                    value={visitorPhone}
                    onChange={(e) => setVisitorPhone(e.target.value)}
                    required
                    className="rounded-lg border border-mist bg-white px-3 py-2 font-sans text-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-bold text-ink">
                  Preferred date <span className="font-normal text-ink/60">(optional)</span>
                  <input
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="rounded-lg border border-mist bg-white px-3 py-2 font-sans text-ink"
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

                {formError && <p className="text-sm font-bold text-red-600">{formError}</p>}
                {formSuccess && <p className="text-sm font-bold text-direct-green">{formSuccess}</p>}

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
    </div>
  );
}
