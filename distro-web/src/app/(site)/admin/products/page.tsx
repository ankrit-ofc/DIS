"use client";

import { useState, useRef, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Plus,
  Pencil,
  Search,
  X,
  Upload,
  ToggleLeft,
  ToggleRight,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import api from "@/lib/api";
import { formatPrice, getImageUrl } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  brand?: string;
  sellUnit: "PIECE" | "CARTON";
  price: number;
  mrp?: number | null;
  unit: string;
  moq: number;
  piecesPerCarton?: number | null;
  pricePerCarton?: number | string | null;
  stockQty: number;
  active: boolean;
  imageUrl?: string;
  categoryId?: string;
  description?: string;
}

interface Category {
  id: string;
  name: string;
}

const EMPTY: Partial<Product> = {
  name: "",
  brand: "",
  sellUnit: "PIECE",
  price: 0,
  mrp: 0,
  unit: "pcs",
  moq: 1,
  stockQty: 0,
  active: true,
  imageUrl: "",
  description: "",
};

const inputCls = (hasError: boolean) =>
  `w-full border rounded-[6px] px-4 py-2.5 text-sm focus:outline-none focus:border-blue ${
    hasError ? "border-red-400 bg-red-50/40" : "border-gray-200"
  }`;

function ProductsContent() {
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(
    searchParams.get("action") === "add"
  );
  const [editProduct, setEditProduct] = useState<Partial<Product>>(EMPTY);
  const [isEdit, setIsEdit] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  // In add mode, Active follows "has stock" until the admin touches it.
  const [activeTouched, setActiveTouched] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["admin-products", search],
    queryFn: async () => {
      const r = await api.get(`/products?${search ? `q=${encodeURIComponent(search)}&` : ""}limit=100&all=1`);
      const raw: any[] = Array.isArray(r.data) ? r.data : r.data.products || [];
      // Normalise field names from API (stockQty/imageUrl) to our interface
      return raw.map((p) => ({
        ...p,
        stockQty: p.stockQty ?? p.stock ?? 0,
        imageUrl: p.imageUrl ?? p.image ?? undefined,
      })) as Product[];
    },
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/categories").then((r) => r.data.categories ?? r.data ?? []),
  });

  const saveProduct = useMutation({
    mutationFn: (data: Partial<Product>) => {
      const isCarton = data.sellUnit === "CARTON";
      const payload: Record<string, any> = {
        name: data.name,
        brand: data.brand || undefined,
        sellUnit: data.sellUnit,
        mrp: data.mrp || undefined,
        stockQty: data.stockQty ?? 0,
        active: data.active ?? true,
        imageUrl: data.imageUrl || undefined,
        description: data.description || undefined,
        categoryId: data.categoryId || undefined,
        moq: data.moq ?? 1,
        ...(isCarton
          ? {
              piecesPerCarton: data.piecesPerCarton,
              pricePerCarton:
                data.pricePerCarton != null ? Number(data.pricePerCarton) : undefined,
            }
          : {
              price: data.price,
              unit: data.unit || "pcs",
              piecesPerCarton: null,
              pricePerCarton: null,
            }),
      };
      return isEdit && data.id
        ? api.patch(`/products/${data.id}`, payload)
        : api.post("/products", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setShowModal(false);
      setEditProduct(EMPTY);
      setSaveError(null);
    },
    onError: (err: any) => {
      setSaveError(err?.response?.data?.error ?? err?.message ?? "Save failed");
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/products/${id}`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const bulkDeactivate = useMutation({
    mutationFn: () =>
      Promise.all(
        selected.map((id) => api.patch(`/products/${id}`, { active: false }))
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setSelected([]);
    },
  });

  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isCarton = editProduct.sellUnit === "CARTON";
  const derivedPerPiece =
    isCarton && editProduct.pricePerCarton && editProduct.piecesPerCarton
      ? Number(editProduct.pricePerCarton) / Number(editProduct.piecesPerCarton)
      : null;
  // Likely-typo warning: buy price above MRP.
  const effectivePerPiece = isCarton ? derivedPerPiece : editProduct.price || null;
  const priceAboveMrp =
    effectivePerPiece != null &&
    !!editProduct.mrp &&
    effectivePerPiece > Number(editProduct.mrp);

  const stockQty = Number(editProduct.stockQty ?? 0);
  const cartonBreakdown =
    isCarton && editProduct.piecesPerCarton
      ? {
          cartons: Math.floor(stockQty / Number(editProduct.piecesPerCarton)),
          loose: stockQty % Number(editProduct.piecesPerCarton),
        }
      : null;

  function validate(p: Partial<Product>): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!p.name?.trim()) errs.name = "Required";
    if (p.mrp != null && p.mrp !== 0 && (isNaN(Number(p.mrp)) || Number(p.mrp) < 0)) errs.mrp = "Must be 0 or more";
    if (p.sellUnit === "CARTON") {
      if (
        p.piecesPerCarton == null ||
        !Number.isInteger(Number(p.piecesPerCarton)) ||
        Number(p.piecesPerCarton) < 1
      ) {
        errs.piecesPerCarton = "Whole number ≥ 1";
      }
      if (p.pricePerCarton == null || isNaN(Number(p.pricePerCarton)) || Number(p.pricePerCarton) <= 0) {
        errs.pricePerCarton = "Must be greater than 0";
      }
      if (p.moq == null || !Number.isInteger(Number(p.moq)) || Number(p.moq) < 1) {
        errs.moq = "Whole number ≥ 1";
      }
    } else {
      if (p.price == null || isNaN(Number(p.price)) || Number(p.price) <= 0) {
        errs.price = "Must be greater than 0";
      }
      if (p.moq == null || !Number.isInteger(Number(p.moq)) || Number(p.moq) < 1) {
        errs.moq = "Whole number ≥ 1";
      }
    }
    return errs;
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("image", file);
    try {
      const res = await api.post("/products/upload-image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // API returns { url, imageUrl } — use whichever is present
      const uploadedUrl: string = res.data.url ?? res.data.imageUrl;
      setEditProduct((p) => ({ ...p, imageUrl: getImageUrl(uploadedUrl) }));
    } catch (err: any) {
      alert(`Image upload failed: ${err?.response?.data?.error ?? err?.message ?? "Unknown error"}`);
    } finally {
      setUploading(false);
    }
  }

  function openAdd() {
    setIsEdit(false);
    setEditProduct(EMPTY);
    setActiveTouched(false);
    setFieldErrors({});
    setSaveError(null);
    setShowModal(true);
  }

  function openEdit(product: Product) {
    setIsEdit(true);
    setEditProduct({
      ...product,
      pricePerCarton:
        product.pricePerCarton != null ? Number(product.pricePerCarton) : undefined,
    });
    setActiveTouched(true);
    setFieldErrors({});
    setSaveError(null);
    setShowModal(true);
  }

  function toggleSelect(id: string) {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
    );
  }

  function setStock(next: number) {
    setEditProduct((p) => ({ ...p, stockQty: next }));
    // New products with no stock default to inactive unless the admin decided.
    if (!isEdit && !activeTouched) {
      setEditProduct((p) => ({ ...p, active: next > 0 }));
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    const errs = validate(editProduct);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setSaveError("Fill the highlighted required fields");
      return;
    }
    saveProduct.mutate(editProduct);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-grotesk font-bold text-xl text-ink">Products</h1>
        <div className="flex gap-2">
          {selected.length > 0 && (
            <button
              onClick={() => bulkDeactivate.mutate()}
              className="flex items-center gap-1.5 text-sm text-red-500 border border-red-200 rounded-[6px] px-4 py-2 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
              Deactivate ({selected.length})
            </button>
          )}
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-blue hover:bg-blue-dark text-white text-sm font-medium px-4 py-2 rounded-[6px] transition-colors"
          >
            <Plus size={16} />
            Add Product
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-[6px] text-sm bg-white focus:outline-none focus:border-blue"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-[8px] overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-14 bg-gray-50 rounded-[6px] animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 w-10">
                    <input
                      type="checkbox"
                      className="accent-blue"
                      checked={
                        selected.length === products.length &&
                        products.length > 0
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? products.map((p) => p.id) : []
                        )
                      }
                    />
                  </th>
                  {["Image", "Name", "Sold by", "Price", "MOQ", "Stock (pcs)", "Active", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((p) => {
                  const carton = p.sellUnit === "CARTON";
                  const displayPrice = carton
                    ? Number(p.pricePerCarton ?? 0)
                    : p.price;
                  return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="accent-blue"
                        checked={selected.includes(p.id)}
                        onChange={() => toggleSelect(p.id)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative w-10 h-10 bg-gray-50 rounded-[6px] overflow-hidden">
                        <Image
                          src={getImageUrl(p.imageUrl)}
                          alt={p.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-ink">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.brand}</p>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {carton ? `Carton · ${p.piecesPerCarton ?? "?"} pcs` : "Piece"}
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-grotesk font-medium text-ink">
                        {formatPrice(displayPrice)}
                        <span className="text-xs text-gray-400 font-normal">
                          {" "}/{carton ? "ctn" : "pc"}
                        </span>
                      </p>
                      {p.mrp ? (
                        <p className="text-xs text-gray-400">MRP {formatPrice(p.mrp)}/pc</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-grotesk text-ink">
                      {p.moq} {carton ? "ctn" : "pcs"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`font-grotesk font-semibold text-sm ${
                          p.stockQty === 0
                            ? "text-red-500"
                            : p.stockQty <= (carton ? (p.piecesPerCarton ?? 1) * 5 : p.moq * 2)
                            ? "text-amber-600"
                            : "text-green"
                        }`}
                      >
                        {p.stockQty}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() =>
                          toggleActive.mutate({ id: p.id, active: !p.active })
                        }
                        className={`transition-colors ${
                          p.active ? "text-green" : "text-gray-400"
                        }`}
                      >
                        {p.active ? (
                          <ToggleRight size={22} />
                        ) : (
                          <ToggleLeft size={22} />
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded-[6px] text-gray-400 hover:text-blue hover:bg-gray-50 transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <>
          <div
            className="fixed inset-0 bg-ink/40 z-50"
            onClick={() => setShowModal(false)}
          />
          <div className="fixed inset-x-4 top-8 bottom-8 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[560px] bg-white rounded-[8px] z-50 flex flex-col border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="font-grotesk font-semibold text-base text-ink">
                {isEdit ? "Edit Product" : "Add Product"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-[6px] hover:bg-gray-200"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleFormSubmit}
              className="flex-1 overflow-y-auto p-5 space-y-5"
            >
              {/* ── Required: name ──────────────────────────────────── */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={editProduct.name || ""}
                  onChange={(e) =>
                    setEditProduct((p) => ({ ...p, name: e.target.value }))
                  }
                  className={inputCls(!!fieldErrors.name)}
                />
                {fieldErrors.name && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>
                )}
              </div>

              {/* ── Required: pricing ───────────────────────────────── */}
              <fieldset className="border border-gray-200 rounded-[8px] p-4 space-y-3">
                <legend className="text-xs font-semibold text-gray-600 px-1">Pricing</legend>

                {/* Sold by — at the top of the pricing section */}
                <div>
                  <span className="text-xs font-medium text-gray-600 block mb-1.5">
                    Sold by <span className="text-red-500">*</span>
                  </span>
                  <div className="flex gap-4">
                    {(["PIECE", "CARTON"] as const).map((mode) => (
                      <label key={mode} className="flex items-center gap-1.5 cursor-pointer text-sm text-ink">
                        <input
                          type="radio"
                          name="sellUnit"
                          className="accent-blue"
                          checked={(editProduct.sellUnit ?? "PIECE") === mode}
                          onChange={() =>
                            setEditProduct((p) => ({
                              ...p,
                              sellUnit: mode,
                              moq: mode === "CARTON" ? 1 : p.moq ?? 1,
                            }))
                          }
                        />
                        {mode === "PIECE" ? "Piece" : "Carton"}
                      </label>
                    ))}
                  </div>
                </div>

                {!isCarton ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">
                        Price (Rs/pc) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editProduct.price || ""}
                        onChange={(e) =>
                          setEditProduct((p) => ({ ...p, price: Number(e.target.value) }))
                        }
                        className={inputCls(!!fieldErrors.price)}
                      />
                      {fieldErrors.price && (
                        <p className="text-xs text-red-500 mt-1">{fieldErrors.price}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">
                        MRP (Rs/pc)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editProduct.mrp || ""}
                        onChange={(e) =>
                          setEditProduct((p) => ({ ...p, mrp: Number(e.target.value) }))
                        }
                        className={inputCls(!!fieldErrors.mrp)}
                      />
                      {fieldErrors.mrp && (
                        <p className="text-xs text-red-500 mt-1">{fieldErrors.mrp}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">
                        MOQ (pcs) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={editProduct.moq || ""}
                        onChange={(e) =>
                          setEditProduct((p) => ({ ...p, moq: Number(e.target.value) }))
                        }
                        className={inputCls(!!fieldErrors.moq)}
                      />
                      {fieldErrors.moq && (
                        <p className="text-xs text-red-500 mt-1">{fieldErrors.moq}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">
                        Stock Qty (pcs)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={editProduct.stockQty ?? ""}
                        onChange={(e) => setStock(Number(e.target.value))}
                        className={inputCls(false)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">
                        Pieces per carton <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={editProduct.piecesPerCarton ?? ""}
                        onChange={(e) =>
                          setEditProduct((p) => ({
                            ...p,
                            piecesPerCarton: e.target.value === "" ? undefined : Number(e.target.value),
                          }))
                        }
                        placeholder="e.g. 24"
                        className={inputCls(!!fieldErrors.piecesPerCarton)}
                      />
                      {fieldErrors.piecesPerCarton && (
                        <p className="text-xs text-red-500 mt-1">{fieldErrors.piecesPerCarton}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">
                        Price per carton (Rs) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editProduct.pricePerCarton ?? ""}
                        onChange={(e) =>
                          setEditProduct((p) => ({
                            ...p,
                            pricePerCarton: e.target.value === "" ? undefined : Number(e.target.value),
                          }))
                        }
                        className={inputCls(!!fieldErrors.pricePerCarton)}
                      />
                      {fieldErrors.pricePerCarton && (
                        <p className="text-xs text-red-500 mt-1">{fieldErrors.pricePerCarton}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">
                        MRP (Rs/pc)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editProduct.mrp || ""}
                        onChange={(e) =>
                          setEditProduct((p) => ({ ...p, mrp: Number(e.target.value) }))
                        }
                        className={inputCls(!!fieldErrors.mrp)}
                      />
                      <p className="text-[11px] text-gray-400 mt-1">Used for margin display on buyer cards</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">
                        MOQ (cartons) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={editProduct.moq ?? 1}
                        onChange={(e) =>
                          setEditProduct((p) => ({ ...p, moq: Number(e.target.value) }))
                        }
                        className={inputCls(!!fieldErrors.moq)}
                      />
                      {fieldErrors.moq && (
                        <p className="text-xs text-red-500 mt-1">{fieldErrors.moq}</p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-gray-600 block mb-1">
                        Stock Qty (pcs)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={editProduct.stockQty ?? ""}
                        onChange={(e) => setStock(Number(e.target.value))}
                        className={inputCls(false)}
                      />
                      {cartonBreakdown && (
                        <p className="text-[11px] text-gray-500 mt-1">
                          = {cartonBreakdown.cartons} cartons
                          {cartonBreakdown.loose > 0 ? ` + ${cartonBreakdown.loose} loose pcs` : ""}
                        </p>
                      )}
                    </div>
                    {derivedPerPiece != null && (
                      <div className="col-span-2 bg-gray-50 border border-gray-200 rounded-[6px] px-3 py-2 text-xs text-gray-600">
                        Per-piece price:{" "}
                        <span className="font-grotesk font-semibold text-ink">
                          Rs {derivedPerPiece.toFixed(2)}
                        </span>{" "}
                        (price per carton ÷ pieces per carton)
                      </div>
                    )}
                  </div>
                )}

                {priceAboveMrp && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-[6px] px-3 py-2">
                    <AlertTriangle size={13} />
                    Buy price is above MRP — likely a typo.
                  </p>
                )}
              </fieldset>

              {/* ── Optional details ────────────────────────────────── */}
              <fieldset className="border border-gray-200 rounded-[8px] p-4 space-y-3">
                <legend className="text-xs font-semibold text-gray-600 px-1">Optional details</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">
                      Brand
                    </label>
                    <input
                      value={editProduct.brand || ""}
                      onChange={(e) =>
                        setEditProduct((p) => ({ ...p, brand: e.target.value }))
                      }
                      className={inputCls(false)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">
                      Category
                    </label>
                    <select
                      value={editProduct.categoryId || ""}
                      onChange={(e) =>
                        setEditProduct((p) => ({
                          ...p,
                          categoryId: e.target.value || undefined,
                        }))
                      }
                      className="w-full border border-gray-200 rounded-[6px] px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-blue"
                    >
                      <option value="">No category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!isCarton && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">
                        Unit label
                      </label>
                      <input
                        value={editProduct.unit || ""}
                        onChange={(e) =>
                          setEditProduct((p) => ({ ...p, unit: e.target.value }))
                        }
                        placeholder="pcs, packet, kg…"
                        className={inputCls(false)}
                      />
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600 block mb-1">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      value={editProduct.description || ""}
                      onChange={(e) =>
                        setEditProduct((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-200 rounded-[6px] px-4 py-2.5 text-sm focus:outline-none focus:border-blue resize-none"
                    />
                  </div>
                  {/* Image upload — upload only; pasting arbitrary URLs bypassed
                      the multer mimetype filter, so that path is gone. */}
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600 block mb-2">
                      Product Image
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative w-16 h-16 bg-gray-50 rounded-[6px] overflow-hidden flex-shrink-0">
                        <Image
                          src={getImageUrl(editProduct.imageUrl)}
                          alt="preview"
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>
                      <div>
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                        />
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          disabled={uploading}
                          className="flex items-center gap-2 text-xs text-ink border border-gray-200 rounded-[6px] px-3 py-2 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          <Upload size={13} />
                          {uploading ? "Uploading…" : "Upload Image"}
                        </button>
                        <p className="text-[11px] text-gray-400 mt-1">jpg, png, webp · max 2 MB</p>
                      </div>
                    </div>
                  </div>
                </div>
              </fieldset>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editProduct.active ?? true}
                  onChange={(e) => {
                    setActiveTouched(true);
                    setEditProduct((p) => ({
                      ...p,
                      active: e.target.checked,
                    }));
                  }}
                  className="accent-blue w-4 h-4"
                />
                <span className="text-sm font-medium text-ink">
                  Active (visible to buyers)
                </span>
              </label>

              {saveError && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-[6px] px-4 py-2">
                  {saveError}
                </p>
              )}
              {/* Always clickable: a click with missing fields highlights them
                  instead of silently doing nothing. */}
              <button
                type="submit"
                disabled={saveProduct.isPending}
                className="w-full bg-blue hover:bg-blue-dark disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-medium py-3 rounded-[6px] transition-colors flex items-center justify-center gap-2"
              >
                {saveProduct.isPending && (
                  <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                )}
                {saveProduct.isPending
                  ? "Saving…"
                  : isEdit
                  ? "Save Changes"
                  : "Add Product"}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<div className="text-gray-400">Loading…</div>}>
      <ProductsContent />
    </Suspense>
  );
}
