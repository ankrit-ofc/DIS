import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { colors, spacing, radius, shadow, typography } from "../lib/theme";
import { priceLine1, priceLine2, unitPriceOf, type SellUnit, type StockStatus } from "../lib/format";
import { resolveImageUrl } from "../lib/imageUrl";
import { CardStepper } from "./CardStepper";

/**
 * Grid product card with an inline add-to-cart stepper. Shared by the buyer
 * catalogue and the sales rep catalogue — the stepper writes to the same cart
 * store either way, so the rep's cart is the shop's order.
 *
 * HomeScreen has a similar card with different image fit and badge styling; it
 * is deliberately left alone rather than folded in here.
 */
export interface CardProduct {
  id: string;
  name: string;
  sellUnit: SellUnit;
  price: number;
  mrp?: number | null;
  unit: string;
  moq: number;
  imageUrl?: string;
  brand?: string;
  piecesPerCarton?: number | null;
  pricePerCarton?: number | null;
  stockStatus: StockStatus;
  maxOrderQty: number;
}

const W = Dimensions.get("window").width;
/** Default two-up grid width, matching the buyer catalogue. */
export const PRODUCT_CARD_W = (W - spacing.lg * 2 - spacing.sm) / 2;
const IMG_H = Math.round(PRODUCT_CARD_W * 0.9);

export function ProductCard({
  item,
  onPress,
  width = PRODUCT_CARD_W,
  showEconomics = false,
}: {
  item: CardProduct;
  onPress: () => void;
  width?: number;
  /**
   * Show MRP and the shopkeeper's margin. Rep-facing catalogues pass true; the
   * buyer catalogue leaves it off. Defaults to off so a new caller can't leak
   * dealer economics to a shopkeeper by omission.
   */
  showEconomics?: boolean;
}) {
  const outOfStock = item.stockStatus === "OUT_OF_STOCK";
  const lowStock = item.stockStatus === "LOW_STOCK";
  const sub = priceLine2(item, showEconomics);
  return (
    <TouchableOpacity
      style={[pc.card, { width }, shadow.card, outOfStock && pc.cardOos]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={pc.imgWrap}>
        {item.imageUrl ? (
          <ExpoImage
            source={{ uri: resolveImageUrl(item.imageUrl) ?? "" }}
            style={pc.img}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
            placeholder={colors.gray100}
          />
        ) : (
          <View style={pc.imgPlaceholder} />
        )}
        {lowStock && !outOfStock && (
          <View style={pc.lowBadge}>
            <Text style={pc.lowBadgeText}>Low stock</Text>
          </View>
        )}
        {outOfStock && (
          <View style={pc.oos}>
            <Text style={pc.oosText}>Out of stock</Text>
          </View>
        )}
      </View>
      <View style={pc.body}>
        {item.brand && (
          <Text style={pc.brand} numberOfLines={1}>
            {item.brand}
          </Text>
        )}
        <Text style={pc.name} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={pc.price}>{priceLine1(item)}</Text>
        {sub && (
          <Text style={pc.cartonMeta} numberOfLines={1}>
            {sub}
          </Text>
        )}
        <View style={{ marginTop: 6 }}>
          <CardStepper
            product={{
              productId: item.id,
              name: item.name,
              sellUnit: item.sellUnit,
              unitPrice: unitPriceOf(item),
              mrp: item.mrp,
              moq: item.moq,
              maxOrderQty: item.maxOrderQty,
              piecesPerCarton: item.piecesPerCarton,
              stockStatus: item.stockStatus,
              image: item.imageUrl ?? undefined,
            }}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const pc = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.xl, overflow: "hidden" },
  imgWrap: { width: "100%", height: IMG_H },
  img: { width: "100%", height: "100%" },
  imgPlaceholder: { width: "100%", height: "100%", backgroundColor: colors.gray100 },
  oos: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  oosText: { fontSize: 11, fontFamily: typography.bodySemiBold, color: colors.white },
  cardOos: { opacity: 0.6 },
  lowBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#FFF7ED",
    borderColor: "#FDBA74",
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  lowBadgeText: { fontSize: 10, fontFamily: typography.bodySemiBold, color: "#C2410C" },
  body: { padding: 10, gap: 2 },
  brand: {
    fontSize: 10,
    fontFamily: typography.bodySemiBold,
    color: colors.blue,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  name: {
    fontSize: 13,
    fontFamily: typography.bodySemiBold,
    color: colors.ink,
    lineHeight: 17,
    minHeight: 34,
  },
  price: {
    fontSize: 15,
    fontFamily: typography.heading,
    color: "#2563EB",
    marginTop: 2,
    fontWeight: "700",
  },
  cartonMeta: { fontSize: 10, fontFamily: typography.body, color: "#9BA3BF" },
});
