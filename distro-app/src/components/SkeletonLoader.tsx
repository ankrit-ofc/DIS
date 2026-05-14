import { useEffect } from "react";
import { View, ViewStyle, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import { colors, radius, spacing } from "../lib/theme";

const { width: W } = Dimensions.get("window");
const CARD_W = (W - spacing.lg * 2 - spacing.sm) / 2;

interface SkeletonLoaderProps {
  width?: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonLoader({
  width = "100%",
  height,
  borderRadius = 8,
  style,
}: SkeletonLoaderProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 900 }),
        withTiming(0.3, { duration: 900 })
      ),
      -1,
      false
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.gray200,
        },
        animStyle,
        style,
      ]}
    />
  );
}

export function SkeletonProductCard() {
  return (
    <View style={sk.card}>
      <SkeletonLoader height={CARD_W * 0.6} borderRadius={radius.md} />
      <View style={sk.cardBody}>
        <SkeletonLoader height={8} width="50%" borderRadius={4} />
        <SkeletonLoader height={12} width="90%" borderRadius={4} />
        <SkeletonLoader height={12} width="70%" borderRadius={4} />
        <SkeletonLoader height={16} width="55%" borderRadius={4} />
      </View>
    </View>
  );
}

export function SkeletonCategoryChip() {
  return (
    <View style={{ alignItems: "center", gap: 8, width: 72 }}>
      <SkeletonLoader width={60} height={60} borderRadius={30} />
      <SkeletonLoader width={40} height={10} borderRadius={4} />
    </View>
  );
}

const sk = StyleSheet.create({
  card: {
    width: CARD_W,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  cardBody: {
    padding: 10,
    gap: 6,
  },
});
