"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, KeyRound, ChevronDown, ChevronUp } from "lucide-react";
import api from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import {
  PageHeader,
  StatusDot,
  card,
  btnPrimary,
  btnSecondary,
  input,
  thBase,
  thNum,
  tdBase,
  tdNum,
  rowHover,
} from "@/components/admin/ui";

interface Rep {
  id: string;
  ownerName: string | null;
  email: string | null;
  phone: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  createdAt: string;
  ordersThisMonth: number;
  valueThisMonth: number;
}

interface RepOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  buyer: { storeName: string | null; phone: string };
}

export default function AdminSalesPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<Rep | null>(null);

  const { data: reps = [], isLoading } = useQuery<Rep[]>({
    queryKey: ["sales-reps"],
    queryFn: () => api.get("/sales/reps").then((r) => r.data.reps ?? []),
  });

  const { data: repOrders = [] } = useQuery<RepOrder[]>({
    queryKey: ["sales-rep-orders", expanded],
    queryFn: () =>
      api.get(`/sales/reps/${expanded}/orders`).then((r) => r.data.orders ?? []),
    enabled: !!expanded,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/sales/reps/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales-reps"] }),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales Team"
        subtitle="Field order bookers — accounts are admin-created only"
        action={
          <button onClick={() => setShowAdd(true)} className={btnPrimary}>
            <Plus size={16} /> Add Rep
          </button>
        }
      />

      <div className={`${card} overflow-hidden`}>
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-50 rounded-[6px] animate-pulse" />
            ))}
          </div>
        ) : reps.length === 0 ? (
          <p className="p-8 text-sm text-gray-400 text-center">
            No sales reps yet. Add the first one to open the field portal.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className={thBase}>Name</th>
                  <th className={thBase}>Email</th>
                  <th className={thBase}>Phone</th>
                  <th className={thBase}>Status</th>
                  <th className={thNum}>Orders (month)</th>
                  <th className={thNum}>Value (month)</th>
                  <th className={thBase}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reps.map((rep) => (
                  <RepRow
                    key={rep.id}
                    rep={rep}
                    expanded={expanded === rep.id}
                    orders={expanded === rep.id ? repOrders : []}
                    onToggle={() => setExpanded(expanded === rep.id ? null : rep.id)}
                    onSuspend={() =>
                      setStatus.mutate({
                        id: rep.id,
                        status: rep.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                      })
                    }
                    onResetPassword={() => setResetFor(rep)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && <AddRepModal onClose={() => setShowAdd(false)} />}
      {resetFor && (
        <ResetPasswordModal rep={resetFor} onClose={() => setResetFor(null)} />
      )}
    </div>
  );
}

function RepRow({
  rep,
  expanded,
  orders,
  onToggle,
  onSuspend,
  onResetPassword,
}: {
  rep: Rep;
  expanded: boolean;
  orders: RepOrder[];
  onToggle: () => void;
  onSuspend: () => void;
  onResetPassword: () => void;
}) {
  return (
    <>
      <tr className={rowHover}>
        <td className={tdBase}>
          <span className="font-medium">{rep.ownerName ?? "—"}</span>
        </td>
        <td className={tdBase}>{rep.email ?? "—"}</td>
        <td className={tdBase}>{rep.phone}</td>
        <td className={tdBase}>
          <StatusDot status={rep.status} />
        </td>
        <td className={tdNum}>{rep.ordersThisMonth}</td>
        <td className={tdNum}>{formatPrice(rep.valueThisMonth)}</td>
        <td className="px-3 py-2">
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={onResetPassword}
              title="Reset password"
              className="p-1.5 rounded-[6px] text-gray-400 hover:text-blue hover:bg-gray-50 transition-colors"
            >
              <KeyRound size={14} />
            </button>
            <button
              onClick={onSuspend}
              className={`text-xs font-medium px-2.5 py-1 rounded-[6px] border transition-colors ${
                rep.status === "ACTIVE"
                  ? "text-red-600 border-red-200 hover:bg-red-50"
                  : "text-green border-gray-200 hover:bg-gray-50"
              }`}
            >
              {rep.status === "ACTIVE" ? "Suspend" : "Reactivate"}
            </button>
            <button
              onClick={onToggle}
              title="Recent orders"
              className="p-1.5 rounded-[6px] text-gray-400 hover:text-ink hover:bg-gray-50 transition-colors"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-gray-50 px-5 py-3">
            {orders.length === 0 ? (
              <p className="text-xs text-gray-400">No orders placed by this rep yet.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className={thBase}>Order</th>
                    <th className={thBase}>Buyer</th>
                    <th className={thBase}>Status</th>
                    <th className={thNum}>Total</th>
                    <th className={thBase}>Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className={tdBase}>{o.orderNumber}</td>
                      <td className={tdBase}>{o.buyer.storeName ?? o.buyer.phone}</td>
                      <td className={tdBase}>
                        <StatusDot status={o.status} />
                      </td>
                      <td className={tdNum}>{formatPrice(o.total)}</td>
                      <td className={tdBase}>
                        {new Date(o.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function AddRepModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.post("/sales/reps", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-reps"] });
      onClose();
    },
    onError: (err: any) =>
      setError(err?.response?.data?.error ?? err?.message ?? "Failed to create rep"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    create.mutate();
  }

  return (
    <>
      <div className="fixed inset-0 bg-ink/40 z-50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md bg-white rounded-[8px] z-50 border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-grotesk font-semibold text-base text-ink">Add Sales Rep</h2>
          <button onClick={onClose} className="p-2 rounded-[6px] hover:bg-gray-200">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          {[
            { key: "name", label: "Name", type: "text", placeholder: "Full name" },
            { key: "phone", label: "Phone", type: "tel", placeholder: "98XXXXXXXX" },
            { key: "email", label: "Email", type: "email", placeholder: "rep@distro.com.np" },
            { key: "password", label: "Password (min 8)", type: "password", placeholder: "••••••••" },
          ].map((f) => (
            <div key={f.key}>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                {f.label} <span className="text-red-500">*</span>
              </label>
              <input
                required
                type={f.type}
                placeholder={f.placeholder}
                value={(form as any)[f.key]}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                className={`${input} w-full`}
              />
            </div>
          ))}
          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-[6px] px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={create.isPending} className={btnPrimary}>
              {create.isPending ? "Creating…" : "Create Rep"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function ResetPasswordModal({ rep, onClose }: { rep: Rep; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = useMutation({
    mutationFn: () => api.post(`/sales/reps/${rep.id}/reset-password`, { password }),
    onSuccess: onClose,
    onError: (err: any) =>
      setError(err?.response?.data?.error ?? err?.message ?? "Reset failed"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    reset.mutate();
  }

  return (
    <>
      <div className="fixed inset-0 bg-ink/40 z-50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-sm bg-white rounded-[8px] z-50 border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-grotesk font-semibold text-base text-ink">
            Reset password — {rep.ownerName ?? rep.phone}
          </h2>
          <button onClick={onClose} className="p-2 rounded-[6px] hover:bg-gray-200">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              New password (min 8) <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${input} w-full`}
            />
          </div>
          <p className="text-xs text-gray-400">
            All of the rep&apos;s sessions will be signed out.
          </p>
          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-[6px] px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={reset.isPending} className={btnPrimary}>
              {reset.isPending ? "Saving…" : "Reset Password"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
