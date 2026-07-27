import { createStackNavigator } from "@react-navigation/stack";
import { SalesHomeScreen } from "../screens/sales/SalesHomeScreen";
import { NewBuyerScreen } from "../screens/sales/NewBuyerScreen";
import { PinLocationScreen } from "../screens/sales/PinLocationScreen";
import { SalesBuyer } from "../lib/sales";

/**
 * Field-rep navigator. Phase 2 adds shop registration and the GPS pin; the
 * remaining ported capabilities land here next (Phase 3: Catalogue/Checkout,
 * Phase 4: TodaysOrders/FindShop).
 */
export type SalesStackParamList = {
  SalesHome: undefined;
  NewBuyer: undefined;
  /** `buyer` is passed straight after creation; omitted when the rep picks one. */
  PinLocation: { buyer?: SalesBuyer } | undefined;
};

const Stack = createStackNavigator<SalesStackParamList>();

export function SalesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SalesHome" component={SalesHomeScreen} />
      <Stack.Screen name="NewBuyer" component={NewBuyerScreen} />
      <Stack.Screen name="PinLocation" component={PinLocationScreen} />
    </Stack.Navigator>
  );
}
