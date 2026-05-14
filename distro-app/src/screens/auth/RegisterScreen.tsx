import { useState } from "react";
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { StackNavigationProp } from "@react-navigation/stack";
import { api } from "../../lib/api";
import { spacing } from "../../lib/theme";
import { AuthStackParamList } from "../../navigation/AuthStack";
import { AuthBrand, StepIndicator, InputField, AuthError, s } from "./_shared";

type Props = { navigation: StackNavigationProp<AuthStackParamList, "Register"> };

export function RegisterScreen({ navigation }: Props) {
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
      await api.post("/auth/request-otp", { email });
      btnScale.value = withSpring(1);
      navigation.navigate("OTP", { email });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? "Failed to send OTP.");
      btnScale.value = withSpring(1);
      shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthBrand subtitle="Create your wholesale account" />

        <View style={s.card}>
          <StepIndicator current={1} total={2} />
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Email address</Text>
            <Text style={s.cardSubtitle}>We'll send a one-time code to verify your email.</Text>
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
