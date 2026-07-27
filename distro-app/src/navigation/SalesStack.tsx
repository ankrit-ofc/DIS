import { createStackNavigator } from "@react-navigation/stack";
import { SalesHomeScreen } from "../screens/sales/SalesHomeScreen";

/**
 * Field-rep navigator. Home only for now; the capabilities ported from the web
 * sales module land here as screens.
 */
export type SalesStackParamList = {
  SalesHome: undefined;
};

const Stack = createStackNavigator<SalesStackParamList>();

export function SalesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SalesHome" component={SalesHomeScreen} />
    </Stack.Navigator>
  );
}
