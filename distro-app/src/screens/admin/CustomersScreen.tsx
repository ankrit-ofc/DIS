import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
} from "react-native";
import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../../lib/api";
import { StatusBadge } from "../../components/StatusBadge";
import { colors, spacing, radius, shadow } from "../../lib/theme";
import { fmtRs } from "../../lib/format";

interface Customer {
  id: number;
  name: string;
  storeName: string;
  phone: string;
  district: string;
  orderCount: number;
  totalSpent: number;
  creditUsed?: number;
  creditLimit?: number;
  status?: string;
  notes?: string;
}
interface CustomerDetail extends Customer {
  recentOrders: { id: number; orderNumber: string; status: string; total?: number; totalAmount?: number; createdAt: string }[];
}

function CreditBar({ used = 0, limit = 0 }: { used?: number; limit?: number }) {
  if (limit <= 0) return null;
  const pct = Math.min(used / limit, 1);
  const barColor = pct > 0.8 ? "#DC2626" : pct > 0.6 ? "#D97706" : colors.green;
  return (
    <View style={cred.wrap}>
      <View style={cred.headerRow}>
        <Text style={cred.label}>Credit</Text>
        <Text style={cred.vals}>{fmtRs(used)} / {fmtRs(limit)}</Text>
      </View>
      <View style={cred.track}>
        <View style={[cred.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}
const cred = StyleSheet.create({
  wrap: { gap: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 12, color: colors.gray400 },
  vals: { fontSize: 12, fontWeight: "600", color: colors.ink },
  track: { height: 6, backgroundColor: colors.gray200, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
});

export function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<CustomerDetail | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [search]);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await api.get("/admin/customers", { params });
      setCustomers(res.data.customers ?? res.data ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { setLoading(true); load(); }, [debouncedSearch]);

  const openCustomer = async (customer: Customer) => {
    setDetailLoading(true);
    setModalVisible(true);
    try {
      const res = await api.get(`/admin/customers/${customer.id}`);
      setSelected(res.data.customer ?? { ...customer, recentOrders: [] });
    } catch {
      setSelected({ ...customer, recentOrders: [] });
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Customers</Text>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search store or owner name…"
          placeholderTextColor={colors.gray400}
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.green} style={styles.loader} />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.green}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, shadow.sm]}
              onPress={() => openCustomer(item)}
              activeOpacity={0.85}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.storeName?.charAt(0)?.toUpperCase() ?? "?"}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.storeName}>{item.storeName}</Text>
                <Text style={styles.ownerName}>{item.name} · {item.district}</Text>
                <Text style={styles.phone}>{item.phone}</Text>
              </View>
              <View style={styles.stats}>
                <Text style={styles.orderCount}>{item.orderCount}</Text>
                <Text style={styles.ordersLabel}>orders</Text>
                <Text style={styles.spent}>{fmtRs(item.totalSpent)}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No customers found.</Text>
          }
        />
      )}

      {/* Customer Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          onPress={() => setModalVisible(false)}
        />
        <View style={styles.modalSheet}>
          <View style={styles.handle} />
          {detailLoading ? (
            <ActivityIndicator color={colors.blue} style={{ margin: spacing.xxl }} />
          ) : selected ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
              {/* Header */}
              <View style={styles.sheetHeader}>
                <View style={styles.sheetAvatar}>
                  <Text style={styles.sheetAvatarText}>
                    {selected.storeName?.charAt(0)?.toUpperCase() ?? "?"}
                  </Text>
                </View>
                <View style={styles.sheetInfo}>
                  <Text style={styles.sheetStoreName}>{selected.storeName}</Text>
                  <Text style={styles.sheetOwner}>{selected.name}</Text>
                  <Text style={styles.sheetPhone}>{selected.phone} · {selected.district}</Text>
                </View>
              </View>

              {/* Stats */}
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxVal}>{selected.orderCount}</Text>
                  <Text style={styles.statBoxLabel}>orders</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxVal}>{fmtRs(selected.totalSpent)}</Text>
                  <Text style={styles.statBoxLabel}>total spent</Text>
                </View>
              </View>

              {/* Credit bar */}
              {selected.creditLimit ? (
                <View style={styles.creditSection}>
                  <Text style={styles.sheetSectionTitle}>Credit</Text>
                  <CreditBar used={selected.creditUsed} limit={selected.creditLimit} />
                </View>
              ) : null}

              {/* Status */}
              {selected.status && (
                <View style={styles.statusRow}>
                  <Text style={styles.sheetSectionTitle}>Account status</Text>
                  <StatusBadge status={selected.status} />
                </View>
              )}

              {/* Notes */}
              {selected.notes && (
                <View style={styles.notesWrap}>
                  <Text style={styles.sheetSectionTitle}>Notes</Text>
                  <Text style={styles.notesText}>{selected.notes}</Text>
                </View>
              )}

              {/* Recent orders */}
              {selected.recentOrders?.length > 0 && (
                <View>
                  <Text style={styles.sheetSectionTitle}>Recent orders</Text>
                  {selected.recentOrders.map((o) => (
                    <View key={o.id} style={styles.recentOrderRow}>
                      <View>
                        <Text style={styles.recentOrderNum}>{o.orderNumber || `#${o.id}`}</Text>
                        <Text style={styles.recentOrderDate}>
                          {new Date(o.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={styles.recentOrderRight}>
                        <StatusBadge status={o.status} />
                        <Text style={styles.recentOrderAmt}>{fmtRs(o.totalAmount ?? o.total)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={{ height: spacing.xl }} />
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D1120" },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg + spacing.md,
    paddingBottom: spacing.sm,
  },
  searchWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  searchInput: {
    backgroundColor: "#161E35",
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.white,
  },
  loader: { marginTop: spacing.xxl },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: "#161E35",
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { color: colors.white, fontSize: 18, fontWeight: "700" },
  cardBody: { flex: 1 },
  storeName: { fontSize: 14, fontWeight: "700", color: colors.white },
  ownerName: { fontSize: 12, color: colors.gray400, marginTop: 2 },
  phone: { fontSize: 12, color: colors.gray600, marginTop: 1 },
  stats: { alignItems: "flex-end" },
  orderCount: { fontSize: 18, fontWeight: "700", color: colors.green },
  ordersLabel: { fontSize: 10, color: colors.gray400 },
  spent: { fontSize: 11, color: colors.gray400, marginTop: 2 },
  emptyText: { color: colors.gray400, textAlign: "center", paddingVertical: spacing.xxl },
  // Modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "82%",
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.gray200, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  sheetContent: { padding: spacing.lg, gap: spacing.lg },
  sheetHeader: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  sheetAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetAvatarText: { color: colors.white, fontSize: 24, fontWeight: "700" },
  sheetInfo: { flex: 1 },
  sheetStoreName: { fontSize: 18, fontWeight: "700", color: colors.ink },
  sheetOwner: { fontSize: 14, color: colors.gray600, marginTop: 2 },
  sheetPhone: { fontSize: 13, color: colors.gray400, marginTop: 2 },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.offWhite,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.xs,
  },
  statBoxVal: { fontSize: 18, fontWeight: "700", color: colors.blue },
  statBoxLabel: { fontSize: 11, color: colors.gray400 },
  creditSection: { gap: spacing.sm },
  sheetSectionTitle: { fontSize: 13, fontWeight: "700", color: colors.gray400, letterSpacing: 0.3 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  notesWrap: { gap: spacing.xs },
  notesText: { fontSize: 14, color: colors.gray600, lineHeight: 20 },
  recentOrderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  recentOrderNum: { fontSize: 13, fontWeight: "600", color: colors.ink },
  recentOrderDate: { fontSize: 11, color: colors.gray400, marginTop: 2 },
  recentOrderRight: { alignItems: "flex-end", gap: spacing.xs },
  recentOrderAmt: { fontSize: 13, fontWeight: "700", color: colors.blue },
});
