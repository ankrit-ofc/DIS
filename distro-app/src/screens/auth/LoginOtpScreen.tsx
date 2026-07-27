import { useState } from "react";
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { api } from "../../lib/api";
import { colors, spacing, typography } from "../../lib/theme";
import { AuthStackParamList } from "../../navigation/AuthStack";
import { AuthBrand, InputField, AuthError, s } from "./_shared";

type Props = { navigation: StackNavigationProp<AuthStackParamList, "LoginOtp"> };

// Matches the API's NEPAL_PHONE check — reject locally so a typo doesn't burn
// one of the server's rate-limited OTP sends.
const NEPAL_PHONE = /^9[6-8]\d{8}$/;

export function LoginOtpScreen({ navigation }: Props) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const btnScale = useSharedValue(1);
  const errorShake = useSharedValue(0);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));
  const errorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: errorShake.value }] }));

  const shake = () => {
    errorShake.value = withSequence(
      withTiming(-8, { duration: 60 }), withTiming(8, { duration: 60 }),
      withTiming(-6, { duration: 60 }), withTiming(6, { duration: 60 }),
      withTiming(0, { duration: 60 })
    );
  };

  const handleRequestOtp = async () => {
    const trimmed = phone.trim();
    if (!NEPAL_PHONE.test(trimmed)) {
      setError("Enter a valid 10-digit Nepal mobile number.");
      shake();
      return;
    }
    setError("");
    setLoading(true);
    btnScale.value = withSpring(0.97, { damping: 20, stiffness: 300 });
    try {
      const res = await api.post("/auth/request-otp", { phone: trimmed });
      btnScale.value = withSpring(1);
      navigation.navigate("OTP", {
        phone: trimmed,
        channel: res.data?.channel === "email" ? "email" : "sms",
        maskedTo: res.data?.maskedTo,
      });
    } catch (err: any) {
      setError(
        err?.message === "otp_delivery_failed"
          ? "We couldn't send your code right now. Please try again."
          : err?.message ?? "Failed to send code."
      );
      btnScale.value = withSpring(1);
      shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingTop: spacing.lg }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={colors.white} />
            <Text style={{ fontSize: 15, fontFamily: typography.bodySemiBold, color: colors.white }}>
              Back
            </Text>
          </TouchableOpacity>

          <AuthBrand subtitle="Sign in without a password" />

          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Login with OTP</Text>
              <Text style={s.cardSubtitle}>
                We'll text a 6-digit code to your registered mobile number.
              </Text>
            </View>
            <InputField
              label="Mobile number"
              value={phone}
              onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))}
              placeholder="98XXXXXXXX"
              keyboardType="phone-pad"
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={handleRequestOtp}
              autoFocus
            />
            <AuthError message={error} animStyle={errorStyle} />
            <Animated.View style={btnStyle}>
              <TouchableOpacity
                style={[s.btn, loading && s.btnLoading]}
                onPress={handleRequestOtp}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading ? (
                  <View style={s.loadingRow}>
                    <View style={s.loadingDot} />
                    <View style={[s.loadingDot, s.loadingDotMid]} />
                    <View style={[s.loadingDot, s.loadingDotFaint]} />
                  </View>
                ) : (
                  <Text style={s.btnText}>Send code →</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>

          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or</Text>
            <View style={s.dividerLine} />
          </View>
          <TouchableOpacity style={s.linkRow} onPress={() => navigation.navigate("Login")} activeOpacity={0.75}>
            <Text style={s.linkText}>Have a password? </Text>
            <Text style={s.linkBold}>Sign in →</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
