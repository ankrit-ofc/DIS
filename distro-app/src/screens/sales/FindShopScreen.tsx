import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { SCREEN_EDGES } from "../../lib/screen";
import { Ionicons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { SalesBuyer, buyerLabel, buyerCoords } from "../../lib/sales";
import { useSalesBuyerStore } from "../../store/salesBuyerStore";
import { useBuyerSearch } from "../../hooks/useBuyerSearch";
import { colors, spacing, radius, typography, shadow } from "../../lib/theme";
import { SalesStackParamList } from "../../navigation/SalesStack";

const BRAND_BLUE = "#1A4BDB";

type Props = { navigation: StackNavigationProp<SalesStackParamList, "FindShop"> };

/**
 * Shop directory for the rep — the browse/admin counterpart to
 * SelectBuyerScreen. Deliberately a separate screen: here a tap opens actions,
 * whereas in the picker every tap commits to a shop and clears the cart. That
 * guard stays unconditional by not sharing the screen; the search itself is
 * shared through useBuyerSearch.
 *
 * /sales/buyers needs a 2-character query, so the rep's recent shops stand in
 * as the browse surface when the field is empty.
 */
export function FindShopScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const setBuyer = useSalesBuyerStore((s) => s.setBuyer);
  const {
    search, setSearch, query, searchNow,
    results, total, hasMore, loadMore, loading, loadingMore,
    recent, error, filtering,
  } = useBuyerSearch();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const startOrder = (buyer: SalesBuyer) => {
    // Same commitment as the picker — switching shops discards the old cart.
    setBuyer(buyer);
    navigation.navigate("SalesCatalogue");
  };

  return (
    <SafeAreaView style={s.safe} edges={SCREEN_EDGES}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Find a shop</Text>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>
              {filtering ? "Results" : "All shops"}
              {!loading && results.length > 0 ? `  ·  ${total}` : ""}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("NewBuyer")}
              hitSlop={6}
              style={s.newShopBtn}
            >
              <Ionicons name="add-circle-outline" size={16} color={BRAND_BLUE} />
              <Text style={s.newShopText}>New shop</Text>
            </TouchableOpacity>
          </View>

          <View style={s.searchBar}>
            <Ionicons name="search-outline" size={17} color={colors.gray400} />
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Name, phone, owner or address…"
              placeholderTextColor={colors.gray300}
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={searchNow}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={17} color={colors.gray300} />
              </TouchableOpacity>
            )}
          </View>

          {!!error && (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.red} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          {loading ? (
            <View style={s.searchingRow}>
              <ActivityIndicator size="small" color={BRAND_BLUE} />
              <Text style={s.mutedText}>{filtering ? "Searching…" : "Loading shops…"}</Text>
            </View>
          ) : results.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.mutedText}>
                {filtering
                  ? `No shop found for “${query.trim()}”.`
                  : "No shops registered yet."}
              </Text>
              <TouchableOpacity
                style={s.registerBtn}
                onPress={() =>
                  navigation.navigate("NewBuyer", {
                    initialName: filtering ? query.trim() : undefined,
                  })
                }
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={16} color={BRAND_BLUE} />
                <Text style={s.registerBtnText} numberOfLines={1}>
                  {filtering ? `Register “${query.trim()}”` : "Register a shop"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {results.map((buyer) => (
                <ShopRow
                  key={buyer.id}
                  buyer={buyer}
                  expanded={expandedId === buyer.id}
                  onToggle={() => setExpandedId((id) => (id === buyer.id ? null : buyer.id))}
                  onPin={() => navigation.navigate("PinLocation", { buyer })}
                  onOrder={() => startOrder(buyer)}
                />
              ))}
              {hasMore && (
                <TouchableOpacity
                  style={[s.loadMore, loadingMore && { opacity: 0.5 }]}
                  onPress={loadMore}
                  disabled={loadingMore}
                  activeOpacity={0.85}
                >
                  <Text style={s.loadMoreText}>
                    {loadingMore ? "Loading…" : `Load more (${results.length} of ${total})`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ShopRow({
  buyer,
  expanded,
  onToggle,
  onPin,
  onOrder,
}: {
  buyer: SalesBuyer;
  expanded: boolean;
  onToggle: () => void;
  onPin: () => void;
  onOrder: () => void;
}) {
  const pinned = buyerCoords(buyer) !== null;
  return (
    <View style={s.row}>
      <TouchableOpacity style={s.rowMain} onPress={onToggle} activeOpacity={0.8}>
        <View style={s.rowIcon}>
          <Ionicons name="storefront-outline" size={16} color={BRAND_BLUE} />
        </View>
        <View style={s.rowBody}>
          <Text style={s.rowName} numberOfLines={1}>
            {buyerLabel(buyer)}
          </Text>
          <Text style={s.rowMeta} numberOfLines={1}>
            {buyer.phone}
            {buyer.district ? ` · ${buyer.district}` : ""}
          </Text>
          <Text style={s.rowAddress} numberOfLines={1}>
            {buyer.address?.trim() || "No address on file"}
          </Text>
          <View style={[s.pinPill, pinned ? s.pinPillOn : s.pinPillOff]}>
            <Ionicons
              name={pinned ? "location" : "location-outline"}
              size={10}
              color={pinned ? "#047857" : colors.gray500}
            />
            <Text style={[s.pinPillText, pinned ? s.pinPillTextOn : s.pinPillTextOff]}>
              {pinned ? "Pinned" : "No pin"}
            </Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.gray300}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={s.actions}>
          <TouchableOpacity style={s.actionSecondary} onPress={onPin} activeOpacity={0.85}>
            <Ionicons name="location-outline" size={15} color={BRAND_BLUE} />
            <Text style={s.actionSecondaryText}>{pinned ? "Update pin" : "Pin location"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionPrimary} onPress={onOrder} activeOpacity={0.85}>
            <Ionicons name="cart-outline" size={15} color={colors.white} />
            <Text style={s.actionPrimaryText}>Start an order</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND_BLUE },
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
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 16, color: colors.ink, fontFamily: typography.heading },
  newShopBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  newShopText: { fontSize: 13, color: BRAND_BLUE, fontFamily: typography.bodySemiBold },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.gray50,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink, fontFamily: typography.body, padding: 0 },

  searchingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  emptyBox: { gap: spacing.sm, paddingVertical: spacing.sm },
  mutedText: { fontSize: 13, color: colors.gray400, fontFamily: typography.body },
  loadMore: {
    marginTop: spacing.sm,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: BRAND_BLUE,
    alignItems: "center",
  },
  loadMoreText: { fontSize: 14, color: BRAND_BLUE, fontFamily: typography.bodySemiBold },
  registerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.gray300,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
  },
  registerBtnText: { flexShrink: 1, fontSize: 14, color: BRAND_BLUE, fontFamily: typography.bodySemiBold },

  row: { borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  rowMain: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: 12 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.blueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, minWidth: 0, gap: 1 },
  rowName: { fontSize: 15, color: colors.ink, fontFamily: typography.bodySemiBold },
  rowMeta: { fontSize: 12, color: colors.gray400, fontFamily: typography.body },
  rowAddress: { fontSize: 12, color: colors.gray500, fontFamily: typography.body },
  pinPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 3,
  },
  pinPillOn: { backgroundColor: colors.greenLight },
  pinPillOff: { backgroundColor: colors.gray100 },
  pinPillText: { fontSize: 10, fontFamily: typography.bodySemiBold, letterSpacing: 0.3 },
  pinPillTextOn: { color: "#047857" },
  pinPillTextOff: { color: colors.gray500 },

  actions: { flexDirection: "row", gap: spacing.sm, paddingBottom: 12 },
  actionSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1.5,
    borderColor: BRAND_BLUE,
    backgroundColor: colors.blueLight,
    borderRadius: radius.md,
    paddingVertical: 10,
  },
  actionSecondaryText: { fontSize: 13, color: BRAND_BLUE, fontFamily: typography.bodySemiBold },
  actionPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: BRAND_BLUE,
    borderRadius: radius.md,
    paddingVertical: 10,
  },
  actionPrimaryText: { fontSize: 13, color: colors.white, fontFamily: typography.bodySemiBold },

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
});
