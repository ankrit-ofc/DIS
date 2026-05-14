import { View, StyleSheet, Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { HomeScreen } from "../screens/buyer/HomeScreen";
import { CatalogueScreen } from "../screens/buyer/CatalogueScreen";
import { ProductScreen } from "../screens/buyer/ProductScreen";
import { CartScreen } from "../screens/buyer/CartScreen";
import { CheckoutScreen } from "../screens/buyer/CheckoutScreen";
import { OrderConfirmScreen } from "../screens/buyer/OrderConfirmScreen";
import { OrdersScreen } from "../screens/buyer/OrdersScreen";
import { OrderDetailScreen } from "../screens/buyer/OrderDetailScreen";
import { AccountScreen } from "../screens/buyer/AccountScreen";
import { ChatScreen } from "../screens/buyer/ChatScreen";
import { useCartStore } from "../store/cartStore";
import { api } from "../lib/api";
import { useEffect, useState } from "react";
import { colors, radius, typography } from "../lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Tab = createBottomTabNavigator();
const CatalogueStack = createStackNavigator();
const CartStack = createStackNavigator();
const OrdersStack = createStackNavigator();

function CatalogueNavigator() {
  return (
    <CatalogueStack.Navigator screenOptions={{ headerShown: false }}>
      <CatalogueStack.Screen name="CatalogueList" component={CatalogueScreen} />
      <CatalogueStack.Screen name="Product" component={ProductScreen} />
    </CatalogueStack.Navigator>
  );
}

function CartNavigator() {
  return (
    <CartStack.Navigator screenOptions={{ headerShown: false }}>
      <CartStack.Screen name="CartMain" component={CartScreen} />
      <CartStack.Screen name="Checkout" component={CheckoutScreen} />
      <CartStack.Screen name="OrderConfirm" component={OrderConfirmScreen} />
    </CartStack.Navigator>
  );
}

function OrdersNavigator() {
  return (
    <OrdersStack.Navigator screenOptions={{ headerShown: false }}>
      <OrdersStack.Screen name="OrdersList" component={OrdersScreen} />
      <OrdersStack.Screen name="OrderDetail" component={OrderDetailScreen} />
    </OrdersStack.Navigator>
  );
}

type TabIconConfig = {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  badge?: number;
};

function TabIcon({ name, icon, iconFocused, focused, badge }: TabIconConfig & { focused: boolean }) {
  const dotStyle = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0, { duration: 200 }),
    transform: [{ scale: withSpring(focused ? 1 : 0, { damping: 20, stiffness: 300 }) }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(focused ? 1.08 : 1, { damping: 20, stiffness: 300 }) },
    ],
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
      {!!badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      )}
      <Animated.View style={[styles.tabDot, dotStyle]} />
    </View>
  );
}

export function BuyerTabs() {
  const insets = useSafeAreaInsets();
  const totalItems = useCartStore((s) => s.totalItems());
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    api.get("/chat/history")
      .then((res) => {
        const conv = res.data.conversation;
        if (conv) setChatUnread(conv.unreadByBuyer ?? 0);
      })
      .catch(() => {});
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { height: 60 + (insets.bottom || 0), paddingBottom: 8 + (insets.bottom || 0) }],
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Home" icon="home-outline" iconFocused="home" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Catalogue"
        component={CatalogueNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Browse" icon="grid-outline" iconFocused="grid" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="Cart"
              icon="bag-outline"
              iconFocused="bag"
              focused={focused}
              badge={totalItems}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="Orders"
              icon="receipt-outline"
              iconFocused="receipt"
              focused={focused}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="Chat"
              icon="chatbubble-outline"
              iconFocused="chatbubble"
              focused={focused}
              badge={chatUnread}
            />
          ),
        }}
        listeners={{ focus: () => setChatUnread(0) }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Account" icon="person-outline" iconFocused="person" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.white,
    borderTopColor: "#E0E4F0",
    borderTopWidth: 0.5,
    height: 60,
    paddingBottom: 8,
    paddingTop: 4,
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
    color: "#9BA3BF",
    fontFamily: typography.bodyMedium,
    fontWeight: "500",
  },
  tabLabelActive: {
    color: "#2563EB",
    fontFamily: typography.bodySemiBold,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -2,
    backgroundColor: colors.blue,
    borderRadius: radius.full,
    minWidth: 17,
    height: 17,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  badgeText: {
    color: colors.white,
    fontSize: 9,
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
