import { useState } from "react";
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { SCREEN_EDGES, keyboardBehavior } from "../../lib/screen";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { api } from "../../lib/api";
import { spacing } from "../../lib/theme";
import { AuthStackParamList } from "../../navigation/AuthStack";
import { AuthBrand, StepIndicator, InputField, AuthError, s } from "./_shared";

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, "Register">;
  route: RouteProp<AuthStackParamList, "Register">;
};

export function RegisterScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  // Set when an OTP login found no account for this number — carried to step 2.
  const prefillPhone = route.params?.prefillPhone;
  const [email, setEmail] = useState("");
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

  const handleRequestOTP = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      shake();
      return;
    }
    setError("");
    setLoading(true);
    btnScale.value = withSpring(0.97, { damping: 20, stiffness: 300 });
    try {
      const res = await api.post("/auth/request-otp", { email });
      btnScale.value = withSpring(1);
      navigation.navigate("OTP", {
        email,
        channel: res.data?.channel === "sms" ? "sms" : "email",
        maskedTo: res.data?.maskedTo,
        prefillPhone,
      });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? "Failed to send OTP.");
      btnScale.value = withSpring(1);
      shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={SCREEN_EDGES}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={keyboardBehavior}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: spacing.xxl, paddingBottom: insets.bottom + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthBrand subtitle="Create your wholesale account" />

        <View style={s.card}>
          <StepIndicator current={1} total={2} />
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Email address</Text>
            <Text style={s.cardSubtitle}>
              {prefillPhone
                ? `No DISTRO account found for ${prefillPhone}. Add your email to create one — we'll send a code to verify it.`
                : "We'll send a one-time code to verify your email."}
            </Text>
          </View>
          <InputField label="Email address" value={email} onChangeText={setEmail}
            placeholder="yourshop@gmail.com" keyboardType="email-address" autoCapitalize="none" autoFocus />
          <AuthError message={error} animStyle={errorStyle} />
          <Animated.View style={btnStyle}>
            <TouchableOpacity style={[s.btn, loading && s.btnLoading]} onPress={handleRequestOTP}
              disabled={loading} activeOpacity={0.88}>
              {loading
                ? <View style={s.loadingRow}>
                    <View style={s.loadingDot} />
                    <View style={[s.loadingDot, s.loadingDotMid]} />
                    <View style={[s.loadingDot, s.loadingDotFaint]} />
                  </View>
                : <Text style={s.btnText}>Send verification code →</Text>}
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={s.divider}>
          <View style={s.dividerLine} /><Text style={s.dividerText}>or</Text><View style={s.dividerLine} />
        </View>
        <TouchableOpacity style={s.linkRow} onPress={() => navigation.navigate("Login")} activeOpacity={0.75}>
          <Text style={s.linkText}>Already have an account? </Text>
          <Text style={s.linkBold}>Sign in →</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
