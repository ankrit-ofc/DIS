import { createStackNavigator } from "@react-navigation/stack";
import { SalesHomeScreen } from "../screens/sales/SalesHomeScreen";
import { NewBuyerScreen } from "../screens/sales/NewBuyerScreen";
import { PinLocationScreen } from "../screens/sales/PinLocationScreen";
import { SelectBuyerScreen } from "../screens/sales/SelectBuyerScreen";
import { SalesCatalogueScreen } from "../screens/sales/SalesCatalogueScreen";
import { SalesCheckoutScreen } from "../screens/sales/SalesCheckoutScreen";
import { TodaysOrdersScreen } from "../screens/sales/TodaysOrdersScreen";
import { FindShopScreen } from "../screens/sales/FindShopScreen";
import { ProductScreen } from "../screens/buyer/ProductScreen";
import { SalesBuyer } from "../lib/sales";

/**
 * Field-rep navigator. Phase 2 added shop registration and the GPS pin,
 * Phase 3 the order-on-behalf flow (SelectBuyer → SalesCatalogue →
 * SalesCheckout), and Phase 4 the day's orders and the shop directory. The
 * web sales module is now fully ported.
 */
export type SalesStackParamList = {
  SalesHome: undefined;
  /** `selectOnCreate` continues into the catalogue for the shop just created. */
  NewBuyer: { selectOnCreate?: boolean; initialName?: string } | undefined;
  /** `buyer` is passed straight after creation; omitted when the rep picks one. */
  PinLocation: { buyer?: SalesBuyer } | undefined;
  SelectBuyer: undefined;
  SalesCatalogue: undefined;
  SalesCheckout: undefined;
  /** The buyer product detail screen, reused verbatim — it has no buyer-only state. */
  SalesProduct: { productId: string };
  TodaysOrders: undefined;
  FindShop: undefined;
};

const Stack = createStackNavigator<SalesStackParamList>();

export function SalesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SalesHome" component={SalesHomeScreen} />
      <Stack.Screen name="NewBuyer" component={NewBuyerScreen} />
      <Stack.Screen name="PinLocation" component={PinLocationScreen} />
      <Stack.Screen name="SelectBuyer" component={SelectBuyerScreen} />
      <Stack.Screen name="SalesCatalogue" component={SalesCatalogueScreen} />
      <Stack.Screen name="SalesCheckout" component={SalesCheckoutScreen} />
      <Stack.Screen name="SalesProduct" component={ProductScreen} />
      <Stack.Screen name="TodaysOrders" component={TodaysOrdersScreen} />
      <Stack.Screen name="FindShop" component={FindShopScreen} />
    </Stack.Navigator>
  );
}
