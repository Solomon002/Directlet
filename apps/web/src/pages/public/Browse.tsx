import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { listPublicProperties, photoUrl, type PublicProperty } from "../../features/public/api";
import { parseApiError } from "../../lib/errors";
import { PlacesMap } from "../../features/maps/Maps";
import { hasLocation } from "../../features/maps/geo";
import StartConversation from "../../features/messages/StartConversation";
import { useAuthStore } from "../../stores/authStore";
import { formatRent } from "../../lib/money";
import { VerifiedBadge, confirmedText } from "../../features/verification/Badge";
import Stars from "../../features/trust/Stars";
import { bedroomRange } from "../../lib/rooms";

// Follows the brand manual's listing card: title, "Area, city / beds",
// "price / year", then Message owner. The badge shows whether the owner has been
// verified, and the list puts verified owners first.
function ListingCard({ property }: { property: PublicProperty }) {
  const user = useAuthStore((s) => s.user);
  const beds = bedroomRange(property.bedroomsMin, property.bedroomsMax);
  const vacant = property.vacantUnitCount ?? 0;
  const hasRange = vacant > 1 || (vacant === 0 && (property.unitCount ?? 0) > 1);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-white p-5 shadow-sm">
      <Link to={`/compounds/${property.id}`} aria-label={`Photos of ${property.name}`} className="-mx-5 -mt-5 mb-4 block">
        {property.coverPhotoId ? (
          <span className="relative block">
            <img
              src={photoUrl(property.coverPhotoId)}
              alt={`${property.name}, ${property.area}`}
              loading="lazy"
              className="aspect-[4/3] w-full bg-mist object-cover"
            />
            {(property.photoCount ?? 0) > 1 && (
              <span className="absolute bottom-2 right-2 rounded-full bg-night-blue/80 px-2.5 py-0.5 text-xs font-bold text-white">
                {property.photoCount} photos
              </span>
            )}
          </span>
        ) : (
          <span className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 bg-mist text-ink/50">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5" />
            </svg>
            <span className="text-xs font-bold">No photos yet</span>
          </span>
        )}
      </Link>
      <Link to={`/compounds/${property.id}`} className="font-display text-lg font-extrabold text-night-blue hover:underline">
        {property.name}
      </Link>
      <p className="mt-1 text-sm text-ink">
        {property.area}, {property.city}
        {beds ? ` / ${beds}` : ""}
      </p>
      {property.priceFrom && (
        <p className="mt-2 font-display text-lg font-extrabold text-trust-blue">
          {hasRange ? "From " : ""}
          {formatRent(property.priceFrom.amount, property.priceFrom.frequency)}
        </p>
      )}
      <p className={vacant ? "mt-1 text-sm font-bold text-direct-green" : "mt-1 text-sm font-bold text-ink/60"}>
        {vacant ? `${vacant} flat${vacant === 1 ? "" : "s"} available` : "Nothing available now"}
      </p>
      {vacant > 0 && <p className="text-xs text-ink/60">{confirmedText(property.availabilityConfirmedDaysAgo)}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <VerifiedBadge landlord={property.landlord} />
        {property.rating && (
          <span className="inline-flex items-center gap-1 text-xs text-ink">
            <Stars value={property.rating.average} />
            <span className="font-bold">{property.rating.average}</span>
            <span className="text-ink/60">({property.rating.count})</span>
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {vacant > 0 && user?.role !== "LANDLORD" && (
          <StartConversation
            target={{ propertyId: property.id }}
            buttonLabel="Message owner"
            initialText={`Hello, I'm interested in a flat at ${property.name}. Is one still available?`}
            variant="button"
          />
        )}
        <Link to={`/compounds/${property.id}`} className="text-sm font-bold text-trust-blue hover:underline">
          See flats{property.latitude != null ? " and directions" : ""}
        </Link>
      </div>
    </div>
  );
}

export default function Browse() {
  // Filters live in the URL so a filtered search can be shared as a link.
  const [searchParams, setSearchParams] = useSearchParams();
  const city = searchParams.get("city") ?? "";
  const area = searchParams.get("area") ?? "";
  const view = searchParams.get("view") === "map" ? "map" : "list";

  const [cityDraft, setCityDraft] = useState(city);
  const [areaDraft, setAreaDraft] = useState(area);
  const [properties, setProperties] = useState<PublicProperty[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const data = await listPublicProperties({ city: city || undefined, area: area || undefined });
        // An unexpected reply (not a list) shows as "no listings" instead of crashing.
        setProperties(Array.isArray(data.properties) ? data.properties : []);
        setTotal(data.total ?? 0);
        setPage(1);
      } catch (err) {
        setLoadError(parseApiError(err).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [city, area]);

  // Adds the next page of listings under the ones already shown.
  async function handleShowMore() {
    setLoadingMore(true);
    try {
      const data = await listPublicProperties({ city: city || undefined, area: area || undefined, page: page + 1 });
      setProperties((current) => [...current, ...(Array.isArray(data.properties) ? data.properties : [])]);
      setPage(page + 1);
    } catch (err) {
      setLoadError(parseApiError(err).message);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (cityDraft.trim()) next.set("city", cityDraft.trim());
    if (areaDraft.trim()) next.set("area", areaDraft.trim());
    if (view === "map") next.set("view", "map");
    setSearchParams(next);
  }

  function handleClear() {
    setCityDraft("");
    setAreaDraft("");
    setSearchParams(view === "map" ? new URLSearchParams({ view: "map" }) : new URLSearchParams());
  }

  function setView(next: "list" | "map") {
    const params = new URLSearchParams(searchParams);
    if (next === "map") params.set("view", "map");
    else params.delete("view");
    setSearchParams(params);
  }

  // Memoised so the map only re-fits its bounds when the results change.
  const mapped = useMemo(() => properties.filter(hasLocation), [properties]);

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

      <div className="mt-4 inline-flex rounded-xl bg-white p-1 shadow-sm">
        {(["list", "map"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setView(option)}
            className={`rounded-lg px-4 py-1.5 text-sm font-bold ${
              view === option ? "bg-trust-blue text-white" : "text-ink"
            }`}
          >
            {option === "list" ? "List" : "Map"}
          </button>
        ))}
      </div>

      {loading && <p className="mt-4 text-ink">Loading...</p>}
      {loadError && <p className="mt-4 text-sm font-bold text-red-600">{loadError}</p>}

      {!loading && !loadError && properties.length === 0 && (
        <p className="mt-4 text-ink">
          {filtered ? "No compounds match that search." : "No listings yet. Check back soon."}
        </p>
      )}

      {view === "map" && !loading && !loadError && (
        <div className="mt-6">
          {mapped.length > 0 ? (
            <PlacesMap
              places={mapped}
              renderPopup={(property) => (
                <div>
                  <p className="font-display font-extrabold text-night-blue">{property.name}</p>
                  <p className="text-xs">
                    {property.area}, {property.city}
                  </p>
                  {property.priceFrom && (
                    <p className="text-xs font-bold text-trust-blue">
                      {formatRent(property.priceFrom.amount, property.priceFrom.frequency)}
                    </p>
                  )}
                  <p className="text-xs font-bold">
                    {property.vacantUnitCount ? `${property.vacantUnitCount} available` : "Fully let"}
                  </p>
                  <Link to={`/compounds/${property.id}`} className="text-xs font-bold text-trust-blue">
                    See flats and directions
                  </Link>
                </div>
              )}
            />
          ) : (
            <p className="text-ink">None of these compounds has a map location yet.</p>
          )}
          {mapped.length > 0 && mapped.length < properties.length && (
            <p className="mt-2 text-sm text-ink/60">
              {properties.length - mapped.length} compound(s) have no map location yet; switch to List to see them.
            </p>
          )}
        </div>
      )}

      <div className={`mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${view === "map" ? "hidden" : ""}`}>
        {properties.map((property) => (
          <ListingCard key={property.id} property={property} />
        ))}
      </div>

      {!loading && properties.length > 0 && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <p className="text-sm text-ink/70">
            Showing {properties.length} of {total} compounds
          </p>
          {properties.length < total && (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void handleShowMore()}
              className="rounded-xl border-2 border-trust-blue px-6 py-2.5 font-display font-extrabold text-trust-blue hover:bg-trust-blue/5 disabled:opacity-60"
            >
              {loadingMore ? "Loading..." : "Show more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
