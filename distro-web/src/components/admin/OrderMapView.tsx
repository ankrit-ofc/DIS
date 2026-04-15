"use client";

import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";

interface Props {
  lat: number;
  lng: number;
}

export default function OrderMapView({ lat, lng }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const center = { lat: Number(lat), lng: Number(lng) };

  if (isNaN(center.lat) || isNaN(center.lng)) {
    return (
      <div className="h-48 bg-blue-pale rounded-xl flex flex-col items-center justify-center gap-2 text-xs text-gray-400">
        <p>No valid location data</p>
      </div>
    );
  }

  if (!apiKey || apiKey === "your_google_maps_api_key_here") {
    return (
      <div className="h-48 bg-blue-pale rounded-xl flex flex-col items-center justify-center gap-2 text-xs text-gray-400">
        <p>Map not configured</p>
        <p className="font-grotesk text-ink">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </p>
      </div>
    );
  }

  return (
    <div className="h-48 rounded-xl overflow-hidden border border-gray-200">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={center}
          defaultZoom={15}
          mapId="distro-admin-order-map"
          gestureHandling="cooperative"
          className="w-full h-full"
        >
          <AdvancedMarker position={center} />
        </Map>
      </APIProvider>
    </div>
  );
}
