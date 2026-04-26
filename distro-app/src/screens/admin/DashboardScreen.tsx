import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  FadeInDown,
  FadeInRight,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { StatusBadge } from "../../components/StatusBadge";
import { colors, spacing, radius, shadow, typography } from "../../lib/theme";
import { fmtRs, sessionInitial } from "../../lib/format";

const { width: W } = Dimensions.get("window");

interface Stats {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  lowStockCount: number;
  totalRetailers?: number;
  totalRevenue?: number;
}
interface RecentOrder {
  id: number;
  orderNumber: string;
  status: string;
  total?: number;
  totalAmount?: number;
  buyerName: string;
  storeName: string;
  createdAt: string;
}

// ─── Animated stat card ───────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  index,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  index: number;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).springify().damping(18)}
      style={[styles.statCard, shadow.sm]}
    >
      <View style={[styles.statIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[styles.statValue, { color: iconColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

// ─── Recent order row ─────────────────────────────────────────────────────────
function OrderRow({ order, index, onPress }: { order: RecentOrder; index: number; onPress: () => void }) {
  return (
    <Animated.View entering={FadeInDown.delay(400 + index * 60).springify().damping(18)}>
      <TouchableOpacity
        style={[styles.orderRow, shadow.sm]}
        onPress={onPress}
        activeOpacity={0.88}
      >
        <View style={styles.orderLeft}>
          <Text style={styles.orderStore} numberOfLines={1}>{order.storeName}</Text>
          <Text style={styles.orderMeta}>
            {order.orderNumber || `#${order.id}`} · {new Date(order.createdAt).toLocaleDateString("en-NP", { month: "short", day: "numeric" })}
          </Text>
        </View>
        <View style={styles.orderRight}>
          <StatusBadge status={order.status} />
          <Text style={styles.orderAmt}>{fmtRs(order.totalAmount ?? order.total)}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Quick action ─────────────────────────────────────────────────────────────
function QuickAction({
  label,
  icon,
  color,
  bg,
  onPress,
  index,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  onPress: () => void;
  index: number;
}) {
  return (
    <Animated.View entering={FadeInRight.delay(300 + index * 60).springify().damping(18)} style={styles.quickActionWrap}>
      <TouchableOpacity style={[styles.quickAction, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.85}>
        <View style={[styles.quickActionIcon, { backgroundColor: color + "18" }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <Text style={[styles.quickActionLabel, { color }]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export function DashboardScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [statsRes, ordersRes] = await Promise.allSettled([
        api.get("/admin/dashboard"),
        api.get("/admin/orders", { params: { limit: 5, page: 1 } }),
      ]);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
      if (ordersRes.status === "fulfilled")
        setRecentOrders(ordersRes.value.data.orders?.slice(0, 5) ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const statCards = stats
    ? [
        {
          label: "Today's orders",
          value: stats.todayOrders,
          icon: "bag-outline" as const,
          iconBg: colors.blueLight,
          iconColor: colors.blue,
        },
        {
          label: "Today's revenue",
          value: fmtRs(stats.todayRevenue),
          icon: "cash-outline" as const,
          iconBg: colors.greenLight,
          iconColor: colors.greenDark,
        },
        {
          label: "Pending orders",
          value: stats.pendingOrders,
          icon: "time-outline" as const,
          iconBg: colors.amberLight,
          iconColor: colors.amberDark,
        },
        {
          label: "Low stock items",
          value: stats.lowStockCount,
          icon: "alert-circle-outline" as const,
          iconBg: colors.redLight,
          iconColor: colors.red,
        },
      ]
    : [];

  return (
    <ScrollView
      style={styles.bg}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          tintColor={colors.blue}
          colors={[colors.blue]}
        />
      }
    >
      <View style={{ height: insets.top }} />

      {/* Header */}
      <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{sessionInitial(profile)}</Text>
          </View>
          <View>
            <Text style={styles.headerLabel}>ADMIN</Text>
            <Text style={styles.headerName}>
              {(profile?.ownerName ?? profile?.name ?? "Admin").split(" ")[0]} 👋
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={() => useAuthStore.getState().logout()}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={16} color={colors.red} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Overview banner */}
      {stats?.todayRevenue != null && (
        <Animated.View entering={FadeInDown.delay(80).springify().damping(18)} style={[styles.overviewBanner, shadow.md]}>
          <View>
            <Text style={styles.overviewLabel}>Today's Revenue</Text>
            <Text style={styles.overviewValue}>{fmtRs(stats.todayRevenue)}</Text>
          </View>
          <View style={styles.overviewRight}>
            <View style={styles.overviewBadge}>
              <Ionicons name="trending-up-outline" size={14} color={colors.green} />
              <Text style={styles.overviewBadgeText}>Live</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Stat cards */}
      <View style={styles.statsGrid}>
        {loading
          ? [1, 2, 3, 4].map((k) => <View key={k} style={[styles.statCard, styles.statCardSkeleton]} />)
          : statCards.map((s, i) => <StatCard key={i} {...s} index={i} />)}
      </View>

      {/* Quick actions */}
      <SectionHeader title="Quick actions" />
      <View style={styles.quickActionsRow}>
        <QuickAction
          label="Stock"
          icon="cube-outline"
          color={colors.blue}
          bg={colors.blueLight}
          onPress={() => navigation.navigate("Inventory")}
          index={0}
        />
        <QuickAction
          label="Ledger"
          icon="document-text-outline"
          color="#7C3AED"
          bg="#EDE9FE"
          onPress={() => navigation.navigate("Ledger")}
          index={1}
        />
        <QuickAction
          label="Buyers"
          icon="people-outline"
          color={colors.greenDark}
          bg={colors.greenLight}
          onPress={() => navigation.navigate("Customers")}
          index={2}
        />
        <QuickAction
          label="Banners"
          icon="image-outline"
          color="#BE185D"
          bg="#FCE7F3"
          onPress={() => navigation.navigate("Banners")}
          index={3}
        />
        <QuickAction
          label="Categories"
          icon="pricetag-outline"
          color="#D97706"
          bg="#FEF3C7"
          onPress={() => navigation.navigate("Categories")}
          index={4}
        />
      </View>

      {/* Recent orders */}
      <SectionHeader
        title="Recent orders"
        action="View all"
        onAction={() => navigation.navigate("AdminOrders")}
      />

      {loading ? (
        <View style={styles.ordersPlaceholder}>
          {[1, 2, 3].map((k) => (
            <View key={k} style={styles.orderRowSkeleton} />
          ))}
        </View>
      ) : recentOrders.length === 0 ? (
        <View style={styles.emptyOrders}>
          <Ionicons name="receipt-outline" size={28} color={colors.gray300} />
          <Text style={styles.emptyText}>No orders yet</Text>
        </View>
      ) : (
        <View style={styles.ordersList}>
          {recentOrders.map((o, i) => (
            <OrderRow
              key={o.id}
              order={o}
              index={i}
              onPress={() => navigation.navigate("AdminOrders")}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={sectionStyles.row}>
      <Text style={sectionStyles.title}>{title}</Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction}>
          <Text style={sectionStyles.action}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  title: { fontSize: 17, fontFamily: typography.heading, color: colors.ink },
  action: { fontSize: 13, color: colors.blue, fontFamily: typography.bodySemiBold },
});

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.offWhite },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  headerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.blueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: {
    fontSize: 20,
    fontFamily: typography.heading,
    color: colors.blue,
  },
  headerLabel: {
    fontSize: 11,
    fontFamily: typography.bodySemiBold,
    color: colors.blue,
    letterSpacing: 2,
  },
  headerName: {
    fontSize: 24,
    fontFamily: typography.heading,
    color: colors.ink,
    marginTop: 2,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.redLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    marginTop: 6,
  },
  signOutText: { fontSize: 13, color: colors.red, fontFamily: typography.bodySemiBold },

  overviewBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.blue,
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  overviewLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: typography.body },
  overviewValue: { fontSize: 28, fontFamily: typography.heading, color: colors.white, marginTop: 4 },
  overviewRight: {},
  overviewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  overviewBadgeText: { fontSize: 12, color: colors.white, fontFamily: typography.bodySemiBold },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  statCard: {
    width: (W - spacing.lg * 2 - spacing.sm) / 2,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  statCardSkeleton: { backgroundColor: colors.gray100, height: 100 },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  statValue: { fontSize: 24, fontFamily: typography.heading },
  statLabel: { fontSize: 12, color: colors.gray500, fontFamily: typography.body },

  quickActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    rowGap: spacing.sm,
  },
  quickActionWrap: {
    flexBasis: "22%",
    flexGrow: 1,
    minWidth: (W - spacing.lg * 2 - spacing.sm * 3) / 4,
  },
  quickAction: {
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.xs,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  quickActionLabel: { fontSize: 12, fontFamily: typography.bodySemiBold },

  ordersPlaceholder: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  orderRowSkeleton: {
    height: 66,
    backgroundColor: colors.gray100,
    borderRadius: radius.xl,
  },
  emptyOrders: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: { fontSize: 14, color: colors.gray400, fontFamily: typography.body },
  ordersList: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  orderRow: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderLeft: { flex: 1, gap: 3, marginRight: spacing.sm },
  orderStore: { fontSize: 14, fontFamily: typography.bodySemiBold, color: colors.ink },
  orderMeta: { fontSize: 12, color: colors.gray400, fontFamily: typography.body },
  orderRight: { alignItems: "flex-end", gap: 5 },
  orderAmt: { fontSize: 14, fontFamily: typography.heading, color: colors.blue },
});
