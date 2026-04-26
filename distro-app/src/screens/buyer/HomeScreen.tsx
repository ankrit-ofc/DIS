import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Dimensions, FlatList, NativeScrollEvent,
  NativeSyntheticEvent, Image,
} from "react-native";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import { useCartStore } from "../../store/cartStore";
import { api } from "../../lib/api";
import { colors, spacing, radius, shadow, typography } from "../../lib/theme";
import { fmtRs, fmtUnitPrice, sessionInitial } from "../../lib/format";
import { SkeletonLoader, SkeletonProductCard, SkeletonCategoryChip } from "../../components/SkeletonLoader";
import { imgUri } from "../../lib/image";

const { width: W } = Dimensions.get("window");
const CARD_W = (W - spacing.lg * 2 - spacing.sm) / 2;
const IMG_H  = 160;
const IMG_BG = "#F4F6F8";
const PRIMARY = "#2563EB";
const BANNER_W = W;

interface Announcement { id: string; text: string; }
interface Banner {
  id: string; title: string; subtitle?: string;
  imageUrl?: string; bgColor: string; textColor: string;
}
interface Category { id: string; name: string; emoji?: string; imageUrl?: string; }
interface Product {
  id: string; name: string; price: number; mrp?: number;
  unit: string; stockQty: number; moq?: number; imageUrl?: string; brand?: string;
}

// ─── Banner carousel ─────────────────────────────────────────────────────────
function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => {
      setActiveIdx(i => {
        const next = (i + 1) % banners.length;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (!banners.length) return null;

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / BANNER_W);
    setActiveIdx(idx);
  }

  return (
    <View style={bc.wrap}>
      <FlatList
        ref={listRef}
        data={banners}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        keyExtractor={item => item.id}
        onMomentumScrollEnd={onScroll}
        contentContainerStyle={{}}
        renderItem={({ item }) => {
          const uri = imgUri(item.imageUrl);
          return (
            <View style={[bc.card, { backgroundColor: item.bgColor, width: BANNER_W }]}>
              {uri ? (
                <Image source={{ uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              ) : (
                <>
                  <View style={[bc.circle, { backgroundColor: item.textColor }]} />
                  <View style={[bc.circleSm, { backgroundColor: item.textColor }]} />
                </>
              )}
              <Text style={[bc.title, { color: uri ? "#fff" : item.textColor }]} numberOfLines={2}>
                {item.title}
              </Text>
              {item.subtitle ? (
                <Text style={[bc.subtitle, { color: uri ? "rgba(255,255,255,0.88)" : item.textColor }]} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              ) : null}
            </View>
          );
        }}
      />
      {banners.length > 1 && (
        <View style={bc.dots}>
          {banners.map((_, i) => (
            <View key={i} style={[bc.dot, i === activeIdx && bc.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const bc = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  card: {
    width: W,
    height: 160,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: spacing.md,
  },
  circle: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    opacity: 0.08,
    right: -30,
    top: -30,
  },
  circleSm: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    opacity: 0.06,
    right: 60,
    bottom: -20,
  },
  title: {
    fontSize: 18,
    fontFamily: typography.heading,
    letterSpacing: -0.4,
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: typography.bodyMedium,
    marginTop: 3,
    opacity: 0.85,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    marginTop: 8,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.gray300,
  },
  dotActive: {
    backgroundColor: colors.blue,
    width: 14,
  },
});

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
        {imgUri(item.imageUrl)
          ? <Image source={{ uri: imgUri(item.imageUrl) }} style={pc.img} resizeMode="contain" />
          : <View style={pc.imgPlaceholder}><Ionicons name="cube-outline" size={32} color={colors.blue} style={{ opacity: 0.35 }} /></View>
        }
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
        <View style={pc.priceRow}>
          <View style={{ flex: 1 }}>
            <Text style={pc.price}>{fmtUnitPrice(item.price, item.unit)}</Text>
            {item.mrp && item.mrp > item.price ? (
              <Text style={pc.mrp}>{fmtRs(item.mrp)}</Text>
            ) : item.moq && item.moq > 1 ? (
              <Text style={pc.moq}>{fmtRs(item.price * item.moq)} / carton ({item.moq} pcs)</Text>
            ) : null}
          </View>
          {!outOfStock && (
            <TouchableOpacity style={pc.addBtn} onPress={onAdd} activeOpacity={0.8} hitSlop={8}>
              <Ionicons name="add" size={18} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const pc = StyleSheet.create({
  card: {
    width: CARD_W,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  imgWrap: {
    width: "100%",
    height: IMG_H,
    position: "relative",
    backgroundColor: IMG_BG,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  img: {
    width: "100%",
    height: "100%",
  },
  imgPlaceholder: {
    width: "100%",
    height: "100%",
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
  priceRow: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 8 },
  price: { fontSize: 14, fontFamily: typography.heading, color: PRIMARY, fontWeight: "700" },
  mrp: { fontSize: 11, fontFamily: typography.body, color: colors.gray400, textDecorationLine: "line-through" },
  moq: { fontSize: 10, fontFamily: typography.body, color: colors.gray400 },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export function HomeScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const { addItem } = useCartStore();
  const insets = useSafeAreaInsets();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [annRes, bannerRes, catRes, prodRes] = await Promise.allSettled([
        api.get("/announcements"),
        api.get("/banners"),
        api.get("/categories"),
        api.get("/products", { params: { sort: "newest", limit: 12 } }),
      ]);
      if (annRes.status === "fulfilled")
        setAnnouncements(annRes.value.data.announcements ?? annRes.value.data ?? []);
      if (bannerRes.status === "fulfilled")
        setBanners(bannerRes.value.data.banners ?? []);
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

      {/* Banner carousel — just above categories */}
      {banners.length > 0 && <BannerCarousel banners={banners} />}

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
              <View style={s.categoryIconWrap}>
                {imgUri(item.imageUrl)
                  ? <Image source={{ uri: imgUri(item.imageUrl)! }} style={s.categoryImg} resizeMode="cover" />
                  : <Text style={s.categoryEmoji}>{item.emoji ?? "📦"}</Text>}
              </View>
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
    fontSize: 16,
    fontFamily: typography.heading,
    color: colors.ink,
    letterSpacing: -0.2,
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
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
    gap: 6,
  },
  categoryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.blueLight,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  categoryImg: { width: "100%", height: "100%" },
  categoryEmoji: { fontSize: 22 },
  categoryName: {
    fontSize: 13,
    fontFamily: typography.heading,
    color: colors.ink,
    letterSpacing: -0.2,
  },

  // Grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
});
