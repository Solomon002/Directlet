import { useState, type FormEvent } from "react";
import { PickerMap, PlaceMap } from "./Maps";
import { directionsUrl, distanceKm, getCurrentPosition, type LatLng } from "./geo";
import { geocode, type GeocodeResult } from "../properties/api";
import { parseApiError } from "../../lib/errors";

// For visitors: where the house is, a one-tap route, and how far away it is.
export function DirectionsPanel({ place, label }: { place: LatLng; label: string }) {
  const [distance, setDistance] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  async function handleHowFar() {
    setLocating(true);
    setLocateError(null);
    try {
      const me = await getCurrentPosition();
      const km = distanceKm(me, place);
      setDistance(km < 1 ? `About ${Math.round(km * 1000)} m from you` : `About ${km.toFixed(1)} km from you`);
    } catch (err) {
      setLocateError((err as Error).message);
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <PlaceMap place={place} label={label} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a
          href={directionsUrl(place)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-direct-green px-4 py-2 font-display font-extrabold text-white"
        >
          Get directions
        </a>
        <button
          type="button"
          disabled={locating}
          onClick={() => void handleHowFar()}
          className="rounded-xl border-2 border-trust-blue px-4 py-2 font-display font-extrabold text-trust-blue disabled:opacity-60"
        >
          {locating ? "Finding you..." : "How far is it?"}
        </button>
      </div>
      {distance && (
        <p className="mt-2 text-sm font-bold text-ink">
          {distance} <span className="font-normal text-ink/60">(straight line; the road route is longer)</span>
        </p>
      )}
      {locateError && <p className="mt-2 text-sm font-bold text-red-600">{locateError}</p>}
    </div>
  );
}

// For landlords: search the address, use their phone's location while standing
// at the property, or tap the map. Then drag the pin to the exact gate.
export function LocationPicker({
  value,
  onChange,
  defaultQuery,
}: {
  value: LatLng | null;
  onChange: (place: LatLng | null) => void;
  defaultQuery: string;
}) {
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // A button, not a nested <form>, because this sits inside the property form.
  async function handleSearch(e?: FormEvent) {
    e?.preventDefault();
    setSearching(true);
    setMessage(null);
    setResults([]);
    try {
      const found = await geocode(query);
      setResults(found);
      if (found.length === 0) {
        setMessage("No match. Try the area and city only, or tap the map.");
      } else if (found.length === 1) {
        onChange({ latitude: found[0].latitude, longitude: found[0].longitude });
      }
    } catch (err) {
      setMessage(parseApiError(err).message);
    } finally {
      setSearching(false);
    }
  }

  async function handleUseMyLocation() {
    setLocating(true);
    setMessage(null);
    try {
      onChange(await getCurrentPosition());
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-bold text-ink">Location on the map</p>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSearch(e);
          }}
          placeholder="Search an address or area"
          className="min-w-0 flex-1 rounded-lg border border-mist px-3 py-2 font-sans text-sm text-ink"
        />
        <button
          type="button"
          disabled={searching || query.trim().length < 3}
          onClick={() => void handleSearch()}
          className="rounded-lg bg-mist px-3 py-2 text-sm font-bold text-night-blue disabled:opacity-60"
        >
          {searching ? "..." : "Search"}
        </button>
      </div>
      {results.length > 1 && (
        <ul className="flex flex-col gap-1 rounded-lg border border-mist p-2">
          {results.map((result) => (
            <li key={`${result.latitude},${result.longitude}`}>
              <button
                type="button"
                onClick={() => {
                  onChange({ latitude: result.latitude, longitude: result.longitude });
                  setResults([]);
                }}
                className="text-left text-sm text-trust-blue hover:underline"
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <button
          type="button"
          disabled={locating}
          onClick={() => void handleUseMyLocation()}
          className="text-sm font-bold text-trust-blue hover:underline disabled:opacity-60"
        >
          {locating ? "Finding you..." : "Use my current location"}
        </button>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="text-sm font-bold text-red-600 hover:underline">
            Remove pin
          </button>
        )}
      </div>
      {message && <p className="text-sm font-bold text-red-600">{message}</p>}
      <PickerMap value={value} onChange={onChange} />
      <p className="text-xs text-ink/60">
        {value
          ? "Drag the pin onto the exact gate. Visitors get directions to this spot."
          : "Tap the map to drop a pin. Without one, visitors see no map or directions."}
      </p>
    </div>
  );
}
