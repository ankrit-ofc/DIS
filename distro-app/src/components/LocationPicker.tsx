import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
  Platform,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius } from "../lib/theme";

export interface LocationPickerValue {
  latitude: number;
  longitude: number;
  address?: string;
}

interface Props {
  value: LocationPickerValue | null;
  onChange: (v: LocationPickerValue) => void;
  label?: string;
  helperText?: string;
}

interface Prediction {
  place_id: string;
  description: string;
}

const NEPAL_REGION: Region = {
  latitude: 27.7,
  longitude: 84.0,
  latitudeDelta: 4.0,
  longitudeDelta: 4.0,
};

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const SESSIONTOKEN_CACHE = { current: Math.random().toString(36).slice(2) };

function newSessionToken() {
  SESSIONTOKEN_CACHE.current = Math.random().toString(36).slice(2);
}

async function fetchPredictions(
  query: string,
  signal: AbortSignal
): Promise<Prediction[]> {
  if (!GOOGLE_API_KEY || query.trim().length < 2) return [];
  const url =
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
    `input=${encodeURIComponent(query)}` +
    `&components=country:np` +
    `&sessiontoken=${SESSIONTOKEN_CACHE.current}` +
    `&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url, { signal });
  const json = await res.json();
  if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
    throw new Error(json.error_message || json.status);
  }
  return (json.predictions ?? []).slice(0, 6).map((p: any) => ({
    place_id: p.place_id,
    description: p.description,
  }));
}

async function fetchPlaceDetails(
  placeId: string
): Promise<{ lat: number; lng: number; address: string }> {
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json?` +
    `place_id=${placeId}` +
    `&fields=geometry,formatted_address,name` +
    `&sessiontoken=${SESSIONTOKEN_CACHE.current}` +
    `&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== "OK") throw new Error(json.error_message || json.status);
  const loc = json.result?.geometry?.location;
  return {
    lat: loc.lat,
    lng: loc.lng,
    address: json.result.formatted_address || json.result.name || "",
  };
}

export function LocationPicker({
  value,
  onChange,
  label = "Pin your store location",
  helperText = "Search, drag the marker, or use your current location.",
}: Props) {
  const mapRef = useRef<MapView>(null);
  const [query, setQuery] = useState(value?.address ?? "");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [locating, setLocating] = useState(false);
  const [region, setRegion] = useState<Region>(() =>
    value
      ? {
          latitude: value.latitude,
          longitude: value.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }
      : NEPAL_REGION
  );

  const marker = useMemo(
    () =>
      value
        ? { latitude: value.latitude, longitude: value.longitude }
        : null,
    [value]
  );

  // Debounced autocomplete
  useEffect(() => {
    if (!GOOGLE_API_KEY) return;
    if (query.trim().length < 2) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }
    if (query === value?.address) return;

    const ctrl = new AbortController();
    setSearching(true);
    const t = setTimeout(() => {
      fetchPredictions(query, ctrl.signal)
        .then((ps) => {
          setPredictions(ps);
          setShowDropdown(true);
        })
        .catch((err) => {
          if (err.name !== "AbortError") setPredictions([]);
        })
        .finally(() => setSearching(false));
    }, 300);

    return () => {
      clearTimeout(t);
      ctrl.abort();
      setSearching(false);
    };
  }, [query, value?.address]);

  const pan = (latitude: number, longitude: number) => {
    const r = { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    setRegion(r);
    mapRef.current?.animateToRegion(r, 600);
  };

  const handleSelectPrediction = async (p: Prediction) => {
    setShowDropdown(false);
    setQuery(p.description);
    try {
      const d = await fetchPlaceDetails(p.place_id);
      newSessionToken();
      onChange({ latitude: d.lat, longitude: d.lng, address: d.address });
      pan(d.lat, d.lng);
    } catch {
      Alert.alert("Search failed", "Could not load that place. Try another.");
    }
  };

  const handleUseMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Enable location in device settings.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = loc.coords;
      onChange({ latitude, longitude, address: value?.address });
      pan(latitude, longitude);
    } catch {
      Alert.alert("Error", "Could not get your location. Try again.");
    } finally {
      setLocating(false);
    }
  };

  const handleMarkerDrag = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    onChange({ latitude, longitude, address: value?.address });
  };

  const handleMapPress = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    onChange({ latitude, longitude, address: value?.address });
  };

  if (!GOOGLE_API_KEY) {
    return (
      <View style={s.configBox}>
        <Ionicons name="warning-outline" size={18} color={colors.amberDark} />
        <Text style={s.configText}>
          Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to enable map + search.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={s.headerRow}>
        <Text style={s.label}>{label}</Text>
        <TouchableOpacity
          onPress={handleUseMyLocation}
          disabled={locating}
          style={[s.myLocBtn, locating && { opacity: 0.6 }]}
          activeOpacity={0.8}
        >
          {locating ? (
            <ActivityIndicator size="small" color={colors.blue} />
          ) : (
            <>
              <Ionicons name="locate-outline" size={14} color={colors.blue} />
              <Text style={s.myLocText}>My location</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={{ position: "relative", zIndex: 10 }}>
        <View style={s.searchWrap}>
          <Ionicons
            name="search"
            size={16}
            color={colors.gray400}
            style={{ marginLeft: 12 }}
          />
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search for a place or address in Nepal"
            placeholderTextColor={colors.gray400}
            onFocus={() => predictions.length > 0 && setShowDropdown(true)}
            returnKeyType="search"
          />
          {searching ? (
            <ActivityIndicator
              size="small"
              color={colors.blue}
              style={{ marginRight: 12 }}
            />
          ) : query.length > 0 ? (
            <TouchableOpacity
              onPress={() => {
                setQuery("");
                setPredictions([]);
                setShowDropdown(false);
              }}
              style={{ padding: 8, marginRight: 4 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.gray400} />
            </TouchableOpacity>
          ) : null}
        </View>

        {showDropdown && predictions.length > 0 && (
          <View style={s.dropdown}>
            <FlatList
              data={predictions}
              keyExtractor={(p) => p.place_id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.predictionRow}
                  onPress={() => handleSelectPrediction(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="location-outline"
                    size={16}
                    color={colors.blue}
                  />
                  <Text style={s.predictionText} numberOfLines={2}>
                    {item.description}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {/* Map */}
      <View style={s.mapWrap}>
        <MapView
          ref={mapRef}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          style={s.map}
          region={region}
          onRegionChangeComplete={setRegion}
          onPress={handleMapPress}
        >
          {marker && (
            <Marker
              coordinate={marker}
              draggable
              onDragEnd={handleMarkerDrag}
              pinColor={colors.blue}
            />
          )}
        </MapView>
      </View>

      {/* Coords */}
      {marker ? (
        <View style={s.coordsBox}>
          <Ionicons name="pin" size={14} color={colors.blue} />
          <Text style={s.coordsText}>
            Lat:{" "}
            <Text style={s.coordsNum}>{marker.latitude.toFixed(4)}</Text> · Lng:{" "}
            <Text style={s.coordsNum}>{marker.longitude.toFixed(4)}</Text>
          </Text>
        </View>
      ) : (
        <Text style={s.noPin}>No pin set — search or tap the map.</Text>
      )}

      <Text style={s.helper}>{helperText}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "700", color: colors.ink },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  myLocBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.blue,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.blueLight,
  },
  myLocText: { color: colors.blue, fontWeight: "700", fontSize: 12 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    fontSize: 14,
    color: colors.ink,
  },
  dropdown: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    maxHeight: 240,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
    overflow: "hidden",
    zIndex: 20,
  },
  predictionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  predictionText: { flex: 1, fontSize: 13, color: colors.ink },
  mapWrap: {
    height: 220,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  map: { width: "100%", height: "100%" },
  coordsBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.blueLight,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  coordsText: { fontSize: 12, color: colors.gray700 },
  coordsNum: { fontWeight: "700", color: colors.ink },
  noPin: { fontSize: 12, color: colors.gray400 },
  helper: { fontSize: 11, color: colors.gray400 },
  configBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.amberLight,
  },
  configText: { flex: 1, fontSize: 12, color: colors.amberDark },
});
