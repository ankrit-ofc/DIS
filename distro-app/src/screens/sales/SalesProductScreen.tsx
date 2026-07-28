import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { ProductScreen } from "../buyer/ProductScreen";
import { SalesBuyerBanner } from "../../components/SalesBuyerBanner";
import { useSalesBuyerStore } from "../../store/salesBuyerStore";
import { colors } from "../../lib/theme";
import { SalesStackParamList } from "../../navigation/SalesStack";

type Props = {
  navigation: StackNavigationProp<SalesStackParamList, "SalesProduct">;
  route: RouteProp<SalesStackParamList, "SalesProduct">;
};

/**
 * The buyer product detail screen with the shop banner above it.
 *
 * ProductScreen itself is reused verbatim — it holds no buyer-only state — but
 * without the banner this was the one screen in the order flow where the rep
 * could add to the cart with nothing on screen saying which shop they were
 * ordering for.
 */
export function SalesProductScreen({ navigation, route }: Props) {
  const buyer = useSalesBuyerStore((s) => s.buyer);
  const clearBuyer = useSalesBuyerStore((s) => s.clearBuyer);

  // Same unwind as the catalogue and checkout: losing the shop drops the whole
  // order flow back to a clean picker.
  useEffect(() => {
    if (buyer) return;
    navigation.reset({ index: 1, routes: [{ name: "SalesHome" }, { name: "SelectBuyer" }] });
  }, [buyer, navigation]);

  if (!buyer) return null;

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <SalesBuyerBanner buyer={buyer} onDiscard={clearBuyer} />
      <View style={s.flex}>
        <ProductScreen navigation={navigation} route={route} embedded />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1A4BDB" },
  flex: { flex: 1, backgroundColor: colors.offWhite },
});
