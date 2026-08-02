import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { SCREEN_EDGES } from "../../lib/screen";
import { Ionicons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { api } from "../../lib/api";
import { colors, spacing, radius, shadow, typography } from "../../lib/theme";
import { fmtRs } from "../../lib/format";
import { ProductCard, PRODUCT_CARD_W, type CardProduct } from "../../components/ProductCard";
import { SalesBuyerBanner } from "../../components/SalesBuyerBanner";
import { useCartStore } from "../../store/cartStore";
import { useSalesBuyerStore } from "../../store/salesBuyerStore";
import { SalesStackParamList } from "../../navigation/SalesStack";

const BRAND_BLUE = "#1A4BDB";

type Product = CardProduct;

interface Category {
  id: string;
  name: string;
}

type Props = { navigation: StackNavigationProp<SalesStackParamList, "SalesCatalogue"> };

/**
 * The rep's catalogue. Same fetch, grid and ProductCard as the buyer
 * catalogue — the stepper writes to the same cartStore, so "the rep's cart" is
 * simply the selected shop's order. The differences are the pinned shop banner
 * and that the order bar goes to the on-behalf checkout.
 */
export function SalesCatalogueScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const buyer = useSalesBuyerStore((s) => s.buyer);
  const clearBuyer = useSalesBuyerStore((s) => s.clearBuyer);
  const { items, totalAmount } = useCartStore();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebounced] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | undefined>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Losing the selection (banner discard, or a logout elsewhere) unwinds the
  // whole order flow — a reset rather than a replace, so the abandoned order
  // screens aren't left behind us to be reached with the back gesture.
  useEffect(() => {
    if (buyer) return;
    navigation.reset({ index: 1, routes: [{ name: "SalesHome" }, { name: "SelectBuyer" }] });
  }, [buyer, navigation]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(search), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [search]);

  useEffect(() => {
    api
      .get("/categories")
      .then((r) => setCategories(r.data.categories ?? r.data ?? []))
      .catch(() => {});
  }, []);

  const loadProducts = useCallback(async (p = 1, q = "", catId?: string) => {
    p === 1 ? setLoading(true) : setLoadingMore(true);
    try {
      const params: Record<string, any> = { page: p, limit: 20 };
      if (q) params.search = q;
      if (catId) params.categoryId = catId;
      const res = await api.get("/products", { params });
      const list: Product[] = res.data.products ?? res.data ?? [];
      setProducts((prev) => (p === 1 ? list : [...prev, ...list]));
      setHasMore(list.length === 20);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    loadProducts(1, debouncedSearch, selectedCat);
  }, [debouncedSearch, selectedCat, loadProducts]);

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    const next = page + 1;
    setPage(next);
    loadProducts(next, debouncedSearch, selectedCat);
  };

  if (!buyer) return null;

  return (
    <SafeAreaView style={s.safe} edges={SCREEN_EDGES}>
      {/* Dropping the buyer is what navigates — see the effect above. */}
      <SalesBuyerBanner buyer={buyer} onDiscard={clearBuyer} />

      <View style={s.header}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.ink} />
          </TouchableOpacity>
          <View style={s.searchBar}>
            <Ionicons name="search-outline" size={17} color={colors.gray400} />
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search products…"
              placeholderTextColor={colors.gray300}
              clearButtonMode="while-editing"
              returnKeyType="search"
              onSubmitEditing={() => {
                if (timer.current) clearTimeout(timer.current);
                setDebounced(search);
              }}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={17} color={colors.gray300} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {[{ id: undefined as any, name: "All" }, ...categories].map((cat) => (
            <TouchableOpacity
              key={cat.id ?? "all"}
              style={[s.chip, selectedCat === cat.id && s.chipActive]}
              onPress={() => setSelectedCat(cat.id)}
            >
              <Text style={[s.chipText, selectedCat === cat.id && s.chipTextActive]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.skeletonGrid}>
          {[1, 2, 3, 4].map((k) => (
            <CardSkeleton key={k} />
          ))}
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={s.row}
          contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + spacing.xxl * 2 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={BRAND_BLUE}
              colors={[BRAND_BLUE]}
              onRefresh={() => {
                setRefreshing(true);
                setPage(1);
                loadProducts(1, debouncedSearch, selectedCat);
              }}
            />
          }
          renderItem={({ item }) => (
            <ProductCard
              item={item}
              onPress={() => navigation.navigate("SalesProduct", { productId: item.id })}
              // Rep-facing: a rep pitches on the shopkeeper's margin at the
              // counter, so MRP and margin stay here. The buyer catalogue uses
              // the same component with the default (off).
              showEconomics
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="search-outline" size={40} color={colors.gray200} />
              <Text style={s.emptyText}>
                {debouncedSearch
                  ? `No products matching “${debouncedSearch}”`
                  : selectedCat
                    ? `No products in ${categories.find((c) => c.id === selectedCat)?.name ?? "this category"}`
                    : "No products found"}
              </Text>
              {(debouncedSearch || selectedCat) && (
                <TouchableOpacity
                  style={s.clearBtn}
                  onPress={() => {
                    setSearch("");
                    setDebounced("");
                    setSelectedCat(undefined);
                  }}
                >
                  <Text style={s.clearBtnText}>Clear filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListFooterComponent={
            hasMore && products.length > 0 ? (
              <TouchableOpacity
                style={[s.loadMore, loadingMore && { opacity: 0.5 }]}
                onPress={handleLoadMore}
                disabled={loadingMore}
              >
                <Text style={s.loadMoreText}>{loadingMore ? "Loading…" : "Load more"}</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {items.length > 0 && (
        <View style={[s.orderBarWrap, { paddingBottom: spacing.lg + insets.bottom }]}>
          <TouchableOpacity
            style={s.orderBar}
            onPress={() => navigation.navigate("SalesCheckout")}
            activeOpacity={0.88}
          >
            <View style={s.orderBarLeft}>
              <Ionicons name="cart-outline" size={17} color={colors.white} />
              <Text style={s.orderBarCount}>
                {items.length} {items.length === 1 ? "product" : "products"}
              </Text>
            </View>
            <Text style={s.orderBarTotal}>{fmtRs(totalAmount())} →</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function CardSkeleton() {
  return (
    <View style={[s.skeletonCard, shadow.card]}>
      <View style={s.skeletonImg} />
      <View style={{ padding: 10, gap: 6 }}>
        {[40, 90, 70, 50, 30].map((w, i) => (
          <View
            key={i}
            style={{
              height: i === 2 ? 12 : 8,
              width: `${w}%`,
              backgroundColor: colors.gray100,
              borderRadius: 4,
            }}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.offWhite },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  backBtn: { padding: 2 },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.offWhite,
    borderRadius: radius.xl,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink, fontFamily: typography.body, padding: 0 },
  chips: { gap: spacing.sm, paddingBottom: spacing.xs },
  chip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.blueLight, borderColor: BRAND_BLUE },
  chipText: { fontSize: 13, fontFamily: typography.bodyMedium, color: colors.ink },
  chipTextActive: { fontSize: 13, fontFamily: typography.bodySemiBold, color: BRAND_BLUE },

  skeletonGrid: { flexDirection: "row", flexWrap: "wrap", padding: spacing.lg, gap: spacing.sm },
  skeletonCard: {
    width: PRODUCT_CARD_W,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    overflow: "hidden",
  },
  skeletonImg: { height: Math.round(PRODUCT_CARD_W * 0.9), backgroundColor: colors.gray100 },

  listContent: { padding: spacing.lg, paddingBottom: 140 },
  row: { gap: spacing.sm, marginBottom: spacing.sm },
  empty: { alignItems: "center", paddingVertical: 80, gap: spacing.md, paddingHorizontal: spacing.lg },
  emptyText: { fontSize: 15, color: colors.gray400, fontFamily: typography.body, textAlign: "center" },
  clearBtn: {
    borderWidth: 1.5,
    borderColor: BRAND_BLUE,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    backgroundColor: colors.blueLight,
  },
  clearBtnText: { fontSize: 14, fontFamily: typography.bodySemiBold, color: BRAND_BLUE },
  loadMore: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: BRAND_BLUE,
    alignItems: "center",
  },
  loadMoreText: { fontSize: 14, fontFamily: typography.bodySemiBold, color: BRAND_BLUE },

  orderBarWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  orderBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BRAND_BLUE,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    ...shadow.card,
  },
  orderBarLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  orderBarCount: { fontSize: 14, color: colors.white, fontFamily: typography.bodyMedium },
  orderBarTotal: { fontSize: 16, color: colors.white, fontFamily: typography.heading },
});
