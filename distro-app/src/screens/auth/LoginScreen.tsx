import { useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput as TI,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { colors, spacing, radius, typography, shadow } from "../../lib/theme";
import { AuthStackParamList } from "../../navigation/AuthStack";

const BRAND_BLUE = "#1A4BDB";

type Props = { navigation: StackNavigationProp<AuthStackParamList, "Login"> };

export function LoginScreen({ navigation }: Props) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const passwordRef = useRef<TI>(null);

  // Mobile is buyer-only. Reject ADMIN/anything else and clear the issued session.
  const acceptOrReject = async (token: string, profile: any) => {
    if (profile?.role !== "BUYER") {
      try {
        await api.post(
          "/auth/logout",
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        );
      } catch {
        // best effort — token will expire on its own
      }
      Alert.alert(
        "Admin access not available",
        "Admin access is on distronepal.com",
        [{ text: "OK" }],
      );
      return false;
    }
    await setAuth(token, profile);
    return true;
  };

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      setError("Enter your email or phone and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      // API field is `email` but the server accepts email OR phone.
      const res = await api.post("/auth/login", {
        email: identifier.trim(),
        password,
      });
      await acceptOrReject(res.data.token, res.data.profile ?? res.data.user);
    } catch (err: any) {
      setError(err?.message ?? "Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={s.header}>
            <Image
              source={require("../../../assets/logo-icon.png")}
              style={s.logo}
              resizeMode="contain"
            />
            <Text style={s.brandName}>DISTRO</Text>
            <Text style={s.tagline}>Wholesale, made simple.</Text>
          </View>

          <View style={s.card}>
            <Text style={s.title}>Welcome back</Text>
            <Text style={s.subtitle}>Sign in to manage your store</Text>

            <View style={s.field}>
              <Text style={s.label}>Email or phone</Text>
              <View style={s.inputBox}>
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={colors.gray400}
                  style={s.inputIcon}
                />
                <TextInput
                  style={s.input}
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="yourshop@gmail.com or 98XXXXXXXX"
                  placeholderTextColor={colors.gray300}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.label}>Password</Text>
              <View style={s.inputBox}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={colors.gray400}
                  style={s.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.gray300}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => setShowPw((v) => !v)}
                  style={s.eye}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showPw ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={colors.gray500}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={s.forgotRow}
              onPress={() => navigation.navigate("ForgotPassword")}
              activeOpacity={0.7}
              hitSlop={8}
            >
              <Text style={s.forgotLink}>Forgot password?</Text>
            </TouchableOpacity>

            {!!error && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.red} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.primaryBtn, loading && s.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={s.primaryBtnText}>Sign in</Text>
              )}
            </TouchableOpacity>

          </View>

          <TouchableOpacity
            style={s.footer}
            onPress={() => navigation.navigate("Register")}
            activeOpacity={0.75}
          >
            <Text style={s.footerText}>New to DISTRO? </Text>
            <Text style={s.footerLink}>Register your store</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND_BLUE },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    backgroundColor: colors.offWhite,
  },

  header: {
    backgroundColor: BRAND_BLUE,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl + spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  logo: { width: 112, height: 112, marginBottom: spacing.sm },
  brandName: {
    fontSize: 28,
    color: colors.white,
    fontFamily: typography.heading,
    letterSpacing: 1.5,
  },
  tagline: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontFamily: typography.body,
    marginTop: 2,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    marginHorizontal: spacing.lg,
    marginTop: -spacing.xl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  title: {
    fontSize: 22,
    color: colors.ink,
    fontFamily: typography.heading,
  },
  subtitle: {
    fontSize: 13,
    color: colors.gray500,
    fontFamily: typography.body,
    marginTop: -spacing.sm,
  },

  field: { gap: 6 },
  label: {
    fontSize: 12,
    color: colors.gray600,
    fontFamily: typography.bodySemiBold,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    backgroundColor: colors.gray50,
  },
  inputIcon: { paddingLeft: spacing.md },
  input: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.ink,
    fontFamily: typography.body,
  },
  eye: { paddingHorizontal: spacing.md, paddingVertical: 12 },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.redLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  errorText: { flex: 1, color: colors.red, fontSize: 13, fontFamily: typography.bodyMedium },

  primaryBtn: {
    backgroundColor: BRAND_BLUE,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  btnDisabled: { opacity: 0.7 },
  primaryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: typography.bodySemiBold,
    letterSpacing: 0.4,
  },

  forgotRow: { alignSelf: "flex-end", paddingVertical: 4 },
  forgotLink: { fontSize: 13, color: BRAND_BLUE, fontFamily: typography.bodySemiBold },

  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  footerText: { fontSize: 14, color: colors.gray500, fontFamily: typography.body },
  footerLink: { fontSize: 14, color: BRAND_BLUE, fontFamily: typography.bodySemiBold },
});
