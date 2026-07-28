import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ScrollView, RefreshControl, Image, Dimensions,
} from "react-native";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { colors, spacing, radius, shadow, typography } from "../../lib/theme";
import { type SellUnit, type StockStatus } from "../../lib/format";
import { ProductCard } from "../../components/ProductCard";

const { width: W } = Dimensions.get("window");
const CARD_W = (W - spacing.lg * 2 - spacing.sm) / 2;
const IMG_H  = Math.round(CARD_W * 0.9);

interface Product {
  id: string; name: string; sellUnit: SellUnit; price: number; mrp?: number | null;
  unit: string; moq: number; imageUrl?: string; brand?: string;
  piecesPerCarton?: number | null; pricePerCarton?: number | null;
  stockStatus: StockStatus; maxOrderQty: number;
}
interface Category { id: string; name: string; }

function CardSkeleton() {
  return (
    <View style={[{ width: CARD_W, backgroundColor: colors.white, borderRadius: radius.xl, overflow: "hidden" }, shadow.card]}>
      <View style={{ height: IMG_H, backgroundColor: colors.gray100 }} />
      <View style={{ padding: 10, gap: 6 }}>
        {[40, 90, 70, 50, 30].map((w, i) => (
          <View key={i} style={{ height: i === 2 ? 12 : 8, width: `${w}%`, backgroundColor: colors.gray100, borderRadius: 4 }} />
        ))}
      </View>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function CatalogueScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const [search, setSearch]               = useState("");
  const [debouncedSearch, setDebounced]   = useState("");
  const [selectedCat, setSelectedCat]     = useState<string | undefined>(route?.params?.categoryId);
  const [categories, setCategories]       = useState<Category[]>([]);
  const [products, setProducts]           = useState<Product[]>([]);
  const [page, setPage]                   = useState(1);
  const [hasMore, setHasMore]             = useState(true);
  const [loading, setLoading]             = useState(true);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(search), 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [search]);

  // Home's category tiles navigate here with params — but the tab stays
  // mounted, so the initial useState value goes stale. Sync on every navigate
  // (params object identity changes each time, even for the same category).
  useEffect(() => {
    if (route?.params?.categoryId !== undefined) {
      setSelectedCat(route.params.categoryId || undefined);
    }
  }, [route?.params]);

  useEffect(() => {
    api.get("/categories").then(r => setCategories(r.data.categories ?? r.data ?? [])).catch(() => {});
  }, []);

  const loadProducts = useCallback(async (p = 1, q = "", catId?: string) => {
    p === 1 ? setLoading(true) : setLoadingMore(true);
    try {
      const params: Record<string, any> = { page: p, limit: 20 };
      if (q) params.search = q;
      if (catId) params.categoryId = catId;
      const res = await api.get("/products", { params });
      const list: Product[] = res.data.products ?? res.data ?? [];
      setProducts(prev => p === 1 ? list : [...prev, ...list]);
      setHasMore(list.length === 20);
    } finally {
      setLoading(false); setLoadingMore(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { setPage(1); loadProducts(1, debouncedSearch, selectedCat); }, [debouncedSearch, selectedCat]);

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    const next = page + 1; setPage(next); loadProducts(next, debouncedSearch, selectedCat);
  };

  return (
    <View style={s.root}>
      {/* Sticky header */}
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={17} color={colors.gray400} />
          <TextInput
            style={s.searchInput} value={search} onChangeText={setSearch}
            placeholder="Search products…" placeholderTextColor={colors.gray300}
            clearButtonMode="while-editing"
            returnKeyType="search"
            onSubmitEditing={() => {
              // Keyboard search key = run the full search now, skip the debounce.
              if (timer.current) clearTimeout(timer.current);
              setDebounced(search);
            }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={17} color={colors.gray300} />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {[{ id: undefined as any, name: "All" }, ...categories].map(cat => (
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

      {/* Grid */}
      {loading ? (
        <View style={s.skeletonGrid}>{[1, 2, 3, 4].map(k => <CardSkeleton key={k} />)}</View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={p => p.id}
          numColumns={2}
          columnWrapperStyle={s.row}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} tintColor={colors.blue} colors={[colors.blue]}
              onRefresh={() => { setRefreshing(true); setPage(1); loadProducts(1, debouncedSearch, selectedCat); }} />
          }
          renderItem={({ item }) => (
            <ProductCard
              item={item}
              onPress={() => navigation.navigate("Product", { productId: item.id })}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="search-outline" size={40} color={colors.gray200} />
              <Text style={s.emptyText}>
                {debouncedSearch
                  ? `No products matching “${debouncedSearch}”`
                  : selectedCat
                    ? `No products in ${categories.find(c => c.id === selectedCat)?.name ?? "this category"}`
                    : "No products found"}
              </Text>
              {(debouncedSearch || selectedCat) && (
                <TouchableOpacity
                  style={s.clearBtn}
                  onPress={() => { setSearch(""); setDebounced(""); setSelectedCat(undefined); }}
                >
                  <Text style={s.clearBtnText}>Clear filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListFooterComponent={
            hasMore && products.length > 0 ? (
              <TouchableOpacity style={[s.loadMore, loadingMore && { opacity: 0.5 }]} onPress={handleLoadMore} disabled={loadingMore}>
                <Text style={s.loadMoreText}>{loadingMore ? "Loading…" : "Load more"}</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.offWhite },
  header:        { backgroundColor: colors.white, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  searchBar:     { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.offWhite, borderRadius: radius.xl, paddingVertical: 11, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  searchInput:   { flex: 1, fontSize: 14, color: colors.ink, fontFamily: typography.body, padding: 0 },
  chips:         { gap: spacing.sm, paddingBottom: spacing.xs },
  chip:          { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 7, borderWidth: 1, borderColor: colors.gray200, backgroundColor: colors.white },
  chipActive:    { backgroundColor: colors.blueLight, borderColor: colors.blue },
  chipText:      { fontSize: 13, fontFamily: typography.bodyMedium, color: colors.ink },
  chipTextActive:{ fontSize: 13, fontFamily: typography.bodySemiBold, color: colors.blue },
  skeletonGrid:  { flexDirection: "row", flexWrap: "wrap", padding: spacing.lg, gap: spacing.sm },
  listContent:   { padding: spacing.lg, paddingBottom: 120 },
  row:           { gap: spacing.sm, marginBottom: spacing.sm },
  empty:         { alignItems: "center", paddingVertical: 80, gap: spacing.md, paddingHorizontal: spacing.lg },
  emptyText:     { fontSize: 15, color: colors.gray400, fontFamily: typography.body, textAlign: "center" },
  clearBtn:      { borderWidth: 1.5, borderColor: colors.blue, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: 10, backgroundColor: colors.blueLight },
  clearBtnText:  { fontSize: 14, fontFamily: typography.bodySemiBold, color: colors.blue },
  loadMore:      { marginHorizontal: spacing.lg, marginVertical: spacing.lg, paddingVertical: 14, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.blue, alignItems: "center" },
  loadMoreText:  { fontSize: 14, fontFamily: typography.bodySemiBold, color: colors.blue },
});
