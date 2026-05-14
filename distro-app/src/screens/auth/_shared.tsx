import { useState } from "react";
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet, TextInput as TI } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate, Extrapolation,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography, shadow } from "../../lib/theme";

// ─── Brand header ─────────────────────────────────────────────────────────────
export function AuthBrand({ subtitle }: { subtitle: string }) {
  return (
    <View style={s.brand}>
      <Image
        source={require('../../../assets/logo-splash.png')}
        style={s.brandLogo}
        resizeMode="contain"
      />
      <Text style={s.brandSubtitle}>{subtitle}</Text>
    </View>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────
export function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={s.stepRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[s.stepDot, i + 1 === current && s.stepDotActive, i + 1 < current && s.stepDotDone]}
        />
      ))}
      <Text style={s.stepLabel}>Step {current} of {total}</Text>
    </View>
  );
}

// ─── Animated input field ─────────────────────────────────────────────────────
export function InputField({ label, value, onChangeText, placeholder, keyboardType,
  secureTextEntry, inputRef, autoCapitalize, maxLength, returnKeyType,
  onSubmitEditing, autoFocus }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; secureTextEntry?: boolean;
  inputRef?: React.Ref<TI>; autoCapitalize?: any; maxLength?: number;
  returnKeyType?: any; onSubmitEditing?: () => void; autoFocus?: boolean;
}) {
  const [showPw, setShowPw] = useState(false);
  const fp = useSharedValue(0);
  const boxStyle = useAnimatedStyle(() => ({
    borderColor: fp.value === 1 ? colors.blue : colors.gray200,
    borderWidth: interpolate(fp.value, [0, 1], [1.5, 2], Extrapolation.CLAMP),
    backgroundColor: fp.value === 1 ? colors.white : colors.gray50,
  }));
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Animated.View style={[s.fieldBox, boxStyle]}>
        <TextInput
          ref={inputRef} style={s.fieldInput} value={value} onChangeText={onChangeText}
          placeholder={placeholder} placeholderTextColor={colors.gray300}
          keyboardType={keyboardType} secureTextEntry={secureTextEntry && !showPw}
          autoCapitalize={autoCapitalize} maxLength={maxLength}
          returnKeyType={returnKeyType} onSubmitEditing={onSubmitEditing} autoFocus={autoFocus}
          onFocus={() => { fp.value = withTiming(1, { duration: 180 }); }}
          onBlur={() => { fp.value = withTiming(0, { duration: 180 }); }}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShowPw(v => !v)} style={s.eyeBtn}>
            <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={20} color={colors.gray400} />
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────
export function AuthError({ message, animStyle }: { message: string; animStyle: any }) {
  if (!message) return null;
  return (
    <Animated.View style={[s.errorWrap, animStyle]}>
      <Ionicons name="alert-circle-outline" size={15} color={colors.red} />
      <Text style={s.errorText}>{message}</Text>
    </Animated.View>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
export const s = StyleSheet.create({
  // Layout
  root:   { flex: 1, backgroundColor: '#155ac1' },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xl },
  card:   { backgroundColor: '#FFFFFF', borderRadius: radius.xl, paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, gap: spacing.md, ...shadow.card },
  fields: { gap: spacing.md },

  // Brand
  brand:        { alignItems: "center", gap: 8, marginBottom: spacing.xs },
  brandLogo:    { width: 230, height: 84 },
  brandSubtitle:{ fontSize: 14, fontFamily: typography.body, color: 'rgba(255,255,255,0.8)' },

  // Step indicator
  stepRow:     { flexDirection: "row", alignItems: "center", gap: 6 },
  stepDot:     { width: 28, height: 4, borderRadius: radius.full, backgroundColor: colors.gray200 },
  stepDotActive:{ backgroundColor: colors.blue, width: 40 },
  stepDotDone: { backgroundColor: colors.blue, opacity: 0.35 },
  stepLabel:   { fontSize: 12, fontFamily: typography.bodyMedium, color: colors.gray400, marginLeft: 4 },

  // Card header
  cardHeader:   { gap: 4, marginBottom: spacing.xs },
  cardTitle:    { fontSize: 20, fontFamily: typography.heading, color: colors.ink },
  cardSubtitle: { fontSize: 14, fontFamily: typography.body, color: colors.gray400 },

  // Input
  fieldWrap:  { gap: 8 },
  fieldLabel: { fontSize: 13, fontFamily: typography.bodySemiBold, color: colors.gray600, letterSpacing: 0.2, marginLeft: 2 },
  fieldBox:   { flexDirection: "row", alignItems: "center", borderRadius: radius.lg, overflow: "hidden" },
  fieldInput: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: 15, fontSize: 16, color: colors.ink, fontFamily: typography.body },
  eyeBtn:     { paddingRight: spacing.md, paddingLeft: spacing.sm },

  // Error
  errorWrap: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.redLight, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 10 },
  errorText: { fontSize: 13, color: colors.red, fontFamily: typography.bodyMedium, flex: 1 },

  // Button
  btn:        { backgroundColor: colors.blue, borderRadius: radius.lg, paddingVertical: 16, alignItems: "center", marginTop: spacing.xs },
  btnLoading: { opacity: 0.8 },
  btnText:    { color: colors.white, fontFamily: typography.bodySemiBold, fontSize: 16, letterSpacing: 0.3 },
  loadingRow: { flexDirection: "row", gap: 6, alignItems: "center", height: 22 },
  loadingDot:     { width: 7, height: 7, borderRadius: radius.full, backgroundColor: colors.white },
  loadingDotMid:  { opacity: 0.6 },
  loadingDotFaint:{ opacity: 0.3 },

  // Divider
  divider:     { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  dividerText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: typography.body },

  // Footer link row
  linkRow:  { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: spacing.sm },
  linkText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontFamily: typography.body },
  linkBold: { fontSize: 14, color: colors.white, fontFamily: typography.bodySemiBold },
});
