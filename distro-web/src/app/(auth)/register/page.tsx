"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertCircle, ChevronRight, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

const MapLocationPicker = dynamic(
  () => import("@/components/MapLocationPicker"),
  { ssr: false, loading: () => <div className="h-80 rounded-xl skeleton" /> }
);

const STEPS = ["Contact", "Verify OTP", "Business", "Password"];

const DISTRICTS = [
  "Kathmandu", "Lalitpur", "Bhaktapur", "Pokhara", "Chitwan",
  "Biratnagar", "Butwal", "Dharan", "Hetauda", "Nepalgunj",
];

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [step, setStep] = useState(0);

  // Step 1
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Step 2
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [step2Loading, setStep2Loading] = useState(false);
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Step 3
  const [ownerName, setOwnerName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [step3Error, setStep3Error] = useState<string | null>(null);

  const handleLocationChange = useCallback((loc: { lat: number; lng: number }, addr?: string) => {
    setLatitude(loc.lat);
    setLongitude(loc.lng);
    if (addr && !address.trim()) setAddress(addr);
  }, [address]);

  // Step 4
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [step4Loading, setStep4Loading] = useState(false);
  const [step4Error, setStep4Error] = useState<string | null>(null);

  useEffect(() => {
    if (step !== 1) return;
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(interval); setCanResend(true); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStep1Error("Enter a valid email address.");
      return;
    }
    if (!/^9[6-8]\d{8}$/.test(phone)) {
      setStep1Error("Enter a valid Nepal phone number (98XXXXXXXX).");
      return;
    }
    setStep1Loading(true);
    setStep1Error(null);
    try {
      await api.post("/auth/request-otp", { email });
      setCountdown(60);
      setCanResend(false);
      setStep(1);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to send OTP.";
      setStep1Error(msg);
      toast.error(msg);
    } finally {
      setStep1Loading(false);
    }
  }

  const handleOtpChange = useCallback((index: number, value: string) => {
    const digit = value.replace(/\D/, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  }, [otp]);

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) { setOtp(text.split("")); otpRefs.current[5]?.focus(); }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) { setStep2Error("Enter all 6 digits."); return; }
    setStep2Loading(true);
    setStep2Error(null);
    try {
      await api.post("/auth/verify-otp", { email, otp: code });
      setStep(2);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Invalid OTP.";
      setStep2Error(msg);
    } finally {
      setStep2Loading(false);
    }
  }

  async function handleResend() {
    setCanResend(false);
    setCountdown(60);
    try { await api.post("/auth/request-otp", { email }); } catch { setCanResend(true); }
  }

  function handleStep3Next(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerName.trim() || !storeName.trim() || !district || !address.trim()) {
      setStep3Error("Fill all required fields.");
      return;
    }
    if (panNumber && !/^\d{9}$/.test(panNumber)) {
      setStep3Error("PAN must be exactly 9 digits.");
      return;
    }
    if (latitude === null || longitude === null) {
      setStep3Error("Pin your store location on the map.");
      return;
    }
    setStep3Error(null);
    setStep(3);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setStep4Error("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setStep4Error("Passwords do not match."); return; }
    if (!agreeTerms) { setStep4Error("Please accept the Terms & Privacy Policy."); return; }

    setStep4Loading(true);
    setStep4Error(null);
    try {
      const res = await api.post("/auth/register", {
        email, phone, password,
        ownerName, storeName, district, address,
        companyName: companyName || undefined,
        panNumber: panNumber || undefined,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
      });
      setAuth(res.data.token, res.data.profile ?? res.data.user);
      toast.success("Account created!");
      router.push(res.data.profile?.role === "ADMIN" ? "/admin" : "/");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Registration failed.";
      setStep4Error(msg);
      toast.error(msg);
    } finally {
      setStep4Loading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="font-grotesk font-bold text-3xl text-blue">DISTRO</Link>
          <p className="text-gray-400 text-sm mt-2">Create your account</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-grotesk font-bold ${i < step ? "bg-green text-white" : i === step ? "bg-blue text-white" : "bg-gray-200 text-gray-400"}`}>
                  {i < step ? <CheckCircle2 size={14} /> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${i === step ? "text-blue" : i < step ? "text-green" : "text-gray-400"}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <ChevronRight size={14} className="text-gray-200" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          {step === 0 && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <h2 className="font-grotesk font-semibold text-lg text-ink">Contact details</h2>
              <p className="text-sm text-gray-400">We&apos;ll send a 6-digit OTP to verify your email.</p>
              <div>
                <label className="text-sm font-medium text-ink block mb-1.5">Email address <span className="text-red-400">*</span></label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="yourshop@gmail.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue" />
              </div>
              <div>
                <label className="text-sm font-medium text-ink block mb-1.5">Phone number <span className="text-red-400">*</span></label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="98XXXXXXXX"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue" />
              </div>
              {step1Error && <div className="flex items-start gap-2 text-red-600 bg-red-50 rounded-xl p-3 text-sm"><AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{step1Error}</div>}
              <button type="submit" disabled={step1Loading}
                className="w-full bg-blue hover:bg-blue-dark disabled:bg-gray-200 text-white font-medium py-3 rounded-xl">
                {step1Loading ? "Sending OTP…" : "Send OTP to email"}
              </button>
            </form>
          )}

          {step === 1 && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <h2 className="font-grotesk font-semibold text-lg text-ink">Verify your email</h2>
                <p className="text-sm text-gray-400 mt-1">Enter the 6-digit code sent to <span className="font-medium text-ink">{email}</span>.</p>
              </div>
              <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input key={i} ref={(el) => { otpRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)} onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className={`w-12 h-14 text-center text-xl font-grotesk font-bold border-2 rounded-xl focus:outline-none ${digit ? "border-blue bg-blue-pale text-blue" : "border-gray-200 text-ink focus:border-blue"}`} />
                ))}
              </div>
              {step2Error && <div className="flex items-start gap-2 text-red-600 bg-red-50 rounded-xl p-3 text-sm"><AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{step2Error}</div>}
              <button type="submit" disabled={step2Loading || otp.join("").length !== 6}
                className="w-full bg-blue hover:bg-blue-dark disabled:bg-gray-200 text-white font-medium py-3 rounded-xl">
                {step2Loading ? "Verifying…" : "Verify OTP"}
              </button>
              <div className="text-center text-sm text-gray-400">
                {canResend ? (
                  <button type="button" onClick={handleResend} className="text-blue font-medium hover:underline">Resend OTP</button>
                ) : (
                  <span>Resend in <span className="font-grotesk font-semibold text-ink">{countdown}s</span></span>
                )}
              </div>
              <button type="button" onClick={() => setStep(0)} className="w-full text-sm text-gray-400 hover:text-ink">← Change email</button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleStep3Next} className="space-y-4">
              <h2 className="font-grotesk font-semibold text-lg text-ink">Business details</h2>
              <div>
                <label className="text-sm font-medium text-ink block mb-1.5">Owner full name <span className="text-red-400">*</span></label>
                <input type="text" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue" />
              </div>
              <div>
                <label className="text-sm font-medium text-ink block mb-1.5">Store / shop name <span className="text-red-400">*</span></label>
                <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} required
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue" />
              </div>
              <div>
                <label className="text-sm font-medium text-ink block mb-1.5">Company name <span className="text-gray-400 text-xs">(optional)</span></label>
                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="For registered businesses"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue" />
              </div>
              <div>
                <label className="text-sm font-medium text-ink block mb-1.5">PAN number <span className="text-gray-400 text-xs">(optional, 9 digits)</span></label>
                <input type="text" inputMode="numeric" value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  placeholder="123456789"
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
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="Street, area"
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue" />
                </div>
                <p className="text-xs text-gray-400 mt-1">Tip: pick a place below to auto-fill this field.</p>
              </div>

              <div className="pt-2">
                <MapLocationPicker
                  onLocationChange={handleLocationChange}
                  initialLocation={latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : undefined}
                  label="Pin your store location *"
                  helperText="Search, drag the marker, or tap the map to set your exact shop location."
                />
              </div>

              {step3Error && <div className="flex items-start gap-2 text-red-600 bg-red-50 rounded-xl p-3 text-sm"><AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{step3Error}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="flex-1 border border-gray-200 text-ink font-medium py-3 rounded-xl">Back</button>
                <button type="submit" className="flex-1 bg-blue hover:bg-blue-dark text-white font-medium py-3 rounded-xl">Continue</button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleRegister} className="space-y-4">
              <h2 className="font-grotesk font-semibold text-lg text-ink">Set password</h2>
              <div>
                <label className="text-sm font-medium text-ink block mb-1.5">Password <span className="text-red-400">*</span></label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="Min 8 characters"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue" />
              </div>
              <div>
                <label className="text-sm font-medium text-ink block mb-1.5">Confirm password <span className="text-red-400">*</span></label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue" />
              </div>
              <label className="flex items-start gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-1" />
                <span>I agree to the <Link href="/terms" target="_blank" className="text-blue hover:underline">Terms &amp; Conditions</Link> and <Link href="/privacy" target="_blank" className="text-blue hover:underline">Privacy Policy</Link>.</span>
              </label>
              {step4Error && <div className="flex items-start gap-2 text-red-600 bg-red-50 rounded-xl p-3 text-sm"><AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{step4Error}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="flex-1 border border-gray-200 text-ink font-medium py-3 rounded-xl">Back</button>
                <button type="submit" disabled={step4Loading} className="flex-1 bg-blue hover:bg-blue-dark disabled:bg-gray-200 text-white font-medium py-3 rounded-xl">
                  {step4Loading ? "Creating…" : "Create Account"}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-400 mt-5">
          Already have an account? <Link href="/login" className="text-blue font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
