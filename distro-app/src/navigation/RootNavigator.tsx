import { useEffect, useState, useCallback } from "react";
import { NavigationContainer } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "../store/authStore";
import { AuthStack } from "./AuthStack";
import { BuyerTabs } from "./BuyerTabs";
import { AdminTabs } from "./AdminTabs";
import { OnboardingScreen } from "../screens/auth/OnboardingScreen";
import { SplashScreen } from "../screens/SplashScreen";

const ONBOARDING_KEY = "distro_onboarding_done";

type Phase = "loading" | "splash" | "onboarding" | "app";

export function RootNavigator() {
  const { isLoading, token, profile, loadToken } = useAuthStore();
  const [phase, setPhase] = useState<Phase>("loading");
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [authInitial, setAuthInitial] = useState<"Login" | "Register">("Login");

  useEffect(() => {
    (async () => {
      await loadToken();
      const done = await SecureStore.getItemAsync(ONBOARDING_KEY).catch(() => null);
      setOnboardingDone(done === "true");
      // Show JS splash first; SplashScreen hides the native splash after paint (avoids flash / wrong frame).
      setPhase("splash");
    })();
  }, []);

  const handleSplashFinish = useCallback(() => {
    if (!onboardingDone) {
      setPhase("onboarding");
    } else {
      setPhase("app");
    }
  }, [onboardingDone]);

  const markOnboardingDone = useCallback(async () => {
    await SecureStore.setItemAsync(ONBOARDING_KEY, "true").catch(() => {});
  }, []);

  const handleOnboardingDone = useCallback(async () => {
    await markOnboardingDone();
    setPhase("app");
  }, []);

  const handleOnboardingSignIn = useCallback(async () => {
    await markOnboardingDone();
    setAuthInitial("Login");
    setPhase("app");
  }, []);

  const handleOnboardingCreateAccount = useCallback(async () => {
    await markOnboardingDone();
    setAuthInitial("Register");
    setPhase("app");
  }, []);

  if (phase === "loading") return null;

  if (phase === "splash") {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (phase === "onboarding") {
    return (
      <OnboardingScreen
        onDone={handleOnboardingDone}
        onSignIn={handleOnboardingSignIn}
        onCreateAccount={handleOnboardingCreateAccount}
      />
    );
  }

  // Phase: app
  const getNavigator = () => {
    if (!token) return <AuthStack initialScreen={authInitial} />;
    if (profile?.role === "ADMIN") return <AdminTabs />;
    return <BuyerTabs />;
  };

  return (
    <NavigationContainer>{getNavigator()}</NavigationContainer>
  );
}
