"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { User, KeyRound, Eye, EyeOff, MousePointer2, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";
import { normalizeRole, useAuth } from "@/src/context/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { clearUser, setUser } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Inline status message ─────────────────────────────────────────────────
  const [status, setStatus] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  // ─────────────────────────────────────────────────────────────────────────

  // ── Cooldown state ────────────────────────────────────────────────────────
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (lockedUntil === null) return;

    timerRef.current = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= lockedUntil) {
        setLockedUntil(null);
        setStatus(null);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lockedUntil]);

  const isLocked = lockedUntil !== null && now < lockedUntil;

  // Derive countdown string shown under the inputs
  const countdown = isLocked && lockedUntil !== null
    ? `Too many attempts — try again in ${Math.ceil((lockedUntil - now) / 1000)}s (unlocks at ${new Date(lockedUntil).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })})`
    : null;
  // ─────────────────────────────────────────────────────────────────────────

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (isLocked) return;

    if (!username || !password) {
      setStatus({ type: "warning", message: "Please fill in all fields." });
      return;
    }

    setStatus(null);
    setLoading(true);
    try {
      // credentials: "include" tells the browser to send/store cookies cross-origin
      const res = await fetch("http://localhost:3001/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.status === 429) {
        // Server-side lockout — sync the countdown with server's lockedUntil
        setLockedUntil(data.lockedUntil ?? Date.now() + 60_000);
        return;
      }

      if (res.ok && data.success) {
        // Always clear stale client-side role before hydrating the next session.
        clearUser();

        const role = normalizeRole(data.user?.role ?? data.user?.roleName ?? null);
        setUser(role ? { ...data.user, role } : null);

        setStatus({ type: "success", message: `Welcome back, ${data.user.username}! Redirecting…` });
        setTimeout(() => router.push("/dashboard"), 800);
      } else {
        setStatus({ type: "error", message: data.message ?? "Invalid credentials. Please try again." });
      }
    } catch {
      setStatus({ type: "error", message: "Could not reach the server. Make sure the API is running." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-[3] relative bg-[#e8eaed] overflow-hidden">
        <Image
          src="/login-illustration.png"
          alt="Small steps build great games"
          fill
          priority
          className="object-cover"
        />
      </div>

      {/* Vertical divider */}
      <div className="hidden lg:block w-px bg-blue-400" />

      {/* Right Panel */}
      <div className="flex flex-[2] flex-col items-center justify-center bg-white px-8 relative">
        <span className="absolute top-6 left-6 w-5 h-5 border-t-2 border-l-2 border-zinc-300" />

        <div className="w-full max-w-[320px] flex flex-col items-center gap-6">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-sm bg-zinc-900 flex items-center justify-center overflow-hidden">
              <Image
                src="/logo.jpg"
                alt="Kitsune Game Studio Logo"
                width={64}
                height={64}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <div className="text-center">
              <h1 className="text-lg font-black tracking-[0.2em] text-zinc-900 uppercase">
                Kitsune Game Studio
              </h1>
              <p className="text-[10px] tracking-[0.25em] text-zinc-400 uppercase mt-0.5">
                Secure Internal Access
              </p>
            </div>
          </div>

          {/* Form */}
          <form className="w-full flex flex-col gap-4" onSubmit={handleLogin}>
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="employee-id"
                className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 uppercase"
              >
                Employee Username / Email
              </label>
              <div className={`flex items-center gap-2 border rounded-sm px-3 py-2.5 bg-white transition-colors ${isLocked ? "border-red-200 bg-red-50" : "border-zinc-200 focus-within:border-zinc-400"}`}>
                <User className={`w-4 h-4 shrink-0 ${isLocked ? "text-red-300" : "text-zinc-400"}`} />
                <input
                  id="employee-id"
                  type="text"
                  placeholder="user.name@studio.local"
                  className="flex-1 text-sm text-zinc-700 placeholder:text-zinc-300 bg-transparent outline-none disabled:cursor-not-allowed"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLocked || loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="passkey"
                  className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 uppercase"
                >
                  Passkey
                </label>
                <button
                  type="button"
                  className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 uppercase hover:text-zinc-700 transition-colors"
                >
                  Recover Access
                </button>
              </div>
              <div className={`flex items-center gap-2 border rounded-sm px-3 py-2.5 bg-white transition-colors ${isLocked ? "border-red-200 bg-red-50" : "border-zinc-200 focus-within:border-zinc-400"}`}>
                <KeyRound className={`w-4 h-4 shrink-0 ${isLocked ? "text-red-300" : "text-zinc-400"}`} />
                <input
                  id="passkey"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="flex-1 text-sm text-zinc-700 placeholder:text-zinc-400 bg-transparent outline-none disabled:cursor-not-allowed"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLocked || loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-zinc-400 hover:text-zinc-600 transition-colors"
                  aria-label={showPassword ? "Hide passkey" : "Show passkey"}
                  disabled={isLocked}
                >
                  {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLocked || loading}
              className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-700 active:bg-zinc-800 disabled:bg-red-400 disabled:cursor-not-allowed text-white text-xs font-black tracking-[0.25em] uppercase py-3.5 rounded-sm transition-colors mt-1 cursor-pointer"
            >
              {loading ? "Authenticating..." : isLocked ? "Access Locked" : "Authenticate"}
              <MousePointer2 className="w-3.5 h-3.5 fill-white stroke-none" />
            </button>

            {/* Inline status message */}
            {status && (
              <div className={`flex items-start gap-2 rounded-sm px-3 py-2.5 border text-[11px] font-semibold leading-snug ${
                status.type === "success"
                  ? "bg-green-50 border-green-200 text-green-700"
                  : status.type === "error"
                  ? "bg-red-50 border-red-200 text-red-600"
                  : "bg-yellow-50 border-yellow-200 text-yellow-700"
              }`}>
                {status.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : status.type === "error" ? (
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{status.message}</span>
              </div>
            )}

            {/* Lockout countdown */}
            {isLocked && countdown && (
              <p className="text-[10px] font-semibold tracking-wide text-red-500 text-center leading-snug">
                {countdown}
              </p>
            )}
          </form>

          {/* Gateway status */}
          <div className="flex items-center gap-2 mt-2">
            <span className={`w-2 h-2 rounded-full ${isLocked ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" : "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.8)]"}`} />
            <span className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase">
              {isLocked ? "Access Suspended" : "Gateway Active"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
