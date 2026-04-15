"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { GoogleLogin } from "@react-oauth/google";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

type Mode = "password" | "otp";
type Audience = "buyer" | "admin";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  const [audience, setAudience] = useState<Audience>("buyer");
  const [mode, setMode] = useState<Mode>("password");

  // Password mode
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockMinutes, setLockMinutes] = useState<number | null>(null);

  // OTP mode
  const [otpContact, setOtpContact] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpMethod, setOtpMethod] = useState<"email" | "phone">("email");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!otpSent) return;
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          setCanResend(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [otpSent]);

  function redirectByRole(user: { role: string }) {
    const redirect = searchParams.get("redirect");
    if (user.role === "ADMIN") router.push(redirect || "/admin");
    else router.push(redirect || "/");
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLockMinutes(null);
    try {
      const res = await api.post("/auth/login", { email: identifier, password });
      const user = res.data.user ?? res.data.profile;
      if (audience === "admin" && user.role !== "ADMIN") {
        setError("That account is not an admin. Switch to Shopkeeper to continue.");
        setLoading(false);
        return;
      }
      if (audience === "buyer" && user.role === "ADMIN") {
        setError("Admins must use the Admin tab to sign in.");
        setLoading(false);
        return;
      }
      setAuth(res.data.token, user);
      toast.success("Welcome back!");
      redirectByRole(user);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; error?: string; minutesLeft?: number; code?: string } } })
        ?.response?.data;
      const isNetworkError = !(err as { response?: unknown })?.response;
      if (isNetworkError) setError("Cannot reach the server. Make sure the API is running.");
      else if (data?.code === "ACCOUNT_SUSPENDED") setError("Your account has been suspended.");
      else if (data?.code === "ACCOUNT_LOCKED" || data?.minutesLeft) { setLockMinutes(data?.minutesLeft ?? 5); setError(null); }
      else setError(data?.message || data?.error || "Incorrect credentials.");
      setLoading(false);
    }
  }

  function isEmail(s: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  function emailDomain(s: string): string | null {
    const at = s.indexOf("@");
    if (at < 0) return null;
    const domain = s.slice(at + 1).trim().toLowerCase();
    return /^[^\s@]+\.[^\s@]+$/.test(domain) ? domain : null;
  }

  function providerLabel(domain: string): string {
    if (domain === "gmail.com" || domain === "googlemail.com") return "Gmail";
    if (["outlook.com", "hotmail.com", "live.com", "msn.com"].includes(domain)) return "Outlook";
    if (domain === "yahoo.com" || domain.startsWith("yahoo.")) return "Yahoo";
    if (domain === "icloud.com" || domain === "me.com" || domain === "mac.com") return "iCloud";
    if (domain === "proton.me" || domain === "protonmail.com") return "Proton Mail";
    return domain;
  }

  const activeIdentifier = mode === "password" ? identifier : otpContact;
  const activeDomain = emailDomain(activeIdentifier);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpLoading(true);
    setOtpError(null);
    try {
      const body = isEmail(otpContact) ? { email: otpContact } : { phone: otpContact };
      const res = await api.post("/auth/request-otp", body);
      setOtpMethod(res.data.method ?? (isEmail(otpContact) ? "email" : "phone"));
      setOtpSent(true);
      setCountdown(60);
      setCanResend(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to send OTP.";
      setOtpError(msg);
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) {
      setOtpError("Enter all 6 digits.");
      return;
    }
    setOtpLoading(true);
    setOtpError(null);
    try {
      const verifyBody = isEmail(otpContact)
        ? { email: otpContact, otp: code }
        : { phone: otpContact, otp: code };
      const res = await api.post("/auth/verify-otp", verifyBody);

      if (res.data?.token && res.data?.profile) {
        const user = res.data.profile;
        setAuth(res.data.token, user);
        toast.success("Welcome back!");
        redirectByRole(user);
        return;
      }

      if (res.data?.requiresRegistration) {
        toast.success("Verified — finish creating your account.");
        router.push(`/register?verified=${encodeURIComponent(otpContact)}`);
        return;
      }

      toast.success("Verified. Please sign in with your password.");
      setMode("password");
      setIdentifier(otpContact);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Invalid OTP.";
      setOtpError(msg);
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResend() {
    setCanResend(false);
    setCountdown(60);
    try {
      const body = isEmail(otpContact) ? { email: otpContact } : { phone: otpContact };
      await api.post("/auth/request-otp", body);
    } catch {
      setCanResend(true);
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

  async function handleGoogle(credential?: string) {
    if (!credential) {
      toast.error("Google login failed");
      return;
    }
    try {
      const res = await api.post("/auth/google", { idToken: credential });
      const user = res.data.profile;
      setAuth(res.data.token, user);
      if (res.data.requiresOnboarding) {
        router.push("/onboarding");
      } else {
        toast.success("Welcome!");
        redirectByRole(user);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Google login failed";
      toast.error(msg);
    }
  }

  return (
    <div className="min-h-[calc(100vh-160px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2">
            <Link href="/" className="font-grotesk font-bold text-3xl text-blue">DISTRO</Link>
            {activeDomain && (
              <>
                <span className="text-gray-300 text-2xl font-light">×</span>
                <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full pl-1.5 pr-3 py-1 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${activeDomain}&sz=64`}
                    alt=""
                    width={18}
                    height={18}
                    className="rounded-full"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
                  />
                  <span className="text-xs font-medium text-ink">{providerLabel(activeDomain)}</span>
                </span>
              </>
            )}
          </div>
          <p className="text-gray-400 text-sm mt-2">
            {audience === "buyer"
              ? "Sign in as a shopkeeper to place orders"
              : "DISTRO staff sign-in"}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          {/* Audience tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-off-white rounded-xl">
            <button
              type="button"
              onClick={() => setAudience("buyer")}
              className={`text-sm font-medium py-2 rounded-lg transition-colors ${
                audience === "buyer" ? "bg-white text-ink shadow-sm" : "text-gray-500 hover:text-ink"
              }`}
            >
              Shopkeeper
            </button>
            <button
              type="button"
              onClick={() => setAudience("admin")}
              className={`text-sm font-medium py-2 rounded-lg transition-colors ${
                audience === "admin" ? "bg-white text-ink shadow-sm" : "text-gray-500 hover:text-ink"
              }`}
            >
              Admin
            </button>
          </div>
          {mode === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-ink block mb-1.5">Email or Phone</label>
                <input
                  type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required
                  placeholder="yourshop@gmail.com or 98XXXXXXXX"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-ink block mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-blue"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ink">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-red-600 bg-red-50 rounded-xl p-3 text-sm">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{error}
                </div>
              )}
              {lockMinutes !== null && (
                <div className="flex items-start gap-2 text-amber-600 bg-amber-50 rounded-xl p-3 text-sm">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  Account temporarily locked. Try again in <span className="font-semibold">{lockMinutes} minute{lockMinutes !== 1 ? "s" : ""}</span>.
                </div>
              )}
              <button type="submit" disabled={loading}
                className="w-full bg-blue hover:bg-blue-dark disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors">
                {loading ? "Signing in…" : "Sign In"}
              </button>
              {audience === "buyer" && (
                <button type="button" onClick={() => setMode("otp")} className="w-full text-sm text-blue hover:underline">
                  Login with OTP instead
                </button>
              )}
            </form>
          )}

          {mode === "otp" && (
            <div className="space-y-4">
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-ink block mb-1.5">Email or Phone</label>
                    <input
                      type="text" value={otpContact} onChange={(e) => setOtpContact(e.target.value)} required
                      placeholder="yourshop@gmail.com or 98XXXXXXXX"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
                    />
                  </div>
                  {otpError && (
                    <div className="flex items-start gap-2 text-red-600 bg-red-50 rounded-xl p-3 text-sm">
                      <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{otpError}
                    </div>
                  )}
                  <button type="submit" disabled={otpLoading}
                    className="w-full bg-blue hover:bg-blue-dark disabled:bg-gray-200 text-white font-medium py-3 rounded-xl">
                    {otpLoading ? "Sending OTP…" : "Send OTP"}
                  </button>
                  <button type="button" onClick={() => setMode("password")} className="w-full text-sm text-gray-500 hover:underline">
                    ← Back to password login
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <p className="text-sm text-gray-500">
                    OTP sent via {otpMethod} to <span className="font-medium text-ink">{otpContact}</span>
                  </p>
                  <div className="flex gap-2 justify-center">
                    {otp.map((digit, i) => (
                      <input key={i}
                        ref={(el) => { otpRefs.current[i] = el; }}
                        type="text" inputMode="numeric" maxLength={1} value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className={`w-12 h-14 text-center text-xl font-grotesk font-bold border-2 rounded-xl focus:outline-none ${digit ? "border-blue bg-blue-pale text-blue" : "border-gray-200 text-ink focus:border-blue"}`}
                      />
                    ))}
                  </div>
                  {otpError && (
                    <div className="flex items-start gap-2 text-red-600 bg-red-50 rounded-xl p-3 text-sm">
                      <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{otpError}
                    </div>
                  )}
                  <button type="submit" disabled={otpLoading || otp.join("").length !== 6}
                    className="w-full bg-blue hover:bg-blue-dark disabled:bg-gray-200 text-white font-medium py-3 rounded-xl">
                    {otpLoading ? "Verifying…" : "Verify & Login"}
                  </button>
                  <div className="text-center text-sm text-gray-400">
                    {canResend ? (
                      <button type="button" onClick={handleResend} className="text-blue font-medium hover:underline">Resend OTP</button>
                    ) : (
                      <span>Resend in <span className="font-grotesk font-semibold text-ink">{countdown}s</span></span>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}

          {audience === "buyer" && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={(response) => handleGoogle(response.credential)}
                  onError={() => toast.error("Google login failed")}
                  text="continue_with"
                  shape="rectangular"
                  width="320"
                />
              </div>
            </>
          )}
        </div>

        {audience === "buyer" ? (
          <p className="text-center text-sm text-gray-400 mt-5">
            New to DISTRO?{" "}
            <Link href="/register" className="text-blue font-medium hover:underline">Create shopkeeper account</Link>
          </p>
        ) : (
          <p className="text-center text-xs text-gray-400 mt-5">
            Admin accounts are provisioned by DISTRO — no self sign-up.
          </p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading…</div>}>
      <LoginContent />
    </Suspense>
  );
}
