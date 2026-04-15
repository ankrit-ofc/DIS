import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/api";
import { StatusBadge } from "../../components/StatusBadge";
import { colors, spacing, radius, shadow } from "../../lib/theme";
import { fmtRs } from "../../lib/format";

interface Order {
  id: number;
  orderNumber: string;
  status: string;
  total?: number;
  totalAmount?: number;
  items?: unknown[];
  itemCount?: number;
  createdAt: string;
}

export function OrdersScreen({ navigation }: any) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/orders");
      setOrders(res.data.orders ?? res.data ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My orders</Text>

      {loading ? (
        <ActivityIndicator color={colors.blue} style={styles.loader} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, shadow.sm]}
              onPress={() => navigation.navigate("OrderDetail", { orderId: item.id })}
              activeOpacity={0.88}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.orderNum}>
                  {item.orderNumber || `#${item.id}`}
                </Text>
                <StatusBadge status={item.status} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.meta}>
                  {item.itemCount ?? item.items?.length ?? 0} item{(item.itemCount ?? item.items?.length ?? 0) !== 1 ? "s" : ""}
                </Text>
                <Text style={styles.meta}>
                  {new Date(item.createdAt).toLocaleDateString("en-NP", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </View>
              <Text style={styles.amount}>{fmtRs(item.totalAmount ?? item.total)}</Text>
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.blue}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptyText}>Your placed orders will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.offWhite },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
    padding: spacing.lg,
    paddingTop: spacing.lg + spacing.md,
  },
  loader: { marginTop: spacing.xxl },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderNum: { fontSize: 15, fontWeight: "700", color: colors.ink },
  cardBody: { flexDirection: "row", gap: spacing.md },
  meta: { fontSize: 12, color: colors.gray400 },
  amount: { fontSize: 16, fontWeight: "700", color: colors.blue },
  empty: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  emptyText: { fontSize: 14, color: colors.gray400 },
});
