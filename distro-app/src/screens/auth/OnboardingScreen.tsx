import { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colors, spacing, radius, typography } from "../../lib/theme";

const { width: W } = Dimensions.get("window");

// ─── Illustrations ────────────────────────────────────────────────────────────

function IllustrationOrder() {
  return (
    <View style={[illus.box, { backgroundColor: "#EFF6FF" }]}>
      {/* Document */}
      <View style={illus.doc}>
        <View style={illus.docHeader} />
        {[80, 65, 50].map((w, i) => (
          <View key={i} style={[illus.docLine, { width: `${w}%` as any }]} />
        ))}
        {/* Checkmark badge */}
        <View style={illus.checkBadge}>
          <Text style={illus.checkText}>✓</Text>
        </View>
      </View>
    </View>
  );
}

function IllustrationPay() {
  return (
    <View style={[illus.box, { backgroundColor: "#D1FAE5" }]}>
      <View style={illus.shield}>
        <View style={illus.shieldInner}>
          <Text style={illus.shieldCheck}>✓</Text>
        </View>
      </View>
      {/* Payment pills */}
      <View style={illus.payRow}>
        {[
          { label: "eSewa", bg: "#00AA60" },
          { label: "COD", bg: colors.ink },
        ].map((p) => (
          <View key={p.label} style={[illus.payPill, { backgroundColor: p.bg }]}>
            <Text style={illus.payPillText}>{p.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function IllustrationTrack() {
  return (
    <View style={[illus.box, { backgroundColor: "#FEF3C7" }]}>
      {/* Location pin */}
      <View style={illus.pin}>
        <View style={illus.pinHead} />
        <View style={illus.pinTip} />
      </View>
      {/* Box below pin */}
      <View style={illus.orderBox}>
        <View style={illus.orderBoxLine1} />
        <View style={illus.orderBoxLine2} />
      </View>
    </View>
  );
}

const illus = StyleSheet.create({
  box: {
    width: 200,
    height: 200,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  // Order doc
  doc: {
    width: 110,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 14,
    gap: 8,
    position: "relative",
  },
  docHeader: {
    height: 10,
    width: "60%",
    backgroundColor: colors.blue,
    borderRadius: 3,
    marginBottom: 4,
  },
  docLine: {
    height: 7,
    backgroundColor: colors.gray200,
    borderRadius: 3,
  },
  checkBadge: {
    position: "absolute",
    top: -12,
    right: -12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
  // Shield
  shield: {
    width: 80,
    height: 90,
    borderRadius: 40,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  shieldInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  shieldCheck: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "700",
  },
  payRow: {
    flexDirection: "row",
    gap: 8,
  },
  payPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  payPillText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "600",
  },
  // Location pin
  pin: {
    alignItems: "center",
  },
  pinHead: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors.amber,
    borderWidth: 3,
    borderColor: colors.white,
  },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.amber,
    marginTop: -2,
  },
  // Order box
  orderBox: {
    width: 80,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.amber,
    padding: 10,
    gap: 6,
  },
  orderBoxLine1: {
    height: 8,
    backgroundColor: colors.amberLight,
    borderRadius: 3,
  },
  orderBoxLine2: {
    height: 8,
    width: "70%",
    backgroundColor: colors.amberLight,
    borderRadius: 3,
  },
});

// ─── Slide data ────────────────────────────────────────────────────────────────
const SLIDES = [
  {
    id: "order",
    Illustration: IllustrationOrder,
    step: "Step 1 of 3",
    title: "Order in bulk,\nthe easy way.",
    sub: "Browse wholesale products and place bulk orders for your shop in minutes.",
  },
  {
    id: "pay",
    Illustration: IllustrationPay,
    step: "Step 2 of 3",
    title: "Pay how you want.",
    sub: "Cash on Delivery available everywhere. eSewa & PhonePe coming soon.",
  },
  {
    id: "track",
    Illustration: IllustrationTrack,
    step: "Step 3 of 3",
    title: "Track every order,\nalways in control.",
    sub: "Real-time order tracking and delivery updates straight to your phone.",
  },
] as const;

// ─── Progress dot ──────────────────────────────────────────────────────────────
function ProgressDot({ active }: { active: boolean }) {
  const width = useSharedValue(active ? 18 : 6);
  const opacity = useSharedValue(active ? 1 : 0.35);

  width.value = withSpring(active ? 18 : 6, { damping: 18, stiffness: 200 });
  opacity.value = withTiming(active ? 1 : 0.35, { duration: 200 });

  const style = useAnimatedStyle(() => ({
    width: width.value,
    opacity: opacity.value,
  }));

  return <Animated.View style={[dotS.dot, style, active && dotS.dotActive]} />;
}

const dotS = StyleSheet.create({
  dot: { height: 6, borderRadius: 3, backgroundColor: colors.gray200 },
  dotActive: { backgroundColor: colors.blue },
});

// ─── Main screen ───────────────────────────────────────────────────────────────
interface OnboardingScreenProps {
  onDone: () => void;
  onSignIn?: () => void;
  onCreateAccount?: () => void;
}

export function OnboardingScreen({
  onDone,
  onSignIn,
  onCreateAccount,
}: OnboardingScreenProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const goNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
      setActiveIndex(activeIndex + 1);
    }
  };

  const goBack = () => {
    if (activeIndex > 0) {
      flatListRef.current?.scrollToIndex({ index: activeIndex - 1, animated: true });
      setActiveIndex(activeIndex - 1);
    }
  };

  const handleSignIn = () => {
    onSignIn ? onSignIn() : onDone();
  };

  const handleCreateAccount = () => {
    onCreateAccount ? onCreateAccount() : onDone();
  };

  const renderSlide = useCallback(
    ({ item, index }: { item: typeof SLIDES[number]; index: number }) => {
      const { Illustration, step, title, sub } = item;
      return (
        <View style={[slide.container, { width: W }]}>
          {/* Top half: illustration */}
          <View style={slide.illustrationArea}>
            <Illustration />
          </View>

          {/* Bottom half: text */}
          <View style={slide.textArea}>
            <View style={slide.stepPill}>
              <Text style={slide.stepText}>{step}</Text>
            </View>
            <Text style={slide.title}>{title}</Text>
            <Text style={slide.sub}>{sub}</Text>

            {/* Progress dots */}
            <View style={slide.dotsRow}>
              {SLIDES.map((_, i) => (
                <ProgressDot key={i} active={i === activeIndex} />
              ))}
            </View>

            {/* Buttons */}
            {index === 0 && (
              <>
                <TouchableOpacity
                  style={slide.btnPrimary}
                  onPress={goNext}
                  activeOpacity={0.88}
                >
                  <Text style={slide.btnPrimaryText}>Get started</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSignIn}
                  activeOpacity={0.75}
                  style={slide.linkBtn}
                >
                  <Text style={slide.linkText}>
                    Already have an account?{" "}
                    <Text style={slide.linkAccent}>Sign in</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {index === 1 && (
              <View style={slide.btnRow}>
                <TouchableOpacity
                  style={slide.btnOutline}
                  onPress={goBack}
                  activeOpacity={0.8}
                >
                  <Text style={slide.btnOutlineText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[slide.btnPrimary, { flex: 2 }]}
                  onPress={goNext}
                  activeOpacity={0.88}
                >
                  <Text style={slide.btnPrimaryText}>Next</Text>
                </TouchableOpacity>
              </View>
            )}

            {index === 2 && (
              <>
                <TouchableOpacity
                  style={[slide.btnPrimary, { backgroundColor: colors.ink }]}
                  onPress={handleCreateAccount}
                  activeOpacity={0.88}
                >
                  <Text style={slide.btnPrimaryText}>Create your account</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSignIn}
                  activeOpacity={0.75}
                  style={slide.linkBtn}
                >
                  <Text style={slide.linkText}>
                    Already registered?{" "}
                    <Text style={slide.linkAccent}>Sign in</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      );
    },
    [activeIndex]
  );

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right', 'bottom']}>
      <FlatList
        ref={flatListRef}
        data={SLIDES as unknown as typeof SLIDES[number][]}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        renderItem={renderSlide as any}
      />
    </SafeAreaView>
  );
}

const slide = StyleSheet.create({
  container: {
    flex: 1,
  },
  illustrationArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  textArea: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  stepPill: {
    backgroundColor: colors.blueLight,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  stepText: {
    fontSize: 11,
    fontFamily: typography.bodySemiBold,
    color: colors.blue,
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: typography.heading,
    color: colors.ink,
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: typography.body,
    color: colors.gray500,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  btnPrimary: {
    backgroundColor: colors.blue,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnPrimaryText: {
    color: colors.white,
    fontSize: 15,
    fontFamily: typography.bodySemiBold,
  },
  btnRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  btnOutline: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.gray200,
  },
  btnOutlineText: {
    fontSize: 15,
    fontFamily: typography.bodySemiBold,
    color: colors.gray600,
  },
  linkBtn: {
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  linkText: {
    fontSize: 13,
    fontFamily: typography.body,
    color: colors.gray400,
  },
  linkAccent: {
    fontFamily: typography.bodySemiBold,
    color: colors.blue,
  },
});

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
});
