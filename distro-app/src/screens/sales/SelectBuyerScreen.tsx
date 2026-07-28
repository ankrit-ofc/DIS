import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { api } from "../../lib/api";
import { SalesBuyer, buyerLabel } from "../../lib/sales";
import { useSalesBuyerStore } from "../../store/salesBuyerStore";
import { colors, spacing, radius, typography, shadow } from "../../lib/theme";
import { SalesStackParamList } from "../../navigation/SalesStack";

const BRAND_BLUE = "#1A4BDB";

// Matches the API: GET /sales/buyers ignores anything shorter.
const MIN_SEARCH = 2;

type Props = { navigation: StackNavigationProp<SalesStackParamList, "SelectBuyer"> };

/**
 * Entry step for the order-on-behalf flow: which shop is the rep standing in?
 *
 * A dedicated screen rather than a sheet — it has to hold a search field, the
 * rep's recent shops, and a way out to shop registration, and it is where the
 * flow starts rather than something layered over it.
 */
export function SelectBuyerScreen({ navigation }: Props) {
  const setBuyer = useSalesBuyerStore((s) => s.setBuyer);

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SalesBuyer[]>([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<SalesBuyer[]>([]);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setQuery(search), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [search]);

  // Refetched on focus: coming back from a fresh registration (or a placed
  // order) should show the shop that was just visited.
  useFocusEffect(
    useCallback(() => {
      api
        .get("/sales/recent-buyers")
        .then((r) => setRecent(r.data?.buyers ?? []))
        .catch(() => {
          // Non-fatal — search still works.
        });
    }, []),
  );

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_SEARCH) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setError("");
    api
      .get("/sales/buyers", { params: { search: q } })
      .then((r) => {
        if (!cancelled) setResults(r.data?.buyers ?? []);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message ?? "Could not search shops.");
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

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

  const searched = query.trim().length >= MIN_SEARCH;

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Which shop?</Text>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
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
              placeholder="Shop name or phone…"
              placeholderTextColor={colors.gray300}
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => {
                if (timer.current) clearTimeout(timer.current);
                setQuery(search);
              }}
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

          {searched && (
            <View style={s.results}>
              {searching && results.length === 0 ? (
                <View style={s.searchingRow}>
                  <ActivityIndicator size="small" color={BRAND_BLUE} />
                  <Text style={s.mutedText}>Searching…</Text>
                </View>
              ) : results.length === 0 ? (
                <View style={s.emptyResults}>
                  <Text style={s.mutedText}>No shop found for “{query.trim()}”.</Text>
                  <TouchableOpacity style={s.registerBtn} onPress={registerNew} activeOpacity={0.85}>
                    <Ionicons name="add-circle-outline" size={16} color={BRAND_BLUE} />
                    <Text style={s.registerBtnText} numberOfLines={1}>
                      Register “{query.trim()}” as a new shop
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                results.map((b) => <BuyerRow key={b.id} buyer={b} onPress={() => pick(b)} />)
              )}
            </View>
          )}
        </View>

        {recent.length > 0 && (
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

  results: { marginTop: spacing.xs },
  searchingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
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
