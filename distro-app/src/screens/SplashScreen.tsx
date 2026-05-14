import { View, Text, StyleSheet, Dimensions } from "react-native";
import { useEffect } from "react";
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

const { width: W, height: H } = Dimensions.get("window");

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
  const logoScale = useSharedValue(0.6);
  const titleOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const dotsOpacity = useSharedValue(0);
  const activeDot = useSharedValue(0);

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
    <View style={s.container}>
      {/* Concentric circles */}
      <View style={[s.circle, s.circleOuter]} />
      <View style={[s.circle, s.circleMiddle]} />
      <View style={[s.circle, s.circleInner]} />

      {/* Center content */}
      <View style={s.center}>
        {/* Logo box */}
        <Animated.View style={[s.logoBox, logoStyle]}>
          <Ionicons name="cube-outline" size={28} color="#fff" />
        </Animated.View>

        {/* DISTRO title */}
        <Animated.Text style={[s.title, titleStyle]}>DISTRO</Animated.Text>

        {/* Tagline */}
        <Animated.Text style={[s.tagline, taglineStyle]}>
          Wholesale, made simple.
        </Animated.Text>

        {/* Loading dots */}
        <Animated.View style={[s.dotsRow, dotsStyle]}>
          <LoadingDot index={0} activeDot={activeDot} />
          <LoadingDot index={1} activeDot={activeDot} />
          <LoadingDot index={2} activeDot={activeDot} />
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    position: "absolute",
    alignSelf: "center",
    borderRadius: 9999,
  },
  circleOuter: {
    width: 280,
    height: 280,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  circleMiddle: {
    width: 200,
    height: 200,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  circleInner: {
    width: 120,
    height: 120,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  center: {
    alignItems: "center",
    gap: 6,
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 3,
  },
  tagline: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    marginTop: 6,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 32,
  },
});
