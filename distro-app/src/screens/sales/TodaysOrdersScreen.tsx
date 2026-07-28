import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { api } from "../../lib/api";
import { fmtRs } from "../../lib/format";
import { colors, spacing, radius, typography, shadow } from "../../lib/theme";
import { SalesStackParamList } from "../../navigation/SalesStack";

const BRAND_BLUE = "#1A4BDB";

interface RepOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  paymentMethod: string;
  createdAt: string;
  buyer: { storeName: string | null; phone: string };
}

/** Mirrors the web page's status palette. */
const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: colors.amberLight, fg: "#B45309" },
  CONFIRMED: { bg: colors.blueLight, fg: BRAND_BLUE },
  PROCESSING: { bg: colors.blueLight, fg: BRAND_BLUE },
  DISPATCHED: { bg: colors.blueLight, fg: BRAND_BLUE },
  DELIVERED: { bg: colors.greenLight, fg: "#047857" },
  CANCELLED: { bg: colors.redLight, fg: colors.red },
};

type Props = { navigation: StackNavigationProp<SalesStackParamList, "TodaysOrders"> };

/**
 * The rep's own orders for today — mirrors distro-web's sales/today.
 *
 * Refetched on focus rather than cached: the rep comes back here after every
 * shop, and a stale list is worse than a brief spinner when the day's running
 * total is the number being checked.
 */
export function TodaysOrdersScreen({ navigation }: Props) {
  const [orders, setOrders] = useState<RepOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get("/sales/orders");
      setOrders(res.data?.orders ?? []);
      setError("");
    } catch (err: any) {
      setError(err?.message ?? "Could not load today's orders.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const todayLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  // Cancelled orders still show in the list but must not inflate the day's take.
  const activeTotal = orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Today's orders</Text>
      </View>

      <View style={s.summary}>
        <View style={s.flex}>
          <Text style={s.summaryLabel}>{todayLabel}</Text>
          <Text style={s.summaryCount}>
            {orders.length} {orders.length === 1 ? "order" : "orders"}
          </Text>
        </View>
        <View>
          <Text style={s.summaryLabel}>Value</Text>
          <Text style={s.summaryValue}>{fmtRs(activeTotal)}</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.centre}>
          <ActivityIndicator color={BRAND_BLUE} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={BRAND_BLUE}
              colors={[BRAND_BLUE]}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          ItemSeparatorComponent={() => <View style={s.separator} />}
          renderItem={({ item }) => <OrderRow order={item} />}
          ListHeaderComponent={
            error ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.red} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            error ? null : (
              <View style={s.empty}>
                <Ionicons name="receipt-outline" size={40} color={colors.gray200} />
                <Text style={s.emptyText}>
                  No orders yet today — find a shop and get rolling.
                </Text>
                <TouchableOpacity
                  style={s.emptyBtn}
                  onPress={() => navigation.navigate("SelectBuyer")}
                  activeOpacity={0.85}
                >
                  <Text style={s.emptyBtnText}>Start an order</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

function OrderRow({ order }: { order: RepOrder }) {
  const style = STATUS_STYLE[order.status] ?? { bg: colors.gray100, fg: colors.gray500 };
  const time = new Date(order.createdAt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <View style={s.row}>
      <View style={s.rowTop}>
        <Text style={s.shop} numberOfLines={1}>
          {order.buyer.storeName ?? order.buyer.phone}
        </Text>
        <Text style={s.total}>{fmtRs(order.total)}</Text>
      </View>
      {/* Time and the two pills are all short and always matter, so they get a
          row of their own; the order number can truncate below them. */}
      <View style={s.rowBottom}>
        <Text style={s.time}>{time}</Text>
        <View style={s.payPill}>
          <Ionicons
            name={order.paymentMethod === "CREDIT" ? "card-outline" : "cash-outline"}
            size={11}
            color={colors.gray600}
          />
          <Text style={s.payPillText}>
            {order.paymentMethod === "CREDIT" ? "Credit" : "COD"}
          </Text>
        </View>
        <View style={[s.statusPill, { backgroundColor: style.bg }]}>
          <Text style={[s.statusPillText, { color: style.fg }]}>{order.status}</Text>
        </View>
      </View>
      <Text style={s.meta} numberOfLines={1}>
        {order.orderNumber}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND_BLUE },
  flex: { flex: 1 },
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

  summary: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.gray400,
    fontFamily: typography.bodySemiBold,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  summaryCount: { fontSize: 18, color: colors.ink, fontFamily: typography.heading, marginTop: 2 },
  summaryValue: {
    fontSize: 18,
    color: BRAND_BLUE,
    fontFamily: typography.heading,
    marginTop: 2,
    textAlign: "right",
  },

  centre: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.offWhite },
  listContent: { backgroundColor: colors.offWhite, flexGrow: 1, padding: spacing.lg },
  separator: { height: spacing.sm },

  row: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 6,
    ...shadow.sm,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  shop: { flex: 1, fontSize: 15, color: colors.ink, fontFamily: typography.bodySemiBold },
  total: { fontSize: 15, color: colors.ink, fontFamily: typography.heading },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 5 },
  time: { fontSize: 12, color: colors.gray600, fontFamily: typography.bodySemiBold, marginRight: 2 },
  meta: { fontSize: 11, color: colors.gray400, fontFamily: typography.body },
  payPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  payPillText: { fontSize: 10, color: colors.gray600, fontFamily: typography.bodySemiBold },
  statusPill: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 10, fontFamily: typography.bodySemiBold, letterSpacing: 0.3 },

  empty: { alignItems: "center", gap: spacing.md, paddingVertical: 80, paddingHorizontal: spacing.lg },
  emptyText: { fontSize: 15, color: colors.gray400, fontFamily: typography.body, textAlign: "center" },
  emptyBtn: {
    borderWidth: 1.5,
    borderColor: BRAND_BLUE,
    backgroundColor: colors.blueLight,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  emptyBtnText: { fontSize: 14, color: BRAND_BLUE, fontFamily: typography.bodySemiBold },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.redLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    marginBottom: spacing.sm,
  },
  errorText: { flex: 1, color: colors.red, fontSize: 13, fontFamily: typography.bodyMedium },
});
