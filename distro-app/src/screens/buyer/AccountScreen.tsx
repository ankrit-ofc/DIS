import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useAuthStore } from "../../store/authStore";
import { api } from "../../lib/api";
import { colors, spacing, radius, shadow } from "../../lib/theme";
import { sessionInitial } from "../../lib/format";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function CreditBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(used / limit, 1) : 0;
  const barColor = pct > 0.8 ? "#DC2626" : pct > 0.6 ? "#D97706" : colors.green;
  return (
    <View style={cb.wrap}>
      <View style={cb.header}>
        <Text style={cb.label}>Credit used</Text>
        <Text style={cb.vals}>
          Rs {used.toLocaleString()} / Rs {limit.toLocaleString()}
        </Text>
      </View>
      <View style={cb.track}>
        <View style={[cb.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[cb.pct, { color: barColor }]}>{Math.round(pct * 100)}% of limit used</Text>
    </View>
  );
}

const cb = StyleSheet.create({
  wrap: { gap: spacing.xs },
  header: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 13, color: colors.gray600 },
  vals: { fontSize: 13, fontWeight: "700", color: colors.ink },
  track: { height: 8, backgroundColor: colors.gray200, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  pct: { fontSize: 11, fontWeight: "600" },
});

export function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { profile, logout, setAuth, token } = useAuthStore();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Edit profile state
  const [editName, setEditName] = useState(profile?.ownerName ?? profile?.name ?? "");
  const [editStore, setEditStore] = useState(profile?.storeName ?? "");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Change password state
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState("");

  const handleLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: logout },
    ]);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) { setEditError("Name is required."); return; }
    setEditError("");
    setEditLoading(true);
    try {
      const res = await api.put("/profile", { name: editName, storeName: editStore });
      await setAuth(token!, { ...profile!, name: editName, storeName: editStore });
      setShowEditModal(false);
    } catch (err: any) {
      setEditError(err.message ?? "Update failed.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPwd.length < 6) { setPwdError("New password must be at least 6 characters."); return; }
    if (newPwd !== confirmPwd) { setPwdError("Passwords do not match."); return; }
    setPwdError("");
    setPwdLoading(true);
    try {
      await api.put("/profile/password", { currentPassword: oldPwd, newPassword: newPwd });
      setShowPasswordModal(false);
      setOldPwd(""); setNewPwd(""); setConfirmPwd("");
      Alert.alert("Done", "Password updated successfully.");
    } catch (err: any) {
      setPwdError(err.message ?? "Failed to change password.");
    } finally {
      setPwdLoading(false);
    }
  };

  // Placeholder credit data — would come from profile
  const creditUsed = (profile as any)?.creditUsed ?? 0;
  const creditLimit = (profile as any)?.creditLimit ?? 50000;

  return (
    <ScrollView style={styles.bg} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]} showsVerticalScrollIndicator={false}>
      {/* Profile card */}
      <View style={[styles.profileCard, shadow.sm]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{sessionInitial(profile)}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{profile?.ownerName ?? profile?.name ?? profile?.storeName ?? "Store"}</Text>
          {profile?.storeName && <Text style={styles.storeName}>{profile.storeName}</Text>}
          <Text style={styles.phone}>{profile?.phone ?? "—"}</Text>
        </View>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => {
            setEditName(profile?.name ?? "");
            setEditStore(profile?.storeName ?? "");
            setEditError("");
            setShowEditModal(true);
          }}
        >
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Credit bar */}
      {creditLimit > 0 && (
        <View style={[styles.creditCard, shadow.sm]}>
          <Text style={styles.sectionTitle}>Credit</Text>
          <CreditBar used={creditUsed} limit={creditLimit} />
        </View>
      )}

      {/* Menu */}
      <View style={[styles.menuCard, shadow.sm]}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            setOldPwd(""); setNewPwd(""); setConfirmPwd(""); setPwdError("");
            setShowPasswordModal(true);
          }}
        >
          <Text style={styles.menuText}>Change password</Text>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Help & support</Text>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Terms & conditions</Text>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>DISTRO v{Constants.expoConfig?.version ?? '1.0.0'}</Text>

      {/* Edit Profile Modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowEditModal(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Edit profile</Text>
          <Text style={styles.inputLabel}>Owner name</Text>
          <TextInput
            style={styles.input}
            value={editName}
            onChangeText={setEditName}
            placeholder="Full name"
            placeholderTextColor={colors.gray400}
          />
          <Text style={styles.inputLabel}>Store name</Text>
          <TextInput
            style={styles.input}
            value={editStore}
            onChangeText={setEditStore}
            placeholder="Store name"
            placeholderTextColor={colors.gray400}
          />
          {!!editError && <Text style={styles.fieldError}>{editError}</Text>}
          <TouchableOpacity
            style={[styles.modalBtn, editLoading && styles.btnDisabled]}
            onPress={handleSaveProfile}
            disabled={editLoading}
          >
            {editLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.modalBtnText}>Save changes</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showPasswordModal} transparent animationType="slide" onRequestClose={() => setShowPasswordModal(false)}>
        <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowPasswordModal(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Change password</Text>
          {[
            { label: "Current password", val: oldPwd, setter: setOldPwd, ph: "Current password" },
            { label: "New password", val: newPwd, setter: setNewPwd, ph: "Min. 6 characters" },
            { label: "Confirm new password", val: confirmPwd, setter: setConfirmPwd, ph: "Re-enter new password" },
          ].map((f) => (
            <View key={f.label}>
              <Text style={styles.inputLabel}>{f.label}</Text>
              <TextInput
                style={styles.input}
                value={f.val}
                onChangeText={f.setter}
                placeholder={f.ph}
                placeholderTextColor={colors.gray400}
                secureTextEntry
              />
            </View>
          ))}
          {!!pwdError && <Text style={styles.fieldError}>{pwdError}</Text>}
          <TouchableOpacity
            style={[styles.modalBtn, pwdLoading && styles.btnDisabled]}
            onPress={handleChangePassword}
            disabled={pwdLoading}
          >
            {pwdLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.modalBtnText}>Update password</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.offWhite },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.lg + spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.white, fontSize: 24, fontWeight: "700" },
  profileInfo: { flex: 1 },
  name: { fontSize: 17, fontWeight: "700", color: colors.ink },
  storeName: { fontSize: 13, color: colors.gray600, marginTop: 2 },
  phone: { fontSize: 13, color: colors.gray400, marginTop: 2 },
  editBtn: {
    backgroundColor: colors.blueLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  editBtnText: { color: colors.blue, fontWeight: "700", fontSize: 13 },
  creditCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  menuCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  menuText: { fontSize: 15, color: colors.ink },
  menuChevron: { fontSize: 20, color: colors.gray400 },
  divider: { height: 1, backgroundColor: colors.gray200, marginLeft: spacing.lg },
  logoutBtn: {
    backgroundColor: "#FEF2F2",
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  logoutText: { color: "#DC2626", fontWeight: "700", fontSize: 15 },
  version: { textAlign: "center", color: colors.gray400, fontSize: 12 },
  // Modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray200,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  inputLabel: { fontSize: 13, fontWeight: "600", color: colors.gray600, marginBottom: spacing.xs },
  input: {
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.offWhite,
  },
  fieldError: {
    color: "#DC2626",
    fontSize: 13,
    backgroundColor: "#FEF2F2",
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  modalBtn: {
    backgroundColor: colors.blue,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  btnDisabled: { opacity: 0.6 },
  modalBtnText: { color: colors.white, fontWeight: "700", fontSize: 16 },
});
