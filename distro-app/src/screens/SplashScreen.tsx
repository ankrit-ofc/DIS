import { View, StyleSheet, Platform } from "react-native";
import { useEffect, useLayoutEffect } from "react";
import * as ExpoSplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  SharedValue,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

/** Matches marketing mockup — full-bleed screen to device bezels */
const SPLASH_BLUE = "#2554F1";

// ─── Loading dot ──────────────────────────────────────────────────────────────
function LoadingDot({
  index,
  activeDot,
}: {
  index: number;
  activeDot: SharedValue<number>;
}) {
  const dotStyle = useAnimatedStyle(() => {
    const isActive = Math.round(activeDot.value) === index;
    return {
      opacity: withTiming(isActive ? 1 : 0.3, { duration: 150 }),
      transform: [{ scale: withSpring(isActive ? 1.3 : 1, { damping: 20, stiffness: 300 }) }],
    };
  });
  return <Animated.View style={[ld.dot, dotStyle]} />;
}

const ld = StyleSheet.create({
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
});

// ─── Splash screen ────────────────────────────────────────────────────────────
interface SplashScreenProps {
  onFinish: () => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const insets = useSafeAreaInsets();
  const logoScale = useSharedValue(0.6);
  const titleOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const dotsOpacity = useSharedValue(0);
  const activeDot = useSharedValue(0);

  useLayoutEffect(() => {
    ExpoSplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    // Logo box: scale 0.6 → 1.0 over 600ms spring
    logoScale.value = withSpring(1, { damping: 14, stiffness: 160, mass: 0.8 });

    // Title: fade in after 300ms over 400ms
    titleOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));

    // Tagline: fade in after 600ms over 400ms
    taglineOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));

    // Dots: appear after 800ms
    dotsOpacity.value = withDelay(800, withTiming(1, { duration: 300 }));

    // Active dot slides 0→1→2 in loop
    const dotTimer = setTimeout(() => {
      activeDot.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, { duration: 400 }),
          withTiming(2, { duration: 400 }),
        ),
        -1,
        false
      );
    }, 800);

    // Navigate after 2500ms
    const navTimer = setTimeout(() => {
      onFinish();
    }, 2500);

    return () => {
      clearTimeout(dotTimer);
      clearTimeout(navTimer);
    };
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  const dotsStyle = useAnimatedStyle(() => ({
    opacity: dotsOpacity.value,
  }));

  return (
    <View style={s.root}>
      <StatusBar style="light" backgroundColor={SPLASH_BLUE} translucent={Platform.OS === "android"} />
      <View
        style={[
          s.fill,
          {
            backgroundColor: SPLASH_BLUE,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        <View style={s.centerColumn}>
          <View style={s.center}>
            <Animated.View style={[s.logoRing, logoStyle]}>
              <Ionicons name="cube-outline" size={30} color="#fff" />
            </Animated.View>

            <Animated.Text style={[s.title, titleStyle]}>DISTRO</Animated.Text>

            <Animated.Text style={[s.tagline, taglineStyle]}>
              Wholesale, made simple
            </Animated.Text>
          </View>

          <Animated.View style={[s.dotsRow, dotsStyle]}>
            <LoadingDot index={0} activeDot={activeDot} />
            <LoadingDot index={1} activeDot={activeDot} />
            <LoadingDot index={2} activeDot={activeDot} />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SPLASH_BLUE,
  },
  fill: {
    flex: 1,
  },
  centerColumn: {
    flex: 1,
    justifyContent: "space-between",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  /** Thin white ring + cube — aligned to visible “screen” via safe area, blue to physical bezel */
  logoRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.95)",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 14,
    fontWeight: "400",
    color: "rgba(255,255,255,0.88)",
    marginTop: 4,
    letterSpacing: 0.2,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingBottom: Platform.OS === "ios" ? 8 : 12,
  },
});
