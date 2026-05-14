import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  FadeInDown,
  FadeIn,
  LinearTransition,
} from "react-native-reanimated";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useCartStore } from "../../store/cartStore";
import { colors, spacing, radius, shadow, typography } from "../../lib/theme";
import { fmtRs } from "../../lib/format";

const { width: W } = Dimensions.get("window");

// ─── Swipe-to-delete action ───────────────────────────────────────────────────
function DeleteAction({ onDelete }: { onDelete: () => void }) {
  return (
    <TouchableOpacity style={styles.deleteAction} onPress={onDelete} activeOpacity={0.8}>
      <Ionicons name="trash-outline" size={20} color={colors.white} />
      <Text style={styles.deleteText}>Remove</Text>
    </TouchableOpacity>
  );
}

// ─── Cart item ────────────────────────────────────────────────────────────────
function CartItem({
  item,
  index,
  onQtyChange,
  onRemove,
}: {
  item: any;
  index: number;
  onQtyChange: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}) {
  const btnScale = useSharedValue(1);

  const pressBtn = (cb: () => void) => {
    btnScale.value = withSequence(
      withSpring(0.88, { damping: 20, stiffness: 300 }),
      withSpring(1, { damping: 20, stiffness: 300 })
    );
    cb();
  };

  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify().damping(18)}
      layout={LinearTransition.springify()}
    >
      <Swipeable
        renderRightActions={() => <DeleteAction onDelete={() => onRemove(item.productId)} />}
        overshootRight={false}
        friction={2}
      >
        <View style={[styles.card, shadow.sm]}>
          {/* Image */}
          <View style={styles.cardImg} />

          {/* Info */}
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.cardUnitPrice}>
              {item.qty} carton{item.qty > 1 ? "s" : ""} ({item.qty * item.piecesPerCarton} {item.unit}{item.qty * item.piecesPerCarton > 1 ? "s" : ""})
            </Text>
            <Text style={styles.cardLineTotal}>
              Rs {(item.pricePerCarton * item.qty).toLocaleString()}
            </Text>
          </View>

          {/* Qty stepper — cartons, min 1 */}
          <View style={styles.qtyCol}>
            <Animated.View style={btnStyle}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => pressBtn(() => onQtyChange(item.productId, Math.max(1, item.qty - 1)))}
                activeOpacity={0.9}
                disabled={item.qty <= 1}
              >
                <Text style={[styles.qtyBtnText, item.qty <= 1 && { opacity: 0.4 }]}>−</Text>
              </TouchableOpacity>
            </Animated.View>

            <Text style={styles.qtyValue}>{item.qty}</Text>

            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => onQtyChange(item.productId, item.qty + 1)}
              activeOpacity={0.9}
            >
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Swipeable>
    </Animated.View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyCart({ onBrowse }: { onBrowse: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.emptyWrap}>
      <View style={styles.emptyIconBg}>
        <Ionicons name="bag-outline" size={36} color={colors.blue} />
      </View>
      <Text style={styles.emptyTitle}>Your cart is empty</Text>
      <Text style={styles.emptyBody}>
        Add products from the catalogue to place a wholesale order.
      </Text>
      <TouchableOpacity style={styles.browseBtn} onPress={onBrowse} activeOpacity={0.88}>
        <Text style={styles.browseBtnText}>Browse products</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.white} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export function CartScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { items, updateQty, removeItem, totalAmount, clearCart } = useCartStore();
  const totalItems = items.reduce((s, i) => s + i.qty, 0);

  if (items.length === 0) {
    return (
      <View style={styles.flex}>
        <View style={{ height: insets.top }} />
        <View style={styles.header}>
          <Text style={styles.heading}>Cart</Text>
        </View>
        <EmptyCart onBrowse={() => navigation.navigate("Catalogue")} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={{ height: insets.top }} />

      {/* Header */}
      <Animated.View entering={FadeInDown.springify()} style={styles.header}>
        <View>
          <Text style={styles.heading}>Cart</Text>
          <Text style={styles.headingMeta}>{totalItems} item{totalItems !== 1 ? "s" : ""}</Text>
        </View>
        <TouchableOpacity
          onPress={clearCart}
          style={styles.clearBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="trash-outline" size={14} color={colors.red} />
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Hint */}
      <View style={styles.swipeHint}>
        <Ionicons name="swap-horizontal-outline" size={12} color={colors.gray400} />
        <Text style={styles.swipeHintText}>Swipe left to remove an item</Text>
      </View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.productId)}
        contentContainerStyle={[styles.list, { paddingBottom: 200 + insets.bottom }]}
        renderItem={({ item, index }) => (
          <CartItem
            item={item}
            index={index}
            onQtyChange={updateQty}
            onRemove={removeItem}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        showsVerticalScrollIndicator={false}
      />

      {/* Footer */}
      <View
        style={[
          styles.footer,
          shadow.md,
          { paddingBottom: insets.bottom + spacing.md },
        ]}
      >
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Order subtotal</Text>
            <Text style={styles.summaryNote}>+ Delivery fee at checkout</Text>
          </View>
          <Text style={styles.summaryTotal}>Rs {totalAmount().toLocaleString()}</Text>
        </View>

        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => navigation.navigate("Checkout")}
          activeOpacity={0.88}
        >
          <Text style={styles.checkoutText}>Proceed to checkout</Text>
          <View style={styles.checkoutArrow}>
            <Ionicons name="arrow-forward" size={16} color={colors.blue} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  heading: {
    fontSize: 26,
    fontFamily: typography.heading,
    color: colors.ink,
  },
  headingMeta: {
    fontSize: 13,
    color: colors.gray400,
    fontFamily: typography.body,
    marginTop: 1,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: colors.redLight,
    marginTop: 6,
  },
  clearText: { fontSize: 13, color: colors.red, fontFamily: typography.bodySemiBold },

  swipeHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  swipeHintText: { fontSize: 11, color: colors.gray400, fontFamily: typography.body },

  list: { paddingHorizontal: spacing.lg },

  card: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: "center",
  },
  cardImg: {
    width: 64,
    height: 64,
    backgroundColor: colors.gray100,
    borderRadius: radius.lg,
    flexShrink: 0,
  },
  cardInfo: { flex: 1, gap: 3 },
  cardName: { fontSize: 14, fontFamily: typography.bodySemiBold, color: colors.ink, lineHeight: 19 },
  cardUnitPrice: { fontSize: 12, color: colors.gray400, fontFamily: typography.body },
  cardLineTotal: { fontSize: 14, fontFamily: typography.heading, color: colors.blue },
  qtyCol: {
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 0,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.blueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { fontSize: 18, color: colors.blue, lineHeight: 22, fontFamily: typography.heading },
  qtyValue: {
    fontSize: 16,
    fontFamily: typography.heading,
    color: colors.ink,
    minWidth: 24,
    textAlign: "center",
  },

  deleteAction: {
    backgroundColor: colors.red,
    justifyContent: "center",
    alignItems: "center",
    width: 84,
    marginLeft: spacing.xs,
    borderRadius: radius.xl,
    gap: 4,
  },
  deleteText: { color: colors.white, fontFamily: typography.bodySemiBold, fontSize: 11 },

  // Empty
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.blueLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  emptyTitle: { fontSize: 20, fontFamily: typography.heading, color: colors.ink },
  emptyBody: { fontSize: 14, color: colors.gray400, textAlign: "center", fontFamily: typography.body, lineHeight: 22 },
  browseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.blue,
    paddingVertical: 13,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
    marginTop: spacing.xs,
  },
  browseBtnText: { color: colors.white, fontFamily: typography.bodySemiBold, fontSize: 15 },

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  summaryLabel: { fontSize: 14, color: colors.gray600, fontFamily: typography.bodyMedium },
  summaryNote: { fontSize: 11, color: colors.gray400, fontFamily: typography.body, marginTop: 2 },
  summaryTotal: { fontSize: 26, fontFamily: typography.heading, color: colors.ink },
  checkoutBtn: {
    backgroundColor: colors.blue,
    borderRadius: radius.lg,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  checkoutText: { color: colors.white, fontFamily: typography.bodySemiBold, fontSize: 16 },
  checkoutArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
});
