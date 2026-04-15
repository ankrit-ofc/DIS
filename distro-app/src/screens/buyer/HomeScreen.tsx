import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Dimensions, FlatList,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import { useCartStore } from "../../store/cartStore";
import { api } from "../../lib/api";
import { colors, spacing, radius, shadow, typography } from "../../lib/theme";
import { fmtRs, fmtUnitPrice, sessionInitial } from "../../lib/format";
import { SkeletonLoader, SkeletonProductCard, SkeletonCategoryChip } from "../../components/SkeletonLoader";

const { width: W } = Dimensions.get("window");
const CARD_W = (W - spacing.lg * 2 - spacing.sm) / 2;

interface Announcement { id: string; text: string; }
interface Category { id: string; name: string; emoji?: string; }
interface Product {
  id: string; name: string; price: number; mrp?: number;
  unit: string; stockQty: number; moq?: number; imageUrl?: string; brand?: string;
}

// ─── Announcement ticker ──────────────────────────────────────────────────────
function AnnouncementTicker({ items, loading }: { items: Announcement[]; loading: boolean }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % items.length), 3500);
    return () => clearInterval(t);
  }, [items.length]);

  if (loading) {
    return (
      <View style={tk.wrap}>
        <SkeletonLoader height={40} borderRadius={8} />
      </View>
    );
  }

  if (!items.length) return null;

  return (
    <View style={tk.wrap}>
      <View style={tk.ticker}>
        <View style={tk.dot} />
        <Text style={tk.text} numberOfLines={1}>{items[idx].text}</Text>
      </View>
    </View>
  );
}

const tk = StyleSheet.create({
  wrap: { marginHorizontal: spacing.md, marginBottom: spacing.sm },
  ticker: {
    backgroundColor: colors.blueLight,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.blue,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontFamily: typography.bodyMedium,
    color: colors.ink,
  },
});

// ─── Product card ──────────────────────────────────────────────────────────────
function ProductCard({ item, onPress, onAdd }: { item: Product; onPress: () => void; onAdd: () => void }) {
  const outOfStock = item.stockQty <= 0;
  const discount = item.mrp && item.mrp > item.price
    ? Math.round(((item.mrp - item.price) / item.mrp) * 100) : 0;

  return (
    <TouchableOpacity style={[pc.card, shadow.card]} onPress={onPress} activeOpacity={0.88}>
      {/* Image area */}
      <View style={pc.imgWrap}>
        <View style={pc.imgPlaceholder}>
          <Ionicons name="cube-outline" size={28} color={colors.blue} style={{ opacity: 0.4 }} />
        </View>
        {discount > 0 && !outOfStock && (
          <View style={pc.badge}>
            <Text style={pc.badgeText}>{discount}%</Text>
          </View>
        )}
        {outOfStock && (
          <View style={pc.oosBanner}>
            <Text style={pc.oosText}>Out of stock</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={pc.body}>
        {item.brand && <Text style={pc.brand} numberOfLines={1}>{item.brand}</Text>}
        <Text style={pc.name} numberOfLines={2}>{item.name}</Text>
        <Text style={pc.price}>{fmtUnitPrice(item.price, item.unit)}</Text>
        {item.moq && item.moq > 1 && (
          <Text style={pc.moq}>{fmtRs(item.price * item.moq)} / carton ({item.moq} pcs)</Text>
        )}
      </View>

      {/* Add button */}
      {!outOfStock && (
        <TouchableOpacity style={pc.addBtn} onPress={onAdd} activeOpacity={0.8} hitSlop={8}>
          <Text style={pc.addBtnText}>Add</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const pc = StyleSheet.create({
  card: {
    width: CARD_W,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  imgWrap: {
    width: "100%",
    height: 56,
    position: "relative",
  },
  imgPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.blueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: colors.green,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontFamily: typography.bodySemiBold, color: colors.white },
  oosBanner: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  oosText: { fontSize: 10, fontFamily: typography.bodySemiBold, color: colors.white },
  body: { padding: 10, gap: 2 },
  brand: {
    fontSize: 10,
    fontFamily: typography.bodySemiBold,
    color: colors.gray400,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  name: {
    fontSize: 12,
    fontFamily: typography.bodySemiBold,
    color: colors.ink,
    lineHeight: 16,
    minHeight: 32,
  },
  price: { fontSize: 14, fontFamily: typography.heading, color: colors.blue, marginTop: 2 },
  moq: { fontSize: 10, fontFamily: typography.body, color: colors.gray400 },
  addBtn: {
    backgroundColor: colors.blue,
    paddingVertical: 8,
    alignItems: "center",
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  addBtnText: {
    color: colors.white,
    fontSize: 12,
    fontFamily: typography.bodySemiBold,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export function HomeScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const { addItem } = useCartStore();
  const insets = useSafeAreaInsets();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [annRes, catRes, prodRes] = await Promise.allSettled([
        api.get("/announcements"),
        api.get("/categories"),
        api.get("/products", { params: { sort: "newest", limit: 12 } }),
      ]);
      if (annRes.status === "fulfilled")
        setAnnouncements(annRes.value.data.announcements ?? annRes.value.data ?? []);
      if (catRes.status === "fulfilled")
        setCategories(catRes.value.data.categories ?? catRes.value.data ?? []);
      if (prodRes.status === "fulfilled")
        setFeatured(prodRes.value.data.products ?? prodRes.value.data ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const storeName = profile?.storeName ?? profile?.ownerName ?? profile?.name ?? "Your Store";
  const initial = sessionInitial(profile);
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  const goCatalogue = (params?: object) =>
    navigation.navigate("Catalogue", { screen: "CatalogueList", params });

  return (
    <ScrollView
      style={s.bg}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          tintColor={colors.white}
          colors={[colors.white]}
        />
      }
    >
      {/* Blue header */}
      <View style={[s.header, { paddingTop: insets.top + spacing.md }]}>
        {/* Top row */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.greeting}>{greeting},</Text>
            <Text style={s.storeName} numberOfLines={1}>{storeName}</Text>
          </View>
          <View style={s.headerActions}>
            <TouchableOpacity
              style={s.sessionAvatar}
              onPress={() => navigation.navigate("Account")}
              activeOpacity={0.85}
              accessibilityLabel="Account"
            >
              <Text style={s.sessionAvatarText}>{initial}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.bellBtn} activeOpacity={0.8} hitSlop={8}>
              <Ionicons name="notifications-outline" size={22} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        <TouchableOpacity
          style={s.search}
          onPress={() => goCatalogue()}
          activeOpacity={0.92}
        >
          <Ionicons name="search-outline" size={16} color={colors.gray400} />
          <Text style={s.searchText}>Search products...</Text>
        </TouchableOpacity>
      </View>

      {/* Announcement ticker */}
      <AnnouncementTicker items={announcements} loading={loading} />

      {/* Categories */}
      <View style={s.sectionHeaderRow}>
        <Text style={s.sectionTitle}>Categories</Text>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.hListContent}
        data={loading ? ([1, 2, 3, 4] as any[]) : categories}
        keyExtractor={(item, i) => loading ? String(i) : item.id}
        renderItem={({ item }) =>
          loading ? (
            <SkeletonCategoryChip />
          ) : (
            <TouchableOpacity
              style={s.categoryChip}
              activeOpacity={0.8}
              onPress={() => goCatalogue({ categoryId: item.id, categoryName: item.name })}
            >
              {item.emoji && <Text style={s.categoryEmoji}>{item.emoji}</Text>}
              <Text style={s.categoryName}>{item.name}</Text>
            </TouchableOpacity>
          )
        }
      />

      {/* Featured products */}
      <View style={s.sectionHeaderRow}>
        <Text style={s.sectionTitle}>Featured</Text>
        <TouchableOpacity onPress={() => goCatalogue()} hitSlop={8}>
          <Text style={s.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      <View style={s.grid}>
        {loading
          ? [1, 2, 3, 4].map(k => <SkeletonProductCard key={k} />)
          : featured.map(item => (
            <ProductCard
              key={item.id}
              item={item}
              onPress={() =>
                navigation.navigate("Catalogue", {
                  screen: "Product",
                  params: { productId: item.id },
                })
              }
              onAdd={() =>
                addItem({
                  productId: item.id,
                  name: item.name,
                  price: item.price,
                  unit: item.unit,
                })
              }
            />
          ))}
      </View>

      <View style={{ height: spacing.xxl + (insets.bottom || 0) }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.offWhite },

  // Header
  header: {
    backgroundColor: colors.blue,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sessionAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  sessionAvatarText: {
    fontSize: 16,
    fontFamily: typography.heading,
    color: colors.white,
  },
  greeting: {
    fontSize: 12,
    color: colors.blueMid,
    fontFamily: typography.body,
  },
  storeName: {
    fontSize: 18,
    fontFamily: typography.heading,
    color: colors.white,
    maxWidth: W - 80,
  },
  bellBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },

  // Search
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
  },
  searchText: {
    flex: 1,
    fontSize: 14,
    color: colors.gray400,
    fontFamily: typography.body,
  },

  // Sections
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: typography.heading,
    color: colors.ink,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  seeAll: {
    fontSize: 12,
    color: colors.blue,
    fontFamily: typography.bodySemiBold,
  },

  // Categories
  hListContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  categoryChip: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    gap: 4,
    minWidth: 64,
  },
  categoryEmoji: { fontSize: 20 },
  categoryName: {
    fontSize: 8,
    fontFamily: typography.heading,
    color: colors.ink,
  },

  // Grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
});
