"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

const DISTRICTS = [
  "Kathmandu", "Lalitpur", "Bhaktapur", "Pokhara", "Chitwan",
  "Biratnagar", "Butwal", "Dharan", "Hetauda", "Nepalgunj",
];

export default function OnboardingPage() {
  const router = useRouter();
  const { token, user, setAuth } = useAuthStore();

  const [phone, setPhone] = useState("");
  const [storeName, setStoreName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^9[6-8]\d{8}$/.test(phone)) { setError("Enter a valid Nepal phone number (98XXXXXXXX)."); return; }
    if (!storeName.trim() || !district || !address.trim()) { setError("Please fill all required fields."); return; }
    if (panNumber && !/^\d{9}$/.test(panNumber)) { setError("PAN must be exactly 9 digits."); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/auth/complete-onboarding", {
        phone, storeName, district, address,
        companyName: companyName || undefined,
        panNumber: panNumber || undefined,
      });
      if (token && user) setAuth(token, res.data.profile);
      toast.success("Profile completed!");
      router.push("/");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to complete profile.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="font-grotesk font-bold text-3xl text-blue">DISTRO</Link>
          <p className="text-gray-400 text-sm mt-2">Complete your profile to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-grotesk font-semibold text-lg text-ink">Business details</h2>

          <div>
            <label className="text-sm font-medium text-ink block mb-1.5">Phone number <span className="text-red-400">*</span></label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="98XXXXXXXX"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue" />
          </div>
          <div>
            <label className="text-sm font-medium text-ink block mb-1.5">Store / shop name <span className="text-red-400">*</span></label>
            <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue" />
          </div>
          <div>
            <label className="text-sm font-medium text-ink block mb-1.5">Company name <span className="text-gray-400 text-xs">(optional)</span></label>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue" />
          </div>
          <div>
            <label className="text-sm font-medium text-ink block mb-1.5">PAN number <span className="text-gray-400 text-xs">(optional, 9 digits)</span></label>
            <input type="text" inputMode="numeric" value={panNumber}
              onChange={(e) => setPanNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue" />
          </div>
          <div>
            <label className="text-sm font-medium text-ink block mb-1.5">District <span className="text-red-400">*</span></label>
            <select value={district} onChange={(e) => setDistrict(e.target.value)} required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue bg-white">
              <option value="">Select district</option>
              {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-ink block mb-1.5">Address <span className="text-red-400">*</span></label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3.5 top-3 text-gray-400" />
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue" />
            </div>
          </div>

          {error && <div className="flex items-start gap-2 text-red-600 bg-red-50 rounded-xl p-3 text-sm"><AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{error}</div>}

          <button type="submit" disabled={loading}
            className="w-full bg-blue hover:bg-blue-dark disabled:bg-gray-200 text-white font-medium py-3 rounded-xl">
            {loading ? "Saving…" : "Complete Setup"}
          </button>
        </form>
      </div>
    </div>
  );
}
