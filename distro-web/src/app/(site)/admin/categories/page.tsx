"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, Tags, Upload } from "lucide-react";
import api from "@/lib/api";
import { getImageUrl } from "@/lib/utils";

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

export default function AdminCategoriesPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Category | null>(null);
  const [name, setName]           = useState("");
  const [imageUrl, setImageUrl]     = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId]     = useState<string | null>(null);
  const [uploading, setUploading]   = useState(false);
  const [nameError, setNameError]   = useState<string | null>(null);
  const [aspectWarning, setAspectWarning] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["admin-categories"],
    queryFn: () => api.get("/admin/categories").then((r) => r.data.categories ?? []),
  });

  const save = useMutation({
    mutationFn: (data: { name: string; imageUrl: string | null; description: string | null; parentId: string | null }) =>
      editing
        ? api.patch(`/admin/categories/${editing.id}`, data)
        : api.post("/admin/categories", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      closeModal();
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error ?? "Could not save category.");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
    onError: (err: any) => {
      alert(err?.response?.data?.error ?? "Could not delete category.");
    },
  });

  function openAdd() {
    setEditing(null);
    setName(""); setImageUrl(""); setDescription(""); setParentId(null);
    setNameError(null); setAspectWarning(null);
    setShowModal(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setName(c.name);
    setImageUrl(c.imageUrl ?? "");
    setDescription(c.description ?? "");
    setParentId(c.parentId ?? null);
    setNameError(null); setAspectWarning(null);
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setEditing(null); setNameError(null); setAspectWarning(null); }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAspectWarning(null);
    // Soft aspect-ratio check (non-blocking)
    try {
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
      const ratio = dims.w / dims.h;
      if (ratio < 0.8 || ratio > 1.2) {
        setAspectWarning("Image is not square; it will be cropped on display.");
      }
    } catch {
      /* ignore — proceed with upload */
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await api.post("/admin/categories/upload-image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImageUrl(res.data.url);
    } catch {
      alert("Upload failed. Max 5 MB, jpg/png/webp only.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleSave() {
    if (!name.trim()) {
      setNameError("Required");
      return;
    }
    setNameError(null);
    save.mutate({
      name: name.trim(),
      imageUrl: imageUrl || null,
      description: description.trim() || null,
      parentId: parentId || null,
    });
  }

  const topLevel = categories.filter((c) => !c.parentId);
  const parentOptions = categories.filter(
    (c) => !c.parentId && (!editing || c.id !== editing.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-grotesk font-bold text-2xl text-ink">Categories</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {categories.length} total · shown on the buyer home and catalogue screens
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue hover:bg-blue-dark text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      {/* Prominent CTA banner */}
      <button
        onClick={openAdd}
        className="w-full flex items-center gap-4 bg-blue-pale border border-blue/30 rounded-2xl p-4 hover:bg-blue/10 transition-colors group"
      >
        <div className="w-10 h-10 rounded-xl bg-blue flex items-center justify-center flex-shrink-0">
          <Plus size={20} className="text-white" />
        </div>
        <div className="flex-1 text-left">
          <p className="font-grotesk font-semibold text-sm text-blue">Add a new category</p>
          <p className="text-xs text-blue/70 mt-0.5">Create a new section shoppers can browse</p>
        </div>
        <span className="text-blue opacity-0 group-hover:opacity-100 transition-opacity">→</span>
      </button>

      {/* Category list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-blue-pale rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <Tags size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm mb-4">
            No categories yet. Create one to organise products for shoppers.
          </p>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 bg-blue hover:bg-blue-dark text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            <Plus size={16} /> Create first category
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {topLevel.map((c) => {
            const children = categories.filter((k) => k.parentId === c.id);
            return (
              <div key={c.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <div className="w-12 h-12 aspect-square rounded-xl bg-blue-pale flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getImageUrl(c.imageUrl)} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{c.emoji ?? "📦"}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-ink">{c.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {c.productCount} product{c.productCount === 1 ? "" : "s"}
                      {children.length > 0 ? ` · ${children.length} sub-categor${children.length === 1 ? "y" : "ies"}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(c)}
                      className="p-2 rounded-lg text-gray-400 hover:text-blue hover:bg-blue-pale transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${c.name}"?`)) remove.mutate(c.id);
                      }}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {children.length > 0 && (
                  <div className="border-t border-gray-100 bg-off-white">
                    {children.map((ch) => (
                      <div
                        key={ch.id}
                        className="flex items-center gap-3 px-6 py-2.5 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="w-6 h-6 aspect-square rounded bg-blue-pale flex items-center justify-center text-base flex-shrink-0 overflow-hidden">
                          {ch.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={getImageUrl(ch.imageUrl)} alt={ch.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{ch.emoji ?? "↳"}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-ink">{ch.name}</p>
                          <p className="text-xs text-gray-400">
                            {ch.productCount} product{ch.productCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <button
                          onClick={() => openEdit(ch)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue hover:bg-blue-pale transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${ch.name}"?`)) remove.mutate(ch.id);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <>
          <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50" onClick={closeModal} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl z-50 p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-grotesk font-semibold text-base text-ink">
                {editing ? "Edit Category" : "New Category"}
              </h2>
              <button onClick={closeModal}>
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Live preview */}
              <div className="flex items-center gap-3 bg-blue-pale border border-blue/20 rounded-xl p-4">
                <div className="w-14 h-14 aspect-square rounded-xl overflow-hidden bg-white flex items-center justify-center text-3xl flex-shrink-0">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getImageUrl(imageUrl)} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span>📦</span>
                  )}
                </div>
                <p className="font-grotesk font-semibold text-base text-blue truncate">
                  {name.trim() || "Category name"}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (nameError) setNameError(null); }}
                  placeholder="e.g. Snacks"
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue ${
                    nameError ? "border-red-300" : "border-gray-200"
                  }`}
                />
                {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Image (optional)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-blue hover:text-blue transition-colors disabled:opacity-50"
                  >
                    <Upload size={14} />
                    {uploading ? "Uploading…" : imageUrl ? "Change image" : "Upload image"}
                  </button>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-red-400 hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Square image recommended (1:1). JPG, PNG, or WebP. Max 5 MB.</p>
                {aspectWarning && (
                  <p className="text-xs text-amber-600 mt-1">{aspectWarning}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Local & imported brews, cases and kegs for every shop size."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue resize-none"
                />
                <p className="text-xs text-gray-400 mt-1.5">Shown on the buyer home "Shop by category" cards.</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">
                  Parent category (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setParentId(null)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      !parentId
                        ? "bg-blue text-white"
                        : "bg-white border border-gray-200 text-gray-600 hover:border-blue"
                    }`}
                  >
                    None (top-level)
                  </button>
                  {parentOptions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setParentId(p.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        parentId === p.id
                          ? "bg-blue text-white"
                          : "bg-white border border-gray-200 text-gray-600 hover:border-blue"
                      }`}
                    >
                      {p.emoji ?? "📦"} {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSave}
                  disabled={!name.trim() || save.isPending}
                  className="flex-1 bg-blue hover:bg-blue-dark disabled:bg-gray-200 text-white font-medium py-3 rounded-xl transition-colors text-sm"
                >
                  {save.isPending ? "Saving…" : editing ? "Save Changes" : "Add Category"}
                </button>
                <button
                  onClick={closeModal}
                  className="flex-1 border border-gray-200 text-sm text-gray-600 hover:bg-off-white py-3 rounded-xl transition-colors"
                >
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
