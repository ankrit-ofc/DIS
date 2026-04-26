"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff, Lock, Mail, Store } from "lucide-react";
import toast from "react-hot-toast";
import { GoogleLogin } from "@react-oauth/google";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

type Mode = "password" | "otp";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  const [mode, setMode] = useState<Mode>("password");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockMinutes, setLockMinutes] = useState<number | null>(null);

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
    else if (user.role === "DRIVER") router.push(redirect || "/driver");
    else router.push(redirect || "/");
  }

  async function handlePasswordLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const idRaw = String(fd.get("identifier") ?? "").trim();
    const pwRaw = String(fd.get("password") ?? "");
    const emailOrPhone = idRaw || identifier;
    const pass = pwRaw || password;

    setLoading(true);
    setError(null);
    setLockMinutes(null);
    try {
      const res = await api.post("/auth/login", { email: emailOrPhone, password: pass });
      const user = res.data.user ?? res.data.profile;
      setAuth(res.data.token, user);
      toast.success("Welcome back!");
      redirectByRole(user);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; error?: string; minutesLeft?: number; code?: string } } })
        ?.response?.data;
      const isNetworkError = !(err as { response?: unknown })?.response;
      if (isNetworkError) setError("Cannot reach the server. Make sure the API is running.");
      else if (data?.code === "ACCOUNT_SUSPENDED") setError("Your account has been suspended.");
      else if (data?.code === "ACCOUNT_LOCKED" || data?.minutesLeft) {
        setLockMinutes(data?.minutesLeft ?? 5);
        setError(null);
      } else setError(data?.message || data?.error || "Incorrect credentials.");
      setLoading(false);
    }
  }

  function isEmail(s: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

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
      const verifyBody = isEmail(otpContact) ? { email: otpContact, otp: code } : { phone: otpContact, otp: code };
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
    <div className="flex min-h-screen w-full flex-col bg-gradient-to-b from-white via-[#f8fafc] to-blue-pale/40 px-4 py-10 sm:py-12">
      <div className="mx-auto flex w-full max-w-[420px] flex-col">
        {/* Brand header — above the card (reference layout) */}
        <div className="mb-8 flex items-center gap-3 sm:mb-10">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue to-blue-dark shadow-md shadow-blue/25">
            <Store className="h-7 w-7 text-white" strokeWidth={2} />
          </div>
          <div className="min-w-0 text-left">
            <p className="font-grotesk text-2xl font-bold tracking-tight text-ink">DISTRO</p>
            <p className="text-sm text-gray-500">Wholesale ordering for your shop</p>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-200/60 sm:p-8">
          {mode === "password" && (
            <>
              <div className="mb-6 text-center sm:text-left">
                <h2 className="font-grotesk text-xl font-bold text-ink sm:text-2xl">Welcome back</h2>
                <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
              </div>

              <form onSubmit={handlePasswordLogin} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="identifier" className="text-sm font-medium text-ink">
                    Email or phone
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="identifier"
                      name="identifier"
                      type="text"
                      autoComplete="username"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="you@example.com or 98XXXXXXXX"
                      className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-gray-400 focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-ink">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-11 text-sm text-ink placeholder:text-gray-400 focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-ink"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setMode("otp")}
                    className="text-sm font-medium text-blue hover:underline"
                  >
                    Login with OTP instead
                  </button>
                </div>

                {error ? (
                  <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </div>
                ) : null}

                {lockMinutes !== null ? (
                  <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    Account temporarily locked. Try again in{" "}
                    <span className="font-semibold">
                      {lockMinutes} minute{lockMinutes !== 1 ? "s" : ""}
                    </span>
                    .
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-[#1a4bdb] to-[#0891b2] py-3 text-sm font-semibold text-white shadow-md shadow-blue/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="flex justify-center [&_iframe]:rounded-lg [&_iframe]:border [&_iframe]:border-gray-200 [&_iframe]:shadow-sm">
                <GoogleLogin
                  onSuccess={(response) => handleGoogle(response.credential)}
                  onError={() => toast.error("Google login failed")}
                  text="continue_with"
                  shape="rectangular"
                  width="100%"
                  theme="outline"
                  size="large"
                />
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
                <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span>Secure &amp; encrypted authentication</span>
              </div>
            </>
          )}

          {mode === "otp" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-grotesk text-xl font-bold text-ink sm:text-2xl">One-time code</h2>
                <p className="mt-1 text-sm text-gray-500">We&apos;ll send a code to your email or phone</p>
              </div>

              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-ink">Email or phone</label>
                    <input
                      type="text"
                      value={otpContact}
                      onChange={(e) => setOtpContact(e.target.value)}
                      required
                      placeholder="you@example.com or 98XXXXXXXX"
                      className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/20"
                    />
                  </div>
                  {otpError ? (
                    <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      {otpError}
                    </div>
                  ) : null}
                  <button
                    type="submit"
                    disabled={otpLoading}
                    className="w-full rounded-xl bg-gradient-to-r from-[#1a4bdb] to-[#0891b2] py-3 text-sm font-semibold text-white shadow-md disabled:opacity-60"
                  >
                    {otpLoading ? "Sending…" : "Send code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("password")}
                    className="w-full text-sm text-gray-500 hover:text-ink hover:underline"
                  >
                    ← Back to password
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Code sent via {otpMethod} to <span className="font-medium text-ink">{otpContact}</span>
                  </p>
                  <div className="flex justify-center gap-2">
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          otpRefs.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className={cn(
                          "h-12 w-10 rounded-lg border-2 text-center font-grotesk text-lg font-bold focus:outline-none sm:h-14 sm:w-11 sm:text-xl",
                          digit ? "border-blue bg-blue-pale text-blue" : "border-gray-200 text-ink focus:border-blue"
                        )}
                      />
                    ))}
                  </div>
                  {otpError ? (
                    <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      {otpError}
                    </div>
                  ) : null}
                  <button
                    type="submit"
                    disabled={otpLoading || otp.join("").length !== 6}
                    className="w-full rounded-xl bg-gradient-to-r from-[#1a4bdb] to-[#0891b2] py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {otpLoading ? "Verifying…" : "Verify & sign in"}
                  </button>
                  <p className="text-center text-sm text-gray-400">
                    {canResend ? (
                      <button type="button" onClick={handleResend} className="font-medium text-blue hover:underline">
                        Resend code
                      </button>
                    ) : (
                      <>
                        Resend in <span className="font-grotesk font-semibold text-ink">{countdown}s</span>
                      </>
                    )}
                  </p>
                </form>
              )}
            </div>
          )}

          {mode === "password" && (
            <p className="mt-8 border-t border-gray-100 pt-6 text-center text-sm text-gray-500">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-semibold text-blue hover:underline">
                Sign up
              </Link>
            </p>
          )}
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed text-gray-400">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="text-gray-600 underline-offset-2 hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-gray-600 underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
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
