"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, MapPin, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { formatPrice } from "@/lib/utils";

interface Profile {
  id: string;
  storeName: string;
  ownerName: string;
  phone: string;
  email?: string | null;
  district: string | null;
  address?: string | null;
  companyName?: string | null;
  panNumber?: string | null;
  creditLimit: number;
  creditUsed: number;
  status: string;
}

function CreditBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const color =
    pct > 80 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-green";
  const textColor =
    pct > 80 ? "text-red-500" : pct > 60 ? "text-amber-600" : "text-green";

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">Credit Used</span>
        <span className={`font-grotesk font-semibold ${textColor}`}>
          {formatPrice(used)} / {formatPrice(limit)}
        </span>
      </div>
      <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 text-right">
        {pct.toFixed(0)}% used
      </p>
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const { user, setAuth, token, clearAuth } = useAuthStore();
  const qc = useQueryClient();

  function handleLogout() {
    clearAuth();
    qc.clear();
    router.push("/login");
  }

  const [editMode, setEditMode] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [locationArea, setLocationArea] = useState("");
  const [address, setAddress] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const { data: profile } = useQuery<Profile>({
    queryKey: ["my-profile"],
    queryFn: () => api.get("/auth/me").then((r) => r.data),
  });

  useEffect(() => {
    if (profile) {
      setStoreName(profile.storeName || "");
      setOwnerName(profile.ownerName || "");
      setLocationArea(profile.district || "");
      setAddress(profile.address || "");
      setCompanyName(profile.companyName || "");
      setPanNumber(profile.panNumber || "");
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: (body: {
      storeName: string;
      ownerName: string;
      district?: string;
      address?: string;
      companyName?: string;
      panNumber?: string;
    }) => api.patch("/auth/me", body).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      if (token && user) {
        setAuth(token, { ...user, storeName: data.storeName });
      }
      setProfileMsg({ type: "ok", text: "Profile updated successfully." });
      setEditMode(false);
      toast.success("Profile updated");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to update profile.";
      setProfileMsg({ type: "err", text: msg });
      toast.error(msg);
    },
  });

  const changePassword = useMutation({
    mutationFn: (body: { oldPassword: string; newPassword: string }) =>
      api.post("/auth/change-password", body),
    onSuccess: () => {
      setPwMsg({ type: "ok", text: "Password changed successfully." });
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
          ?.error ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to change password.";
      setPwMsg({ type: "err", text: msg });
    },
  });

  function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    const pan = panNumber.trim();
    if (pan && !/^\d{9}$/.test(pan)) {
      setProfileMsg({ type: "err", text: "PAN number must be exactly 9 digits." });
      return;
    }
    updateProfile.mutate({
      storeName,
      ownerName,
      district: locationArea.trim() || undefined,
      address: address.trim() || undefined,
      companyName: companyName.trim() || undefined,
      panNumber: pan || undefined,
    });
  }

  function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwMsg({ type: "err", text: "New passwords do not match." });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({ type: "err", text: "Password must be at least 8 characters." });
      return;
    }
    changePassword.mutate({ oldPassword: oldPw, newPassword: newPw });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-grotesk font-bold text-2xl text-ink truncate">My Account</h1>
          {user && (
            <p className="text-xs text-gray-500 mt-1 truncate">
              Signed in as <span className="font-medium text-ink">{user.phone}</span>
              {" · "}
              <span className="uppercase tracking-wider text-blue font-semibold">{user.role}</span>
            </p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm font-medium text-red-500 border border-red-200 hover:bg-red-50 rounded-xl px-3 py-2 transition-colors shrink-0"
        >
          <LogOut size={15} />
          Logout
        </button>
      </div>

      {/* Credit */}
      {profile && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-grotesk font-semibold text-sm text-ink mb-4">
            Credit Limit
          </h2>
          <CreditBar used={profile.creditUsed} limit={profile.creditLimit} />
          <p className="text-xs text-gray-400 mt-3">
            Available:{" "}
            <span className="font-semibold text-ink">
              {formatPrice(Math.max(0, profile.creditLimit - profile.creditUsed))}
            </span>
          </p>
        </div>
      )}

      {/* Profile */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-grotesk font-semibold text-sm text-ink">
            Store Profile
          </h2>
          {!editMode && (
            <button
              onClick={() => {
                setEditMode(true);
                setProfileMsg(null);
              }}
              className="text-xs text-blue font-medium hover:underline"
            >
              Edit
            </button>
          )}
        </div>

        {!editMode ? (
          <div className="space-y-3 text-sm">
            {[
              ["Store Name", profile?.storeName || "—"],
              ["Owner Name", profile?.ownerName || "—"],
              ["Phone", profile?.phone || "—"],
              ["Email", profile?.email || "—"],
              ["Location", profile?.district || "—"],
              ["Address", profile?.address || "—"],
              ["Company", profile?.companyName || "—"],
              ["PAN Number", profile?.panNumber || "—"],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between gap-3">
                <span className="text-gray-400 shrink-0">{label}</span>
                <span className="font-medium text-ink text-right break-words min-w-0">{val}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span className="text-gray-400">Status</span>
              <span
                className={`font-medium ${
                  profile?.status === "ACTIVE" ? "text-green" : "text-red-500"
                }`}
              >
                {profile?.status}
              </span>
            </div>
            {(!profile?.panNumber || !profile?.companyName || !profile?.address) && (
              <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-3 text-xs">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>
                  Your store profile is incomplete. Add your company name, PAN number and address for VAT-compliant invoices.
                </span>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Store Name
              </label>
              <input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Owner Name
              </label>
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Location (District)
              </label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={locationArea}
                  onChange={(e) => setLocationArea(e.target.value)}
                  placeholder="e.g. Balaju, Kathmandu"
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Delivery Address
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, landmark, etc."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Company Name <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Registered company name (for VAT)"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                PAN Number <span className="text-gray-400 font-normal">(9 digits, for VAT invoices)</span>
              </label>
              <input
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
                inputMode="numeric"
                maxLength={9}
                placeholder="123456789"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
              />
            </div>

            {profileMsg && (
              <div
                className={`flex items-center gap-2 text-xs rounded-xl p-3 ${
                  profileMsg.type === "ok"
                    ? "bg-green-light text-green"
                    : "bg-red-50 text-red-500"
                }`}
              >
                {profileMsg.type === "ok" ? (
                  <CheckCircle2 size={13} />
                ) : (
                  <AlertCircle size={13} />
                )}
                {profileMsg.text}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={updateProfile.isPending}
                className="flex-1 bg-blue hover:bg-blue-dark disabled:bg-gray-200 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                {updateProfile.isPending ? "Saving…" : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="flex-1 border border-gray-200 text-sm text-gray-600 hover:bg-blue-pale py-2.5 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="font-grotesk font-semibold text-sm text-ink mb-4">
          Change Password
        </h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              minLength={8}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
            />
          </div>

          {pwMsg && (
            <div
              className={`flex items-center gap-2 text-xs rounded-xl p-3 ${
                pwMsg.type === "ok"
                  ? "bg-green-light text-green"
                  : "bg-red-50 text-red-500"
              }`}
            >
              {pwMsg.type === "ok" ? (
                <CheckCircle2 size={13} />
              ) : (
                <AlertCircle size={13} />
              )}
              {pwMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={changePassword.isPending}
            className="w-full bg-blue hover:bg-blue-dark disabled:bg-gray-200 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            {changePassword.isPending ? "Changing…" : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
