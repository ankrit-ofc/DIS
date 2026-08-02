import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { SCREEN_EDGES, keyboardBehavior } from "../../lib/screen";
import { Ionicons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { api } from "../../lib/api";
import { SalesBuyer, buyerLabel, buyerCoords } from "../../lib/sales";
import { LocationPicker, LocationPickerValue } from "../../components/LocationPicker";
import { colors, spacing, radius, typography, shadow } from "../../lib/theme";
import { SalesStackParamList } from "../../navigation/SalesStack";

const BRAND_BLUE = "#1A4BDB";

type Props = {
  navigation: StackNavigationProp<SalesStackParamList, "PinLocation">;
  route: RouteProp<SalesStackParamList, "PinLocation">;
};

/**
 * Capture or update a shop's coordinates. Reached either straight after
 * creating a shop (buyer passed in) or from the rep home, where the rep first
 * picks the shop by name/phone.
 *
 * Unlike web's map-click LocationCapture, this asks the device for a GPS fix on
 * open — the rep is standing at the shop. Permission denial or no fix falls back
 * to the manual map, which is always available.
 */
export function PinLocationScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const [buyer, setBuyer] = useState<SalesBuyer | null>(route.params?.buyer ?? null);
  const [location, setLocation] = useState<LocationPickerValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Shop search (only when we arrived without a shop already selected)
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SalesBuyer[]>([]);
  const [searching, setSearching] = useState(false);

  // Seed the picker with the shop's existing pin, if it has one.
  useEffect(() => {
    if (!buyer) return;
    const coords = buyerCoords(buyer);
    if (coords) setLocation(coords);
  }, [buyer]);

  // Debounced shop lookup — the API ignores searches shorter than 2 chars.
  useEffect(() => {
    if (buyer) return;
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      api
        .get(`/sales/buyers?search=${encodeURIComponent(q)}`)
        .then((r) => setResults(r.data?.buyers ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      clearTimeout(t);
      setSearching(false);
    };
  }, [search, buyer]);

  const handleSave = async () => {
    if (!buyer || !location) return;
    setSaving(true);
    setError("");
    try {
      const res = await api.patch(`/sales/buyers/${buyer.id}`, {
        latitude: location.latitude,
        longitude: location.longitude,
      });
      setBuyer(res.data.buyer);
      setSaved(true);
    } catch (err: any) {
      setError(err?.message ?? "Could not save the location.");
    } finally {
      setSaving(false);
    }
  };

  // ── Shop picker ───────────────────────────────────────────────────────────
  if (!buyer) {
    return (
      <SafeAreaView style={s.safe} edges={SCREEN_EDGES}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Pin shop location</Text>
        </View>

        <View style={s.pickerBody}>
          <View style={s.card}>
            <Text style={s.cardTitle}>Which shop?</Text>
            <Text style={s.cardSubtitle}>Search by shop name, owner, or phone.</Text>
            <View style={s.searchWrap}>
              <Ionicons name="search" size={16} color={colors.gray400} />
              <TextInput
                style={s.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Shop name or phone…"
                placeholderTextColor={colors.gray300}
                autoCorrect={false}
                autoFocus
              />
              {searching && <ActivityIndicator size="small" color={colors.blue} />}
            </View>

            <ScrollView style={s.results} keyboardShouldPersistTaps="handled">
              {results.map((b) => {
                const pinned = !!buyerCoords(b);
                return (
                  <TouchableOpacity key={b.id} style={s.resultRow} onPress={() => setBuyer(b)}>
                    <View style={s.flex}>
                      <Text style={s.resultName}>{buyerLabel(b)}</Text>
                      <Text style={s.resultMeta}>
                        {b.phone}
                        {b.district ? ` · ${b.district}` : ""}
                      </Text>
                    </View>
                    <View style={[s.pinBadge, pinned ? s.pinBadgeOn : s.pinBadgeOff]}>
                      <Text style={[s.pinBadgeText, pinned && s.pinBadgeTextOn]}>
                        {pinned ? "Pinned" : "No pin"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {search.trim().length >= 2 && !searching && results.length === 0 && (
                <Text style={s.empty}>No shops matched.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Pin capture ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={SCREEN_EDGES}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={keyboardBehavior}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Shop location</Text>
        </View>

        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + spacing.lg }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.card}>
            <Text style={s.cardTitle}>{buyerLabel(buyer)}</Text>
            <Text style={s.cardSubtitle}>
              {buyer.phone}
              {buyer.district ? ` · ${buyer.district}` : ""} — drivers use this pin for navigation.
            </Text>

            <LocationPicker
              value={location}
              onChange={(v) => {
                setLocation(v);
                setSaved(false);
              }}
              autoLocate
              label="Shop position"
              helperText="Stand at the shop and use GPS, or tap the map to place the pin."
            />

            {!!error && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.red} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {saved && (
              <View style={s.savedBox}>
                <Ionicons name="checkmark-circle" size={16} color={colors.green} />
                <Text style={s.savedText}>Location saved.</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.primaryBtn, (saving || !location) && s.btnDisabled]}
              onPress={handleSave}
              disabled={saving || !location}
              activeOpacity={0.88}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={s.primaryBtnText}>{saved ? "Save again" : "Save location"}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={s.doneRow}
              onPress={() => navigation.navigate("SalesHome")}
              activeOpacity={0.75}
            >
              <Text style={s.doneText}>{saved ? "Done" : "Skip for now"}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND_BLUE },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: BRAND_BLUE,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  backBtn: { padding: 2 },
  headerTitle: { fontSize: 20, color: colors.white, fontFamily: typography.heading },

  scroll: { flexGrow: 1, backgroundColor: colors.offWhite, paddingBottom: spacing.xxl },
  pickerBody: { flex: 1, backgroundColor: colors.offWhite },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.xl,
    margin: spacing.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  cardTitle: { fontSize: 18, color: colors.ink, fontFamily: typography.heading },
  cardSubtitle: {
    fontSize: 13,
    color: colors.gray500,
    fontFamily: typography.body,
    lineHeight: 19,
    marginBottom: spacing.xs,
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    backgroundColor: colors.gray50,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.ink,
    fontFamily: typography.body,
  },
  results: { maxHeight: 320 },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  resultName: { fontSize: 15, color: colors.ink, fontFamily: typography.bodySemiBold },
  resultMeta: { fontSize: 12, color: colors.gray500, fontFamily: typography.body, marginTop: 2 },
  pinBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  pinBadgeOn: { backgroundColor: colors.greenLight },
  pinBadgeOff: { backgroundColor: colors.gray100 },
  pinBadgeText: { fontSize: 10, color: colors.gray500, fontFamily: typography.bodySemiBold },
  pinBadgeTextOn: { color: colors.green },
  empty: {
    paddingVertical: spacing.lg,
    textAlign: "center",
    fontSize: 13,
    color: colors.gray400,
    fontFamily: typography.body,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.redLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  errorText: { flex: 1, color: colors.red, fontSize: 13, fontFamily: typography.bodyMedium },
  savedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.blueLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  savedText: { flex: 1, color: colors.green, fontSize: 13, fontFamily: typography.bodyMedium },

  primaryBtn: {
    backgroundColor: BRAND_BLUE,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: typography.bodySemiBold,
    letterSpacing: 0.4,
  },
  doneRow: { alignItems: "center", paddingVertical: spacing.sm },
  doneText: { fontSize: 14, color: colors.gray500, fontFamily: typography.bodySemiBold },
});
