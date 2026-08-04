import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, Image, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { SCREEN_EDGES, keyboardBehavior } from "../../lib/screen";
import { api } from "../../lib/api";
import { acceptMobileSession } from "../../lib/session";
import { colors, spacing, radius, typography } from "../../lib/theme";
import { AuthStackParamList } from "../../navigation/AuthStack";

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, "OTP">;
  route: RouteProp<AuthStackParamList, "OTP">;
};

const OTP_LENGTH = 6;

export function OTPScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { email, phone } = route.params;
  // Phone identifies the passwordless login flow; email the registration flow.
  const identifier = phone ? { phone } : { email: email! };
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [resending, setResending] = useState(false);
  const [channel, setChannel] = useState<"sms" | "email">(
    route.params.channel ?? (phone ? "sms" : "email"),
  );
  const [maskedTo, setMaskedTo] = useState<string | undefined>(route.params.maskedTo);
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
    const otp = digits.join("");
    if (otp.length < OTP_LENGTH) { setError("Enter all 6 digits."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/verify-otp", { ...identifier, otp });

      // An ACTIVE profile gets a session back — OTP doubles as passwordless
      // login. This is the only way in for sales-created buyers (passwordHash '').
      if (res.data?.token) {
        const accepted = await acceptMobileSession(
          res.data.token,
          res.data.profile ?? res.data.user,
        );
        // Rejected role: the session is already revoked, stay put.
        if (!accepted) setDigits(Array(OTP_LENGTH).fill(""));
        return;
      }

      // Verified, no account yet → finish signing up. Registration is
      // phone-first, so the verified number IS the identifier and there is
      // nothing left to collect before the details step.
      const verifiedPhone = phone ?? route.params.prefillPhone;
      if (!verifiedPhone) {
        // Reached only by an email-identified OTP on a profile that never
        // completed registration (an abandoned signup from the old email-first
        // flow). /register needs a verified phone, so collect and verify one.
        navigation.navigate("Register");
        return;
      }
      navigation.navigate("RegisterStep2", { phone: verifiedPhone, email });
    } catch (err: any) {
      setError(err?.message ?? "Invalid OTP.");
    } finally {
      setLoading(false);
    }
  };

  // verify-otp resolves the same profile no matter which channel delivered the
  // code, so resending only has to repeat whichever identifier we started with.
  const requestOtp = async (forceChannel?: "email") => {
    setResending(true);
    try {
      const res = await api.post(
        "/auth/request-otp",
        forceChannel ? { ...identifier, forceChannel } : identifier,
      );
      setChannel(res.data?.channel === "sms" ? "sms" : "email");
      setMaskedTo(res.data?.maskedTo);
      setCountdown(60);
      setDigits(Array(OTP_LENGTH).fill(""));
      setError("");
      inputs.current[0]?.focus();
    } catch (err: any) {
      const raw = err?.response?.data?.error;
      setError(
        raw === "otp_delivery_failed" || err?.message === "otp_delivery_failed"
          ? "We couldn't deliver your code right now. Please try again."
          : raw ?? err.message ?? "Failed to resend OTP."
      );
    } finally {
      setResending(false);
    }
  };

  const handleResend = () => requestOtp();
  const handleResendViaEmail = () => requestOtp("email");

  return (
    <SafeAreaView style={st.root} edges={SCREEN_EDGES}>
      <KeyboardAvoidingView style={st.root} behavior={keyboardBehavior}>
        <View style={[st.container, { paddingBottom: insets.bottom }]}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()}>
          <Text style={st.backText}>← Back</Text>
        </TouchableOpacity>

        <Image
          source={require('../../../assets/logo-splash.png')}
          style={st.logo}
          resizeMode="contain"
        />

        <Text style={st.title}>{channel === "sms" ? "Verify your phone" : "Verify your email"}</Text>
        <Text style={st.subtitle}>
          {channel === "sms" ? "Enter the 6-digit code sent via SMS to" : "Enter the 6-digit code sent to"}{"\n"}
          <Text style={st.phone}>{maskedTo ?? phone ?? email}</Text>
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
          style={[st.btn, loading && st.btnDisabled]}
          onPress={handleVerify}
          disabled={loading}
          activeOpacity={0.88}
        >
          {loading
            ? <ActivityIndicator color={colors.blue} />
            : <Text style={st.btnText}>Verify & continue</Text>}
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
          {/* Phone-only profiles may have no email on file, so this fallback is
              offered only when we know the email that identified the profile. */}
          {!phone && channel === "sms" && countdown <= 0 && (
            <TouchableOpacity onPress={handleResendViaEmail} disabled={resending} style={st.resendEmailBtn}>
              <Text style={st.resendText}>Resend via email instead</Text>
            </TouchableOpacity>
          )}
        </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root:      { flex: 1, backgroundColor: '#155ac1' },
  container: { flex: 1, padding: spacing.lg },
  backBtn:   { marginBottom: spacing.xl },
  backText:  { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontFamily: typography.bodySemiBold },
  logo:      { width: '70%', height: 92, alignSelf: 'center', marginBottom: spacing.xl },
  title:     { fontSize: 26, fontFamily: typography.heading, color: colors.white, marginBottom: spacing.xs },
  subtitle:  { fontSize: 15, fontFamily: typography.body, color: 'rgba(255,255,255,0.75)', marginBottom: spacing.xl, lineHeight: 22 },
  phone:     { color: colors.white, fontFamily: typography.bodySemiBold },
  otpRow:    { flexDirection: "row", gap: spacing.sm, justifyContent: "center", marginBottom: spacing.lg },
  otpBox: {
    width: 46, height: 56, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: radius.md, textAlign: "center", fontSize: 22,
    fontFamily: typography.heading, color: colors.ink, backgroundColor: colors.white,
  },
  otpBoxFilled: { borderColor: colors.white, borderWidth: 2 },
  error:     { color: "#DC2626", fontSize: 13, backgroundColor: "#FEF2F2", borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.md, textAlign: "center", fontFamily: typography.body },
  btn:       { backgroundColor: colors.white, borderRadius: radius.lg, paddingVertical: 16, alignItems: "center" },
  btnDisabled: { opacity: 0.7 },
  btnText:   { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 16 },
  resendRow: { alignItems: "center", marginTop: spacing.lg },
  countdownText: { color: 'rgba(255,255,255,0.65)', fontFamily: typography.body, fontSize: 14 },
  countdownNum:  { fontFamily: typography.bodySemiBold, color: colors.white },
  resendText:    { color: colors.white, fontFamily: typography.bodySemiBold, fontSize: 14 },
  resendEmailBtn: { marginTop: spacing.sm },
});
