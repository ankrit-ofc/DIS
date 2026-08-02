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
import { SalesBuyer, buyerLabel } from "../../lib/sales";
import { useSalesBuyerStore } from "../../store/salesBuyerStore";
import { useBuyerSearch } from "../../hooks/useBuyerSearch";
import { colors, spacing, radius, typography, shadow } from "../../lib/theme";
import { SalesStackParamList } from "../../navigation/SalesStack";

const BRAND_BLUE = "#1A4BDB";

type Props = { navigation: StackNavigationProp<SalesStackParamList, "SelectBuyer"> };

/**
 * Entry step for the order-on-behalf flow: which shop is the rep standing in?
 *
 * A dedicated screen rather than a sheet — it has to hold a search field, the
 * rep's recent shops, and a way out to shop registration, and it is where the
 * flow starts rather than something layered over it.
 */
export function SelectBuyerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const setBuyer = useSalesBuyerStore((s) => s.setBuyer);
  const {
    search, setSearch, query, searchNow,
    results, total, hasMore, loadMore, loading, loadingMore,
    recent, error, filtering,
  } = useBuyerSearch();

  const pick = (buyer: SalesBuyer) => {
    // Switching shops discards the previous shop's cart — see salesBuyerStore.
    setBuyer(buyer);
    navigation.navigate("SalesCatalogue");
  };

  const registerNew = () => {
    // `selectOnCreate` makes NewBuyerScreen continue straight into the
    // catalogue for the shop it just created instead of returning home.
    navigation.navigate("NewBuyer", {
      selectOnCreate: true,
      initialName: search.trim() || undefined,
    });
  };

  return (
    <SafeAreaView style={s.safe} edges={SCREEN_EDGES}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Which shop?</Text>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>Find the shop</Text>
            <TouchableOpacity onPress={registerNew} hitSlop={6} style={s.newShopBtn}>
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
        </View>

        {/* Recent shops stay pinned above the full list — a rep's usual stops
            should be one tap away without scrolling or typing. Hidden while
            filtering, where the results are the answer. */}
        {!filtering && recent.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>Recent shops</Text>
            <View style={s.chipWrap}>
              {recent.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={s.chip}
                  onPress={() => pick(b)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="storefront-outline" size={13} color={colors.gray400} />
                  <Text style={s.chipText} numberOfLines={1}>
                    {buyerLabel(b)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* The full list. This screen must never render as blank: it is either
            loading, showing shops, or explaining that there are none. */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>
            {filtering ? `Results for “${query.trim()}”` : "All shops"}
            {!loading && results.length > 0 ? `  ·  ${total}` : ""}
          </Text>

          {loading ? (
            <View style={s.searchingRow}>
              <ActivityIndicator size="small" color={BRAND_BLUE} />
              <Text style={s.mutedText}>{filtering ? "Searching…" : "Loading shops…"}</Text>
            </View>
          ) : results.length === 0 ? (
            <View style={s.emptyResults}>
              <Text style={s.mutedText}>
                {filtering
                  ? `No shop found for “${query.trim()}”.`
                  : "No shops registered yet."}
              </Text>
              <TouchableOpacity style={s.registerBtn} onPress={registerNew} activeOpacity={0.85}>
                <Ionicons name="add-circle-outline" size={16} color={BRAND_BLUE} />
                <Text style={s.registerBtnText} numberOfLines={1}>
                  {filtering
                    ? `Register “${query.trim()}” as a new shop`
                    : "Register a new shop"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {results.map((b) => (
                <BuyerRow key={b.id} buyer={b} onPress={() => pick(b)} />
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
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BuyerRow({ buyer, onPress }: { buyer: SalesBuyer; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.8}>
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
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.gray300} />
    </TouchableOpacity>
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
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    fontFamily: typography.body,
    padding: 0,
  },

  searchingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  loadMore: {
    marginTop: spacing.sm,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: BRAND_BLUE,
    alignItems: "center",
  },
  loadMoreText: { fontSize: 14, color: BRAND_BLUE, fontFamily: typography.bodySemiBold },
  emptyResults: { gap: spacing.sm, paddingVertical: spacing.sm },
  mutedText: { fontSize: 13, color: colors.gray400, fontFamily: typography.body },
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

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.blueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, color: colors.ink, fontFamily: typography.bodySemiBold },
  rowMeta: { fontSize: 12, color: colors.gray400, fontFamily: typography.body, marginTop: 1 },

  sectionLabel: {
    fontSize: 11,
    color: colors.gray400,
    fontFamily: typography.bodySemiBold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "100%",
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  chipText: { flexShrink: 1, fontSize: 13, color: colors.ink, fontFamily: typography.bodyMedium },

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
