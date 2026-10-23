export type LatLng = { latitude: number; longitude: number };

// Lagos, used when nothing else is known.
export const DEFAULT_CENTER: LatLng = { latitude: 6.5244, longitude: 3.3792 };

export function hasLocation<T extends { latitude?: number | null; longitude?: number | null }>(
  place: T,
): place is T & LatLng {
  return typeof place.latitude === "number" && typeof place.longitude === "number";
}

// Opens Google Maps with the route already filled in: the Maps app on a
// phone, maps.google.com on a computer. The start is the user's location.
export function directionsUrl(place: LatLng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
}

// Straight-line ("as the crow flies") distance in kilometres.
export function distanceKm(from: LatLng, to: LatLng) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Your browser cannot share your location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location permission was denied. Allow it in your browser settings and try again."
              : "Could not get your location. Try again outside or with GPS on.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}
