import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeInDown,
  LinearTransition,
} from "react-native-reanimated";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { BottomSheet } from "../../components/BottomSheet";
import { StatusBadge } from "../../components/StatusBadge";
import { colors, spacing, radius, shadow, typography, statusColors } from "../../lib/theme";
import { fmtRs } from "../../lib/format";

interface Order {
  id: number;
  orderNumber: string;
  status: string;
  total?: number;
  totalAmount?: number;
  buyerName: string;
  storeName: string;
  createdAt: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryDistrict?: string;
  district?: string;
  deliveryAddress?: string;
  address?: string;
  paymentMethod?: string;
  items?: { name?: string; productName?: string; qty: number; price?: number; unitPrice?: number }[];
}

const STATUS_TABS = ["ALL", "PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

// ─── Filter tab ───────────────────────────────────────────────────────────────
function FilterTab({ label, active, count, onPress }: {
  label: string;
  active: boolean;
  count?: number;
  onPress: () => void;
}) {
  const sc = statusColors[label];
  return (
    <TouchableOpacity
      style={[
        styles.tab,
        active && { backgroundColor: sc?.bg ?? colors.blueLight },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {label !== "ALL" && sc && (
        <View style={[styles.tabDot, { backgroundColor: sc.dot }]} />
      )}
      <Text style={[
        styles.tabText,
        active && { color: sc?.text ?? colors.blue, fontFamily: typography.bodySemiBold },
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Order card ───────────────────────────────────────────────────────────────
function OrderCard({ order, index, onPress }: { order: Order; index: number; onPress: () => void }) {
  const sc = statusColors[order.status];
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).springify().damping(18)}
      layout={LinearTransition.springify()}
    >
      <TouchableOpacity style={[styles.card, shadow.sm]} onPress={onPress} activeOpacity={0.88}>
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardStore} numberOfLines={1}>{order.storeName}</Text>
            <Text style={styles.cardBuyer} numberOfLines={1}>{order.buyerName}</Text>
          </View>
          <StatusBadge status={order.status} />
        </View>
        <View style={styles.cardBottom}>
          <View style={styles.cardMeta}>
            <Ionicons name="receipt-outline" size={12} color={colors.gray400} />
            <Text style={styles.cardMetaText}>{order.orderNumber || `#${order.id}`}</Text>
          </View>
          <View style={styles.cardMeta}>
            <Ionicons name="calendar-outline" size={12} color={colors.gray400} />
            <Text style={styles.cardMetaText}>
              {new Date(order.createdAt).toLocaleDateString("en-NP", { month: "short", day: "numeric" })}
            </Text>
          </View>
          <Text style={styles.cardAmount}>{fmtRs(order.totalAmount ?? order.total)}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export function AdminOrdersScreen() {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selected, setSelected] = useState<Order | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "ALL") params.status = statusFilter;
      const res = await api.get("/admin/orders", { params });
      setOrders(res.data.orders ?? res.data ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => { setLoading(true); load(); }, [statusFilter]);

  const openOrder = async (order: Order) => {
    try {
      const res = await api.get(`/admin/orders/${order.id}`);
      setSelected(res.data.order ?? res.data);
    } catch {
      setSelected(order);
    }
    setSheetVisible(true);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selected) return;
    setStatusUpdating(true);
    try {
      await api.put(`/admin/orders/${selected.id}/status`, { status: newStatus });
      setSelected({ ...selected, status: newStatus });
      setOrders((prev) => prev.map((o) => o.id === selected.id ? { ...o, status: newStatus } : o));
    } finally {
      setStatusUpdating(false);
    }
  };

  const mapRegion = selected?.deliveryLat
    ? {
        latitude: selected.deliveryLat,
        longitude: selected.deliveryLng!,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : null;

  return (
    <View style={styles.container}>
      <View style={{ height: insets.top }} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>Orders</Text>
        {!loading && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{orders.length}</Text>
          </View>
        )}
      </View>

      {/* Status filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContent}
        style={styles.filterScroll}
      >
        {STATUS_TABS.map((t) => (
          <FilterTab
            key={t}
            label={t}
            active={statusFilter === t}
            onPress={() => setStatusFilter(t)}
          />
        ))}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.blue} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.id)}
          contentContainerStyle={[styles.list, { paddingBottom: spacing.xxxl + insets.bottom }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.blue}
            />
          }
          renderItem={({ item, index }) => (
            <OrderCard order={item} index={index} onPress={() => openOrder(item)} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="receipt-outline" size={32} color={colors.gray300} />
              <Text style={styles.emptyText}>No orders for this status</Text>
            </View>
          }
        />
      )}

      {/* Order detail sheet */}
      <BottomSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} snapHeight={600}>
        {selected && (
          <ScrollView
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {/* Sheet header */}
            <View style={styles.sheetHead}>
              <View>
                <Text style={styles.sheetOrderNum}>{selected.orderNumber || `#${selected.id}`}</Text>
                <Text style={styles.sheetStoreName}>{selected.storeName}</Text>
              </View>
              <StatusBadge status={selected.status} size="md" />
            </View>

            {/* Meta info */}
            <View style={styles.sheetMeta}>
              {(selected.deliveryDistrict ?? selected.district) ? (
                <View style={styles.sheetMetaRow}>
                  <Ionicons name="location-outline" size={14} color={colors.gray400} />
                  <Text style={styles.sheetMetaText}>
                    {selected.deliveryDistrict ?? selected.district}{(selected.deliveryAddress ?? selected.address) ? `, ${selected.deliveryAddress ?? selected.address}` : ""}
                  </Text>
                </View>
              ) : null}
              {selected.paymentMethod && (
                <View style={styles.sheetMetaRow}>
                  <Ionicons name="card-outline" size={14} color={colors.gray400} />
                  <Text style={styles.sheetMetaText}>{selected.paymentMethod}</Text>
                </View>
              )}
            </View>

            {/* Items */}
            {selected.items && selected.items.length > 0 && (
              <View style={styles.itemsCard}>
                {selected.items.map((item, idx) => {
                  const price = item.unitPrice ?? item.price ?? 0;
                  return (
                    <View key={idx} style={[styles.itemRow, idx > 0 && styles.itemRowBorder]}>
                      <Text style={styles.itemName} numberOfLines={1}>{item.productName ?? item.name}</Text>
                      <Text style={styles.itemQty}>×{item.qty}</Text>
                      <Text style={styles.itemAmt}>{fmtRs(price * item.qty)}</Text>
                    </View>
                  );
                })}
                <View style={[styles.itemRow, styles.itemRowBorder, styles.itemTotalRow]}>
                  <Text style={styles.itemTotalLabel}>Total</Text>
                  <Text style={styles.itemTotalAmt}>{fmtRs(selected.totalAmount ?? selected.total)}</Text>
                </View>
              </View>
            )}

            {/* Status picker */}
            <Text style={styles.sheetSectionTitle}>Update status</Text>
            <View style={styles.statusGrid}>
              {ORDER_STATUSES.map((s) => {
                const sc = statusColors[s];
                const isActive = selected.status === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.statusChip,
                      isActive && { backgroundColor: sc?.bg, borderColor: sc?.dot },
                      statusUpdating && styles.statusChipDisabled,
                    ]}
                    onPress={() => handleStatusChange(s)}
                    disabled={statusUpdating || isActive}
                    activeOpacity={0.8}
                  >
                    {sc && <View style={[styles.statusChipDot, { backgroundColor: sc.dot }]} />}
                    <Text style={[styles.statusChipText, isActive && { color: sc?.text, fontFamily: typography.bodySemiBold }]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Map */}
            <Text style={styles.sheetSectionTitle}>Delivery location</Text>
            {mapRegion ? (
              <MapView
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                region={mapRegion}
                scrollEnabled={false}
                zoomEnabled={false}
              >
                <Marker coordinate={{ latitude: mapRegion.latitude, longitude: mapRegion.longitude }} pinColor={colors.blue} />
              </MapView>
            ) : (
              <View style={styles.noMap}>
                <Ionicons name="map-outline" size={24} color={colors.gray300} />
                <Text style={styles.noMapText}>No location provided</Text>
              </View>
            )}

            <View style={{ height: spacing.xxl }} />
          </ScrollView>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.offWhite },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  heading: { fontSize: 26, fontFamily: typography.heading, color: colors.ink },
  countBadge: {
    backgroundColor: colors.blueLight,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countText: { fontSize: 13, color: colors.blue, fontFamily: typography.bodySemiBold },

  filterScroll: { maxHeight: 44, marginBottom: spacing.xs },
  filterContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    paddingRight: spacing.xl,
    alignItems: "center",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  tabDot: { width: 6, height: 6, borderRadius: 3 },
  tabText: { fontSize: 12, color: colors.gray500, fontFamily: typography.bodyMedium },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },

  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardLeft: { flex: 1, marginRight: spacing.sm, gap: 2 },
  cardStore: { fontSize: 15, fontFamily: typography.bodySemiBold, color: colors.ink },
  cardBuyer: { fontSize: 12, color: colors.gray400, fontFamily: typography.body },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 3 },
  cardMetaText: { fontSize: 12, color: colors.gray400, fontFamily: typography.body },
  cardAmount: { marginLeft: "auto", fontSize: 15, fontFamily: typography.heading, color: colors.blue },

  emptyWrap: { alignItems: "center", paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyText: { fontSize: 14, color: colors.gray400, fontFamily: typography.body },

  // Sheet
  sheetContent: { padding: spacing.lg, gap: spacing.lg },
  sheetHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  sheetOrderNum: { fontSize: 18, fontFamily: typography.heading, color: colors.ink },
  sheetStoreName: { fontSize: 13, color: colors.gray500, fontFamily: typography.body, marginTop: 2 },
  sheetMeta: { gap: 6 },
  sheetMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sheetMetaText: { fontSize: 13, color: colors.gray600, fontFamily: typography.body },

  itemsCard: {
    backgroundColor: colors.offWhite,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: spacing.sm,
  },
  itemRowBorder: { borderTopWidth: 1, borderTopColor: colors.gray100 },
  itemTotalRow: { backgroundColor: colors.white },
  itemName: { flex: 1, fontSize: 13, color: colors.gray600, fontFamily: typography.body },
  itemQty: { fontSize: 12, color: colors.gray400, fontFamily: typography.bodyMedium, minWidth: 24 },
  itemAmt: { fontSize: 13, fontFamily: typography.bodySemiBold, color: colors.ink },
  itemTotalLabel: { flex: 1, fontSize: 14, fontFamily: typography.bodySemiBold, color: colors.ink },
  itemTotalAmt: { fontSize: 16, fontFamily: typography.heading, color: colors.blue },

  sheetSectionTitle: {
    fontSize: 12,
    fontFamily: typography.bodySemiBold,
    color: colors.gray400,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.offWhite,
    borderWidth: 1.5,
    borderColor: colors.gray100,
  },
  statusChipDot: { width: 6, height: 6, borderRadius: 3 },
  statusChipDisabled: { opacity: 0.5 },
  statusChipText: { fontSize: 12, color: colors.gray600, fontFamily: typography.bodyMedium },

  map: { width: "100%", height: 180, borderRadius: radius.lg, overflow: "hidden" },
  noMap: {
    backgroundColor: colors.offWhite,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  noMapText: { fontSize: 13, color: colors.gray400, fontFamily: typography.body },
});
