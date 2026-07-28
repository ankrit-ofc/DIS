import { useEffect, useState } from "react";
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
import { StackNavigationProp } from "@react-navigation/stack";
import { api } from "../../lib/api";
import { colors, spacing, radius, shadow, typography } from "../../lib/theme";
import { fmtRs, unitShort } from "../../lib/format";
import { buyerLabel, type SalesBuyer } from "../../lib/sales";
import { useCartStore } from "../../store/cartStore";
import { useSalesBuyerStore } from "../../store/salesBuyerStore";
import { SalesBuyerBanner } from "../../components/SalesBuyerBanner";
import { SalesStackParamList } from "../../navigation/SalesStack";

const BRAND_BLUE = "#1A4BDB";
const MIN_ORDER = 10000;
const VAT_RATE = 0.13;

interface District {
  id: string;
  name: string;
  deliveryFee: number;
}

/** Per-line stock shortfall reported by a 409 from POST /orders. */
interface StockIssue {
  productId: string;
  available: number;
}

type PaymentMethod = "COD" | "CREDIT";
type SaveMode = "order" | "profile";

type Props = { navigation: StackNavigationProp<SalesStackParamList, "SalesCheckout"> };

/**
 * Checkout on behalf of the selected shop — mirrors distro-web's
 * sales/checkout. Validation matches it exactly (Rs 10,000 minimum, 13% VAT,
 * district delivery fee, district + address required).
 *
 * Two deliberate departures from the buyer checkout:
 *  - payment is COD **or** CREDIT (pay on account); the buyer app hardcodes
 *    COD, but a rep at the door settles either way. The API only accepts
 *    CREDIT for on-behalf orders.
 *  - a 409 stock conflict is fixed inline, per line ("Update to N"), instead of
 *    bouncing to a cart screen — the rep is standing at the counter and needs
 *    to close the order now.
 */
export function SalesCheckoutScreen({ navigation }: Props) {
  const buyer = useSalesBuyerStore((s) => s.buyer);
  const setBuyer = useSalesBuyerStore((s) => s.setBuyer);
  const clearBuyer = useSalesBuyerStore((s) => s.clearBuyer);
  const { items, totalAmount, updateQty, removeItem, clearCart, applyValidation } = useCartStore();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState("");
  const [editing, setEditing] = useState(false);
  const [saveMode, setSaveMode] = useState<SaveMode>("order");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [districts, setDistricts] = useState<District[]>([]);
  const [issues, setIssues] = useState<StockIssue[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<{ orderNumber: string; total: number } | null>(null);

  // Losing the selection (banner discard, "next shop", or a logout elsewhere)
  // unwinds the whole order flow — a reset rather than a replace, so the
  // finished order screens aren't reachable again with the back gesture.
  useEffect(() => {
    if (buyer) return;
    navigation.reset({ index: 1, routes: [{ name: "SalesHome" }, { name: "SelectBuyer" }] });
  }, [buyer, navigation]);

  // District fees mirror the server's District-table lookup, so the total shown
  // at the shop door is what the order will actually cost.
  useEffect(() => {
    api
      .get("/districts?active=true")
      .then((r) => setDistricts(r.data?.districts ?? []))
      .catch(() => {});
  }, []);

  // Pre-fill from the SELECTED SHOP's profile — never the rep's own.
  useEffect(() => {
    if (buyer) {
      setAddress(buyer.address ?? "");
      setDistrict(buyer.district ?? "");
    }
  }, [buyer]);

  if (!buyer) return null;

  if (placed) {
    return (
      <SalesOrderPlaced
        orderNumber={placed.orderNumber}
        total={placed.total}
        shopName={buyerLabel(buyer)}
        // Dropping the buyer is what navigates — see the effect above.
        onNextShop={clearBuyer}
        onSameShop={() => navigation.replace("SalesCatalogue")}
      />
    );
  }

  const hasSavedAddress = !!(buyer.address?.trim() && buyer.district);
  const showForm = !hasSavedAddress || editing;

  const sub = totalAmount();
  const vat = Math.round(sub * VAT_RATE * 100) / 100;
  const deliveryFee = districts.find((d) => d.name === district)?.deliveryFee ?? 0;
  const grandTotal = sub + vat + deliveryFee;
  const belowMin = sub < MIN_ORDER;
  const needed = Math.max(0, MIN_ORDER - sub);

  const cancelEditing = () => {
    setEditing(false);
    setAddress(buyer.address ?? "");
    setDistrict(buyer.district ?? "");
    setSaveMode("order");
    setPickerOpen(false);
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0 || belowMin) return;
    if (!district) {
      setError("Select the delivery district.");
      return;
    }
    if (!address.trim()) {
      setError("Enter the delivery address.");
      return;
    }
    setError("");
    setIssues([]);
    setSubmitting(true);
    try {
      const res = await api.post("/orders", {
        buyerId: buyer.id,
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        paymentMethod,
        deliveryDistrict: district,
        deliveryAddress: address.trim(),
        notes: notes.trim() || undefined,
      });

      // "Save as shop's new address" — persisted only after the order is in.
      if (editing && saveMode === "profile") {
        try {
          const upd = await api.patch(`/sales/buyers/${buyer.id}`, {
            address: address.trim(),
            district,
          });
          setBuyer(upd.data.buyer as SalesBuyer); // same id — selection survives
        } catch {
          // Best-effort — the order is already placed.
        }
      }

      const order = res.data?.order ?? res.data;
      clearCart();
      setPlaced({
        orderNumber: order?.orderNumber ?? "—",
        total: order?.total ?? grandTotal,
      });
    } catch (err: any) {
      // Someone took the stock first. Fix it here rather than sending the rep
      // to another screen — refresh the caps and offer a per-line "Update to N".
      if (err?.status === 409 && err?.data?.code === "INSUFFICIENT_STOCK") {
        const short: StockIssue[] = err.data.items ?? [];
        applyValidation(short.map((i) => ({ productId: i.productId, maxOrderQty: i.available })));
        setIssues(short);
        setError("Stock changed while ordering — fix the highlighted lines below.");
      } else {
        setError(err?.message ?? "Order failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <SalesBuyerBanner buyer={buyer} onDiscard={clearBuyer} />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={s.backText}>← Back to catalogue</Text>
          </TouchableOpacity>

          <Text style={s.heading}>Order for {buyerLabel(buyer)}</Text>
          <Text style={s.subheading}>
            {buyer.phone}
            {buyer.district ? ` · ${buyer.district}` : ""}
          </Text>

          {items.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="cart-outline" size={36} color={colors.gray200} />
              <Text style={s.emptyText}>
                Nothing in this order yet — add products from the catalogue.
              </Text>
              <TouchableOpacity
                style={s.secondaryBtn}
                onPress={() => navigation.navigate("SalesCatalogue")}
                activeOpacity={0.85}
              >
                <Text style={s.secondaryBtnText}>Browse catalogue</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Lines */}
              <View style={[s.section, shadow.sm]}>
                <Text style={s.sectionTitle}>Items</Text>
                {items.map((item) => {
                  const unit = unitShort(item.sellUnit);
                  const issue = issues.find((i) => i.productId === item.productId);
                  return (
                    <View key={item.productId} style={s.line}>
                      <View style={s.lineRow}>
                        <View style={s.lineBody}>
                          <Text style={s.lineName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={s.lineMeta}>
                            {fmtRs(item.price)} / {unit}
                          </Text>
                        </View>
                        <View style={s.stepper}>
                          <TouchableOpacity
                            style={s.stepBtn}
                            onPress={() =>
                              item.qty - 1 < item.moq
                                ? removeItem(item.productId)
                                : updateQty(item.productId, item.qty - 1)
                            }
                            hitSlop={4}
                          >
                            <Ionicons name="remove" size={14} color={colors.ink} />
                          </TouchableOpacity>
                          <Text style={s.stepQty}>
                            {item.qty} <Text style={s.stepUnit}>{unit}</Text>
                          </Text>
                          <TouchableOpacity
                            style={[s.stepBtn, item.qty >= item.maxOrderQty && s.stepBtnDisabled]}
                            onPress={() => updateQty(item.productId, item.qty + 1)}
                            disabled={item.qty >= item.maxOrderQty}
                            hitSlop={4}
                          >
                            <Ionicons name="add" size={14} color={colors.ink} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => removeItem(item.productId)}
                            hitSlop={6}
                            style={s.trashBtn}
                          >
                            <Ionicons name="trash-outline" size={15} color={colors.gray400} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {issue && (
                        <View style={s.issueBox}>
                          <Ionicons name="alert-circle" size={13} color={colors.amberDark} />
                          <Text style={s.issueText}>
                            {issue.available > 0
                              ? `Only ${issue.available} available.`
                              : "Out of stock — remove this line."}
                          </Text>
                          {issue.available > 0 && (
                            <TouchableOpacity
                              style={s.issueBtn}
                              onPress={() => {
                                updateQty(item.productId, issue.available);
                                setIssues((prev) =>
                                  prev.filter((i) => i.productId !== item.productId),
                                );
                              }}
                              activeOpacity={0.85}
                            >
                              <Text style={s.issueBtnText}>Update to {issue.available}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Delivery */}
              <View style={[s.section, shadow.sm]}>
                <Text style={s.sectionTitle}>Deliver to</Text>
                {!showForm ? (
                  <View style={s.savedCard}>
                    <View style={s.savedIcon}>
                      <Ionicons name="storefront-outline" size={17} color={BRAND_BLUE} />
                    </View>
                    <View style={s.savedBody}>
                      <Text style={s.savedStore} numberOfLines={1}>
                        {buyerLabel(buyer)}
                      </Text>
                      <Text style={s.savedAddress}>{buyer.address}</Text>
                      <Text style={s.savedDistrict}>
                        {buyer.district}
                        {deliveryFee > 0 ? ` · delivery ${fmtRs(deliveryFee)}` : " · free delivery"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setEditing(true);
                        setSaveMode("order");
                      }}
                      hitSlop={6}
                    >
                      <Text style={s.changeText}>Change</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Text style={s.label}>Delivery address</Text>
                    <TextInput
                      style={s.addressInput}
                      value={address}
                      onChangeText={setAddress}
                      placeholder="Street, tole, landmark…"
                      placeholderTextColor={colors.gray300}
                      multiline
                      numberOfLines={2}
                      textAlignVertical="top"
                    />

                    <Text style={s.label}>District</Text>
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
                                  {d.deliveryFee > 0 ? ` — delivery ${fmtRs(d.deliveryFee)}` : ""}
                                </Text>
                                {district === d.name && (
                                  <Ionicons name="checkmark" size={16} color={BRAND_BLUE} />
                                )}
                              </TouchableOpacity>
                            ))
                          )}
                        </ScrollView>
                      </View>
                    )}

                    {hasSavedAddress && (
                      <View style={s.saveModeBox}>
                        {(
                          [
                            ["order", "Use for this order only"],
                            ["profile", "Save as shop's new address"],
                          ] as const
                        ).map(([mode, label]) => (
                          <TouchableOpacity
                            key={mode}
                            style={s.saveModeRow}
                            onPress={() => setSaveMode(mode)}
                            activeOpacity={0.8}
                          >
                            <View style={[s.radioOuter, saveMode === mode && s.radioOuterActive]}>
                              {saveMode === mode && <View style={s.radioInner} />}
                            </View>
                            <Text style={s.saveModeLabel}>{label}</Text>
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity onPress={cancelEditing} hitSlop={6}>
                          <Text style={s.cancelEditText}>Cancel — keep saved address</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Payment */}
              <View style={[s.section, shadow.sm]}>
                <Text style={s.sectionTitle}>Payment</Text>
                <View style={s.payRow}>
                  {(
                    [
                      ["COD", "Cash on delivery", "cash-outline"],
                      ["CREDIT", "Credit (on account)", "card-outline"],
                    ] as const
                  ).map(([method, label, icon]) => {
                    const active = paymentMethod === method;
                    return (
                      <TouchableOpacity
                        key={method}
                        style={[s.payOption, active && s.payOptionActive]}
                        onPress={() => setPaymentMethod(method)}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name={icon}
                          size={18}
                          color={active ? BRAND_BLUE : colors.gray400}
                        />
                        <Text style={[s.payLabel, active && s.payLabelActive]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {paymentMethod === "CREDIT" && (
                  <Text style={s.creditNote}>
                    Credit used {fmtRs(buyer.creditUsed)} of {fmtRs(buyer.creditLimit)}.
                  </Text>
                )}
              </View>

              {/* Notes */}
              <View style={[s.section, shadow.sm]}>
                <Text style={s.sectionTitle}>Notes</Text>
                <TextInput
                  style={s.input}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Optional note for the warehouse"
                  placeholderTextColor={colors.gray300}
                />
              </View>

              {/* Totals */}
              <View style={[s.section, shadow.sm]}>
                <Text style={s.sectionTitle}>Total</Text>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Subtotal</Text>
                  <Text style={s.summaryAmt}>{fmtRs(sub)}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>VAT (13%)</Text>
                  <Text style={s.summaryAmt}>{fmtRs(vat)}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Delivery{district ? ` (${district})` : ""}</Text>
                  {deliveryFee > 0 ? (
                    <Text style={s.summaryAmt}>{fmtRs(deliveryFee)}</Text>
                  ) : (
                    <Text style={[s.summaryAmt, { color: colors.green }]}>Free</Text>
                  )}
                </View>
                <View style={s.divider} />
                <View style={s.summaryRow}>
                  <Text style={s.totalLabel}>Total</Text>
                  <Text style={s.totalAmt}>{fmtRs(grandTotal)}</Text>
                </View>
              </View>

              {belowMin && (
                <View style={s.warnBox}>
                  <Ionicons name="alert-circle" size={15} color={colors.amberDark} />
                  <Text style={s.warnText}>
                    Minimum order is Rs {MIN_ORDER.toLocaleString("en-IN")} — add Rs{" "}
                    {needed.toLocaleString("en-IN")} more.
                  </Text>
                </View>
              )}

              {!!error && (
                <View style={s.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={colors.red} />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[s.primaryBtn, (submitting || belowMin) && s.btnDisabled]}
                onPress={handlePlaceOrder}
                disabled={submitting || belowMin}
                activeOpacity={0.88}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={s.primaryBtnText}>Place order — {fmtRs(grandTotal)}</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Confirmation. Both exits matter on a round: the next shop needs a clean
 * selection, and a shop that forgot an item needs a second order.
 */
function SalesOrderPlaced({
  orderNumber,
  total,
  shopName,
  onNextShop,
  onSameShop,
}: {
  orderNumber: string;
  total: number;
  shopName: string;
  onNextShop: () => void;
  onSameShop: () => void;
}) {
  return (
    <SafeAreaView style={s.doneSafe} edges={["top", "left", "right", "bottom"]}>
      <View style={s.doneBody}>
        <Ionicons name="checkmark-circle" size={56} color={colors.green} />
        <Text style={s.doneTitle}>Order placed</Text>
        <Text style={s.doneMeta}>
          {orderNumber} · {fmtRs(total)}
        </Text>
        <Text style={s.doneSub}>{shopName} will get the confirmation SMS.</Text>
      </View>
      <View style={s.doneActions}>
        <TouchableOpacity style={s.primaryBtn} onPress={onNextShop} activeOpacity={0.88}>
          <Text style={s.primaryBtnText}>Next shop</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.secondaryBtn} onPress={onSameShop} activeOpacity={0.85}>
          <Text style={s.secondaryBtnText}>Another order for this shop</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.offWhite },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.offWhite },
  backBtn: { marginBottom: spacing.xs },
  backText: { color: BRAND_BLUE, fontSize: 14, fontFamily: typography.bodySemiBold },
  heading: { fontSize: 22, color: colors.ink, fontFamily: typography.heading },
  subheading: {
    fontSize: 13,
    color: colors.gray400,
    fontFamily: typography.body,
    marginTop: -spacing.sm,
  },

  section: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    color: colors.ink,
    fontFamily: typography.bodySemiBold,
    marginBottom: spacing.xs,
  },

  emptyBox: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray400,
    fontFamily: typography.body,
    textAlign: "center",
  },

  line: { gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  lineRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  lineBody: { flex: 1, minWidth: 0 },
  lineName: { fontSize: 14, color: colors.ink, fontFamily: typography.bodyMedium },
  lineMeta: { fontSize: 12, color: colors.gray400, fontFamily: typography.body, marginTop: 1 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnDisabled: { opacity: 0.4 },
  stepQty: {
    minWidth: 46,
    textAlign: "center",
    fontSize: 14,
    color: colors.ink,
    fontFamily: typography.bodySemiBold,
  },
  stepUnit: { fontSize: 10, color: colors.gray400, fontFamily: typography.body },
  trashBtn: { paddingHorizontal: 2 },

  issueBox: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    backgroundColor: colors.amberLight,
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  issueText: { flexShrink: 1, fontSize: 12, color: "#92400E", fontFamily: typography.bodyMedium },
  issueBtn: {
    backgroundColor: colors.amber,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  issueBtnText: { fontSize: 12, color: colors.white, fontFamily: typography.bodySemiBold },

  savedCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.offWhite,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  savedIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.blueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  savedBody: { flex: 1, minWidth: 0 },
  savedStore: { fontSize: 14, color: colors.ink, fontFamily: typography.bodySemiBold },
  savedAddress: { fontSize: 13, color: colors.gray600, fontFamily: typography.body, marginTop: 2 },
  savedDistrict: { fontSize: 12, color: colors.gray400, fontFamily: typography.body, marginTop: 2 },
  changeText: { fontSize: 13, color: BRAND_BLUE, fontFamily: typography.bodySemiBold },

  label: {
    fontSize: 12,
    color: colors.gray600,
    fontFamily: typography.bodySemiBold,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    backgroundColor: colors.gray50,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    fontFamily: typography.body,
  },
  addressInput: {
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    backgroundColor: colors.gray50,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    fontFamily: typography.body,
    minHeight: 62,
  },
  selectRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectValue: { fontSize: 15, color: colors.ink, fontFamily: typography.body },
  selectPlaceholder: { fontSize: 15, color: colors.gray300, fontFamily: typography.body },
  dropdown: {
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    overflow: "hidden",
    marginTop: -2,
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
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  dropdownItemActive: { backgroundColor: colors.blueLight },
  dropdownItemText: { flex: 1, fontSize: 14, color: colors.ink, fontFamily: typography.body },
  dropdownItemTextActive: { fontFamily: typography.bodySemiBold, color: BRAND_BLUE },

  saveModeBox: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
    marginTop: spacing.xs,
  },
  saveModeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 6 },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.gray200,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: { borderColor: BRAND_BLUE },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND_BLUE },
  saveModeLabel: { fontSize: 14, color: colors.ink, fontFamily: typography.body },
  cancelEditText: {
    fontSize: 12,
    color: colors.gray400,
    fontFamily: typography.body,
    textDecorationLine: "underline",
    marginTop: 4,
  },

  payRow: { flexDirection: "row", gap: spacing.sm },
  payOption: {
    flex: 1,
    alignItems: "center",
    gap: 5,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  payOptionActive: { borderColor: BRAND_BLUE, backgroundColor: colors.blueLight },
  payLabel: {
    fontSize: 12,
    color: colors.gray500,
    fontFamily: typography.bodyMedium,
    textAlign: "center",
  },
  payLabelActive: { color: colors.ink, fontFamily: typography.bodySemiBold },
  creditNote: { fontSize: 12, color: colors.gray400, fontFamily: typography.body },

  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { fontSize: 14, color: colors.gray600, fontFamily: typography.body },
  summaryAmt: { fontSize: 14, color: colors.ink, fontFamily: typography.bodySemiBold },
  divider: { height: 1, backgroundColor: colors.gray200, marginVertical: spacing.xs },
  totalLabel: { fontSize: 15, color: colors.ink, fontFamily: typography.bodySemiBold },
  totalAmt: { fontSize: 19, color: BRAND_BLUE, fontFamily: typography.heading },

  warnBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.amberLight,
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  warnText: { flex: 1, fontSize: 13, color: "#92400E", fontFamily: typography.bodyMedium },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.redLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  errorText: { flex: 1, color: colors.red, fontSize: 13, fontFamily: typography.bodyMedium },

  primaryBtn: {
    backgroundColor: BRAND_BLUE,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: typography.bodySemiBold,
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.white,
  },
  secondaryBtnText: { color: colors.ink, fontSize: 14, fontFamily: typography.bodySemiBold },

  doneSafe: { flex: 1, backgroundColor: colors.offWhite },
  doneBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.xl,
  },
  doneTitle: { fontSize: 24, color: colors.ink, fontFamily: typography.heading, marginTop: spacing.sm },
  doneMeta: { fontSize: 14, color: colors.gray600, fontFamily: typography.bodyMedium },
  doneSub: {
    fontSize: 13,
    color: colors.gray400,
    fontFamily: typography.body,
    textAlign: "center",
    marginTop: 2,
  },
  doneActions: { padding: spacing.lg, gap: spacing.sm },
});
