import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCartStore } from "../../store/cartStore";
import { useAuthStore } from "../../store/authStore";
import { api } from "../../lib/api";
import { colors, spacing, radius, shadow } from "../../lib/theme";
import { fmtRs } from "../../lib/format";
import { LocationPicker, LocationPickerValue } from "../../components/LocationPicker";

// DISTRO currently delivers only within the Kathmandu Valley.
const VALLEY_DISTRICTS = ["Kathmandu", "Lalitpur", "Bhaktapur"] as const;

export function CheckoutScreen({ navigation }: any) {
  const { items, totalAmount, clearCart } = useCartStore();
  const { profile } = useAuthStore();
  // Prefill from the buyer's saved profile (single-address autofill — Part 3C).
  const [district, setDistrict] = useState<string>(
    profile?.district && (VALLEY_DISTRICTS as readonly string[]).includes(profile.district)
      ? profile.district
      : ""
  );
  const [address, setAddress] = useState(profile?.address ?? "");
  // COD is the only supported method for now; sent verbatim to the backend.
  const paymentMethod = "COD";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [location, setLocation] = useState<LocationPickerValue | null>(null);

  const handleLocationChange = (v: LocationPickerValue) => {
    setLocation(v);
    if (v.address) {
      // Reverse-geocoded address — populate the field (user can still edit).
      setAddress(v.address);
      const lower = v.address.toLowerCase();
      const matched = VALLEY_DISTRICTS.find((d) => lower.includes(d.toLowerCase()));
      if (matched) setDistrict(matched);
    }
  };

  const MIN_ORDER = 10000;
  const total = totalAmount();
  const belowMin = total < MIN_ORDER;
  const needed = Math.max(0, MIN_ORDER - total);

  const handlePlaceOrder = async () => {
    if (belowMin) { setError(`Minimum order is Rs ${MIN_ORDER.toLocaleString("en-IN")}`); return; }
    if (!district) { setError("Please select your delivery district."); return; }
    if (!address.trim()) { setError("Please enter your delivery address."); return; }
    if (!location) { setError("Please pin your delivery location on the map."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/orders", {
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        paymentMethod,
        deliveryDistrict: district,
        deliveryAddress: address.trim(),
        deliveryLat: location?.latitude ?? null,
        deliveryLng: location?.longitude ?? null,
      });
      clearCart();
      const orderId = res.data.order?.id ?? res.data.id;
      const orderNumber = res.data.order?.orderNumber ?? res.data.orderNumber ?? `ORD-${orderId}`;
      navigation.replace("OrderConfirm", { orderId, orderNumber });
    } catch (err: any) {
      setError(err.message ?? "Order failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView style={styles.bg} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.heading}>Checkout</Text>

      {/* Delivery district */}
      <View style={[styles.section, shadow.sm]}>
        <Text style={styles.sectionTitle}>Delivery district</Text>
        <View style={styles.districtRow}>
          {VALLEY_DISTRICTS.map((d) => {
            const active = district === d;
            return (
              <TouchableOpacity
                key={d}
                style={[styles.districtChip, active && styles.districtChipActive]}
                onPress={() => setDistrict(d)}
                activeOpacity={0.85}
              >
                <Text style={[styles.districtChipText, active && styles.districtChipTextActive]}>{d}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.comingSoon}>We currently deliver within the Kathmandu Valley area</Text>
      </View>

      {/* Address */}
      <View style={[styles.section, shadow.sm]}>
        <Text style={styles.sectionTitle}>Delivery address</Text>
        <TextInput
          style={styles.addressInput}
          value={address}
          onChangeText={setAddress}
          placeholder="Street, ward, landmark…"
          placeholderTextColor={colors.gray400}
          multiline
          numberOfLines={2}
        />
        <Text style={styles.comingSoon}>Pin your location below and we'll fill this in — edit as needed.</Text>
      </View>

      {/* Map */}
      <View style={[styles.section, shadow.sm]}>
        <LocationPicker
          value={location}
          onChange={handleLocationChange}
          label="Pin your store location"
          helperText="Search, drag the marker, or use your current location."
        />
      </View>

      {/* Payment */}
      <View style={[styles.section, shadow.sm]}>
        <Text style={styles.sectionTitle}>Payment method</Text>
        <View style={styles.codRow}>
          <Ionicons name="cash-outline" size={20} color={colors.green} />
          <Text style={styles.codLabel}>Cash on Delivery</Text>
        </View>
      </View>

      {/* Order summary */}
      <View style={[styles.section, shadow.sm]}>
        <Text style={styles.sectionTitle}>Order summary</Text>
        {items.map((item) => (
          <View key={item.productId} style={styles.summaryRow}>
            <Text style={styles.summaryName} numberOfLines={1}>
              {item.name} × {item.qty} carton{item.qty > 1 ? "s" : ""}
            </Text>
            <Text style={styles.summaryAmt}>{fmtRs(item.pricePerCarton * item.qty)}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryAmt}>{fmtRs(totalAmount())}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Delivery</Text>
          <Text style={[styles.summaryAmt, { color: colors.green }]}>Free</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmt}>{fmtRs(total)}</Text>
        </View>
      </View>

      {belowMin && (
        <View style={{ backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#F59E0B", borderRadius: radius.md, padding: spacing.md }}>
          <Text style={{ fontSize: 13, color: "#92400E", fontWeight: "600" }}>
            Minimum order Rs {MIN_ORDER.toLocaleString("en-IN")} — add Rs {needed.toLocaleString("en-IN")} more
          </Text>
        </View>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.orderBtn, (loading || belowMin) && styles.btnDisabled]}
        onPress={handlePlaceOrder}
        disabled={loading || belowMin}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.orderBtnText}>Place order — {fmtRs(total)}</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.offWhite },
  flex: { flex: 1 },
  bg: { flex: 1, backgroundColor: colors.offWhite },
  districtRow: { flexDirection: "row", gap: spacing.sm },
  districtChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    backgroundColor: colors.offWhite,
  },
  districtChipActive: { borderColor: colors.blue, backgroundColor: colors.blueLight },
  districtChipText: { fontSize: 14, fontWeight: "600", color: colors.gray600 },
  districtChipTextActive: { color: colors.blue, fontWeight: "700" },
  content: { padding: spacing.lg, gap: spacing.md },
  backBtn: { marginBottom: spacing.xs },
  backText: { color: colors.blue, fontSize: 15, fontWeight: "600" },
  heading: { fontSize: 26, fontWeight: "700", color: colors.ink, marginBottom: spacing.xs },
  section: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.ink, marginBottom: spacing.xs },
  addressInput: {
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.offWhite,
    minHeight: 60,
    textAlignVertical: "top",
  },
  mapSubtitle: { fontSize: 12, color: colors.gray400, marginTop: -spacing.xs },
  locationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.blueLight,
    borderRadius: radius.md,
    paddingVertical: 10,
    gap: spacing.xs,
  },
  locationBtnDisabled: { opacity: 0.6 },
  locationBtnText: { color: colors.blue, fontWeight: "700", fontSize: 14 },
  map: { width: "100%", height: 220, borderRadius: radius.md, overflow: "hidden" },
  coordsWrap: {
    backgroundColor: colors.blueLight,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: "center",
  },
  coordsText: { fontSize: 13, color: colors.blue, fontWeight: "600" },
  noPin: { fontSize: 12, color: colors.gray400, textAlign: "center" },
  tapMapHint: {
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  tapMapText: { color: colors.blue, fontSize: 13, fontWeight: "600" },
  codRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.blueLight,
  },
  codLabel: { fontSize: 14, fontWeight: "700", color: colors.ink },
  comingSoon: { fontSize: 12, color: colors.gray400, marginTop: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryName: { flex: 1, fontSize: 13, color: colors.gray600, marginRight: spacing.sm },
  summaryAmt: { fontSize: 13, fontWeight: "600", color: colors.ink },
  summaryLabel: { fontSize: 14, color: colors.gray600 },
  divider: { height: 1, backgroundColor: colors.gray200, marginVertical: spacing.xs },
  totalLabel: { fontSize: 15, fontWeight: "700", color: colors.ink },
  totalAmt: { fontSize: 18, fontWeight: "700", color: colors.blue },
  error: {
    color: "#DC2626",
    fontSize: 13,
    backgroundColor: "#FEF2F2",
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  orderBtn: {
    backgroundColor: colors.blue,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  orderBtnText: { color: colors.white, fontWeight: "700", fontSize: 16 },
});
