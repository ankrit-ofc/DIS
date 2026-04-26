import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, RefreshControl, Image,
} from "react-native";
import { useState, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api } from "../../lib/api";
import { colors, spacing, radius, shadow, typography } from "../../lib/theme";
import { imgUri } from "../../lib/image";

interface Category {
  id: string;
  name: string;
  emoji?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  parentId?: string | null;
  parentName?: string | null;
  productCount: number;
  childCount: number;
}

const EMOJI_SUGGESTIONS = ["🍚", "🥤", "🧴", "🍪", "🧺", "🧻", "🍜", "🥛", "🧂", "🍬", "🌶️", "🛒"];

export function CategoriesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/admin/categories");
      setCategories(res.data.categories ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setName(""); setEmoji(""); setImageUrl(""); setDescription(""); setParentId(null);
    setShowModal(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setName(c.name);
    setEmoji(c.emoji ?? "");
    setImageUrl(c.imageUrl ?? "");
    setDescription(c.description ?? "");
    setParentId(c.parentId ?? null);
    setShowModal(true);
  }

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Allow photo access to upload an image."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
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
        name: `category-${Date.now()}.jpg`,
      } as any);
      const res = await api.post("/admin/categories/upload-image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImageUrl(res.data.url);
    } catch {
      Alert.alert("Upload failed", "Could not upload image. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        emoji: emoji.trim() || null,
        imageUrl: imageUrl || null,
        description: description.trim() || null,
        parentId: parentId || null,
      };
      if (editing) {
        await api.patch(`/admin/categories/${editing.id}`, payload);
      } else {
        await api.post("/admin/categories", payload);
      }
      setShowModal(false);
      load();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error ?? "Could not save category.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(c: Category) {
    Alert.alert("Delete category", `Remove "${c.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/admin/categories/${c.id}`);
            setCategories(prev => prev.filter(x => x.id !== c.id));
          } catch (err: any) {
            Alert.alert("Error", err?.response?.data?.error ?? "Could not delete category.");
          }
        },
      },
    ]);
  }

  const topLevel = categories.filter(c => !c.parentId);
  const parentOptions = categories.filter(c => !editing || (c.id !== editing.id && c.parentId !== editing.id));

  return (
    <View style={{ flex: 1, backgroundColor: colors.offWhite }}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Categories</Text>
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
        <TouchableOpacity style={s.ctaBtn} onPress={openAdd} activeOpacity={0.85}>
          <View style={s.ctaIcon}>
            <Ionicons name="add" size={20} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.ctaTitle}>Add a new category</Text>
            <Text style={s.ctaSub}>Create a new section shoppers can browse</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.blue} />
        </TouchableOpacity>

        {loading ? (
          [1, 2, 3, 4].map(k => (
            <View key={k} style={[s.skeletonCard, { opacity: 0.4 - k * 0.06 }]} />
          ))
        ) : categories.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="pricetag-outline" size={40} color={colors.gray300} />
            <Text style={s.emptyText}>No categories yet</Text>
            <Text style={s.emptyHint}>Create your first category to organise{"\n"}products on the home screen</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={openAdd} activeOpacity={0.85}>
              <Ionicons name="add" size={18} color={colors.white} />
              <Text style={s.emptyBtnText}>Create first category</Text>
            </TouchableOpacity>
          </View>
        ) : (
          topLevel.map(c => {
            const children = categories.filter(k => k.parentId === c.id);
            return (
              <View key={c.id} style={[s.card, shadow.sm]}>
                <View style={s.cardTop}>
                  <View style={s.emojiBox}>
                    {imgUri(c.imageUrl) ? (
                      <Image source={{ uri: imgUri(c.imageUrl)! }} style={s.thumbImg} resizeMode="cover" />
                    ) : (
                      <Text style={s.emojiText}>{c.emoji ?? "📦"}</Text>
                    )}
                  </View>
                  <View style={s.cardInfo}>
                    <Text style={s.cardTitle} numberOfLines={1}>{c.name}</Text>
                    <Text style={s.cardMeta}>
                      {c.productCount} product{c.productCount === 1 ? "" : "s"}
                      {children.length > 0 ? ` · ${children.length} sub` : ""}
                    </Text>
                  </View>
                  <View style={s.actionsRow}>
                    <TouchableOpacity onPress={() => openEdit(c)} style={s.iconBtn} activeOpacity={0.7}>
                      <Ionicons name="pencil-outline" size={16} color={colors.blue} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDelete(c)} style={s.iconBtn} activeOpacity={0.7}>
                      <Ionicons name="trash-outline" size={16} color={colors.red} />
                    </TouchableOpacity>
                  </View>
                </View>
                {children.length > 0 && (
                  <View style={s.subList}>
                    {children.map(ch => (
                      <View key={ch.id} style={s.subRow}>
                        {imgUri(ch.imageUrl) ? (
                          <Image source={{ uri: imgUri(ch.imageUrl)! }} style={s.subThumb} resizeMode="cover" />
                        ) : (
                          <Text style={s.subEmoji}>{ch.emoji ?? "↳"}</Text>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={s.subName}>{ch.name}</Text>
                          <Text style={s.subMeta}>{ch.productCount} product{ch.productCount === 1 ? "" : "s"}</Text>
                        </View>
                        <TouchableOpacity onPress={() => openEdit(ch)} style={s.iconBtn} activeOpacity={0.7}>
                          <Ionicons name="pencil-outline" size={14} color={colors.blue} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => confirmDelete(ch)} style={s.iconBtn} activeOpacity={0.7}>
                          <Ionicons name="trash-outline" size={14} color={colors.red} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={m.wrap}>
          <View style={m.header}>
            <Text style={m.headerTitle}>{editing ? "Edit Category" : "New Category"}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.gray500} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={m.body} keyboardShouldPersistTaps="handled">
            <View style={m.previewCard}>
              {imageUrl ? (
                <Image source={{ uri: imgUri(imageUrl) ?? imageUrl }} style={m.previewImg} resizeMode="cover" />
              ) : (
                <Text style={m.previewEmoji}>{emoji || "📦"}</Text>
              )}
              <Text style={m.previewName} numberOfLines={1}>{name.trim() || "Category name"}</Text>
            </View>

            <Text style={m.label}>Name *</Text>
            <TextInput
              style={m.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Snacks"
              placeholderTextColor={colors.gray400}
            />

            <Text style={m.label}>Image (optional)</Text>
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
            <Text style={m.hint}>Square image works best · jpg / png / webp · max 5 MB</Text>

            <Text style={m.label}>{imageUrl ? "Emoji (fallback)" : "Emoji"}</Text>
            <TextInput
              style={m.input}
              value={emoji}
              onChangeText={setEmoji}
              placeholder="Paste one emoji"
              placeholderTextColor={colors.gray400}
              maxLength={4}
            />
            <View style={m.emojiRow}>
              {EMOJI_SUGGESTIONS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[m.emojiChip, emoji === e && m.emojiChipActive]}
                  onPress={() => setEmoji(e)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={m.label}>Description (optional)</Text>
            <TextInput
              style={[m.input, { minHeight: 72, textAlignVertical: "top" }]}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Local & imported brews, cases and kegs for every shop size."
              placeholderTextColor={colors.gray400}
              multiline
            />
            <Text style={m.hint}>Shown on the buyer home "Shop by category" cards.</Text>

            <Text style={m.label}>Parent category (optional)</Text>
            <View style={m.parentRow}>
              <TouchableOpacity
                style={[m.parentChip, !parentId && m.parentChipActive]}
                onPress={() => setParentId(null)}
                activeOpacity={0.8}
              >
                <Text style={[m.parentChipText, !parentId && m.parentChipTextActive]}>None (top-level)</Text>
              </TouchableOpacity>
              {parentOptions.filter(p => !p.parentId).map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[m.parentChip, parentId === p.id && m.parentChipActive]}
                  onPress={() => setParentId(p.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[m.parentChipText, parentId === p.id && m.parentChipTextActive]}>
                    {p.emoji ?? "📦"} {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={m.footer}>
            <TouchableOpacity
              style={[m.saveBtn, (!name.trim() || saving) && m.saveBtnDisabled]}
              onPress={save}
              disabled={!name.trim() || saving}
              activeOpacity={0.85}
            >
              <Text style={m.saveBtnText}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Category"}</Text>
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
    width: 34, height: 34, borderRadius: radius.sm,
    backgroundColor: colors.blue, alignItems: "center", justifyContent: "center",
  },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
  skeletonCard: { height: 76, borderRadius: radius.md, backgroundColor: colors.gray100 },
  ctaBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.blueLight,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1, borderColor: colors.blue,
  },
  ctaIcon: {
    width: 36, height: 36, borderRadius: radius.sm,
    backgroundColor: colors.blue,
    alignItems: "center", justifyContent: "center",
  },
  ctaTitle: { fontSize: 14, fontFamily: typography.bodySemiBold, color: colors.blue },
  ctaSub: { fontSize: 12, fontFamily: typography.body, color: colors.blue, opacity: 0.8, marginTop: 2 },
  empty: { alignItems: "center", paddingTop: spacing.xxl, gap: spacing.sm },
  emptyText: { fontSize: 16, fontFamily: typography.heading, color: colors.gray400 },
  emptyHint: { fontSize: 13, color: colors.gray400, fontFamily: typography.body, textAlign: "center", lineHeight: 20 },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.blue,
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  emptyBtnText: { color: colors.white, fontSize: 14, fontFamily: typography.bodySemiBold },
  card: {
    backgroundColor: colors.white, borderRadius: radius.md, overflow: "hidden",
    borderWidth: 1, borderColor: colors.gray200,
  },
  cardTop: { flexDirection: "row", alignItems: "center", padding: 12, gap: 12 },
  emojiBox: {
    width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.blueLight,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  emojiText: { fontSize: 22 },
  thumbImg: { width: "100%", height: "100%" },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontFamily: typography.bodySemiBold, color: colors.ink },
  cardMeta: { fontSize: 12, color: colors.gray500, fontFamily: typography.body },
  actionsRow: { flexDirection: "row", gap: 4 },
  iconBtn: {
    width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.offWhite,
    alignItems: "center", justifyContent: "center",
  },
  subList: {
    borderTopWidth: 1, borderTopColor: colors.gray100,
    paddingHorizontal: 12, paddingVertical: 6, gap: 4,
    backgroundColor: colors.offWhite,
  },
  subRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 6,
  },
  subEmoji: { fontSize: 16, width: 24, textAlign: "center" },
  subThumb: { width: 24, height: 24, borderRadius: 4 },
  subName: { fontSize: 13, fontFamily: typography.bodyMedium, color: colors.ink },
  subMeta: { fontSize: 11, color: colors.gray400, fontFamily: typography.body },
});

const m = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.offWhite },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: spacing.md, paddingTop: spacing.lg,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray200,
  },
  headerTitle: { fontSize: 17, fontFamily: typography.heading, color: colors.ink },
  body: { padding: spacing.md, gap: 4, paddingBottom: spacing.xl },
  previewCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: colors.gray200,
  },
  previewEmoji: { fontSize: 28, width: 48, height: 48, textAlign: "center", lineHeight: 48 },
  previewImg: { width: 48, height: 48, borderRadius: radius.sm },
  previewName: { flex: 1, fontSize: 15, fontFamily: typography.bodySemiBold, color: colors.ink },
  label: {
    fontSize: 12, fontFamily: typography.bodySemiBold, color: colors.gray600,
    textTransform: "uppercase", letterSpacing: 0.4, marginTop: 14, marginBottom: 6,
  },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200,
    borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: typography.body, color: colors.ink,
  },
  emojiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  emojiChip: {
    width: 44, height: 44, borderRadius: radius.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200,
    alignItems: "center", justifyContent: "center",
  },
  emojiChipActive: { borderColor: colors.blue, backgroundColor: colors.blueLight },
  parentRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  parentChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200,
  },
  parentChipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  parentChipText: { fontSize: 13, fontFamily: typography.bodyMedium, color: colors.ink },
  parentChipTextActive: { color: colors.white },
  footer: {
    padding: spacing.md, backgroundColor: colors.white,
    borderTopWidth: 1, borderTopColor: colors.gray200,
  },
  saveBtn: {
    backgroundColor: colors.blue, borderRadius: radius.md,
    paddingVertical: 14, alignItems: "center",
  },
  saveBtnDisabled: { backgroundColor: colors.gray200 },
  saveBtnText: { fontSize: 15, fontFamily: typography.bodySemiBold, color: colors.white },
  imageRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  uploadBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: colors.blue, borderRadius: radius.sm,
    paddingHorizontal: 14, paddingVertical: 10, flex: 1,
  },
  uploadBtnText: { fontSize: 13, fontFamily: typography.bodySemiBold, color: colors.blue },
  removeBtn: {
    width: 38, height: 38, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.redLight,
    alignItems: "center", justifyContent: "center",
  },
  hint: { fontSize: 11, color: colors.gray400, fontFamily: typography.body, marginTop: 4 },
});
