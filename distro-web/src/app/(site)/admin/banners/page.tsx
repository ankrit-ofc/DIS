"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight, Upload, ImageIcon } from "lucide-react";
import api from "@/lib/api";
import { getImageUrl } from "@/lib/utils";

interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  bgColor: string;
  textColor: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
}

const PRESETS = [
  { label: "Brand Blue",   bgColor: "#1A4BDB", textColor: "#FFFFFF" },
  { label: "Ink Dark",     bgColor: "#0D1120", textColor: "#FFFFFF" },
  { label: "Forest Green", bgColor: "#00A859", textColor: "#FFFFFF" },
  { label: "Crimson",      bgColor: "#C41230", textColor: "#FFFFFF" },
  { label: "Amber",        bgColor: "#F59E0B", textColor: "#0D1120" },
  { label: "Purple",       bgColor: "#7C3AED", textColor: "#FFFFFF" },
  { label: "Teal",         bgColor: "#0E7490", textColor: "#FFFFFF" },
  { label: "Rose",         bgColor: "#BE185D", textColor: "#FFFFFF" },
];

function BannerPreview({ title, subtitle, imageUrl, bgColor, textColor }: Partial<Banner>) {
  const hasImage = !!imageUrl;
  return (
    <div
      className="h-28 rounded-2xl overflow-hidden relative flex flex-col justify-end p-4"
      style={{ backgroundColor: hasImage ? "#000" : bgColor }}
    >
      {hasImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getImageUrl(imageUrl)}
          alt="Banner preview"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {!hasImage && (
        <div
          className="absolute right-0 top-0 w-32 h-32 rounded-full opacity-10 translate-x-10 -translate-y-10"
          style={{ backgroundColor: textColor }}
        />
      )}
      {/* Text overlay */}
      <div className="relative z-10">
        {hasImage && (
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent -mb-4 -mx-4" />
        )}
        {title && (
          <p
            className="font-grotesk font-bold text-base leading-tight relative"
            style={{ color: hasImage ? "#fff" : textColor }}
          >
            {title}
          </p>
        )}
        {subtitle && (
          <p
            className="text-sm mt-0.5 relative"
            style={{ color: hasImage ? "rgba(255,255,255,0.85)" : textColor, opacity: hasImage ? 1 : 0.85 }}
          >
            {subtitle}
          </p>
        )}
        {!title && !subtitle && (
          <p className="text-sm text-white/50">Preview will appear here</p>
        )}
      </div>
    </div>
  );
}

export default function AdminBannersPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState<Banner | null>(null);
  const [title, setTitle]             = useState("");
  const [subtitle, setSubtitle]       = useState("");
  const [imageUrl, setImageUrl]       = useState("");
  const [bgColor, setBgColor]         = useState(PRESETS[0].bgColor);
  const [textColor, setTextColor]     = useState(PRESETS[0].textColor);
  const [uploading, setUploading]     = useState(false);

  const { data: banners = [], isLoading } = useQuery<Banner[]>({
    queryKey: ["admin-banners"],
    queryFn: () => api.get("/admin/banners").then((r) => r.data.banners ?? []),
  });

  const save = useMutation({
    mutationFn: (data: Partial<Banner>) =>
      editing
        ? api.patch(`/admin/banners/${editing.id}`, data)
        : api.post("/admin/banners", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-banners"] });
      closeModal();
    },
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/admin/banners/${id}`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-banners"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/banners/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-banners"] }),
  });

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

  function closeModal() { setShowModal(false); setEditing(null); }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await api.post("/admin/banners/upload-image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImageUrl(res.data.url); // store relative path; getImageUrl() used at display time
    } catch {
      alert("Upload failed. Max 5 MB, jpg/png/webp only.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleSave() {
    save.mutate({
      title,
      subtitle: subtitle || undefined,
      imageUrl: imageUrl || undefined,
      bgColor,
      textColor,
      active: editing?.active ?? true,
    });
  }

  const activeBanners = banners.filter((b) => b.active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-grotesk font-bold text-2xl text-ink">Banners</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {activeBanners.length} active · shown as slides on the buyer home screen
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue hover:bg-blue-dark text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={16} /> Add Banner
        </button>
      </div>

      {/* Live preview strip */}
      {activeBanners.length > 0 && (
        <div className="rounded-2xl border border-blue/20 overflow-hidden">
          <div className="bg-blue-pale px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-blue uppercase tracking-wide">App Preview</span>
            <span className="text-xs text-blue">{activeBanners.length} slide{activeBanners.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="p-4 flex gap-3 overflow-x-auto">
            {activeBanners.map((b) => (
              <div key={b.id} className="flex-shrink-0 w-56">
                <BannerPreview
                  title={b.title} subtitle={b.subtitle}
                  imageUrl={b.imageUrl} bgColor={b.bgColor} textColor={b.textColor}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Banner list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-blue-pale rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : banners.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <ImageIcon size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No banners yet. Add one to show it on the home screen.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((b) => (
            <div
              key={b.id}
              className={`bg-white border rounded-2xl overflow-hidden transition-colors ${b.active ? "border-blue/30" : "border-gray-200"}`}
            >
              <div className="flex items-center gap-4 p-4">
                {/* Thumbnail or swatch */}
                <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden">
                  {b.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getImageUrl(b.imageUrl)}
                      alt={b.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center font-grotesk font-bold text-sm"
                      style={{ backgroundColor: b.bgColor, color: b.textColor }}
                    >
                      {b.title.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${b.active ? "text-ink" : "text-gray-400"}`}>
                    {b.title}
                  </p>
                  {b.subtitle && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{b.subtitle}</p>
                  )}
                  <p className="text-xs text-gray-300 mt-1">
                    {b.imageUrl ? "Image poster" : b.bgColor}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${b.active ? "bg-green-light text-green" : "bg-gray-100 text-gray-400"}`}>
                    {b.active ? "Active" : "Inactive"}
                  </span>
                  <button onClick={() => toggle.mutate({ id: b.id, active: !b.active })} className={b.active ? "text-green" : "text-gray-300"}>
                    {b.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                  <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue hover:bg-blue-pale transition-colors">
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => { if (confirm("Delete this banner?")) remove.mutate(b.id); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <>
          <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50" onClick={closeModal} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl z-50 p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-grotesk font-semibold text-base text-ink">
                {editing ? "Edit Banner" : "New Banner"}
              </h2>
              <button onClick={closeModal}><X size={18} className="text-gray-400" /></button>
            </div>

            <div className="space-y-4">
              {/* Live preview */}
              <BannerPreview
                title={title} subtitle={subtitle}
                imageUrl={imageUrl} bgColor={bgColor} textColor={textColor}
              />

              {/* Image upload */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Poster image</label>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
                <div className="flex gap-2">
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-blue hover:text-blue transition-colors disabled:opacity-50"
                  >
                    <Upload size={14} />
                    {uploading ? "Uploading…" : imageUrl ? "Change image" : "Upload image"}
                  </button>
                  {imageUrl && (
                    <button
                      onClick={() => setImageUrl("")}
                      className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-red-400 hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">jpg / png / webp · max 5 MB · recommended 1200×480px</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Title *</label>
                <input
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Free delivery this week"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Subtitle (optional)</label>
                <input
                  value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="e.g. On orders above Rs 5,000"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
                />
              </div>

              {/* Color presets — only relevant when no image */}
              {!imageUrl && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-2">Background color</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {PRESETS.map((p) => (
                      <button
                        key={p.bgColor}
                        onClick={() => { setBgColor(p.bgColor); setTextColor(p.textColor); }}
                        title={p.label}
                        className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${bgColor === p.bgColor ? "border-ink scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: p.bgColor }}
                      />
                    ))}
                    <div className="flex items-center gap-1 ml-1">
                      <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200" title="Custom background" />
                      <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200" title="Custom text color" />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSave}
                  disabled={!title.trim() || save.isPending || uploading}
                  className="flex-1 bg-blue hover:bg-blue-dark disabled:bg-gray-200 text-white font-medium py-3 rounded-xl transition-colors text-sm"
                >
                  {save.isPending ? "Saving…" : editing ? "Save Changes" : "Add Banner"}
                </button>
                <button onClick={closeModal} className="flex-1 border border-gray-200 text-sm text-gray-600 hover:bg-off-white py-3 rounded-xl transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
