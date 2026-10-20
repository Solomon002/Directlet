import { useEffect, useState } from "react";
import { Link } from "react-router";
import { listPublicProperties, type PublicProperty } from "../../features/public/api";
import { parseApiError } from "../../lib/errors";

export default function Browse() {
  const [properties, setProperties] = useState<PublicProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await listPublicProperties();
        setProperties(data.properties);
      } catch (err) {
        setLoadError(parseApiError(err).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">Browse compounds</h1>

      {loading && <p className="mt-4 text-ink">Loading...</p>}
      {loadError && <p className="mt-4 text-sm font-bold text-red-600">{loadError}</p>}

      {!loading && !loadError && properties.length === 0 && (
        <p className="mt-4 text-ink">No listings yet. Check back soon.</p>
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
            <p className="mt-2 text-sm font-bold text-trust-blue">
              {property._count?.units ?? 0} unit(s) available
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
