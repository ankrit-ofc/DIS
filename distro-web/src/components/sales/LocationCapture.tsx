"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  MapMouseEvent,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { LocateFixed, MapPin, Search, X } from "lucide-react";

export interface LatLng {
  lat: number;
  lng: number;
}

const KATHMANDU: LatLng = { lat: 27.7172, lng: 85.324 };

// Rough centers for the districts DISTRO serves; anything unknown falls back
// to Kathmandu. Only used to frame the map before a pin exists.
const DISTRICT_CENTERS: Record<string, LatLng> = {
  Kathmandu: KATHMANDU,
  Lalitpur: { lat: 27.6644, lng: 85.3188 },
  Bhaktapur: { lat: 27.671, lng: 85.4298 },
};

// Kathmandu Valley bounding box — biases Places suggestions to the valley.
const VALLEY_BOUNDS: google.maps.LatLngBoundsLiteral = {
  north: 27.82,
  south: 27.55,
  east: 85.6,
  west: 85.18,
};

export function districtCenter(district?: string | null): LatLng {
  return (district && DISTRICT_CENTERS[district]) || KATHMANDU;
}

interface LocationCaptureProps {
  value: LatLng | null;
  /** reverseAddress is only passed when GPS/place search resolved an address. */
  onChange: (pos: LatLng, reverseAddress?: string) => void;
  /** Frames the empty map — selected district's center, else Kathmandu. */
  district?: string | null;
}

/** Best-effort reverse geocode via Google Geocoding. Resolves null on any failure. */
async function reverseGeocode(pos: LatLng): Promise<string | null> {
  try {
    if (typeof google === "undefined" || !google.maps) return null;
    const geocoder = new google.maps.Geocoder();
    const { results } = await geocoder.geocode({ location: pos });
    const first = results?.[0];
    if (!first) return null;
    // Prefer a short local line over the full country-length formatted_address.
    const parts = first.address_components ?? [];
    const get = (type: string) =>
      parts.find((c) => c.types.includes(type))?.long_name;
    const short = [
      get("route"),
      get("sublocality") ?? get("neighborhood"),
      get("locality"),
    ]
      .filter(Boolean)
      .join(", ");
    return short || first.formatted_address || null;
  } catch {
    return null;
  }
}

/** Keeps the map framed on the pin (or district center while there is none). */
function Recenter({ target, zoom }: { target: LatLng; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.panTo(target);
    if (zoom) map.setZoom(zoom);
  }, [map, target.lat, target.lng, zoom]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function PlacesSearchBar({
  onPlaceSelect,
}: {
  onPlaceSelect: (pos: LatLng, address: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const placesLib = useMapsLibrary("places");
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;
    const ac = new placesLib.Autocomplete(inputRef.current, {
      fields: ["geometry", "formatted_address", "name"],
      componentRestrictions: { country: "np" },
      bounds: VALLEY_BOUNDS,
    });
    setAutocomplete(ac);
    return () => {
      google.maps.event.clearInstanceListeners(ac);
    };
  }, [placesLib]);

  useEffect(() => {
    if (!autocomplete) return;
    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) return;
      const pos = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      };
      const address = place.formatted_address || place.name || "";
      setText(address);
      onPlaceSelect(pos, address);
    });
    return () => listener.remove();
  }, [autocomplete, onPlaceSelect]);

  return (
    <div className="relative">
      <Search
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search a place — e.g. Bhatbhateni Boudha"
        className="w-full border border-gray-200 rounded-[6px] pl-9 pr-9 py-2.5 text-sm bg-white focus:outline-none focus:border-blue"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText("");
            inputRef.current?.focus();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ink"
          aria-label="Clear place search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function CaptureInner({ value, onChange, district }: LocationCaptureProps) {
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  // Bumped on GPS fix / place select so Recenter zooms in even if the pin barely moved.
  const [focusZoom, setFocusZoom] = useState<number | undefined>(undefined);
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
        setFocusZoom(17);
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

  const handlePlaceSelect = useCallback(
    (pos: LatLng, address: string) => {
      setFocusZoom(17);
      onChange(pos, address);
    },
    [onChange]
  );

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      const ll = e.detail.latLng;
      if (ll) onChange({ lat: ll.lat, lng: ll.lng });
    },
    [onChange]
  );

  const handleDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) onChange({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    },
    [onChange]
  );

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

      <PlacesSearchBar onPlaceSelect={handlePlaceSelect} />

      {gpsError && <p className="text-xs text-amber-700">{gpsError}</p>}

      <div className="h-64 rounded-[8px] overflow-hidden border border-gray-200 relative z-0">
        <Map
          defaultCenter={center}
          defaultZoom={value ? 17 : 14}
          mapId="distro-delivery-map"
          onClick={handleMapClick}
          className="w-full h-full"
        >
          <Recenter target={center} zoom={value ? focusZoom : undefined} />
          {value && (
            <AdvancedMarker position={value} draggable onDragEnd={handleDragEnd} />
          )}
        </Map>
      </div>

      <p className="text-xs text-gray-400">
        {value
          ? `Pinned at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} — drag the pin to adjust.`
          : "Optional — search a place, tap the map, or use the button above."}
      </p>
    </div>
  );
}

/**
 * GPS-first location capture for the sales portal (mobile-first): a large
 * "use my current location" button, Google Places search biased to the valley,
 * tap-to-drop on the map, and a draggable pin to nudge GPS drift. Location
 * stays optional — parents must submit fine with value === null.
 *
 * Uses the same Google Maps loader + NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as the
 * buyer-side MapLocationPicker — one maps setup for the whole product.
 */
export default function LocationCapture(props: LocationCaptureProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  if (!apiKey || apiKey === "your_google_maps_api_key_here") {
    return (
      <div className="rounded-[8px] border border-gray-200 bg-blue-light/40 p-6 text-center">
        <MapPin size={28} className="mx-auto text-blue mb-2" />
        <p className="text-sm font-medium text-ink">Google Maps not configured</p>
        <p className="text-xs text-gray-400 mt-1">
          Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local
        </p>
        {props.value && (
          <p className="mt-3 text-xs text-gray-600 font-grotesk">
            Lat: {props.value.lat.toFixed(4)}, Lng: {props.value.lng.toFixed(4)}
          </p>
        )}
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={["places"]}>
      <CaptureInner {...props} />
    </APIProvider>
  );
}
