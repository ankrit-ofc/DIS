import "react-native-gesture-handler";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import * as Font from "expo-font";
import { setupNotifications } from "./src/lib/notifications";
import { ThemeProvider } from "./src/lib/ThemeContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { clearLegacyCart } from "./src/store/cartStore";

SplashScreen.preventAutoHideAsync();

async function loadFonts() {
  try {
    // Dynamically require so the app still boots if npm install hasn't been run yet
    const spaceGrotesk = require("@expo-google-fonts/space-grotesk");
    const jakartaSans = require("@expo-google-fonts/plus-jakarta-sans");
    await Font.loadAsync({
      SpaceGrotesk_400Regular: spaceGrotesk.SpaceGrotesk_400Regular,
      SpaceGrotesk_500Medium: spaceGrotesk.SpaceGrotesk_500Medium,
      SpaceGrotesk_600SemiBold: spaceGrotesk.SpaceGrotesk_600SemiBold,
      SpaceGrotesk_700Bold: spaceGrotesk.SpaceGrotesk_700Bold,
      PlusJakartaSans_400Regular: jakartaSans.PlusJakartaSans_400Regular,
      PlusJakartaSans_500Medium: jakartaSans.PlusJakartaSans_500Medium,
      PlusJakartaSans_600SemiBold: jakartaSans.PlusJakartaSans_600SemiBold,
      PlusJakartaSans_700Bold: jakartaSans.PlusJakartaSans_700Bold,
    });
  } catch {
    // Fonts unavailable — app falls back to system fonts gracefully
  }
}

export default function App() {
  useEffect(() => {
    setupNotifications().catch(() => { });
    loadFonts();
    clearLegacyCart();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
