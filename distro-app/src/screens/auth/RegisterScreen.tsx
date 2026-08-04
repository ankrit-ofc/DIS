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
  // Set when an OTP login found no account for this number — start from it so
  // the shopkeeper doesn't retype the number they just entered.
  const prefillPhone = route.params?.prefillPhone;
  const [phone, setPhone] = useState(prefillPhone ?? "");
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
    // Phone-first: shopkeepers use their number daily and may have no working
    // email at all. Sending the phone here is also what lets the API's SMS-first
    // branch fire — with an email-only request it had no number to text.
    if (!/^9[6-8]\d{8}$/.test(phone.trim())) {
      setError("Enter a valid Nepal phone number (98XXXXXXXX).");
      shake();
      return;
    }
    setError("");
    setLoading(true);
    btnScale.value = withSpring(0.97, { damping: 20, stiffness: 300 });
    try {
      const res = await api.post("/auth/request-otp", { phone: phone.trim() });
      btnScale.value = withSpring(1);
      navigation.navigate("OTP", {
        phone: phone.trim(),
        channel: res.data?.channel === "sms" ? "sms" : "email",
        maskedTo: res.data?.maskedTo,
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
            <Text style={s.cardTitle}>Your phone number</Text>
            <Text style={s.cardSubtitle}>
              {prefillPhone
                ? `No DISTRO account found for ${prefillPhone}. Let's create one — we'll text you a code to verify this number.`
                : "We'll text you a 6-digit code to verify it."}
            </Text>
          </View>
          <InputField label="Phone number" value={phone} onChangeText={setPhone}
            placeholder="98XXXXXXXX" keyboardType="phone-pad" autoCapitalize="none" autoFocus />
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
