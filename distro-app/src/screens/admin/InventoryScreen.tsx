import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/api";
import { colors, spacing, radius, shadow } from "../../lib/theme";
import { fmtRs } from "../../lib/format";

interface Product {
  id: number;
  name: string;
  stock: number;
  unit: string;
  price: number;
  categoryName?: string;
}
interface StockMovement {
  id: number;
  productName: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  qty: number;
  reason?: string;
  createdAt: string;
}

const ADJUSTMENT_TYPES = [
  { key: "IN", label: "Stock IN", color: colors.green },
  { key: "OUT", label: "Stock OUT", color: "#DC2626" },
  { key: "ADJUSTMENT", label: "Adjustment", color: "#D97706" },
];

function AdjustModal({
  product,
  visible,
  onClose,
  onDone,
}: {
  product: Product | null;
  visible: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [type, setType] = useState<"IN" | "OUT" | "ADJUSTMENT">("IN");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => { setType("IN"); setQty(""); setReason(""); setError(""); };

  const handleSubmit = async () => {
    const q = parseInt(qty, 10);
    if (!q || q <= 0) { setError("Enter a valid quantity."); return; }
    setError("");
    setLoading(true);
    try {
      await api.post("/admin/stock-movements", {
        productId: product?.id,
        type,
        qty: q,
        reason: reason.trim() || undefined,
      });
      reset();
      onDone();
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Adjustment failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.modalSheet}>
        <View style={styles.handle} />
        <Text style={styles.modalTitle}>Adjust stock</Text>
        {product && (
          <Text style={styles.modalProduct}>{product.name}</Text>
        )}
        <Text style={styles.inputLabel}>Type</Text>
        <View style={styles.typeRow}>
          {ADJUSTMENT_TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.typeBtn, type === t.key && { backgroundColor: t.color }]}
              onPress={() => setType(t.key as any)}
            >
              <Text style={[styles.typeBtnText, type === t.key && styles.typeBtnTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.inputLabel}>Quantity</Text>
        <TextInput
          style={styles.input}
          value={qty}
          onChangeText={setQty}
          placeholder="e.g. 50"
          keyboardType="numeric"
          placeholderTextColor={colors.gray400}
        />
        <Text style={styles.inputLabel}>Reason (optional)</Text>
        <TextInput
          style={[styles.input, { minHeight: 52 }]}
          value={reason}
          onChangeText={setReason}
          placeholder="Purchase receipt #, expiry removal…"
          multiline
          textAlignVertical="top"
          placeholderTextColor={colors.gray400}
        />
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitBtnText}>
            {loading ? "Saving…" : "Save adjustment"}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

export function InventoryScreen() {
  const [tab, setTab] = useState<"ALL" | "LOW">("ALL");
  const [movementsTab, setMovementsTab] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [showModal, setShowModal] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const params: Record<string, any> = { limit: 100 };
      if (tab === "LOW") params.lowStock = true;
      const res = await api.get("/products", { params });
      const list: Product[] = res.data.products ?? res.data ?? [];
      setProducts(tab === "LOW" ? list.filter((p) => p.stock <= 10) : list);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  const loadMovements = useCallback(async () => {
    try {
      const res = await api.get("/admin/stock-movements", { params: { limit: 30 } });
      setMovements(res.data.movements ?? res.data ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    if (movementsTab) loadMovements();
    else loadProducts();
  }, [tab, movementsTab]);

  const TYPE_COLORS: Record<string, string> = {
    IN: colors.green,
    OUT: "#DC2626",
    ADJUSTMENT: "#D97706",
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Inventory</Text>

      {/* View tabs */}
      <View style={styles.viewTabRow}>
        <TouchableOpacity
          style={[styles.viewTab, !movementsTab && styles.viewTabActive]}
          onPress={() => setMovementsTab(false)}
        >
          <Text style={[styles.viewTabText, !movementsTab && styles.viewTabTextActive]}>Stock</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewTab, movementsTab && styles.viewTabActive]}
          onPress={() => setMovementsTab(true)}
        >
          <Text style={[styles.viewTabText, movementsTab && styles.viewTabTextActive]}>Movements</Text>
        </TouchableOpacity>
      </View>

      {!movementsTab && (
        <View style={styles.filterRow}>
          {(["ALL", "LOW"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.filterTab, tab === t && styles.filterTabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.filterTabText, tab === t && styles.filterTabTextActive]}>
                {t === "ALL" ? "All products" : "Low stock"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.green} style={styles.loader} />
      ) : movementsTab ? (
        <FlatList
          data={movements}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMovements(); }} tintColor={colors.green} />
          }
          renderItem={({ item }) => (
            <View style={[styles.movementCard, shadow.sm]}>
              <View style={[styles.movDot, { backgroundColor: TYPE_COLORS[item.type] }]} />
              <View style={styles.movBody}>
                <Text style={styles.movProduct}>{item.productName}</Text>
                {item.reason && <Text style={styles.movReason}>{item.reason}</Text>}
                <Text style={styles.movDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.movQty, { color: TYPE_COLORS[item.type] }]}>
                {item.type === "IN" ? "+" : item.type === "OUT" ? "−" : "~"}{item.qty}
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No movements yet.</Text>}
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProducts(); }} tintColor={colors.green} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.productCard, shadow.sm]}
              onPress={() => { setAdjustProduct(item); setShowModal(true); }}
              activeOpacity={0.85}
            >
              <View style={styles.productLeft}>
                <Text style={styles.productName}>{item.name}</Text>
                {item.categoryName && <Text style={styles.productCat}>{item.categoryName}</Text>}
                <Text style={styles.productPrice}>{fmtRs(item.price)} / {item.unit}</Text>
              </View>
              <View style={[
                styles.stockBadge,
                { backgroundColor: item.stock <= 10 ? "#3A1A1A" : "#1A2A1A" },
              ]}>
                <Text style={[styles.stockQty, { color: item.stock <= 10 ? "#F87171" : colors.green }]}>
                  {item.stock}
                </Text>
                <Text style={styles.stockUnit}>{item.unit}s</Text>
                {item.stock <= 10 && <Text style={styles.lowLabel}>LOW</Text>}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No products.</Text>}
        />
      )}

      <AdjustModal
        product={adjustProduct}
        visible={showModal}
        onClose={() => setShowModal(false)}
        onDone={() => { setLoading(true); loadProducts(); }}
      />
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
  viewTabRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  viewTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: "#161E35",
    alignItems: "center",
  },
  viewTabActive: { backgroundColor: colors.blue },
  viewTabText: { fontSize: 13, color: colors.gray400, fontWeight: "600" },
  viewTabTextActive: { color: colors.white },
  filterRow: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.xs, marginBottom: spacing.sm },
  filterTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: "#161E35",
  },
  filterTabActive: { backgroundColor: colors.green },
  filterTabText: { fontSize: 12, color: colors.gray400, fontWeight: "600" },
  filterTabTextActive: { color: "#0D1120" },
  loader: { marginTop: spacing.xxl },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  productCard: {
    backgroundColor: "#161E35",
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productLeft: { flex: 1, gap: 2 },
  productName: { fontSize: 14, fontWeight: "600", color: colors.white },
  productCat: { fontSize: 11, color: colors.gray400 },
  productPrice: { fontSize: 12, color: colors.gray600 },
  stockBadge: {
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "center",
    minWidth: 56,
  },
  stockQty: { fontSize: 20, fontWeight: "700" },
  stockUnit: { fontSize: 10, color: colors.gray400 },
  lowLabel: { fontSize: 9, color: "#F87171", fontWeight: "700", marginTop: 2 },
  movementCard: {
    backgroundColor: "#161E35",
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  movDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  movBody: { flex: 1 },
  movProduct: { fontSize: 13, fontWeight: "600", color: colors.white },
  movReason: { fontSize: 12, color: colors.gray400, marginTop: 1 },
  movDate: { fontSize: 11, color: colors.gray600, marginTop: 1 },
  movQty: { fontSize: 18, fontWeight: "700" },
  emptyText: { color: colors.gray400, textAlign: "center", paddingVertical: spacing.xxl },
  // Modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.gray200, alignSelf: "center", marginBottom: spacing.sm },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  modalProduct: { fontSize: 14, color: colors.gray600, marginTop: -spacing.xs },
  inputLabel: { fontSize: 13, fontWeight: "600", color: colors.gray600 },
  typeRow: { flexDirection: "row", gap: spacing.sm },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.offWhite,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  typeBtnText: { fontSize: 12, color: colors.gray600, fontWeight: "600" },
  typeBtnTextActive: { color: colors.white },
  input: {
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.offWhite,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    backgroundColor: "#FEF2F2",
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  submitBtn: {
    backgroundColor: colors.blue,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  submitBtnText: { color: colors.white, fontWeight: "700", fontSize: 16 },
});
