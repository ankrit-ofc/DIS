import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useCartStore } from "../../store/cartStore";
import { api } from "../../lib/api";
import { colors, spacing, radius, shadow } from "../../lib/theme";
import { fmtRs } from "../../lib/format";
import { LocationPicker, LocationPickerValue } from "../../components/LocationPicker";

// [ESEWA - UNCOMMENT WHEN MERCHANT ACCOUNT READY]
// { key: "ESEWA", label: "eSewa" },
// [/ESEWA]
// [KHALTI - UNCOMMENT WHEN MERCHANT ACCOUNT READY]
// { key: "KHALTI", label: "Khalti" },
// [/KHALTI]
const PAYMENT_METHODS = [
  { key: "COD", label: "Cash on Delivery" },
];

export function CheckoutScreen({ navigation }: any) {
  const { items, totalAmount, clearCart } = useCartStore();
  const [deliveryArea, setDeliveryArea] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [location, setLocation] = useState<LocationPickerValue | null>(null);

  const handleLocationChange = (v: LocationPickerValue) => {
    setLocation(v);
    if (v.address && !address.trim()) setAddress(v.address);
  };

  const MIN_ORDER = 50000;
  const total = totalAmount();
  const belowMin = total < MIN_ORDER;
  const needed = Math.max(0, MIN_ORDER - total);

  const handlePlaceOrder = async () => {
    if (belowMin) { setError(`Minimum order Rs ${MIN_ORDER.toLocaleString("en-IN")} — add Rs ${needed.toLocaleString("en-IN")} more`); return; }
    if (!deliveryArea.trim()) { setError("Please enter your delivery area."); return; }
    if (!address.trim()) { setError("Please enter your delivery address."); return; }
    if (!location) { setError("Please pin your delivery location on the map."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/orders", {
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        paymentMethod,
        deliveryDistrict: deliveryArea.trim(),
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
    <ScrollView style={styles.bg} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.heading}>Checkout</Text>

      {/* Delivery Area */}
      <View style={[styles.section, shadow.sm]}>
        <Text style={styles.sectionTitle}>Delivery area</Text>
        <TextInput
          style={styles.addressInput}
          value={deliveryArea}
          onChangeText={setDeliveryArea}
          placeholder="e.g. Balaju, Kathmandu"
          placeholderTextColor={colors.gray400}
        />
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
        {PAYMENT_METHODS.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[styles.methodRow, paymentMethod === m.key && styles.methodRowActive]}
            onPress={() => setPaymentMethod(m.key)}
          >
            <View style={[styles.radio, paymentMethod === m.key && styles.radioActive]}>
              {paymentMethod === m.key && <View style={styles.radioDot} />}
            </View>
            <Text style={[styles.methodLabel, paymentMethod === m.key && styles.methodLabelActive]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.comingSoon}>Online payments coming soon — eSewa &amp; PhonePe</Text>
      </View>

      {/* Order summary */}
      <View style={[styles.section, shadow.sm]}>
        <Text style={styles.sectionTitle}>Order summary</Text>
        {items.map((item) => (
          <View key={item.productId} style={styles.summaryRow}>
            <Text style={styles.summaryName} numberOfLines={1}>
              {item.name} × {item.qty}
            </Text>
            <Text style={styles.summaryAmt}>{fmtRs(item.price * item.qty)}</Text>
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
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.offWhite },
  content: { padding: spacing.lg, paddingTop: 60, gap: spacing.md },
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
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  methodRowActive: { backgroundColor: colors.blueLight },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.gray400,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: colors.blue },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.blue },
  methodLabel: { fontSize: 14, color: colors.gray600 },
  methodLabelActive: { color: colors.ink, fontWeight: "700" },
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
