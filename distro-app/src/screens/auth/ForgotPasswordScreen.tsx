import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { api } from "../../lib/api";
import { colors, spacing, typography } from "../../lib/theme";
import { AuthStackParamList } from "../../navigation/AuthStack";
import { AuthScreenContainer } from "../../components/AuthScreenContainer";
import { AuthBrand, InputField, s } from "./_shared";

type Props = { navigation: StackNavigationProp<AuthStackParamList, "ForgotPassword"> };

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      navigation.navigate("ResetOtp", { email });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Could not send reset code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenContainer contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, gap: spacing.xl }}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: "row", alignItems: "center", gap: 6 }} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={20} color={colors.white} />
        <Text style={{ color: colors.white, fontFamily: typography.bodySemiBold, fontSize: 15 }}>Back</Text>
      </TouchableOpacity>

      <AuthBrand subtitle="Reset your password" />

      <View style={s.card}>
        <View style={s.cardHeader}>
          <Text style={s.cardTitle}>Reset your password</Text>
          <Text style={s.cardSubtitle}>Enter your email and we'll send you a 6-digit code.</Text>
        </View>
        <InputField
          label="Email address"
          value={email}
          onChangeText={setEmail}
          placeholder="yourshop@gmail.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoFocus
        />
        {!!error && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.redLight, padding: 10, borderRadius: 8 }}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.red} />
            <Text style={{ flex: 1, color: colors.red, fontSize: 13, fontFamily: typography.bodyMedium }}>{error}</Text>
          </View>
        )}
        <TouchableOpacity style={[s.btn, loading && s.btnLoading]} onPress={handleSubmit} disabled={loading} activeOpacity={0.88}>
          <Text style={s.btnText}>{loading ? "Sending…" : "Send code →"}</Text>
        </TouchableOpacity>
      </View>
    </AuthScreenContainer>
  );
}
