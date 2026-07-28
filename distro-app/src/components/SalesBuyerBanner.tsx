import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../lib/theme";
import { buyerLabel, type SalesBuyer } from "../lib/sales";

/**
 * "Ordering for {shop}" — pinned to the top of every screen in the sales
 * order flow. A rep works several shops in a row from the same phone, so the
 * shop the cart belongs to must never be more than a glance away.
 *
 * The ✕ discards the whole in-progress order (buyer + cart die together), so
 * it always confirms first.
 */
export function SalesBuyerBanner({
  buyer,
  onDiscard,
}: {
  buyer: SalesBuyer;
  onDiscard: () => void;
}) {
  const confirmDiscard = () => {
    Alert.alert(
      "Discard this order?",
      `Discard this order and pick another shop? Everything in ${buyerLabel(buyer)}'s cart will be lost.`,
      [
        { text: "Keep ordering", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: onDiscard },
      ],
    );
  };

  return (
    <View style={s.bar}>
      <View style={s.icon}>
        <Ionicons name="storefront-outline" size={15} color={colors.white} />
      </View>
      <View style={s.body}>
        <Text style={s.eyebrow}>Ordering for</Text>
        <Text style={s.name} numberOfLines={1}>
          {buyerLabel(buyer)}
        </Text>
      </View>
      <TouchableOpacity onPress={confirmDiscard} hitSlop={10} style={s.close}>
        <Ionicons name="close" size={18} color="rgba(255,255,255,0.9)" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#1A4BDB",
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontSize: 10,
    color: "rgba(255,255,255,0.75)",
    fontFamily: typography.bodySemiBold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  name: { fontSize: 14, color: colors.white, fontFamily: typography.bodySemiBold },
  close: { padding: 2 },
});
