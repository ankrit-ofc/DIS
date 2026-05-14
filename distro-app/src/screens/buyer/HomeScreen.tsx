import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Dimensions, FlatList, Image, Animated,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import { useCartStore } from "../../store/cartStore";
import { api } from "../../lib/api";
import { colors, spacing, radius, shadow, typography } from "../../lib/theme";
import { fmtCarton, sessionInitial } from "../../lib/format";
import { resolveImageUrl } from "../../lib/imageUrl";
import { SkeletonLoader, SkeletonProductCard, SkeletonCategoryChip } from "../../components/SkeletonLoader";

const { width: W } = Dimensions.get("window");
const CARD_W = (W - spacing.lg * 2 - spacing.sm) / 2;
const BANNER_W = W - spacing.lg * 2;
// Branded blue palette for category fallback circles (deterministic by name hash)
const CAT_COLORS = [
  "#DBEAFE", // bluePale
  "#BFDBFE", // blueMid
  "#EFF6FF", // blueLight
  "#E0E7FF", // indigo-100
  "#CFFAFE", // cyan-100
  "#DBEAFE",
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ─── Banner Carousel ──────────────────────────────────────────────────────────
const BANNERS = [
  require("../../../assets/banner1.png"),
  require("../../../assets/banner2.png"),
];

function BannerCarousel() {
  const [active, setActive] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    let mounted = true;
    const timer = setInterval(() => {
      if (!mounted) return;
      let next = (active + 1) % BANNERS.length;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setActive(next);
    }, 3000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [active]);

  return (
    <View style={bc.wrap}>
      <FlatList
        ref={flatListRef}
        data={BANNERS}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setActive(Math.round(e.nativeEvent.contentOffset.x / BANNER_W))}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <Image source={item} style={bc.img} resizeMode="cover" />
        )}
      />
      <View style={bc.dots}>
        {BANNERS.map((_, i) => (
          <View key={i} style={[bc.dot, active === i && bc.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const bc = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    overflow: "hidden",
    height: BANNER_W / 2,
    backgroundColor: colors.gray100,
  },
  img: { width: BANNER_W, height: BANNER_W / 2 },
  dots: {
    position: "absolute",
    bottom: 10,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { backgroundColor: colors.white, width: 14 },
});

interface Announcement { id: string; text: string; }
interface Category { id: string; name: string; emoji?: string; imageUrl?: string; image?: string; }
interface Product {
  id: string; name: string; price: number; mrp?: number;
  unit: string; stockQty: number; moq?: number; imageUrl?: string; brand?: string;
  piecesPerCarton?: number; pricePerCarton?: number;
}

// ─── Announcement ticker ──────────────────────────────────────────────────────
function AnnouncementTicker({ items, loading }: { items: Announcement[]; loading: boolean }) {
  const [idx, setIdx] = useState(0);
  const scrollAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!items.length || loading) return;
    const run = () => {
      scrollAnim.setValue(W);
      Animated.timing(scrollAnim, {
        toValue: -W,
        duration: 10000,
        useNativeDriver: true,
        easing: (t) => t,
      }).start(({ finished }) => {
        if (finished) {
          setIdx((i) => (i + 1) % items.length);
          run();
        }
      });
    };
    run();
    return () => scrollAnim.stopAnimation();
  }, [items.length, loading]);

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
        <View style={{ flex: 1, overflow: "hidden" }}>
          <Animated.Text
            style={[tk.text, { transform: [{ translateX: scrollAnim }] }]}
            numberOfLines={1}
          >
            {items[idx].text}
          </Animated.Text>
        </View>
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
    fontSize: 13,
    fontFamily: typography.bodyMedium,
    color: colors.ink,
    width: W, // Ensure wide enough for animation range
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
        {item.imageUrl ? (
          <ExpoImage
            source={{ uri: resolveImageUrl(item.imageUrl) ?? "" }}
            style={pc.img}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={200}
            placeholder={colors.blueLight}
          />
        ) : (
          <View style={pc.imgPlaceholder}>
            <Ionicons name="cube-outline" size={28} color={colors.blue} style={{ opacity: 0.4 }} />
          </View>
        )}
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
        {(() => {
          const pieces = item.piecesPerCarton ?? item.moq ?? 1;
          const cartonPrice = item.pricePerCarton ?? item.price * pieces;
          return <Text style={pc.price}>{fmtCarton(cartonPrice, pieces, item.unit)}</Text>;
        })()}
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
    width: CARD_W,
    height: 140,
    backgroundColor: colors.blueLight,
    position: "relative",
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
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      {/* Blue header — stays fixed, does not move with pull-to-refresh */}
      <View style={[s.header, { paddingTop: spacing.md }]}>
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

      <ScrollView
        style={s.bg}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.blue}
            colors={[colors.blue]}
            progressBackgroundColor={colors.white}
          />
        }
      >
      {/* Announcement ticker */}
      <AnnouncementTicker items={announcements} loading={loading} />

      {/* Banner Carousel */}
      <BannerCarousel />

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
        renderItem={({ item, index }) =>
          loading ? (
            <SkeletonCategoryChip />
          ) : (
            (() => {
              const rawImg = item.imageUrl ?? item.image;
              const resolvedImg = rawImg ? resolveImageUrl(rawImg) : null;
              const bg = CAT_COLORS[hashName(item.name) % CAT_COLORS.length];
              if (__DEV__ && resolvedImg) console.log("[category image]", item.name, resolvedImg);
              return (
                <TouchableOpacity
                  style={s.categoryChip}
                  activeOpacity={0.8}
                  onPress={() => goCatalogue({ categoryId: item.id, categoryName: item.name })}
                >
                  <View style={[s.categoryIcon, { backgroundColor: bg, overflow: 'hidden' }]}>
                    {resolvedImg ? (
                      <ExpoImage source={{ uri: resolvedImg }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" transition={200} placeholder={bg} />
                    ) : item.emoji ? (
                      <Text style={s.categoryEmoji}>{item.emoji}</Text>
                    ) : (
                      <Text style={s.categoryInitial}>{item.name.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <Text style={s.categoryName} numberOfLines={1}>{item.name}</Text>
                </TouchableOpacity>
              );
            })()
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
                });
              }}
            />
          ))}
      </View>

      <View style={{ height: spacing.xxl + (insets.bottom || 0) }} />
    </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.blue },
  bg: { flex: 1, backgroundColor: colors.white },
  scrollContent: { backgroundColor: colors.white, paddingTop: spacing.sm },

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
    alignItems: "center",
    gap: 8,
    width: 72,
  },
  categoryIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryEmoji: { fontSize: 26 },
  categoryInitial: { fontSize: 22, fontFamily: typography.heading, color: colors.blueDark },
  categoryName: {
    fontSize: 10,
    fontFamily: typography.bodyMedium,
    color: colors.ink,
    textAlign: "center",
  },

  // Grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
});
