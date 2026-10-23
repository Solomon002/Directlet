import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { listMyProperties, createProperty, type Property } from "../../features/properties/api";
import { parseApiError } from "../../lib/errors";

export default function Properties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("Lagos");
  const [state, setState] = useState("Lagos");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadProperties() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listMyProperties();
      setProperties(data);
    } catch (err) {
      setLoadError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProperties();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      await createProperty({ name, address, area, city, state, description: description || undefined });
      setName("");
      setAddress("");
      setArea("");
      setDescription("");
      setShowForm(false);
      await loadProperties();
    } catch (err) {
      setFormError(parseApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold text-night-blue">Properties</h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl bg-trust-blue px-4 py-2 font-display font-extrabold text-white"
        >
          {showForm ? "Cancel" : "Add property"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mt-6 flex max-w-md flex-col gap-3 rounded-xl bg-white p-6 shadow-sm">
          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Address
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Area
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              required
              className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
            />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm font-bold text-ink">
              City
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm font-bold text-ink">
              State
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
                className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Description <span className="font-normal text-ink/60">(optional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
              rows={2}
            />
          </label>

          {formError && <p className="text-sm font-bold text-red-600">{formError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-xl bg-trust-blue px-5 py-3 font-display font-extrabold text-white disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create property"}
          </button>
        </form>
      )}

      <div className="mt-6">
        {loading && <p className="text-ink">Loading...</p>}
        {loadError && <p className="text-sm font-bold text-red-600">{loadError}</p>}

        {!loading && !loadError && properties.length === 0 && (
          <p className="text-ink">No properties yet. Add your first one above.</p>
        )}

        <ul className="flex flex-col gap-3">
          {properties.map((property) => (
            <li key={property.id} className="rounded-xl bg-white p-4 shadow-sm">
              <Link
                to={`/landlord/properties/${property.id}`}
                className="font-display text-lg font-extrabold text-night-blue"
              >
                {property.name}
              </Link>
              <p className="text-sm text-ink">
                {property.area}, {property.city} - {property._count?.units ?? 0} unit(s)
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
