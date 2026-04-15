"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, X, ChevronRight, ToggleLeft, ToggleRight, Plus } from "lucide-react";
import api from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface Customer {
  id: string;
  storeName: string;
  ownerName?: string | null;
  phone: string;
  email?: string | null;
  district?: string | null;
  address?: string | null;
  companyName?: string | null;
  panNumber?: string | null;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  creditLimit: number;
  creditUsed: number;
  createdAt: string;
}

interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
}

interface LedgerEntry {
  id: string;
  type: "DEBIT" | "CREDIT";
  amount: number;
  note?: string | null;
  createdAt: string;
}

interface Note {
  id: string;
  note: string;
  createdAt: string;
}

type Tab = "profile" | "orders" | "ledger" | "notes";

function CreditMiniBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const color = pct > 80 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-green";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 font-grotesk">{pct.toFixed(0)}%</span>
    </div>
  );
}

export default function AdminCustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("profile");
  const [newNote, setNewNote] = useState("");
  const [editCredit, setEditCredit] = useState<string | null>(null);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["admin-customers", search],
    queryFn: () =>
      api
        .get(`/customers?limit=100${search ? `&search=${encodeURIComponent(search)}` : ""}`)
        .then((r) => r.data?.customers ?? []),
  });

  const selectedCustomer = customers.find((c) => c.id === selectedId);

  const { data: customerOrders = [] } = useQuery<CustomerOrder[]>({
    queryKey: ["customer-orders", selectedId],
    queryFn: () =>
      api.get(`/orders?buyerId=${selectedId}&limit=20`).then((r) =>
        Array.isArray(r.data) ? r.data : r.data.orders || []
      ),
    enabled: !!selectedId && tab === "orders",
  });

  const { data: ledger = [] } = useQuery<LedgerEntry[]>({
    queryKey: ["customer-ledger", selectedId],
    queryFn: () =>
      api.get(`/ledger?buyerId=${selectedId}&limit=20`).then((r) =>
        Array.isArray(r.data) ? r.data : r.data.entries ?? []
      ),
    enabled: !!selectedId && tab === "ledger",
  });

  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: ["customer-notes", selectedId],
    queryFn: () =>
      api.get(`/customers/${selectedId}`).then((r) => r.data?.notes ?? []),
    enabled: !!selectedId && tab === "notes",
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/customers/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-customers"] }),
  });

  const updateCredit = useMutation({
    mutationFn: ({ id, creditLimit }: { id: string; creditLimit: number }) =>
      api.patch(`/customers/${id}/credit`, { creditLimit }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      setEditCredit(null);
    },
  });

  const addNote = useMutation({
    mutationFn: (note: string) =>
      api.post(`/customers/${selectedId}/notes`, { note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-notes", selectedId] });
      setNewNote("");
    },
  });

  const TABS: { key: Tab; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "orders", label: "Orders" },
    { key: "ledger", label: "Ledger" },
    { key: "notes", label: "Notes" },
  ];

  return (
    <div className="flex gap-6 h-[calc(100vh-100px)]">
      {/* Customer list */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-5 space-y-3">
          <h1 className="font-grotesk font-bold text-2xl text-ink">Customers</h1>
          <div className="relative max-w-sm">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search store name, phone…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white border border-gray-200 rounded-2xl">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 bg-blue-pale rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-off-white sticky top-0">
                <tr>
                  {["Store", "Phone", "District", "Credit", "Status", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => {
                      setSelectedId(c.id);
                      setTab("profile");
                    }}
                    className={`cursor-pointer hover:bg-off-white transition-colors ${
                      selectedId === c.id ? "bg-blue-pale" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{c.storeName}</p>
                      <p className="text-xs text-gray-400">{c.ownerName}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {c.district || "—"}
                    </td>
                    <td className="px-4 py-3 w-32">
                      <CreditMiniBar used={c.creditUsed} limit={c.creditLimit} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                          c.status === "ACTIVE"
                            ? "bg-green-light text-green"
                            : "bg-red-50 text-red-500"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight size={14} className="text-gray-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedCustomer && (
        <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col overflow-hidden bg-white border border-gray-200 rounded-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <p className="font-grotesk font-bold text-sm text-ink truncate">
              {selectedCustomer.storeName}
            </p>
            <button
              onClick={() => setSelectedId(null)}
              className="p-1.5 rounded-lg hover:bg-gray-200"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                  tab === t.key
                    ? "border-b-2 border-blue text-blue"
                    : "text-gray-400 hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {tab === "profile" && (
              <div className="space-y-4">
                <div className="space-y-2 text-sm">
                  {[
                    ["Owner", selectedCustomer.ownerName || "—"],
                    ["Phone", selectedCustomer.phone],
                    ["Email", selectedCustomer.email || "—"],
                    ["District", selectedCustomer.district || "—"],
                    ["Address", selectedCustomer.address || "—"],
                    ["Company", selectedCustomer.companyName || "—"],
                    ["PAN", selectedCustomer.panNumber || "—"],
                    [
                      "Member since",
                      new Date(selectedCustomer.createdAt).toLocaleDateString(),
                    ],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <span className="text-gray-400 shrink-0">{label}</span>
                      <span className="font-medium text-ink text-right break-words min-w-0">{val}</span>
                    </div>
                  ))}
                </div>

                {/* Credit limit */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-600">
                      Credit Limit
                    </p>
                    <button
                      onClick={() =>
                        setEditCredit(String(selectedCustomer.creditLimit))
                      }
                      className="text-xs text-blue hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  {editCredit !== null ? (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={editCredit}
                        onChange={(e) => setEditCredit(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue"
                      />
                      <button
                        onClick={() =>
                          updateCredit.mutate({
                            id: selectedCustomer.id,
                            creditLimit: Number(editCredit),
                          })
                        }
                        className="px-3 py-1.5 bg-blue text-white text-xs rounded-lg"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <p className="font-grotesk font-semibold text-ink">
                      {formatPrice(selectedCustomer.creditLimit)}
                      <span className="text-xs text-gray-400 font-normal ml-1">
                        ({formatPrice(selectedCustomer.creditUsed)} used)
                      </span>
                    </p>
                  )}
                </div>

                {/* Status toggle */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-600">
                      Account Status
                    </p>
                    <button
                      onClick={() =>
                        toggleStatus.mutate({
                          id: selectedCustomer.id,
                          status:
                            selectedCustomer.status === "ACTIVE"
                              ? "SUSPENDED"
                              : "ACTIVE",
                        })
                      }
                      className={selectedCustomer.status === "ACTIVE" ? "text-green" : "text-gray-400"}
                    >
                      {selectedCustomer.status === "ACTIVE" ? (
                        <ToggleRight size={28} />
                      ) : (
                        <ToggleLeft size={28} />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Currently{" "}
                    <span
                      className={
                        selectedCustomer.status === "ACTIVE"
                          ? "text-green font-medium"
                          : "text-red-500 font-medium"
                      }
                    >
                      {selectedCustomer.status}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {tab === "orders" && (
              <div className="space-y-2">
                {customerOrders.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">
                    No orders yet.
                  </p>
                ) : (
                  customerOrders.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-xl text-xs"
                    >
                      <div>
                        <p className="font-grotesk font-semibold text-ink">
                          #{o.orderNumber}
                        </p>
                        <p className="text-gray-400">
                          {new Date(o.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-grotesk font-semibold text-blue">
                          {formatPrice(o.total)}
                        </p>
                        <p className="text-gray-400">{o.status}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "ledger" && (
              <div className="space-y-2">
                {ledger.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">
                    No ledger entries.
                  </p>
                ) : (
                  ledger.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-xl text-xs"
                    >
                      <div>
                        <span
                          className={`font-medium px-2 py-0.5 rounded-full text-xs ${
                            e.type === "CREDIT"
                              ? "bg-green-light text-green"
                              : "bg-red-50 text-red-500"
                          }`}
                        >
                          {e.type}
                        </span>
                        <p className="text-gray-400 mt-1">{e.note || "—"}</p>
                      </div>
                      <p className="font-grotesk font-semibold text-ink">
                        {formatPrice(e.amount)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "notes" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add internal note…"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newNote.trim()) {
                        addNote.mutate(newNote.trim());
                      }
                    }}
                  />
                  <button
                    onClick={() => newNote.trim() && addNote.mutate(newNote.trim())}
                    className="p-2 bg-blue text-white rounded-lg hover:bg-blue-dark transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {notes.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">
                    No notes yet.
                  </p>
                ) : (
                  notes.map((n) => (
                    <div
                      key={n.id}
                      className="bg-off-white rounded-xl p-3 text-xs"
                    >
                      <p className="text-ink">{n.note}</p>
                      <p className="text-gray-400 mt-1">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
