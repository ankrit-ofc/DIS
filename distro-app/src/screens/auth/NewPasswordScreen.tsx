import { useState } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp, CommonActions } from "@react-navigation/native";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { colors, spacing, typography } from "../../lib/theme";
import { AuthStackParamList } from "../../navigation/AuthStack";
import { AuthScreenContainer } from "../../components/AuthScreenContainer";
import { AuthBrand, InputField, s } from "./_shared";

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, "NewPassword">;
  route: RouteProp<AuthStackParamList, "NewPassword">;
};

export function NewPasswordScreen({ navigation, route }: Props) {
  const { resetToken } = route.params;
  const { logout } = useAuthStore();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { resetToken, newPassword: password });
      // Server invalidates sessions; clear local auth too so user is fully signed out.
      await logout();
      Alert.alert(
        "Password updated",
        "Please sign in with your new password.",
        [{
          text: "OK",
          onPress: () => navigation.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: "Login" }] }),
          ),
        }],
      );
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Could not reset password.";
      setError(msg);
      // If the token is expired, send the user back to start
      if (/expired|invalid/i.test(msg)) {
        setTimeout(() => navigation.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: "ForgotPassword" }] }),
        ), 1500);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenContainer contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, gap: spacing.xl }}>
      <AuthBrand subtitle="Choose a new password" />

      <View style={s.card}>
        <View style={s.cardHeader}>
          <Text style={s.cardTitle}>Create a new password</Text>
          <Text style={s.cardSubtitle}>Pick something at least 8 characters.</Text>
        </View>
        <InputField
          label="New password"
          value={password}
          onChangeText={setPassword}
          placeholder="Min. 8 characters"
          secureTextEntry
          autoCapitalize="none"
          autoFocus
        />
        <InputField
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Re-enter password"
          secureTextEntry
          autoCapitalize="none"
        />
        {!!error && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.redLight, padding: 10, borderRadius: 8 }}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.red} />
            <Text style={{ flex: 1, color: colors.red, fontSize: 13, fontFamily: typography.bodyMedium }}>{error}</Text>
          </View>
        )}
        <TouchableOpacity style={[s.btn, loading && s.btnLoading]} onPress={handleSubmit} disabled={loading} activeOpacity={0.88}>
          <Text style={s.btnText}>{loading ? "Updating…" : "Update password"}</Text>
        </TouchableOpacity>
      </View>
    </AuthScreenContainer>
  );
}
