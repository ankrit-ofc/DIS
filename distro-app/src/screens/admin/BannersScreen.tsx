import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, RefreshControl, Switch, Image,
} from "react-native";
import { useState, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api } from "../../lib/api";
import { colors, spacing, radius, shadow, typography } from "../../lib/theme";

interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  bgColor: string;
  textColor: string;
  active: boolean;
  sortOrder: number;
}

const PRESETS = [
  { bgColor: "#1A4BDB", textColor: "#FFFFFF" },
  { bgColor: "#0D1120", textColor: "#FFFFFF" },
  { bgColor: "#00A859", textColor: "#FFFFFF" },
  { bgColor: "#C41230", textColor: "#FFFFFF" },
  { bgColor: "#F59E0B", textColor: "#0D1120" },
  { bgColor: "#7C3AED", textColor: "#FFFFFF" },
];

function BannerPreviewCard({ title, subtitle, imageUrl, bgColor, textColor }: Partial<Banner>) {
  if (!title && !imageUrl) return null;
  return (
    <View style={[preview.card, { backgroundColor: bgColor ?? "#1A4BDB" }]}>
      {imageUrl ? (
        <>
          <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          <View style={preview.overlay} />
        </>
      ) : (
        <View style={[preview.circle, { backgroundColor: textColor }]} />
      )}
      {title ? (
        <Text style={[preview.title, { color: imageUrl ? "#fff" : textColor }]} numberOfLines={2}>{title}</Text>
      ) : null}
      {subtitle ? (
        <Text style={[preview.sub, { color: imageUrl ? "rgba(255,255,255,0.85)" : textColor }]} numberOfLines={1}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const preview = StyleSheet.create({
  card: {
    height: 100,
    borderRadius: radius.md,
    padding: 14,
    justifyContent: "flex-end",
    overflow: "hidden",
    marginTop: 12,
  },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.32)" },
  circle: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.08,
    right: -20,
    top: -20,
  },
  title: { fontSize: 15, fontFamily: typography.heading, letterSpacing: -0.3 },
  sub: { fontSize: 11, fontFamily: typography.bodyMedium, marginTop: 2, opacity: 0.85 },
});

export function BannersScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle]         = useState("");
  const [subtitle, setSubtitle]   = useState("");
  const [imageUrl, setImageUrl]   = useState("");
  const [bgColor, setBgColor]     = useState(PRESETS[0].bgColor);
  const [textColor, setTextColor] = useState(PRESETS[0].textColor);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/admin/banners");
      setBanners(res.data.banners ?? []);
    } catch {
      // handled silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setTitle(""); setSubtitle(""); setImageUrl("");
    setBgColor(PRESETS[0].bgColor); setTextColor(PRESETS[0].textColor);
    setShowModal(true);
  }

  function openEdit(b: Banner) {
    setEditing(b);
    setTitle(b.title); setSubtitle(b.subtitle ?? ""); setImageUrl(b.imageUrl ?? "");
    setBgColor(b.bgColor); setTextColor(b.textColor);
    setShowModal(true);
  }

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Allow photo access to upload a banner image."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [5, 2],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", {
        uri: asset.uri,
        type: asset.mimeType ?? "image/jpeg",
        name: `banner-${Date.now()}.jpg`,
      } as any);
      const res = await api.post("/admin/banners/upload-image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // Construct full URL from the API base URL
      const apiBase = (process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.100:3001/api").replace("/api", "");
      setImageUrl(`${apiBase}${res.data.url}`);
    } catch {
      Alert.alert("Upload failed", "Could not upload image. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload = { title, subtitle: subtitle || null, imageUrl: imageUrl || null, bgColor, textColor };
      if (editing) {
        const res = await api.patch(`/admin/banners/${editing.id}`, payload);
        setBanners(prev => prev.map(b => b.id === editing.id ? res.data.banner : b));
      } else {
        const res = await api.post("/admin/banners", { ...payload, active: true });
        setBanners(prev => [res.data.banner, ...prev]);
      }
      setShowModal(false);
    } catch {
      Alert.alert("Error", "Could not save banner.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(b: Banner) {
    try {
      await api.patch(`/admin/banners/${b.id}`, { active: !b.active });
      setBanners(prev => prev.map(x => x.id === b.id ? { ...x, active: !x.active } : x));
    } catch {
      Alert.alert("Error", "Could not update banner.");
    }
  }

  function confirmDelete(b: Banner) {
    Alert.alert("Delete banner", `Remove "${b.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/admin/banners/${b.id}`);
            setBanners(prev => prev.filter(x => x.id !== b.id));
          } catch {
            Alert.alert("Error", "Could not delete banner.");
          }
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.offWhite }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Banners</Text>
        <TouchableOpacity style={s.addBtn} onPress={openAdd} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.blue}
          />
        }
      >
        {loading ? (
          [1, 2, 3].map(k => (
            <View key={k} style={[s.skeletonCard, { opacity: 0.4 - k * 0.08 }]} />
          ))
        ) : banners.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="image-outline" size={40} color={colors.gray300} />
            <Text style={s.emptyText}>No banners yet</Text>
            <Text style={s.emptyHint}>Tap + to add a banner that appears{"\n"}on the buyer home screen</Text>
          </View>
        ) : (
          banners.map(b => (
            <View key={b.id} style={[s.card, shadow.sm, !b.active && s.cardInactive]}>
              {/* Swatch + info */}
              <View style={s.cardTop}>
                <View style={[s.swatch, { backgroundColor: b.bgColor, overflow: "hidden" }]}>
                  {b.imageUrl ? (
                    <Image source={{ uri: b.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  ) : (
                    <Text style={[s.swatchText, { color: b.textColor }]}>
                      {b.title.slice(0, 2).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={s.cardInfo}>
                  <Text style={[s.cardTitle, !b.active && { color: colors.gray400 }]} numberOfLines={1}>
                    {b.title}
                  </Text>
                  {b.subtitle ? (
                    <Text style={s.cardSub} numberOfLines={1}>{b.subtitle}</Text>
                  ) : null}
                  <Text style={s.cardColor}>{b.bgColor}</Text>
                </View>
                <Switch
                  value={b.active}
                  onValueChange={() => toggleActive(b)}
                  trackColor={{ true: colors.blue, false: colors.gray200 }}
                  thumbColor={colors.white}
                />
              </View>
              {/* Actions */}
              <View style={s.cardActions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(b)} activeOpacity={0.8}>
                  <Ionicons name="pencil-outline" size={15} color={colors.blue} />
                  <Text style={[s.actionText, { color: colors.blue }]}>Edit</Text>
                </TouchableOpacity>
                <View style={s.actionDivider} />
                <TouchableOpacity style={s.actionBtn} onPress={() => confirmDelete(b)} activeOpacity={0.8}>
                  <Ionicons name="trash-outline" size={15} color={colors.red} />
                  <Text style={[s.actionText, { color: colors.red }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Create / Edit modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={m.wrap}>
          <View style={m.header}>
            <Text style={m.headerTitle}>{editing ? "Edit Banner" : "New Banner"}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.gray500} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={m.body} keyboardShouldPersistTaps="handled">
            {/* Preview */}
            <BannerPreviewCard title={title} subtitle={subtitle} imageUrl={imageUrl} bgColor={bgColor} textColor={textColor} />

            {/* Image upload */}
            <Text style={m.label}>Poster image</Text>
            <View style={m.imageRow}>
              <TouchableOpacity style={m.uploadBtn} onPress={pickImage} disabled={uploading} activeOpacity={0.8}>
                <Ionicons name="image-outline" size={16} color={colors.blue} />
                <Text style={m.uploadBtnText}>{uploading ? "Uploading…" : imageUrl ? "Change image" : "Pick from library"}</Text>
              </TouchableOpacity>
              {imageUrl ? (
                <TouchableOpacity style={m.removeBtn} onPress={() => setImageUrl("")} activeOpacity={0.8}>
                  <Ionicons name="trash-outline" size={15} color={colors.red} />
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={m.hint}>Recommended 1200×480px · jpg / png / webp · max 5 MB</Text>

            <Text style={m.label}>Title *</Text>
            <TextInput
              style={m.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Free delivery this week"
              placeholderTextColor={colors.gray400}
            />

            <Text style={m.label}>Subtitle (optional)</Text>
            <TextInput
              style={m.input}
              value={subtitle}
              onChangeText={setSubtitle}
              placeholder="e.g. On orders above Rs 5,000"
              placeholderTextColor={colors.gray400}
            />

            {!imageUrl && (
              <>
                <Text style={m.label}>Background color</Text>
                <View style={m.presets}>
                  {PRESETS.map((p, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[m.preset, { backgroundColor: p.bgColor }, bgColor === p.bgColor && m.presetActive]}
                      onPress={() => { setBgColor(p.bgColor); setTextColor(p.textColor); }}
                      activeOpacity={0.85}
                    />
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          <View style={m.footer}>
            <TouchableOpacity
              style={[m.saveBtn, (!title.trim() || saving || uploading) && m.saveBtnDisabled]}
              onPress={save}
              disabled={!title.trim() || saving || uploading}
              activeOpacity={0.85}
            >
              <Text style={m.saveBtnText}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Banner"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    gap: spacing.sm,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: typography.heading, color: colors.ink },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
  skeletonCard: { height: 100, borderRadius: radius.md, backgroundColor: colors.gray100 },
  empty: { alignItems: "center", paddingTop: spacing.xxl, gap: spacing.sm },
  emptyText: { fontSize: 16, fontFamily: typography.heading, color: colors.gray400 },
  emptyHint: { fontSize: 13, color: colors.gray400, fontFamily: typography.body, textAlign: "center", lineHeight: 20 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  cardInactive: { opacity: 0.6 },
  cardTop: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  swatchText: { fontSize: 12, fontFamily: typography.heading },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 14, fontFamily: typography.bodySemiBold, color: colors.ink },
  cardSub: { fontSize: 12, color: colors.gray500, fontFamily: typography.body },
  cardColor: { fontSize: 11, color: colors.gray400, fontFamily: typography.body, marginTop: 2 },
  cardActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  actionText: { fontSize: 13, fontFamily: typography.bodySemiBold },
  actionDivider: { width: 1, backgroundColor: colors.gray100 },
});

const m = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.offWhite },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    paddingTop: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerTitle: { fontSize: 17, fontFamily: typography.heading, color: colors.ink },
  body: { padding: spacing.md, gap: 4, paddingBottom: spacing.xl },
  label: {
    fontSize: 12,
    fontFamily: typography.bodySemiBold,
    color: colors.gray600,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: typography.body,
    color: colors.ink,
  },
  presets: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 4 },
  preset: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: "transparent",
  },
  presetActive: { borderColor: colors.ink, transform: [{ scale: 1.12 }] },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  saveBtn: {
    backgroundColor: colors.blue,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnDisabled: { backgroundColor: colors.gray200 },
  saveBtnText: { fontSize: 15, fontFamily: typography.bodySemiBold, color: colors.white },
  imageRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.blue,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flex: 1,
  },
  uploadBtnText: { fontSize: 13, fontFamily: typography.bodySemiBold, color: colors.blue },
  removeBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.redLight,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { fontSize: 11, color: colors.gray400, fontFamily: typography.body, marginTop: 4 },
});
