import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useState, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  withSequence, FadeInDown, FadeIn, interpolate, Extrapolation,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useCartStore } from "../../store/cartStore";
import { colors, spacing, radius, shadow, typography } from "../../lib/theme";
import {
  fmtRs, priceLine1, priceLine2, unitPriceOf, unitShort,
  type SellUnit, type StockStatus,
} from "../../lib/format";
import { resolveImageUrl } from "../../lib/imageUrl";
import { CardStepper } from "../../components/CardStepper";

interface Product {
  id: string; name: string; sellUnit: SellUnit; price: number; mrp?: number | null;
  unit: string; moq: number; imageUrl?: string;
  brand?: string; description?: string; categoryName?: string;
  piecesPerCarton?: number | null; pricePerCarton?: number | null;
  stockStatus: StockStatus; maxOrderQty: number;
}

// ─── Stock badge — coarse status only, no raw numbers ─────────────────────────
function StockBadge({ status }: { status: StockStatus }) {
  if (status === "OUT_OF_STOCK") return <View style={[sb.wrap, { backgroundColor: colors.redLight   }]}><View style={[sb.dot, { backgroundColor: colors.red   }]} /><Text style={[sb.text, { color: colors.red   }]}>Out of stock</Text></View>;
  if (status === "LOW_STOCK")    return <View style={[sb.wrap, { backgroundColor: colors.amberLight }]}><View style={[sb.dot, { backgroundColor: colors.amber }]} /><Text style={[sb.text, { color: colors.amberDark }]}>Low stock</Text></View>;
  return                                <View style={[sb.wrap, { backgroundColor: colors.greenLight  }]}><View style={[sb.dot, { backgroundColor: colors.green  }]} /><Text style={[sb.text, { color: colors.greenDark  }]}>In stock</Text></View>;
}
const sb = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  dot:  { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontFamily: typography.bodySemiBold },
});

// ─── Qty button ───────────────────────────────────────────────────────────────
function QtyBtn({ icon, onPress, disabled }: { icon: string; onPress: () => void; disabled: boolean }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: disabled ? 0.4 : 1 }));
  return (
    <TouchableOpacity onPress={() => {
      if (disabled) return;
      scale.value = withSequence(withSpring(0.88, { damping: 18 }), withSpring(1, { damping: 18 }));
      onPress();
    }} activeOpacity={1} disabled={disabled}>
      <Animated.View style={[qb.btn, style]}>
        <Text style={qb.icon}>{icon}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}
const qb = StyleSheet.create({
  btn:  { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.blueLight, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 20, color: colors.blue, lineHeight: 24 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export function ProductScreen({ navigation, route }: any) {
  const { productId } = route.params;
  const insets = useSafeAreaInsets();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const { items } = useCartStore();

  const barY       = useSharedValue(80);
  const barOpacity = useSharedValue(0);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ translateY: barY.value }], opacity: barOpacity.value }));

  useEffect(() => {
    api.get(`/products/${productId}`)
      .then(res => {
        const p = res.data.product ?? res.data;
        setProduct(p);
        barY.value = withSpring(0, { damping: 18, stiffness: 200 });
        barOpacity.value = withTiming(1, { duration: 300 });
      })
      .catch(() => setLoading(false))
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading || !product) {
    return (
      <View style={s.center}>
        {!loading && !product && <><Ionicons name="alert-circle-outline" size={32} color={colors.gray300} /><Text style={s.errText}>Product not found</Text></>}
      </View>
    );
  }

  const unit       = unitShort(product.sellUnit);
  const unitPrice  = unitPriceOf(product);
  const outOfStock = product.stockStatus === "OUT_OF_STOCK";
  const cartItem   = items.find(i => i.productId === productId);
  const priceSub   = priceLine2(product);

  return (
    <View style={s.flex}>
      <ScrollView style={s.bg} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>

        {/* Status-bar safe spacer */}
        <View style={{ height: insets.top, backgroundColor: colors.white }} />

        {/* Hero image — fixed square aspect, contained, never overflows */}
        <View style={s.hero}>
          {product.imageUrl
            ? <ExpoImage source={{ uri: resolveImageUrl(product.imageUrl) ?? "" }} style={[s.heroImg, outOfStock && { opacity: 0.5 }]} contentFit="contain" cachePolicy="memory-disk" transition={200} placeholder={colors.blueLight} />
            : <View style={s.heroPlaceholder}><Ionicons name="cube-outline" size={36} color={colors.blue} style={{ opacity: 0.35 }} /></View>}
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={20} color={colors.ink} />
          </TouchableOpacity>
        </View>

        {/* Content card */}
        <View style={s.card}>

          {/* Brand + category */}
          <Animated.View entering={FadeInDown.delay(60).springify()} style={s.metaRow}>
            {product.brand && <View style={s.brandChip}><Text style={s.brandText}>{product.brand}</Text></View>}
            {product.categoryName && <Text style={s.catText}>{product.categoryName}</Text>}
          </Animated.View>

          {/* Name */}
          <Animated.Text entering={FadeInDown.delay(100).springify()} style={s.name}>{product.name}</Animated.Text>

          {/* Price block — sellUnit-aware, no mixed-unit strikethrough */}
          <Animated.View entering={FadeInDown.delay(140).springify()} style={s.priceBlock}>
            <Text style={s.price}>{priceLine1(product)}</Text>
            {priceSub && <Text style={s.priceSubLine}>{priceSub}</Text>}
          </Animated.View>

          {/* Stock */}
          <Animated.View entering={FadeInDown.delay(180).springify()}>
            <StockBadge status={product.stockStatus} />
          </Animated.View>

          {/* MOQ */}
          <Animated.View entering={FadeInDown.delay(210).springify()} style={s.moqBox}>
            <Ionicons name="information-circle-outline" size={16} color={colors.amberDark} />
            <Text style={s.moqText}>
              Minimum order:{" "}
              <Text style={s.moqBold}>
                {product.moq} {unit}
                {product.sellUnit === "CARTON" && product.piecesPerCarton
                  ? ` (${product.moq * product.piecesPerCarton} pcs)`
                  : ""}
              </Text>
            </Text>
          </Animated.View>

          {/* Meta row */}
          <Animated.View entering={FadeInDown.delay(230).springify()} style={s.metaCards}>
            <View style={s.metaCard}>
              <Text style={s.metaCardLabel}>Sold by</Text>
              <Text style={s.metaCardValue}>{product.sellUnit === "CARTON" ? "Carton" : "Piece"}</Text>
            </View>
            <View style={s.metaCard}>
              <Text style={s.metaCardLabel}>Min Order</Text>
              <Text style={s.metaCardValue}>{product.moq} {unit}</Text>
            </View>
            {product.sellUnit === "CARTON" && (
              <View style={s.metaCard}>
                <Text style={s.metaCardLabel}>Pcs / Carton</Text>
                <Text style={s.metaCardValue}>{product.piecesPerCarton ?? "—"}</Text>
              </View>
            )}
          </Animated.View>

          {/* Description */}
          {product.description && (
            <Animated.View entering={FadeInDown.delay(290).springify()} style={s.descBox}>
              <Text style={s.descLabel}>About this product</Text>
              <Text style={s.descText}>{product.description}</Text>
            </Animated.View>
          )}

          {/* Cart note */}
          {cartItem && (
            <Animated.View entering={FadeIn} style={s.cartNote}>
              <Ionicons name="bag-outline" size={14} color={colors.blue} />
              <Text style={s.cartNoteText}>
                {cartItem.qty} {unit} in cart — use the stepper below to adjust
              </Text>
            </Animated.View>
          )}
        </View>
      </ScrollView>

      {/* Sticky bottom bar — cart-connected stepper (MOQ-aware, typeable) */}
      <Animated.View style={[s.bar, shadow.lg, barStyle, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={s.barTotal}>
          <Text style={s.barAmount}>
            {fmtRs(unitPrice * (cartItem?.qty ?? product.moq))}
          </Text>
          <Text style={s.barNote}>
            {(cartItem?.qty ?? product.moq)} {unit}
            {product.sellUnit === "CARTON" && product.piecesPerCarton
              ? ` · ${(cartItem?.qty ?? product.moq) * product.piecesPerCarton} pcs`
              : ""}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <CardStepper
            size="lg"
            product={{
              productId: product.id,
              name: product.name,
              sellUnit: product.sellUnit,
              unitPrice,
              mrp: product.mrp,
              moq: product.moq,
              maxOrderQty: product.maxOrderQty,
              piecesPerCarton: product.piecesPerCarton,
              stockStatus: product.stockStatus,
              image: product.imageUrl ?? undefined,
            }}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  flex:    { flex: 1 },
  bg:      { flex: 1, backgroundColor: colors.white },
  center:  { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.offWhite },
  errText: { color: colors.gray400, fontFamily: typography.body, fontSize: 14 },

  // Hero — fixed-aspect square, never overflows
  hero:            { width: "100%", aspectRatio: 1, position: "relative", backgroundColor: colors.gray100, overflow: "hidden" },
  heroImg:         { width: "100%", height: "100%" },
  heroPlaceholder: { width: "100%", height: "100%", backgroundColor: colors.blueLight, alignItems: "center", justifyContent: "center" },
  discountBadge:   { position: "absolute", top: spacing.md, right: spacing.md, backgroundColor: colors.green, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  discountText:    { color: colors.white, fontFamily: typography.bodySemiBold, fontSize: 12 },
  backBtn:         { position: "absolute", top: spacing.sm, left: spacing.md, width: 38, height: 38, borderRadius: 19, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", ...shadow.sm },

  // Card
  card:      { backgroundColor: colors.white, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, marginTop: -28, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  metaRow:   { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandChip: { backgroundColor: colors.blueLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  brandText: { fontSize: 11, fontFamily: typography.bodySemiBold, color: colors.blue, letterSpacing: 0.4 },
  catText:   { fontSize: 12, color: colors.gray400, fontFamily: typography.body },
  name:      { fontSize: 24, fontFamily: typography.heading, color: colors.ink, lineHeight: 30 },

  // Price
  priceBlock:       { gap: 2 },
  priceSubLine:     { fontSize: 13, color: colors.gray500, fontFamily: typography.body },
  priceRow:         { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  price:            { fontSize: 24, fontFamily: typography.heading, color: "#2563EB", fontWeight: "700" },
  cartonPrice:      { fontSize: 13, color: "#9BA3BF", fontFamily: typography.body },
  priceUnit:        { fontSize: 14, color: colors.gray400, fontFamily: typography.body },
  mrp:              { fontSize: 16, color: colors.gray300, textDecorationLine: "line-through", fontFamily: typography.body },
  discountPill:     { backgroundColor: colors.greenLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  discountPillText: { fontSize: 11, fontFamily: typography.bodySemiBold, color: colors.greenDark },

  // Meta cards row
  metaCards: { flexDirection: "row", gap: spacing.sm },
  metaCard: {
    flex: 1,
    backgroundColor: colors.offWhite,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    padding: spacing.sm,
    alignItems: "center",
    gap: 2,
  },
  metaCardLabel: { fontSize: 10, color: colors.gray400, fontFamily: typography.body },
  metaCardValue: { fontSize: 14, fontFamily: typography.heading, color: colors.ink },

  // Qty total
  qtyTotal: { flex: 1, alignItems: "flex-end" },
  qtyTotalText: { fontSize: 13, fontFamily: typography.bodySemiBold, color: colors.blue },

  // MOQ & unit
  moqBox:  { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs, backgroundColor: colors.amberLight, borderRadius: radius.md, padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.amber },
  moqText: { flex: 1, fontSize: 13, color: "#78350F", fontFamily: typography.body, lineHeight: 18 },
  moqBold: { fontFamily: typography.bodySemiBold },
  unitRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  unitText:{ fontSize: 13, color: colors.gray400, fontFamily: typography.body },

  // Qty stepper
  qtySection: { gap: spacing.sm },
  qtyLabel:   { fontSize: 14, fontFamily: typography.bodySemiBold, color: colors.gray600 },
  qtyRow:     { flexDirection: "row", alignItems: "center", gap: spacing.md },
  qtyDisplay: { flexDirection: "row", alignItems: "baseline", gap: 4, minWidth: 64, justifyContent: "center" },
  qtyVal:     { fontSize: 26, fontFamily: typography.heading, color: colors.ink },
  qtyUnit:    { fontSize: 13, color: colors.gray400, fontFamily: typography.body },
  qtyDerived: { fontSize: 12, color: colors.gray400, fontFamily: typography.body, marginTop: spacing.xs },

  // Description
  descBox:  { backgroundColor: colors.offWhite, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  descLabel:{ fontSize: 13, fontFamily: typography.bodySemiBold, color: colors.gray600 },
  descText: { fontSize: 14, color: colors.gray500, fontFamily: typography.body, lineHeight: 22 },

  // Cart note
  cartNote:    { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.blueLight, borderRadius: radius.md, padding: spacing.sm },
  cartNoteText:{ flex: 1, fontSize: 12, color: colors.blue, fontFamily: typography.bodyMedium },

  // Sticky bar
  bar:        { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", paddingTop: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.gray100 },
  barTotal:   { gap: 1 },
  barAmount:  { fontSize: 22, fontFamily: typography.heading, color: colors.ink },
  barNote:    { fontSize: 12, color: colors.gray400, fontFamily: typography.body },
  addBtn:     { backgroundColor: colors.blue, borderRadius: radius.md, paddingVertical: 14, flex: 1, alignItems: "center" },
  addBtnUpdate:  { backgroundColor: colors.blueDark },
  addBtnDisabled:{ backgroundColor: colors.gray200 },
  addBtnInner:   { flexDirection: "row", alignItems: "center", gap: spacing.sm, justifyContent: "center" },
  addBtnText:    { color: colors.white, fontFamily: typography.bodySemiBold, fontSize: 15 },
});
