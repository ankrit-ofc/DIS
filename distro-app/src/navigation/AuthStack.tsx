import { createStackNavigator } from "@react-navigation/stack";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { RegisterScreen } from "../screens/auth/RegisterScreen";
import { OTPScreen } from "../screens/auth/OTPScreen";
import { LoginOtpScreen } from "../screens/auth/LoginOtpScreen";
import { RegisterStep2Screen } from "../screens/auth/RegisterStep2Screen";
import { ForgotPasswordScreen } from "../screens/auth/ForgotPasswordScreen";
import { ResetOtpScreen } from "../screens/auth/ResetOtpScreen";
import { NewPasswordScreen } from "../screens/auth/NewPasswordScreen";

export type AuthStackParamList = {
  Login: undefined;
  /** `prefillPhone` carries a number from the OTP-login flow into registration. */
  Register: { prefillPhone?: string } | undefined;
  LoginOtp: undefined;
  /**
   * Exactly one of `email` / `phone` identifies the profile — `phone` means the
   * passwordless login flow, `email` the registration flow.
   */
  OTP: {
    email?: string;
    phone?: string;
    channel?: "sms" | "email";
    maskedTo?: string;
    /** Passed through the email flow so step 2 can prefill the phone field. */
    prefillPhone?: string;
  };
  RegisterStep2: { email: string; otpToken: string; prefillPhone?: string };
  ForgotPassword: undefined;
  ResetOtp: { email: string };
  NewPassword: { resetToken: string };
};

const Stack = createStackNavigator<AuthStackParamList>();

interface AuthStackProps {
  initialScreen?: keyof AuthStackParamList;
}

export function AuthStack({ initialScreen = "Login" }: AuthStackProps) {
  return (
    <Stack.Navigator
      initialRouteName={initialScreen}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="LoginOtp" component={LoginOtpScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen name="RegisterStep2" component={RegisterStep2Screen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetOtp" component={ResetOtpScreen} />
      <Stack.Screen name="NewPassword" component={NewPasswordScreen} />
    </Stack.Navigator>
  );
}
