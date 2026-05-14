import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { DashboardScreen } from "../screens/admin/DashboardScreen";
import { AdminOrdersScreen } from "../screens/admin/OrdersScreen";
import { InventoryScreen } from "../screens/admin/InventoryScreen";
import { LedgerScreen } from "../screens/admin/LedgerScreen";
import { CustomersScreen } from "../screens/admin/CustomersScreen";
import { colors, radius, typography } from "../lib/theme";

const Tab = createBottomTabNavigator();

function AdminTabIcon({
  name,
  icon,
  iconFocused,
  focused,
}: {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  focused: boolean;
}) {
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(focused ? 1.08 : 1, { damping: 20, stiffness: 300 }) },
    ],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0, { duration: 200 }),
    transform: [{ scale: withSpring(focused ? 1 : 0, { damping: 20, stiffness: 300 }) }],
  }));

  return (
    <View style={styles.tabIconWrap}>
      <Animated.View style={iconStyle}>
        <Ionicons
          name={focused ? iconFocused : icon}
          size={22}
          color={focused ? colors.blue : colors.gray400}
        />
      </Animated.View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
        {name}
      </Text>
      <Animated.View style={[styles.tabDot, dotStyle]} />
    </View>
  );
}

export function AdminTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { height: 60 + (insets.bottom || 0), paddingBottom: 8 + (insets.bottom || 0) }],
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <AdminTabIcon name="Dashboard" icon="stats-chart-outline" iconFocused="stats-chart" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="AdminOrders"
        component={AdminOrdersScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <AdminTabIcon name="Orders" icon="receipt-outline" iconFocused="receipt" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <AdminTabIcon name="Stock" icon="cube-outline" iconFocused="cube" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Ledger"
        component={LedgerScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <AdminTabIcon name="Ledger" icon="document-text-outline" iconFocused="document-text" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Customers"
        component={CustomersScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <AdminTabIcon name="Buyers" icon="people-outline" iconFocused="people" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.white,
    borderTopColor: colors.gray100,
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    position: "relative",
    minWidth: 52,
  },
  tabLabel: {
    fontSize: 10,
    color: colors.gray400,
    fontFamily: typography.bodyMedium,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: colors.blue,
    fontFamily: typography.bodySemiBold,
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.blue,
    position: "absolute",
    bottom: -6,
  },
});
