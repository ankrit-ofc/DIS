import { useState, useEffect, useRef } from "react";
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
  Alert,
  TextInput as TI,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { api } from "../../lib/api";
import { SalesBuyer, buyerLabel } from "../../lib/sales";
import { useSalesBuyerStore } from "../../store/salesBuyerStore";
import { colors, spacing, radius, typography, shadow } from "../../lib/theme";
import { SalesStackParamList } from "../../navigation/SalesStack";

const BRAND_BLUE = "#1A4BDB";

// Mirrors the API's NEPAL_PHONE (sales.ts) so a typo fails before the round-trip.
const NEPAL_PHONE = /^9[6-8]\d{8}$/;

// Mirrors PAN_NUMBER in sales.ts, which in turn matches the buyer's own web
// register/onboarding/account forms. Nepal PAN is exactly 9 digits.
const PAN_NUMBER = /^\d{9}$/;

type Props = {
  navigation: StackNavigationProp<SalesStackParamList, "NewBuyer">;
  route: RouteProp<SalesStackParamList, "NewBuyer">;
};

interface District {
  id: string;
  name: string;
  active: boolean;
}

/**
 * Quick-create a shop at the door — mirrors distro-web sales/new-buyer.
 * No OTP: the rep is physically present. Required fields match the API
 * (storeName, phone, district); ownerName and address are optional.
 *
 * Unlike web, the map is not inline here — after creating the shop we offer the
 * dedicated GPS pin screen, which is the real field sequence.
 */
export function NewBuyerScreen({ navigation, route }: Props) {
  // Reached from the buyer picker ("no shop found — register it"): the rep is
  // mid-order, so hand the new shop straight to the catalogue instead of
  // dropping them back on the home screen to search for what they just typed.
  const selectOnCreate = route.params?.selectOnCreate ?? false;
  const setSelectedBuyer = useSalesBuyerStore((s) => s.setBuyer);

  const [storeName, setStoreName] = useState(route.params?.initialName ?? "");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [districts, setDistricts] = useState<District[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const ownerRef = useRef<TI>(null);
  const phoneRef = useRef<TI>(null);
  const addressRef = useRef<TI>(null);

  // Served districts come from the server so the rep can't pick one we don't
  // deliver to (the API rejects inactive districts anyway).
  useEffect(() => {
    api
      .get("/districts?active=true")
      .then((r) => setDistricts(r.data?.districts ?? []))
      .catch(() => {
        // Non-fatal: the rep can still retry; submit is validated server-side.
      });
  }, []);

  const handleSubmit = async () => {
    const trimmedStore = storeName.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedStore || !trimmedPhone || !district) {
      setError("Shop name, phone, and district are required.");
      return;
    }
    if (!NEPAL_PHONE.test(trimmedPhone)) {
      setError("Enter a valid 10-digit Nepal mobile number (98XXXXXXXX).");
      return;
    }
    // Optional: only validated when the rep actually typed something, so
    // skipping it can never block the submit.
    const trimmedPan = panNumber.trim();
    if (trimmedPan && !PAN_NUMBER.test(trimmedPan)) {
      setError("PAN must be exactly 9 digits.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const res = await api.post("/sales/buyers", {
        storeName: trimmedStore,
        ownerName: ownerName.trim() || undefined,
        phone: trimmedPhone,
        district,
        address: address.trim() || undefined,
        panNumber: trimmedPan || undefined,
      });
      const buyer: SalesBuyer = res.data.buyer;

      if (selectOnCreate) {
        // Registering a shop mid-order — the rep already intends to sell to it.
        setSelectedBuyer(buyer);
        Alert.alert(
          "Shop created",
          `${buyerLabel(buyer)} is registered and selected. Pin its location before you start the order?`,
          [
            {
              text: "Start order",
              onPress: () => navigation.replace("SalesCatalogue"),
            },
            {
              text: "Pin location",
              onPress: () => navigation.replace("PinLocation", { buyer }),
            },
          ],
        );
        return;
      }

      // The real field sequence: register the shop, then drop the pin while
      // still standing there.
      Alert.alert(
        "Shop created",
        `${buyerLabel(buyer)} is registered. Pin the shop's location now?`,
        [
          {
            text: "Later",
            style: "cancel",
            onPress: () => navigation.navigate("SalesHome"),
          },
          {
            text: "Pin location",
            onPress: () => navigation.replace("PinLocation", { buyer }),
          },
        ],
      );
    } catch (err: any) {
      setError(err?.message ?? "Could not create the shop.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>New shop</Text>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.card}>
            <Text style={s.cardSubtitle}>
              Creates a normal buyer account — the owner can log in later with their phone.
            </Text>

            <Field label="Shop name" required>
              <TextInput
                style={s.input}
                value={storeName}
                onChangeText={setStoreName}
                placeholder="e.g. Sharma General Store"
                placeholderTextColor={colors.gray300}
                returnKeyType="next"
                onSubmitEditing={() => ownerRef.current?.focus()}
              />
            </Field>

            <Field label="Owner name">
              <TextInput
                ref={ownerRef}
                style={s.input}
                value={ownerName}
                onChangeText={setOwnerName}
                placeholder="e.g. Ram Sharma"
                placeholderTextColor={colors.gray300}
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
              />
            </Field>

            <Field label="Phone" required>
              <TextInput
                ref={phoneRef}
                style={s.input}
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))}
                placeholder="98XXXXXXXX"
                placeholderTextColor={colors.gray300}
                keyboardType="phone-pad"
                maxLength={10}
                returnKeyType="next"
              />
            </Field>

            <Field label="District" required>
              <TouchableOpacity
                style={[s.input, s.selectRow]}
                onPress={() => setPickerOpen((v) => !v)}
                activeOpacity={0.8}
              >
                <Text style={district ? s.selectValue : s.selectPlaceholder}>
                  {district || "Select district…"}
                </Text>
                <Ionicons
                  name={pickerOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.gray400}
                />
              </TouchableOpacity>
              {pickerOpen && (
                <View style={s.dropdown}>
                  <ScrollView style={s.dropdownList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {districts.length === 0 ? (
                      <Text style={s.dropdownEmpty}>Loading served districts…</Text>
                    ) : (
                      districts.map((d) => (
                        <TouchableOpacity
                          key={d.id ?? d.name}
                          style={[s.dropdownItem, district === d.name && s.dropdownItemActive]}
                          onPress={() => {
                            setDistrict(d.name);
                            setPickerOpen(false);
                          }}
                        >
                          <Text
                            style={[
                              s.dropdownItemText,
                              district === d.name && s.dropdownItemTextActive,
                            ]}
                          >
                            {d.name}
                          </Text>
                          {district === d.name && (
                            <Ionicons name="checkmark" size={16} color={colors.blue} />
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </View>
              )}
            </Field>

            <Field label="Address / location note">
              <TextInput
                ref={addressRef}
                style={[s.input, s.textarea]}
                value={address}
                onChangeText={setAddress}
                placeholder="Street, tole, landmark…"
                placeholderTextColor={colors.gray300}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            </Field>

            {/* Last field: a tax number is rarely to hand at the shop door, so it
                sits below the fields the rep always fills. */}
            <Field label="PAN number" hint="optional, 9 digits">
              <TextInput
                style={s.input}
                value={panNumber}
                onChangeText={(v) => setPanNumber(v.replace(/\D/g, "").slice(0, 9))}
                placeholder="123456789"
                placeholderTextColor={colors.gray300}
                keyboardType="number-pad"
                maxLength={9}
                returnKeyType="done"
              />
            </Field>

            {!!error && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.red} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.primaryBtn, submitting && s.btnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.88}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={s.primaryBtnText}>Create shop</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>
        {label}
        {required && <Text style={s.req}> *</Text>}
        {!!hint && <Text style={s.hint}> ({hint})</Text>}
      </Text>
      {children}
    </View>
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
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.xl,
    margin: spacing.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.gray500,
    fontFamily: typography.body,
    lineHeight: 19,
  },

  field: { gap: 6 },
  label: {
    fontSize: 12,
    color: colors.gray600,
    fontFamily: typography.bodySemiBold,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  req: { color: colors.red },
  hint: {
    color: colors.gray400,
    fontFamily: typography.body,
    textTransform: "none",
    letterSpacing: 0,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    backgroundColor: colors.gray50,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.ink,
    fontFamily: typography.body,
  },
  textarea: { minHeight: 64, paddingTop: 12 },
  selectRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectValue: { fontSize: 15, color: colors.ink, fontFamily: typography.body },
  selectPlaceholder: { fontSize: 15, color: colors.gray300, fontFamily: typography.body },

  dropdown: {
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    overflow: "hidden",
    marginTop: 4,
  },
  dropdownList: { maxHeight: 200, backgroundColor: colors.white },
  dropdownEmpty: {
    padding: spacing.md,
    fontSize: 13,
    color: colors.gray400,
    fontFamily: typography.body,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  dropdownItemActive: { backgroundColor: colors.blueLight },
  dropdownItemText: { fontSize: 15, color: colors.ink, fontFamily: typography.body },
  dropdownItemTextActive: { fontFamily: typography.bodySemiBold, color: colors.blue },

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

  primaryBtn: {
    backgroundColor: BRAND_BLUE,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  btnDisabled: { opacity: 0.7 },
  primaryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: typography.bodySemiBold,
    letterSpacing: 0.4,
  },
});
