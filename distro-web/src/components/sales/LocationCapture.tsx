"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { LocateFixed } from "lucide-react";
import "leaflet/dist/leaflet.css";

export interface LatLng {
  lat: number;
  lng: number;
}

// Default Leaflet marker images 404 under bundlers — inline SVG pin instead.
const pinIcon = L.divIcon({
  className: "",
  html: `<svg width="34" height="34" viewBox="0 0 24 24" fill="#1A4BDB" stroke="#fff" stroke-width="1.2" style="filter: drop-shadow(0 2px 3px rgba(13,17,32,.35))"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"/><circle cx="12" cy="9" r="2.6" fill="#fff" stroke="none"/></svg>`,
  iconSize: [34, 34],
  iconAnchor: [17, 32],
});

const KATHMANDU: LatLng = { lat: 27.7172, lng: 85.324 };

// Rough centers for the districts DISTRO serves; anything unknown falls back
// to Kathmandu. Only used to frame the map before a pin exists.
const DISTRICT_CENTERS: Record<string, LatLng> = {
  Kathmandu: KATHMANDU,
  Lalitpur: { lat: 27.6644, lng: 85.3188 },
  Bhaktapur: { lat: 27.671, lng: 85.4298 },
};

export function districtCenter(district?: string | null): LatLng {
  return (district && DISTRICT_CENTERS[district]) || KATHMANDU;
}

/** Best-effort reverse geocode via OSM Nominatim. Resolves null on any failure. */
async function reverseGeocode(pos: LatLng): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pos.lat}&lon=${pos.lng}&zoom=17`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      display_name?: string;
      address?: { road?: string; suburb?: string; neighbourhood?: string; city?: string };
    };
    const a = data.address;
    // Prefer a short local line over the full country-length display_name.
    const short = [a?.road, a?.neighbourhood ?? a?.suburb, a?.city].filter(Boolean).join(", ");
    return short || data.display_name || null;
  } catch {
    return null;
  }
}

function TapToPlace({ onPlace }: { onPlace: (pos: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPlace({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/** Keeps the map framed on the pin (or district center while there is none). */
function Recenter({ target, zoom }: { target: LatLng; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([target.lat, target.lng], zoom ?? map.getZoom());
  }, [map, target.lat, target.lng, zoom]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

interface LocationCaptureProps {
  value: LatLng | null;
  /** reverseAddress is only passed when the GPS button resolved an address. */
  onChange: (pos: LatLng, reverseAddress?: string) => void;
  /** Frames the empty map — selected district's center, else Kathmandu. */
  district?: string | null;
}

/**
 * GPS-first location capture for the sales portal (mobile-first): a large
 * "use my current location" button, an always-available tap-to-drop OSM map,
 * and a draggable pin to nudge GPS drift. Location stays optional — parents
 * must submit fine with value === null.
 */
export default function LocationCapture({ value, onChange, district }: LocationCaptureProps) {
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  // Bumped on GPS fix so Recenter zooms in even if the pin barely moved.
  const [gpsZoom, setGpsZoom] = useState<number | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const useMyLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGpsError("This device has no location support — tap the map to drop a pin instead.");
      return;
    }
    setLocating(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setGpsZoom(17);
        // Best-effort reverse geocode; the pin lands immediately either way.
        onChange(pos);
        const addr = await reverseGeocode(pos);
        if (mounted.current) {
          if (addr) onChange(pos, addr);
          setLocating(false);
        }
      },
      (err) => {
        if (!mounted.current) return;
        setLocating(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — tap the map to drop the pin manually."
            : "Couldn't get a GPS fix — tap the map to drop the pin manually."
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }, [onChange]);

  const center = value ?? districtCenter(district);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={useMyLocation}
        disabled={locating}
        className="w-full flex items-center justify-center gap-2 bg-blue-light text-blue font-semibold text-sm py-3 rounded-[6px] hover:bg-blue-light/70 disabled:opacity-60 transition-colors"
      >
        <LocateFixed size={16} className={locating ? "animate-pulse" : ""} />
        {locating ? "Getting your location…" : "📍 Use my current location"}
      </button>

      {gpsError && <p className="text-xs text-amber-700">{gpsError}</p>}

      <div className="h-64 rounded-[8px] overflow-hidden border border-gray-200 relative z-0">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={value ? 17 : 14}
          style={{ height: "100%", width: "100%" }}
          attributionControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <TapToPlace onPlace={(pos) => onChange(pos)} />
          <Recenter target={center} zoom={value ? gpsZoom : undefined} />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const ll = (e.target as L.Marker).getLatLng();
                  onChange({ lat: ll.lat, lng: ll.lng });
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <p className="text-xs text-gray-400">
        {value
          ? `Pinned at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} — drag the pin to adjust.`
          : "Optional — tap the map to drop a pin, or use the button above."}
      </p>
    </div>
  );
}
