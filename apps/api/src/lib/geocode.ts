import { AppError } from "../utils/AppError";

// OpenStreetMap's free geocoder. Its usage policy asks for an identifying
// User-Agent and at most one request per second, so it is only called from
// the landlord's location picker (rate limited), never on public page loads.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "DirectLet/0.1 (rental platform for Nigeria)";

export type GeocodeResult = { label: string; latitude: number; longitude: number };

export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "ng");
  url.searchParams.set("limit", "5");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new AppError(502, "Address search is unavailable right now. Drop the pin on the map instead.", "GEOCODER_UNAVAILABLE");
  }

  if (!response.ok) {
    throw new AppError(502, "Address search is unavailable right now. Drop the pin on the map instead.", "GEOCODER_UNAVAILABLE");
  }

  const results = (await response.json()) as { display_name: string; lat: string; lon: string }[];
  return results.map((result) => ({
    label: result.display_name,
    latitude: Number(result.lat),
    longitude: Number(result.lon),
  }));
}
