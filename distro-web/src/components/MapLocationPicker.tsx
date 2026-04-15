"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  MapMouseEvent,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { MapPin, Locate, Search, X } from "lucide-react";

interface LatLng {
  lat: number;
  lng: number;
}

interface MapLocationPickerProps {
  onLocationChange: (location: LatLng, address?: string) => void;
  initialLocation?: LatLng;
  label?: string;
  helperText?: string;
}

// Default center: Kathmandu
const DEFAULT_CENTER: LatLng = { lat: 27.7172, lng: 85.324 };

function MarkerWithPan({
  position,
  onDrag,
}: {
  position: LatLng;
  onDrag: (pos: LatLng) => void;
}) {
  const map = useMap();

  const handleDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const newPos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        onDrag(newPos);
        map?.panTo(newPos);
      }
    },
    [map, onDrag]
  );

  return (
    <AdvancedMarker
      position={position}
      draggable
      onDragEnd={handleDragEnd}
    />
  );
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
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;
    const ac = new placesLib.Autocomplete(inputRef.current, {
      fields: ["geometry", "formatted_address", "name"],
      componentRestrictions: { country: "np" },
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
      setValue(address);
      onPlaceSelect(pos, address);
    });
    return () => listener.remove();
  }, [autocomplete, onPlaceSelect]);

  return (
    <div className="relative">
      <Search
        size={16}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search for a place or address in Nepal"
        className="w-full border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm bg-white focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/10 transition"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ink"
          aria-label="Clear search"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

function MapCanvas({
  markerPos,
  onDrag,
  onMapClick,
}: {
  markerPos: LatLng;
  onDrag: (pos: LatLng) => void;
  onMapClick: (e: MapMouseEvent) => void;
}) {
  return (
    <Map
      defaultCenter={markerPos}
      center={markerPos}
      defaultZoom={14}
      mapId="distro-delivery-map"
      onClick={onMapClick}
      className="w-full h-full"
    >
      <MarkerWithPan position={markerPos} onDrag={onDrag} />
    </Map>
  );
}

export default function MapLocationPicker({
  onLocationChange,
  initialLocation,
  label = "Pin your store location",
  helperText = "Search, drag the marker, or tap the map to set your exact location.",
}: MapLocationPickerProps) {
  const [markerPos, setMarkerPos] = useState<LatLng>(() => {
    if (initialLocation) {
      const lat = Number(initialLocation.lat);
      const lng = Number(initialLocation.lng);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
    return DEFAULT_CENTER;
  });
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  const handleDrag = useCallback(
    (pos: LatLng) => {
      setMarkerPos(pos);
      onLocationChange(pos);
    },
    [onLocationChange]
  );

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      const ll = e.detail.latLng;
      if (ll) {
        const pos = { lat: ll.lat, lng: ll.lng };
        setMarkerPos(pos);
        onLocationChange(pos);
      }
    },
    [onLocationChange]
  );

  const handlePlaceSelect = useCallback(
    (pos: LatLng, address: string) => {
      setMarkerPos(pos);
      onLocationChange(pos, address);
    },
    [onLocationChange]
  );

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setMarkerPos(location);
        onLocationChange(location);
        setLocating(false);
      },
      () => {
        setError("Unable to retrieve your location. Please pin it manually.");
        setLocating(false);
      }
    );
  }

  if (!apiKey || apiKey === "your_google_maps_api_key_here") {
    return (
      <div className="rounded-xl border border-gray-200 bg-blue-pale p-6 text-center">
        <MapPin size={32} className="mx-auto text-blue mb-2" />
        <p className="text-sm font-medium text-ink">Google Maps not configured</p>
        <p className="text-xs text-gray-400 mt-1">
          Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local
        </p>
        <div className="mt-4 bg-white rounded-lg p-3 text-left">
          <p className="text-xs text-gray-600 font-grotesk">
            Lat: {markerPos.lat.toFixed(4)}, Lng: {markerPos.lng.toFixed(4)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={["places"]}>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-medium text-ink">{label}</label>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="flex items-center gap-1.5 text-xs font-medium text-blue border border-blue rounded-lg px-3 py-1.5 hover:bg-blue-pale disabled:opacity-60 transition-colors shrink-0"
          >
            <Locate size={13} />
            {locating ? "Locating…" : "Use My Location"}
          </button>
        </div>

        <PlacesSearchBar onPlaceSelect={handlePlaceSelect} />

        {error && (
          <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm h-64 sm:h-80">
          <MapCanvas
            markerPos={markerPos}
            onDrag={handleDrag}
            onMapClick={handleMapClick}
          />
        </div>

        <div className="bg-blue-pale rounded-lg px-4 py-2 flex items-center gap-3">
          <MapPin size={14} className="text-blue flex-shrink-0" />
          <p className="font-grotesk text-xs text-gray-600">
            Lat:{" "}
            <span className="font-semibold text-ink">
              {markerPos.lat.toFixed(4)}
            </span>{" "}
            · Lng:{" "}
            <span className="font-semibold text-ink">
              {markerPos.lng.toFixed(4)}
            </span>
          </p>
        </div>

        <p className="text-xs text-gray-400">{helperText}</p>
      </div>
    </APIProvider>
  );
}
