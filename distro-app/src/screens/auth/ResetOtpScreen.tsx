import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { api } from "../../lib/api";
import { colors, spacing, radius, typography } from "../../lib/theme";
import { AuthStackParamList } from "../../navigation/AuthStack";
import { AuthScreenContainer } from "../../components/AuthScreenContainer";

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, "ResetOtp">;
  route: RouteProp<AuthStackParamList, "ResetOtp">;
};

const OTP_LENGTH = 6;

export function ResetOtpScreen({ navigation, route }: Props) {
  const { email } = route.params;
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [resending, setResending] = useState(false);
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleDigit = (text: string, idx: number) => {
    const digit = text.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    if (digit && idx < OTP_LENGTH - 1) inputs.current[idx + 1]?.focus();
  };

  const handleKeyPress = (key: string, idx: number) => {
    if (key === "Backspace" && !digits[idx] && idx > 0) inputs.current[idx - 1]?.focus();
  };

  const handleVerify = async () => {
    const code = digits.join("");
    if (code.length < OTP_LENGTH) {
      setError("Enter all 6 digits.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/verify-reset-code", { email, code });
      navigation.navigate("NewPassword", { resetToken: res.data.resetToken });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setCountdown(60);
      setDigits(Array(OTP_LENGTH).fill(""));
      setError("");
      inputs.current[0]?.focus();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthScreenContainer contentContainerStyle={{ padding: spacing.lg }}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: spacing.xl }}>
        <Text style={st.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={st.title}>Enter the code</Text>
      <Text style={st.subtitle}>
        We sent a 6-digit code to{"\n"}
        <Text style={st.emailText}>{email}</Text>
      </Text>

      <View style={st.otpRow}>
        {digits.map((digit, idx) => (
          <TextInput
            key={idx}
            ref={(el) => { inputs.current[idx] = el; }}
            style={[st.otpBox, digit ? st.otpBoxFilled : null]}
            value={digit}
            onChangeText={(t) => handleDigit(t, idx)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, idx)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            caretHidden
          />
        ))}
      </View>

      {!!error && <Text style={st.error}>{error}</Text>}

      <TouchableOpacity
        style={[st.btn, loading && { opacity: 0.7 }]}
        onPress={handleVerify}
        disabled={loading}
        activeOpacity={0.88}
      >
        <Text style={st.btnText}>{loading ? "Verifying…" : "Verify"}</Text>
      </TouchableOpacity>

      <View style={st.resendRow}>
        {countdown > 0 ? (
          <Text style={st.countdownText}>
            Resend in <Text style={st.countdownNum}>{countdown}s</Text>
          </Text>
        ) : (
          <TouchableOpacity onPress={handleResend} disabled={resending}>
            <Text style={st.resendText}>{resending ? "Sending…" : "Resend code"}</Text>
          </TouchableOpacity>
        )}
      </View>
    </AuthScreenContainer>
  );
}

const st = StyleSheet.create({
  backText:  { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontFamily: typography.bodySemiBold },
  title:     { fontSize: 26, fontFamily: typography.heading, color: colors.white, marginBottom: spacing.xs },
  subtitle:  { fontSize: 15, fontFamily: typography.body, color: 'rgba(255,255,255,0.75)', marginBottom: spacing.xl, lineHeight: 22 },
  emailText: { color: colors.white, fontFamily: typography.bodySemiBold },
  otpRow:    { flexDirection: "row", gap: spacing.sm, justifyContent: "center", marginBottom: spacing.lg },
  otpBox: {
    width: 46, height: 56, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: radius.md, textAlign: "center", fontSize: 22,
    fontFamily: typography.heading, color: colors.ink, backgroundColor: '#FFFFFF',
  },
  otpBoxFilled: { borderColor: colors.white, borderWidth: 2 },
  error:     { color: "#DC2626", fontSize: 13, backgroundColor: "#FEF2F2", borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.md, textAlign: "center", fontFamily: typography.body },
  btn:       { backgroundColor: '#FFFFFF', borderRadius: radius.lg, paddingVertical: 16, alignItems: "center" },
  btnText:   { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 16 },
  resendRow: { alignItems: "center", marginTop: spacing.lg },
  countdownText: { color: 'rgba(255,255,255,0.65)', fontFamily: typography.body, fontSize: 14 },
  countdownNum:  { fontFamily: typography.bodySemiBold, color: colors.white },
  resendText:    { color: colors.white, fontFamily: typography.bodySemiBold, fontSize: 14 },
});
