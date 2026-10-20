import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { getPublicProperty, type PublicProperty } from "../../features/public/api";
import { parseApiError } from "../../lib/errors";

export default function CompoundPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [property, setProperty] = useState<PublicProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  if (loading) {
    return <div className="p-8 text-ink">Loading...</div>;
  }

  if (loadError || !property) {
    return <div className="p-8 text-sm font-bold text-red-600">{loadError ?? "Listing not found."}</div>;
  }

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">{property.name}</h1>
      <p className="mt-1 text-sm text-ink">
        {property.address}, {property.area}, {property.city}, {property.state}
      </p>
      {property.description && <p className="mt-2 text-ink">{property.description}</p>}

      <h2 className="mt-8 font-display text-lg font-extrabold text-night-blue">Available units</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {property.units?.map((unit) => (
          <li key={unit.id} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="font-display font-extrabold text-night-blue">{unit.label}</p>
            <p className="text-sm text-ink">
              {unit.bedrooms} bed - {unit.bathrooms ?? "?"} bath - NGN {Number(unit.rentAmount).toLocaleString()} / {unit.rentFrequency.toLowerCase()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
