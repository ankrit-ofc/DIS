import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCartStore, type CartItem } from "../store/cartStore";
import { colors, radius, typography } from "../lib/theme";
import { unitShort, type SellUnit, type StockStatus } from "../lib/format";

export interface StepperProduct {
  productId: string;
  name: string;
  sellUnit: SellUnit;
  /** Rs per sellUnit */
  unitPrice: number;
  mrp?: number | null;
  moq: number;
  maxOrderQty: number;
  piecesPerCarton?: number | null;
  stockStatus: StockStatus;
  image?: string;
}

/**
 * Mobile counterpart of the web QtyStepper: Add-to-Van → [− qty +] with a
 * typeable center field, MOQ-aware first add, subtle remove confirm below MOQ,
 * and an "Only N available" hint at the cap.
 */
export function CardStepper({
  product,
  size = "sm",
}: {
  product: StepperProduct;
  size?: "sm" | "lg";
}) {
  const { items, addItem, updateQty, removeItem } = useCartStore();
  const inCart = items.find((i) => i.productId === product.productId);

  const [draft, setDraft] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [capHint, setCapHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (hintTimer.current) clearTimeout(hintTimer.current); }, []);
  useEffect(() => { if (!inCart) { setConfirmRemove(false); setDraft(null); } }, [inCart]);

  const outOfStock = product.stockStatus === "OUT_OF_STOCK" || product.maxOrderQty < 1;
  const unit = unitShort(product.sellUnit);
  const max = Math.max(product.moq, product.maxOrderQty);
  const lg = size === "lg";

  function toCartItem(): Omit<CartItem, "qty"> {
    return {
      productId: product.productId,
      name: product.name,
      sellUnit: product.sellUnit,
      price: product.unitPrice,
      mrp: product.mrp,
      moq: product.moq,
      maxOrderQty: product.maxOrderQty,
      piecesPerCarton: product.piecesPerCarton,
      image: product.image,
    };
  }

  function showCapHint() {
    setCapHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setCapHint(false), 2500);
  }

  function commitDraft() {
    if (!inCart || draft === null) return;
    const n = parseInt(draft, 10);
    setDraft(null);
    if (isNaN(n)) return;
    if (n < product.moq) { updateQty(product.productId, product.moq); return; }
    if (n > max) { updateQty(product.productId, max); showCapHint(); return; }
    updateQty(product.productId, n);
  }

  if (outOfStock) {
    return (
      <View style={[s.btn, s.btnDisabled, lg && s.btnLg]}>
        <Text style={[s.btnText, { color: colors.gray400 }]}>Out of Stock</Text>
      </View>
    );
  }

  if (!inCart) {
    return (
      <TouchableOpacity
        style={[s.btn, lg && s.btnLg]}
        onPress={() => addItem(toCartItem(), product.moq)}
        activeOpacity={0.85}
      >
        <Ionicons name="cart-outline" size={lg ? 17 : 14} color={colors.white} />
        <Text style={s.btnText}>Add to Van</Text>
      </TouchableOpacity>
    );
  }

  if (confirmRemove) {
    return (
      <View style={[s.confirmWrap, lg && s.btnLg]}>
        <Text style={s.confirmText}>Remove?</Text>
        <TouchableOpacity
          style={s.confirmYes}
          onPress={() => removeItem(product.productId)}
          activeOpacity={0.85}
        >
          <Text style={s.confirmYesText}>Yes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.confirmNo}
          onPress={() => setConfirmRemove(false)}
          activeOpacity={0.85}
        >
          <Text style={s.confirmNoText}>No</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const qty = inCart.qty;
  const atMax = qty >= max;

  return (
    <View>
      <View style={[s.stepper, lg && s.stepperLg]}>
        <TouchableOpacity
          style={[s.stepBtn, lg && s.stepBtnLg]}
          onPress={() => {
            if (qty - 1 < product.moq) setConfirmRemove(true);
            else updateQty(product.productId, qty - 1);
          }}
          activeOpacity={0.85}
          hitSlop={6}
        >
          <Text style={s.stepBtnText}>−</Text>
        </TouchableOpacity>
        <View style={s.qtyWrap}>
          <TextInput
            style={[s.qtyInput, lg && s.qtyInputLg]}
            value={draft ?? String(qty)}
            onChangeText={(t) => setDraft(t.replace(/[^0-9]/g, ""))}
            onBlur={commitDraft}
            onSubmitEditing={commitDraft}
            keyboardType="number-pad"
            returnKeyType="done"
            selectTextOnFocus
          />
          <Text style={s.qtyUnit}>{unit}</Text>
        </View>
        <TouchableOpacity
          style={[s.stepBtn, lg && s.stepBtnLg, atMax && { opacity: 0.4 }]}
          onPress={() => {
            if (atMax) { showCapHint(); return; }
            updateQty(product.productId, qty + 1);
          }}
          activeOpacity={0.85}
          hitSlop={6}
        >
          <Text style={s.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      {(capHint || atMax) && (
        <Text style={s.capHint}>Only {product.maxOrderQty} available</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.blue,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  btnLg: { paddingVertical: 14 },
  btnDisabled: { backgroundColor: colors.gray200 },
  btnText: { color: colors.white, fontFamily: typography.bodySemiBold, fontSize: 13 },

  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    padding: 3,
  },
  stepperLg: { padding: 6 },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.blueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnLg: { width: 40, height: 40 },
  stepBtnText: { fontSize: 17, color: colors.blue, lineHeight: 20, fontFamily: typography.heading },
  qtyWrap: { flexDirection: "row", alignItems: "baseline", gap: 3, flexShrink: 1 },
  qtyInput: {
    minWidth: 34,
    textAlign: "center",
    fontSize: 15,
    fontFamily: typography.heading,
    color: colors.ink,
    padding: 0,
  },
  qtyInputLg: { minWidth: 48, fontSize: 20 },
  qtyUnit: { fontSize: 10, color: colors.gray400, fontFamily: typography.body },
  capHint: {
    fontSize: 10,
    color: colors.amberDark ?? "#B45309",
    fontFamily: typography.body,
    textAlign: "center",
    marginTop: 3,
  },

  confirmWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  confirmText: { fontSize: 11, color: colors.red, fontFamily: typography.bodySemiBold },
  confirmYes: {
    backgroundColor: colors.red,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  confirmYesText: { color: colors.white, fontSize: 11, fontFamily: typography.bodySemiBold },
  confirmNo: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.white,
  },
  confirmNoText: { color: colors.gray600, fontSize: 11, fontFamily: typography.bodyMedium },
});
