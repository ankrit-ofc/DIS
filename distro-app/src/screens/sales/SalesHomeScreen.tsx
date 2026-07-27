import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import { colors, spacing, radius, typography, shadow } from "../../lib/theme";

const BRAND_BLUE = "#1A4BDB";

/**
 * Placeholder rep home (Phase 1 — auth + routing only).
 *
 * The tiles below name the field-rep capabilities being ported from the web
 * sales module and are intentionally inert until their phase lands:
 *   Phase 2 — new buyer, location pin
 *   Phase 3 — catalogue, checkout on behalf
 *   Phase 4 — today's orders, buyer search
 */
type Tool = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

const TOOLS: Tool[] = [
  { icon: "person-add-outline", label: "New buyer" },
  { icon: "location-outline", label: "Pin shop location" },
  { icon: "grid-outline", label: "Catalogue" },
  { icon: "cart-outline", label: "Order for a shop" },
  { icon: "receipt-outline", label: "Today's orders" },
  { icon: "search-outline", label: "Find a shop" },
];

export function SalesHomeScreen() {
  const { profile, logout } = useAuthStore();

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
            Rep tools are rolling out to mobile. They're not active yet — use the web app
            at distronepal.com in the meantime.
          </Text>

          <View style={s.grid}>
            {TOOLS.map((tool) => (
              <View key={tool.label} style={s.tile}>
                <Ionicons name={tool.icon} size={22} color={colors.gray400} />
                <Text style={s.tileLabel}>{tool.label}</Text>
                <View style={s.soonPill}>
                  <Text style={s.soonText}>Soon</Text>
                </View>
              </View>
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

  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray100,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    gap: 6,
  },
  tileLabel: {
    fontSize: 13,
    color: colors.gray500,
    fontFamily: typography.bodyMedium,
    textAlign: "center",
  },
  soonPill: {
    backgroundColor: colors.gray200,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  soonText: {
    fontSize: 10,
    color: colors.gray600,
    fontFamily: typography.bodySemiBold,
    letterSpacing: 0.4,
  },

  logoutRow: { alignItems: "center", paddingVertical: spacing.xl },
  logoutText: { fontSize: 14, color: colors.red, fontFamily: typography.bodySemiBold },
});
