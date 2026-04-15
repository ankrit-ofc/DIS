import { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TextInput as TI } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { colors, spacing, radius, typography } from "../../lib/theme";
import { AuthStackParamList } from "../../navigation/AuthStack";
import { AuthBrand, StepIndicator, InputField, AuthError, s } from "./_shared";
import { LocationPicker, LocationPickerValue } from "../../components/LocationPicker";

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, "RegisterStep2">;
  route: RouteProp<AuthStackParamList, "RegisterStep2">;
};

const NEPAL_DISTRICTS = [
  "Achham", "Arghakhanchi", "Baglung", "Baitadi", "Bajhang", "Bajura",
  "Banke", "Bara", "Bardiya", "Bhaktapur", "Bhojpur", "Chitwan",
  "Dadeldhura", "Dailekh", "Dang", "Darchula", "Dhading", "Dhankuta",
  "Dhanusa", "Dolakha", "Dolpa", "Doti", "Gorkha", "Gulmi", "Humla",
  "Ilam", "Jajarkot", "Jhapa", "Jumla", "Kailali", "Kalikot", "Kanchanpur",
  "Kapilvastu", "Kaski", "Kathmandu", "Kavrepalanchok", "Khotang",
  "Lalitpur", "Lamjung", "Mahottari", "Makwanpur", "Manang", "Morang",
  "Mugu", "Mustang", "Myagdi", "Nawalparasi", "Nuwakot", "Okhaldhunga",
  "Palpa", "Panchthar", "Parbat", "Parsa", "Pyuthan", "Ramechhap",
  "Rasuwa", "Rautahat", "Rolpa", "Rupandehi", "Salyan", "Sankhuwasabha",
  "Saptari", "Sarlahi", "Sindhuli", "Sindhupalchok", "Siraha", "Solukhumbu",
  "Sunsari", "Surkhet", "Syangja", "Tanahun", "Taplejung", "Terhathum",
  "Udayapur",
];

function DistrictPicker({ value, onSelect }: { value: string; onSelect: (d: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>District</Text>
      <TouchableOpacity
        style={[p.trigger, open && p.triggerOpen]}
        onPress={() => setOpen(v => !v)}
        activeOpacity={0.8}
      >
        <Text style={value ? p.selected : p.placeholder}>{value || "Select your district"}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.gray400} />
      </TouchableOpacity>
      {open && (
        <View style={p.dropdown}>
          <ScrollView style={p.list} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {NEPAL_DISTRICTS.map(d => (
              <TouchableOpacity
                key={d}
                style={[p.item, value === d && p.itemActive]}
                onPress={() => { onSelect(d); setOpen(false); }}
              >
                <Text style={[p.itemText, value === d && p.itemTextActive]}>{d}</Text>
                {value === d && <Ionicons name="checkmark" size={16} color={colors.blue} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const p = StyleSheet.create({
  trigger:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1.5, borderColor: colors.gray200, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 15, backgroundColor: colors.gray50 },
  triggerOpen: { borderColor: colors.blue, borderWidth: 2, backgroundColor: colors.white },
  selected:    { fontSize: 16, fontFamily: typography.body, color: colors.ink },
  placeholder: { fontSize: 16, fontFamily: typography.body, color: colors.gray300 },
  dropdown:    { borderWidth: 1.5, borderColor: colors.gray200, borderRadius: radius.lg, overflow: "hidden", marginTop: -4 },
  list:        { maxHeight: 200, backgroundColor: colors.white },
  item:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  itemActive:  { backgroundColor: colors.blueLight },
  itemText:    { fontSize: 15, fontFamily: typography.body, color: colors.ink },
  itemTextActive: { fontFamily: typography.bodySemiBold, color: colors.blue },
});

export function RegisterStep2Screen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { email, otpToken } = route.params;
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState<LocationPickerValue | null>(null);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const ownerRef = useRef<TI>(null);
  const companyRef = useRef<TI>(null);
  const panRef = useRef<TI>(null);
  const addressRef = useRef<TI>(null);
  const phoneRef = useRef<TI>(null);
  const passwordRef = useRef<TI>(null);
  const confirmRef = useRef<TI>(null);

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

  const handleRegister = async () => {
    if (!storeName.trim() || !ownerName.trim() || !district || !phone.trim() || !password || !address.trim()) {
      setError("Please fill all required fields."); shake(); return;
    }
    if (!location) {
      setError("Please pin your store location on the map."); shake(); return;
    }
    if (panNumber && !/^\d{9}$/.test(panNumber)) {
      setError("PAN number must be exactly 9 digits."); shake(); return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters."); shake(); return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match."); shake(); return;
    }
    if (!agreeTerms) {
      setError("Please accept the Terms & Privacy Policy."); shake(); return;
    }
    setError("");
    setLoading(true);
    btnScale.value = withSpring(0.97, { damping: 20, stiffness: 300 });
    try {
      const res = await api.post("/auth/register", {
        email, otpToken, storeName, ownerName, district, phone, password, address,
        companyName: companyName || undefined,
        panNumber: panNumber || undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
      });
      await setAuth(res.data.token, res.data.profile ?? res.data.user);
      btnScale.value = withSpring(1);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? "Registration failed.");
      btnScale.value = withSpring(1);
      shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={ls.backRow} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.white} />
          <Text style={ls.backText}>Back</Text>
        </TouchableOpacity>

        <AuthBrand subtitle="Almost there — just your store details" />

        <View style={s.card}>
          <StepIndicator current={2} total={2} />
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Your store 🏪</Text>
            <Text style={s.cardSubtitle}>Tell us about your business so buyers can find you.</Text>
          </View>
          <View style={s.fields}>
            <InputField label="Store name" value={storeName} onChangeText={setStoreName}
              placeholder="e.g. Sharma General Store" returnKeyType="next"
              onSubmitEditing={() => (ownerRef.current as any)?.focus()} />
            <InputField label="Owner name" value={ownerName} onChangeText={setOwnerName}
              placeholder="e.g. Ram Sharma" inputRef={ownerRef} returnKeyType="next"
              onSubmitEditing={() => (companyRef.current as any)?.focus()} />
            <InputField label="Company name (optional)" value={companyName} onChangeText={setCompanyName}
              placeholder="For registered businesses" inputRef={companyRef} returnKeyType="next"
              onSubmitEditing={() => (panRef.current as any)?.focus()} />
            <InputField label="PAN number (optional, 9 digits)" value={panNumber}
              onChangeText={(v) => setPanNumber(v.replace(/\D/g, "").slice(0, 9))}
              placeholder="123456789" keyboardType="number-pad" inputRef={panRef}
              returnKeyType="next" onSubmitEditing={() => (addressRef.current as any)?.focus()} />
            <DistrictPicker value={district} onSelect={setDistrict} />
            <InputField label="Address" value={address} onChangeText={setAddress}
              placeholder="Street, area, landmark" inputRef={addressRef} returnKeyType="next"
              onSubmitEditing={() => (phoneRef.current as any)?.focus()} />
            <LocationPicker
              value={location}
              onChange={(v) => {
                setLocation(v);
                if (v.address && !address.trim()) setAddress(v.address);
              }}
              label="Pin your store location *"
              helperText="Search, drag the marker, or use your current location."
            />
            <InputField label="Phone number" value={phone} onChangeText={setPhone}
              placeholder="98XXXXXXXX" keyboardType="phone-pad" inputRef={phoneRef}
              returnKeyType="next" onSubmitEditing={() => (passwordRef.current as any)?.focus()} />
            <InputField label="Password" value={password} onChangeText={setPassword}
              placeholder="Min. 8 characters" secureTextEntry inputRef={passwordRef}
              returnKeyType="next" onSubmitEditing={() => (confirmRef.current as any)?.focus()}
              autoCapitalize="none" />
            <InputField label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword}
              placeholder="Re-enter password" secureTextEntry inputRef={confirmRef}
              returnKeyType="done" onSubmitEditing={handleRegister} autoCapitalize="none" />
            <TouchableOpacity onPress={() => setAgreeTerms(v => !v)} activeOpacity={0.8}
              style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 6 }}>
              <View style={{
                width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
                borderColor: agreeTerms ? colors.blue : colors.gray300,
                backgroundColor: agreeTerms ? colors.blue : "transparent",
                alignItems: "center", justifyContent: "center", marginTop: 2,
              }}>
                {agreeTerms && <Ionicons name="checkmark" size={12} color={colors.white} />}
              </View>
              <Text style={{ flex: 1, fontSize: 13, color: colors.gray600, fontFamily: typography.body }}>
                I agree to the <Text style={{ color: colors.blue }}>Terms &amp; Conditions</Text> and{" "}
                <Text style={{ color: colors.blue }}>Privacy Policy</Text>.
              </Text>
            </TouchableOpacity>
          </View>
          <AuthError message={error} animStyle={errorStyle} />
          <Animated.View style={btnStyle}>
            <TouchableOpacity style={[s.btn, loading && s.btnLoading]} onPress={handleRegister}
              disabled={loading} activeOpacity={0.88}>
              {loading
                ? <View style={s.loadingRow}>
                    <View style={s.loadingDot} />
                    <View style={[s.loadingDot, s.loadingDotMid]} />
                    <View style={[s.loadingDot, s.loadingDotFaint]} />
                  </View>
                : <Text style={s.btnText}>Create my account →</Text>}
            </TouchableOpacity>
          </Animated.View>
        </View>

        <Text style={ls.privacyNote}>By creating an account you agree to our terms of service.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ls = StyleSheet.create({
  backRow:     { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  backText:    { fontSize: 15, fontFamily: typography.bodySemiBold, color: colors.white },
  privacyNote: { textAlign: "center", fontSize: 12, fontFamily: typography.body, color: 'rgba(255,255,255,0.55)', paddingHorizontal: spacing.md },
});
