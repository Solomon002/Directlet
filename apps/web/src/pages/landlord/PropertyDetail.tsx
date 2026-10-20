import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router";
import { getMyProperty, createUnit, type Property } from "../../features/properties/api";
import { parseApiError } from "../../lib/errors";

export default function PropertyDetail() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [bedrooms, setBedrooms] = useState("1");
  const [bathrooms, setBathrooms] = useState("1");
  const [rentAmount, setRentAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    if (!propertyId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getMyProperty(propertyId);
      setProperty(data);
    } catch (err) {
      setLoadError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [propertyId]);

  async function handleAddUnit(e: FormEvent) {
    e.preventDefault();
    if (!propertyId) return;
    setSubmitting(true);
    setFormError(null);

    try {
      await createUnit(propertyId, {
        label,
        bedrooms: Number(bedrooms),
        bathrooms: bathrooms ? Number(bathrooms) : undefined,
        rentAmount: Number(rentAmount),
      });
      setLabel("");
      setBedrooms("1");
      setBathrooms("1");
      setRentAmount("");
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(parseApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-ink">Loading...</div>;
  }

  if (loadError || !property) {
    return <div className="p-8 text-sm font-bold text-red-600">{loadError ?? "Property not found."}</div>;
  }

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">{property.name}</h1>
      <p className="mt-1 text-sm text-ink">
        {property.address}, {property.area}, {property.city}, {property.state}
      </p>
      {property.description && <p className="mt-2 text-ink">{property.description}</p>}

      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-display text-lg font-extrabold text-night-blue">Units</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl bg-trust-blue px-4 py-2 font-display font-extrabold text-white"
        >
          {showForm ? "Cancel" : "Add unit"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAddUnit} className="mt-4 flex max-w-md flex-col gap-3 rounded-xl bg-white p-6 shadow-sm">
          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Label
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
            />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm font-bold text-ink">
              Bedrooms
              <input
                type="number"
                min={0}
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                required
                className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm font-bold text-ink">
              Bathrooms
              <input
                type="number"
                min={0}
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Annual rent (NGN)
            <input
              type="number"
              min={0}
              value={rentAmount}
              onChange={(e) => setRentAmount(e.target.value)}
              required
              className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
            />
          </label>

          {formError && <p className="text-sm font-bold text-red-600">{formError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-xl bg-trust-blue px-5 py-3 font-display font-extrabold text-white disabled:opacity-60"
          >
            {submitting ? "Adding..." : "Add unit"}
          </button>
        </form>
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {property.units?.map((unit) => (
          <li key={unit.id} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="font-display font-extrabold text-night-blue">{unit.label}</p>
            <p className="text-sm text-ink">
              {unit.bedrooms} bed - {unit.bathrooms ?? "?"} bath - NGN {Number(unit.rentAmount).toLocaleString()} / {unit.rentFrequency.toLowerCase()}
            </p>
          </li>
        ))}
        {property.units?.length === 0 && <p className="text-ink">No units yet.</p>}
      </ul>
    </div>
  );
}
