import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { listPublicProperties, type PublicProperty } from "../../features/public/api";
import { parseApiError } from "../../lib/errors";

export default function Browse() {
  // Filters live in the URL so a filtered search can be shared as a link.
  const [searchParams, setSearchParams] = useSearchParams();
  const city = searchParams.get("city") ?? "";
  const area = searchParams.get("area") ?? "";

  const [cityDraft, setCityDraft] = useState(city);
  const [areaDraft, setAreaDraft] = useState(area);
  const [properties, setProperties] = useState<PublicProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const data = await listPublicProperties({ city: city || undefined, area: area || undefined });
        setProperties(data.properties);
      } catch (err) {
        setLoadError(parseApiError(err).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [city, area]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (cityDraft.trim()) next.set("city", cityDraft.trim());
    if (areaDraft.trim()) next.set("area", areaDraft.trim());
    setSearchParams(next);
  }

  function handleClear() {
    setCityDraft("");
    setAreaDraft("");
    setSearchParams(new URLSearchParams());
  }

  const filtered = Boolean(city || area);

  return (
    <div className="p-4 sm:p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">Browse compounds</h1>

      <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-sm font-bold text-ink">
          City
          <input
            value={cityDraft}
            onChange={(e) => setCityDraft(e.target.value)}
            placeholder="e.g. Lagos"
            className="rounded-lg border border-mist bg-white px-3 py-2 font-sans text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold text-ink">
          Area
          <input
            value={areaDraft}
            onChange={(e) => setAreaDraft(e.target.value)}
            placeholder="e.g. Yaba"
            className="rounded-lg border border-mist bg-white px-3 py-2 font-sans text-ink"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-xl bg-trust-blue px-5 py-2 font-display font-extrabold text-white"
          >
            Search
          </button>
          {filtered && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-xl px-3 py-2 text-sm font-bold text-trust-blue hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {loading && <p className="mt-4 text-ink">Loading...</p>}
      {loadError && <p className="mt-4 text-sm font-bold text-red-600">{loadError}</p>}

      {!loading && !loadError && properties.length === 0 && (
        <p className="mt-4 text-ink">
          {filtered ? "No compounds match that search." : "No listings yet. Check back soon."}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((property) => (
          <Link
            key={property.id}
            to={`/compounds/${property.id}`}
            className="rounded-xl bg-white p-5 shadow-sm"
          >
            <p className="font-display text-lg font-extrabold text-night-blue">{property.name}</p>
            <p className="mt-1 text-sm text-ink">
              {property.area}, {property.city}
            </p>
            <p
              className={
                property.vacantUnitCount
                  ? "mt-2 text-sm font-bold text-direct-green"
                  : "mt-2 text-sm font-bold text-ink/60"
              }
            >
              {property.vacantUnitCount
                ? `${property.vacantUnitCount} of ${property.unitCount} flat(s) vacant`
                : "Fully let"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
