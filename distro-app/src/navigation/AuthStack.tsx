import { createStackNavigator } from "@react-navigation/stack";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { RegisterScreen } from "../screens/auth/RegisterScreen";
import { OTPScreen } from "../screens/auth/OTPScreen";
import { RegisterStep2Screen } from "../screens/auth/RegisterStep2Screen";
import { ForgotPasswordScreen } from "../screens/auth/ForgotPasswordScreen";
import { ResetOtpScreen } from "../screens/auth/ResetOtpScreen";
import { NewPasswordScreen } from "../screens/auth/NewPasswordScreen";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  OTP: { email: string };
  RegisterStep2: { email: string; otpToken: string };
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
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen name="RegisterStep2" component={RegisterStep2Screen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetOtp" component={ResetOtpScreen} />
      <Stack.Screen name="NewPassword" component={NewPasswordScreen} />
    </Stack.Navigator>
  );
}
