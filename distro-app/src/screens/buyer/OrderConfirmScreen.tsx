import { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  FadeInDown,
  FadeIn,
  interpolate,
  Extrapolation,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { notifyOrderConfirmed } from "../../lib/notifications";
import { colors, spacing, radius, shadow, typography } from "../../lib/theme";
import { fmtRs } from "../../lib/format";

const { width: W, height: H } = Dimensions.get("window");

// ─── Confetti particle ────────────────────────────────────────────────────────
interface ParticleConfig {
  x: number;
  delay: number;
  color: string;
  size: number;
  duration: number;
}

function ConfettiParticle({ config }: { config: ParticleConfig }) {
  const y = useSharedValue(-20);
  const opacity = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      y.value = withTiming(H * 0.7, { duration: config.duration, easing: Easing.out(Easing.quad) });
      opacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withDelay(config.duration - 400, withTiming(0, { duration: 400 }))
      );
      rotation.value = withTiming(config.duration / 100, { duration: config.duration });
    }, config.delay);
    return () => clearTimeout(timer);
  }, []);

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: config.x,
    top: 0,
    width: config.size,
    height: config.size * 0.5,
    borderRadius: config.size * 0.1,
    backgroundColor: config.color,
    opacity: opacity.value,
    transform: [
      { translateY: y.value },
      { rotate: `${rotation.value * 10}deg` },
    ],
  }));

  return <Animated.View style={style} />;
}

const PARTICLE_COLORS = [
  colors.blue, colors.green, colors.amber, "#7C3AED",
  "#DB2777", "#0284C7", "#059669", colors.bluePale,
];

function generateParticles(count: number): ParticleConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.random() * W,
    delay: Math.random() * 800,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    size: 8 + Math.random() * 10,
    duration: 1200 + Math.random() * 800,
  }));
}

// ─── Check circle ─────────────────────────────────────────────────────────────
function CheckCircle() {
  const scale = useSharedValue(0);
  const innerScale = useSharedValue(0);
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 140 });
    innerScale.value = withDelay(200, withSpring(1, { damping: 14, stiffness: 120 }));

    // Ripple ring
    setTimeout(() => {
      ringScale.value = withTiming(2.2, { duration: 700, easing: Easing.out(Easing.cubic) });
      ringOpacity.value = withTiming(0, { duration: 700 });
    }, 300);
  }, []);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
    opacity: innerScale.value,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  return (
    <View style={check.wrap}>
      {/* Ripple ring */}
      <Animated.View style={[check.ring, ringStyle]} />
      {/* Circle */}
      <Animated.View style={[check.circle, circleStyle]}>
        <Animated.View style={checkStyle}>
          <Ionicons name="checkmark" size={44} color={colors.white} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const check = StyleSheet.create({
  wrap: { width: 120, height: 120, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: colors.green,
  },
  circle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.lg,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export function OrderConfirmScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { orderId, orderNumber, totalAmount, estimatedDays } = route.params ?? {};
  const displayNumber = orderNumber ?? `ORD-${orderId}`;
  const particles = useRef(generateParticles(24)).current;

  useEffect(() => {
    notifyOrderConfirmed(displayNumber).catch(() => {});
  }, []);

  const infoRows = [
    { icon: "receipt-outline" as const, label: "Order number", value: displayNumber },
    { icon: "time-outline" as const, label: "Estimated delivery", value: estimatedDays ? `${estimatedDays}–${estimatedDays + 1} business days` : "2–4 business days" },
    { icon: "notifications-outline" as const, label: "Updates via", value: "SMS to your registered number" },
  ];

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Confetti */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {particles.map((p, i) => (
          <ConfettiParticle key={i} config={p} />
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Check animation */}
        <View style={styles.checkWrap}>
          <CheckCircle />
        </View>

        <Animated.View entering={FadeInDown.delay(400).springify().damping(18)} style={styles.textBlock}>
          <Text style={styles.title}>Order placed!</Text>
          <Text style={styles.subtitle}>
            Your order is confirmed and will be processed shortly.
          </Text>
        </Animated.View>

        {/* Info card */}
        <Animated.View entering={FadeInDown.delay(550).springify().damping(18)} style={[styles.infoCard, shadow.sm]}>
          {infoRows.map((row, i) => (
            <View key={i} style={[styles.infoRow, i > 0 && styles.infoRowDivider]}>
              <View style={styles.infoIconWrap}>
                <Ionicons name={row.icon} size={16} color={colors.blue} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Amount summary */}
        {totalAmount && (
          <Animated.View entering={FadeInDown.delay(680).springify().damping(18)} style={styles.amountRow}>
            <Text style={styles.amountLabel}>Order total</Text>
            <Text style={styles.amountValue}>{fmtRs(Number(totalAmount))}</Text>
          </Animated.View>
        )}
      </View>

      {/* CTA */}
      <Animated.View entering={FadeInDown.delay(800).springify().damping(18)} style={[styles.ctas, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate("Orders")}
          activeOpacity={0.88}
        >
          <Ionicons name="receipt-outline" size={18} color={colors.white} />
          <Text style={styles.primaryBtnText}>Track my order</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => {
            // Pop back to catalogue
            navigation.navigate("Catalogue");
          }}
        >
          <Text style={styles.secondaryBtnText}>Continue shopping</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  checkWrap: { marginBottom: spacing.sm },
  textBlock: { alignItems: "center", gap: spacing.sm },
  title: {
    fontSize: 32,
    fontFamily: typography.heading,
    color: colors.ink,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray500,
    fontFamily: typography.body,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 300,
  },
  infoCard: {
    width: "100%",
    backgroundColor: colors.offWhite,
    borderRadius: radius.xl,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    gap: spacing.md,
  },
  infoRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.blueLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  infoText: { flex: 1, gap: 2 },
  infoLabel: { fontSize: 11, color: colors.gray400, fontFamily: typography.bodyMedium, letterSpacing: 0.2 },
  infoValue: { fontSize: 14, color: colors.ink, fontFamily: typography.bodySemiBold },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.blueLight,
    borderRadius: radius.lg,
  },
  amountLabel: { fontSize: 14, color: colors.blue, fontFamily: typography.bodyMedium },
  amountValue: { fontSize: 22, color: colors.blue, fontFamily: typography.heading },
  ctas: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.blue,
    borderRadius: radius.lg,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  primaryBtnText: {
    color: colors.white,
    fontFamily: typography.bodySemiBold,
    fontSize: 16,
  },
  secondaryBtn: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: colors.gray500,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
  },
});
