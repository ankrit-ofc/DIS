import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { useAuthStore } from "../../store/authStore";
import { useSalesBuyerStore } from "../../store/salesBuyerStore";
import { buyerLabel } from "../../lib/sales";
import { colors, spacing, radius, typography, shadow } from "../../lib/theme";
import { SalesStackParamList } from "../../navigation/SalesStack";

const BRAND_BLUE = "#1A4BDB";

/**
 * Rep home. The tiles are the field-rep capabilities ported from the web sales
 * module — as of Phase 4 all six are live, so there is no longer an inert
 * "Soon" state.
 */
type Tool = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  screen: keyof SalesStackParamList;
  /**
   * Continue the order already in progress instead of opening `screen`, when a
   * shop is selected. Only "Catalogue" does this — "Order for a shop" always
   * starts from the picker so switching shops is one deliberate tap.
   */
  resumesOrder?: boolean;
};

const TOOLS: Tool[] = [
  { icon: "person-add-outline", label: "New buyer", screen: "NewBuyer" },
  { icon: "location-outline", label: "Pin shop location", screen: "PinLocation" },
  { icon: "grid-outline", label: "Catalogue", screen: "SelectBuyer", resumesOrder: true },
  { icon: "cart-outline", label: "Order for a shop", screen: "SelectBuyer" },
  { icon: "receipt-outline", label: "Today's orders", screen: "TodaysOrders" },
  { icon: "search-outline", label: "Find a shop", screen: "FindShop" },
];

type Props = { navigation: StackNavigationProp<SalesStackParamList, "SalesHome"> };

export function SalesHomeScreen({ navigation }: Props) {
  const { profile, logout } = useAuthStore();
  const selectedBuyer = useSalesBuyerStore((s) => s.buyer);

  const openTool = (tool: Tool) => {
    if (tool.resumesOrder && selectedBuyer) {
      navigation.navigate("SalesCatalogue");
      return;
    }
    navigation.navigate(tool.screen as any);
  };

  const handleLogout = () => {
    Alert.alert("Log out", "Sign out of your rep account?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => void logout() },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View style={s.headerRow}>
            <View style={s.flex}>
              <Text style={s.eyebrow}>DISTRO · Field sales</Text>
              <Text style={s.name} numberOfLines={1}>
                {profile?.ownerName || profile?.storeName || "Sales rep"}
              </Text>
              <Text style={s.phone}>{profile?.phone}</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={s.logoutBtn} hitSlop={8} activeOpacity={0.8}>
              <Ionicons name="log-out-outline" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Field tools</Text>
          <Text style={s.cardSubtitle}>
            Register a shop, pin its location, place orders on a shop's behalf, and
            check the day's round — all from here.
          </Text>

          {selectedBuyer && (
            <TouchableOpacity
              style={s.resumeRow}
              onPress={() => navigation.navigate("SalesCatalogue")}
              activeOpacity={0.85}
            >
              <Ionicons name="cart-outline" size={16} color={BRAND_BLUE} />
              <Text style={s.resumeText} numberOfLines={1}>
                Order in progress for {buyerLabel(selectedBuyer)}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={BRAND_BLUE} />
            </TouchableOpacity>
          )}

          <View style={s.grid}>
            {TOOLS.map((tool) => (
              <TouchableOpacity
                key={tool.label}
                style={s.tile}
                onPress={() => openTool(tool)}
                activeOpacity={0.85}
              >
                <Ionicons name={tool.icon} size={22} color={BRAND_BLUE} />
                <Text style={s.tileLabel}>{tool.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={s.logoutRow} onPress={handleLogout} activeOpacity={0.75}>
          <Text style={s.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND_BLUE },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, backgroundColor: colors.offWhite, paddingBottom: spacing.xl },

  header: {
    backgroundColor: BRAND_BLUE,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  eyebrow: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    fontFamily: typography.body,
    letterSpacing: 0.5,
  },
  name: { fontSize: 24, color: colors.white, fontFamily: typography.heading, marginTop: 2 },
  phone: { fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: typography.body, marginTop: 2 },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.xl,
    marginHorizontal: spacing.lg,
    marginTop: -spacing.xl,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadow.card,
  },
  cardTitle: { fontSize: 18, color: colors.ink, fontFamily: typography.heading },
  cardSubtitle: {
    fontSize: 13,
    color: colors.gray500,
    fontFamily: typography.body,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },

  resumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.blueLight,
    borderWidth: 1,
    borderColor: BRAND_BLUE,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.sm,
  },
  resumeText: { flex: 1, fontSize: 13, color: BRAND_BLUE, fontFamily: typography.bodySemiBold },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: BRAND_BLUE,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    gap: 6,
  },
  tileLabel: {
    fontSize: 13,
    color: colors.ink,
    fontFamily: typography.bodySemiBold,
    textAlign: "center",
  },

  logoutRow: { alignItems: "center", paddingVertical: spacing.xl },
  logoutText: { fontSize: 14, color: colors.red, fontFamily: typography.bodySemiBold },
});
