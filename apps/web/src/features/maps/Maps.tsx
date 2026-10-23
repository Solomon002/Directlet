import { useEffect, type ReactNode } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_CENTER, type LatLng } from "./geo";

// A brand-coloured pin drawn with CSS, so no marker image files are needed.
const pinIcon = L.divIcon({
  className: "",
  html: `<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;background:#174A9D;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:rotate(-45deg)"></span>`,
  iconSize: [22, 22],
  iconAnchor: [11, 22],
  popupAnchor: [0, -22],
});

function BaseMap({
  center,
  zoom,
  className,
  children,
}: {
  center: LatLng;
  zoom: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={zoom}
      scrollWheelZoom={false}
      className={className ?? "h-64 w-full rounded-xl"}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {children}
    </MapContainer>
  );
}

// One property, read-only.
export function PlaceMap({ place, label }: { place: LatLng; label: string }) {
  return (
    <BaseMap center={place} zoom={16}>
      <Marker position={[place.latitude, place.longitude]} icon={pinIcon}>
        <Popup>{label}</Popup>
      </Marker>
    </BaseMap>
  );
}

function FitToPlaces({ places }: { places: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (places.length === 0) return;
    if (places.length === 1) {
      map.setView([places[0].latitude, places[0].longitude], 15);
      return;
    }
    map.fitBounds(
      L.latLngBounds(places.map((p) => [p.latitude, p.longitude] as [number, number])),
      { padding: [32, 32] },
    );
  }, [map, places]);
  return null;
}

// Many properties, each pin with a popup (used by Browse).
export function PlacesMap<T extends LatLng & { id: string }>({
  places,
  renderPopup,
}: {
  places: T[];
  renderPopup: (place: T) => ReactNode;
}) {
  return (
    <BaseMap center={places[0] ?? DEFAULT_CENTER} zoom={12} className="h-[28rem] w-full rounded-xl">
      <FitToPlaces places={places} />
      {places.map((place) => (
        <Marker key={place.id} position={[place.latitude, place.longitude]} icon={pinIcon}>
          <Popup>{renderPopup(place)}</Popup>
        </Marker>
      ))}
    </BaseMap>
  );
}

function ClickToPlace({ onPick }: { onPick: (place: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });
  return null;
}

function FlyTo({ place }: { place: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (place) map.setView([place.latitude, place.longitude], Math.max(map.getZoom(), 16));
  }, [map, place]);
  return null;
}

// The landlord taps the map or drags the pin to set the exact spot.
export function PickerMap({ value, onChange }: { value: LatLng | null; onChange: (place: LatLng) => void }) {
  return (
    <BaseMap center={value ?? DEFAULT_CENTER} zoom={value ? 16 : 11}>
      <ClickToPlace onPick={onChange} />
      <FlyTo place={value} />
      {value && (
        <Marker
          position={[value.latitude, value.longitude]}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend(e) {
              const { lat, lng } = (e.target as L.Marker).getLatLng();
              onChange({ latitude: lat, longitude: lng });
            },
          }}
        />
      )}
    </BaseMap>
  );
}
