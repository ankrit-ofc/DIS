import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Alert,
} from "react-native";
import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { StatusBadge } from "../../components/StatusBadge";
import { colors, spacing, radius, shadow } from "../../lib/theme";
import { fmtRs } from "../../lib/format";
import { useCartStore } from "../../store/cartStore";

interface OrderDetail {
  id: number;
  orderNumber: string;
  status: string;
  total: number;
  totalAmount?: number;
  deliveryFee: number;
  paymentMethod: string;
  paymentStatus?: string;
  deliveryDistrict?: string;
  district?: string;
  deliveryAddress?: string;
  address?: string;
  createdAt: string;
  items: { name: string; productName?: string; qty: number; price: number; unitPrice?: number; total?: number; unit?: string }[];
}

const TIMELINE_STEPS = [
  { key: "PENDING",    label: "Pending" },
  { key: "CONFIRMED",  label: "Confirmed" },
  { key: "PROCESSING", label: "Processing" },
  { key: "SHIPPED",    label: "Shipped" },
  { key: "DELIVERED",  label: "Delivered" },
];

function Timeline({ status }: { status: string }) {
  const cancelled = status === "CANCELLED";
  const activeIdx = cancelled ? -1 : TIMELINE_STEPS.findIndex((s) => s.key === status);

  if (cancelled) {
    return (
      <View style={tl.cancelledWrap}>
        <Text style={tl.cancelledText}>This order was cancelled.</Text>
      </View>
    );
  }

  return (
    <View style={tl.container}>
      {TIMELINE_STEPS.map((step, idx) => {
        const done = idx < activeIdx;
        const active = idx === activeIdx;
        return (
          <View key={step.key} style={tl.stepOuter}>
            {idx > 0 && (
              <View style={[tl.connector, (done || active) && tl.connectorDone]} />
            )}
            <View style={[tl.dot, done && tl.dotDone, active && tl.dotActive]}>
              {done && <Text style={tl.dotCheck}>✓</Text>}
              {active && <View style={tl.dotInner} />}
            </View>
            <Text style={[tl.label, active && tl.labelActive, done && tl.labelDone]}>
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const tl = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  stepOuter: { alignItems: "center", flex: 1, position: "relative" },
  connector: {
    position: "absolute",
    top: 12,
    right: "50%",
    left: "-50%",
    height: 3,
    backgroundColor: colors.gray200,
    zIndex: 0,
  },
  connectorDone: { backgroundColor: colors.green },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.gray200,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  dotDone: { backgroundColor: colors.green },
  dotActive: { backgroundColor: colors.blue },
  dotCheck: { color: colors.white, fontSize: 13, fontWeight: "700" },
  dotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.white },
  label: { fontSize: 9, color: colors.gray400, marginTop: 4, textAlign: "center" },
  labelActive: { color: colors.blue, fontWeight: "700" },
  labelDone: { color: colors.green, fontWeight: "600" },
  cancelledWrap: {
    backgroundColor: "#FEF2F2",
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  cancelledText: { color: "#DC2626", fontWeight: "700", fontSize: 14 },
});

export function OrderDetailScreen({ navigation, route }: any) {
  const { orderId } = route.params;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [remainingMs, setRemainingMs] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const { addItem, updateQty } = useCartStore();

  const loadOrder = () => {
    return api.get(`/orders/${orderId}`)
      .then((res) => setOrder(res.data.order ?? res.data))
      .catch((err) => setError(err.message ?? "Failed to load order."));
  };

  useEffect(() => {
    loadOrder().finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (!order || order.status !== "PENDING") return;
    const deadline = new Date(order.createdAt).getTime() + 30 * 60 * 1000;
    const tick = () => setRemainingMs(Math.max(0, deadline - Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>;
  if (error || !order)
    return <View style={styles.center}><Text style={styles.errorText}>{error || "Order not found."}</Text></View>;

  const subtotal = order.items.reduce((s, i) => s + (i.unitPrice ?? i.price ?? 0) * i.qty, 0);
  const canCancel = order.status === "PENDING" && remainingMs > 0;
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);

  const handleDownloadInvoice = () => {
    const url = `${process.env.EXPO_PUBLIC_API_URL}/orders/${orderId}/invoice`;
    Linking.openURL(url).catch(() => {});
  };

  const handleCancel = () => {
    Alert.alert(
      "Cancel order",
      "Are you sure you want to cancel this order?",
      [
        { text: "Keep order", style: "cancel" },
        {
          text: "Cancel order",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.patch(`/orders/${orderId}/cancel`);
              await loadOrder();
              Alert.alert("Cancelled", "Your order has been cancelled.");
            } catch (err: any) {
              Alert.alert("Error", err?.response?.data?.error ?? "Could not cancel the order.");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReorder = async () => {
    setActionLoading(true);
    try {
      const res = await api.post(`/orders/${orderId}/reorder`);
      const items: Array<{ productId: string; name: string; price: number; qty: number; unit: string; imageUrl: string | null; available: boolean }> = res.data.items ?? [];
      let unavailable = 0;
      for (const it of items) {
        if (!it.available) { unavailable++; continue; }
        addItem({
          productId: it.productId,
          name: it.name,
          price: it.price,
          unit: it.unit,
          image: it.imageUrl ?? undefined,
        });
        updateQty(it.productId, it.qty);
      }
      Alert.alert(
        "Added to cart",
        unavailable > 0
          ? `Items added — ${unavailable} item(s) unavailable and skipped.`
          : "Items have been added to your cart.",
        [{ text: "View cart", onPress: () => navigation.navigate("Cart") }, { text: "OK" }]
      );
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error ?? "Reorder failed.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.topRow}>
        <Text style={styles.heading}>{order.orderNumber || `#${order.id}`}</Text>
        <StatusBadge status={order.status} size="md" />
      </View>
      <Text style={styles.date}>
        {new Date(order.createdAt).toLocaleString("en-NP", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>

      {/* Timeline */}
      <View style={[styles.card, shadow.sm]}>
        <Text style={styles.cardTitle}>Order status</Text>
        <Timeline status={order.status} />
      </View>

      {/* Items */}
      <View style={[styles.card, shadow.sm]}>
        <Text style={styles.cardTitle}>Items</Text>
        {order.items.map((item, idx) => {
          const unitPrice = item.unitPrice ?? item.price ?? 0;
          return (
            <View key={idx} style={styles.itemRow}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemName}>{item.productName ?? item.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.qty} × {fmtRs(unitPrice)}{item.unit ? ` / ${item.unit}` : ""}
                </Text>
              </View>
              <Text style={styles.itemTotal}>
                {fmtRs(unitPrice * item.qty)}
              </Text>
            </View>
          );
        })}
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryVal}>{fmtRs(subtotal)}</Text>
        </View>
        {order.deliveryFee > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery</Text>
            <Text style={styles.summaryVal}>{fmtRs(order.deliveryFee)}</Text>
          </View>
        )}
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalVal}>{fmtRs(order.totalAmount ?? order.total)}</Text>
        </View>
      </View>

      {/* Payment & delivery */}
      <View style={[styles.card, shadow.sm]}>
        <Text style={styles.cardTitle}>Delivery & payment</Text>
        {(order.deliveryDistrict ?? order.district) ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoVal}>{order.deliveryDistrict ?? order.district}</Text>
          </View>
        ) : null}
        {(order.deliveryAddress ?? order.address) ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address</Text>
            <Text style={styles.infoVal}>{order.deliveryAddress ?? order.address}</Text>
          </View>
        ) : null}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Payment</Text>
          <Text style={styles.infoVal}>{order.paymentMethod}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Payment status</Text>
          <Text style={styles.infoVal}>{order.paymentStatus ?? "Pending"}</Text>
        </View>
      </View>

      {canCancel && (
        <View style={[styles.card, shadow.sm]}>
          <Text style={styles.cancelHint}>
            You can cancel for {mins}:{secs.toString().padStart(2, "0")} more minutes
          </Text>
          <TouchableOpacity
            style={[styles.cancelBtn, actionLoading && styles.btnDisabled]}
            onPress={handleCancel}
            disabled={actionLoading}
            activeOpacity={0.85}
          >
            <Text style={styles.cancelBtnText}>Cancel Order</Text>
          </TouchableOpacity>
        </View>
      )}

      {order.status === "DELIVERED" && (
        <TouchableOpacity
          style={[styles.reorderBtn, actionLoading && styles.btnDisabled]}
          onPress={handleReorder}
          disabled={actionLoading}
          activeOpacity={0.85}
        >
          {actionLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.reorderBtnText}>Reorder</Text>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.invoiceBtn} onPress={handleDownloadInvoice} activeOpacity={0.85}>
        <Text style={styles.invoiceBtnText}>Download Invoice (PDF)</Text>
      </TouchableOpacity>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.offWhite },
  content: { padding: spacing.lg, paddingTop: 60, gap: spacing.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  backBtn: { marginBottom: spacing.xs },
  backText: { color: colors.blue, fontSize: 15, fontWeight: "600" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heading: { fontSize: 22, fontWeight: "700", color: colors.ink },
  date: { fontSize: 13, color: colors.gray400, marginTop: -spacing.xs },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.ink, marginBottom: spacing.xs },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  itemLeft: { flex: 1, gap: 2 },
  itemName: { fontSize: 13, fontWeight: "600", color: colors.ink },
  itemMeta: { fontSize: 12, color: colors.gray400 },
  itemTotal: { fontSize: 14, fontWeight: "700", color: colors.ink, marginLeft: spacing.sm },
  divider: { height: 1, backgroundColor: colors.gray200, marginVertical: spacing.xs },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 13, color: colors.gray600 },
  summaryVal: { fontSize: 13, fontWeight: "600", color: colors.ink },
  totalLabel: { fontSize: 15, fontWeight: "700", color: colors.ink },
  totalVal: { fontSize: 17, fontWeight: "700", color: colors.blue },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  infoLabel: { fontSize: 13, color: colors.gray400 },
  infoVal: { fontSize: 13, fontWeight: "600", color: colors.ink, flex: 1, textAlign: "right" },
  invoiceBtn: {
    backgroundColor: colors.blueLight,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.blue,
  },
  invoiceBtnText: { color: colors.blue, fontWeight: "700", fontSize: 14 },
  errorText: { color: "#DC2626", fontSize: 14 },
  cancelHint: { fontSize: 12, color: colors.gray600, textAlign: "center" },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: "#DC2626",
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#FEF2F2",
  },
  cancelBtnText: { color: "#DC2626", fontWeight: "700", fontSize: 14 },
  reorderBtn: {
    backgroundColor: colors.blue,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  reorderBtnText: { color: colors.white, fontWeight: "700", fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
});
