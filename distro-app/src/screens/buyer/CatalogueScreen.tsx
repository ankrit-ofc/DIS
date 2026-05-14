import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ScrollView, RefreshControl, Image, Dimensions,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useCartStore } from "../../store/cartStore";
import { colors, spacing, radius, shadow, typography } from "../../lib/theme";
import { fmtCarton } from "../../lib/format";
import { resolveImageUrl } from "../../lib/imageUrl";

const { width: W } = Dimensions.get("window");
const CARD_W = (W - spacing.lg * 2 - spacing.sm) / 2;
const IMG_H  = Math.round(CARD_W * 0.9);

interface Product {
  id: string; name: string; price: number; mrp?: number;
  unit: string; stockQty: number; moq?: number; imageUrl?: string; brand?: string;
  piecesPerCarton?: number; pricePerCarton?: number;
}
interface Category { id: string; name: string; }

// ─── Product card (identical to HomeScreen) ───────────────────────────────────
function ProductCard({ item, onPress, onAdd }: { item: Product; onPress: () => void; onAdd: () => void }) {
  const outOfStock = item.stockQty <= 0;
  const discount = item.mrp && item.mrp > item.price
    ? Math.round(((item.mrp - item.price) / item.mrp) * 100) : 0;
  return (
    <TouchableOpacity style={[pc.card, shadow.card]} onPress={onPress} activeOpacity={0.88}>
      <View style={pc.imgWrap}>
        {item.imageUrl
          ? <ExpoImage source={{ uri: resolveImageUrl(item.imageUrl) ?? "" }} style={pc.img} contentFit="cover" cachePolicy="memory-disk" transition={200} placeholder={colors.gray100} />
          : <View style={pc.imgPlaceholder} />}
        {discount > 0 && !outOfStock && <View style={pc.badge}><Text style={pc.badgeText}>{discount}%</Text></View>}
        {outOfStock && <View style={pc.oos}><Text style={pc.oosText}>Out of stock</Text></View>}
      </View>
      <View style={pc.body}>
        {item.brand && <Text style={pc.brand} numberOfLines={1}>{item.brand}</Text>}
        <Text style={pc.name} numberOfLines={2}>{item.name}</Text>
        {(() => {
          const pieces = item.piecesPerCarton ?? item.moq ?? 1;
          const cartonPrice = item.pricePerCarton ?? item.price * pieces;
          return <Text style={pc.price}>{fmtCarton(cartonPrice, pieces, item.unit)}</Text>;
        })()}
        {!outOfStock && (
          <TouchableOpacity style={pc.addBtn} onPress={onAdd} activeOpacity={0.8} hitSlop={8}>
            <Ionicons name="add" size={18} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}
const pc = StyleSheet.create({
  card:           { width: CARD_W, backgroundColor: colors.white, borderRadius: radius.xl, overflow: "hidden" },
  imgWrap:        { width: "100%", height: IMG_H },
  img:            { width: "100%", height: "100%" },
  imgPlaceholder: { width: "100%", height: "100%", backgroundColor: colors.gray100 },
  badge:          { position: "absolute", top: 8, left: 8, backgroundColor: colors.green, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText:      { fontSize: 10, fontFamily: typography.bodySemiBold, color: colors.white },
  oos:            { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  oosText:        { fontSize: 11, fontFamily: typography.bodySemiBold, color: colors.white },
  body:           { padding: 10, paddingBottom: 42, gap: 2 },
  brand:          { fontSize: 10, fontFamily: typography.bodySemiBold, color: colors.blue, letterSpacing: 0.3, textTransform: "uppercase" },
  name:           { fontSize: 13, fontFamily: typography.bodySemiBold, color: colors.ink, lineHeight: 17, minHeight: 34 },
  price:          { fontSize: 15, fontFamily: typography.heading, color: "#2563EB", marginTop: 2, fontWeight: "700" },
  cartonMeta:     { fontSize: 10, fontFamily: typography.body, color: "#9BA3BF" },
  meta:           { fontSize: 11, fontFamily: typography.body, color: colors.gray400 },
  addBtn:         { position: "absolute", bottom: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
});

function CardSkeleton() {
  return (
    <View style={[pc.card, shadow.card]}>
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
  const { addItem } = useCartStore();

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(search), 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [search]);

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
              onAdd={() => {
                const pieces = item.piecesPerCarton ?? item.moq ?? 1;
                const cartonPrice = item.pricePerCarton ?? item.price * pieces;
                addItem({
                  productId: item.id,
                  name: item.name,
                  price: item.price,
                  unit: item.unit,
                  piecesPerCarton: pieces,
                  pricePerCarton: cartonPrice,
                  image: item.imageUrl ?? undefined,
                });
              }}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="search-outline" size={40} color={colors.gray200} />
              <Text style={s.emptyText}>No products found</Text>
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
  chipActive:    { backgroundColor: colors.blue, borderColor: colors.blue },
  chipText:      { fontSize: 13, fontFamily: typography.bodyMedium, color: colors.ink },
  chipTextActive:{ fontSize: 13, fontFamily: typography.bodyMedium, color: colors.white },
  skeletonGrid:  { flexDirection: "row", flexWrap: "wrap", padding: spacing.lg, gap: spacing.sm },
  listContent:   { padding: spacing.lg, paddingBottom: 120 },
  row:           { gap: spacing.sm, marginBottom: spacing.sm },
  empty:         { alignItems: "center", paddingVertical: 80, gap: spacing.md },
  emptyText:     { fontSize: 15, color: colors.gray400, fontFamily: typography.body },
  loadMore:      { marginHorizontal: spacing.lg, marginVertical: spacing.lg, paddingVertical: 14, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.blue, alignItems: "center" },
  loadMoreText:  { fontSize: 14, fontFamily: typography.bodySemiBold, color: colors.blue },
});
