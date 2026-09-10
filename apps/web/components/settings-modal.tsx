"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Check, AlertCircle, Eye, EyeOff, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/src/context/auth-context";

const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001";

interface UserProfile {
  id:       number;
  username: string;
  email:    string;
  role:     string;
}

interface SettingsModalProps {
  open:    boolean;
  onClose: () => void;
}

// ── Censor email: show first 2 chars + *** + domain ───────────────────────────
function censorEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, 2);
  const stars   = "*".repeat(Math.max(3, local.length - 2));
  return `${visible}${stars}@${domain}`;
}

function getInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ── Password field with show/hide toggle ──────────────────────────────────────
function PasswordField({
  id, label, value, onChange, placeholder, hint,
}: {
  id: string; label: string; value: string;
  onChange: (v: string) => void; placeholder?: string; hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 text-[13px] rounded-sm pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Feedback line ─────────────────────────────────────────────────────────────
function Feedback({ msg }: { msg: { type: "success" | "error"; text: string } | null }) {
  if (!msg) return null;
  return (
    <div className={`flex items-center gap-2 text-[12px] ${msg.type === "success" ? "text-green-600" : "text-destructive"}`}>
      {msg.type === "success"
        ? <Check className="w-3.5 h-3.5 shrink-0" />
        : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
      {msg.text}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { refresh, setUser } = useAuth();
  const [profile,  setProfile]  = useState<UserProfile | null>(null);
  const [loading,  setLoading]  = useState(false);

  // Which section is expanded: null = none, "profile" or "password"
  const [section, setSection] = useState<"profile" | "password" | null>(null);

  // Profile fields
  const [username, setUsername] = useState("");
  const [email,    setEmail]    = useState("");

  // Password fields
  const [currentPw,  setCurrentPw]  = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");

  // Feedback
  const [profileMsg,  setProfileMsg]  = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savingProfile,  setSavingProfile]  = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Fetch current user when modal opens
  useEffect(() => {
    if (!open) return;
    setSection(null);
    setProfileMsg(null);
    setPasswordMsg(null);
    setCurrentPw(""); setNewPw(""); setConfirmPw("");

    setLoading(true);
    fetch(`${API}/users/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setProfile(data.data);
          setUsername(data.data.username);
          setEmail(data.data.email);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  // ── Save profile ───────────────────────────────────────────────────────────
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetch(`${API}/users/me`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        const updatedUser = { username: data.data.username, email: data.data.email };
        setProfile((p) => p ? { ...p, ...updatedUser } : p);
        setUsername(updatedUser.username);
        setEmail(updatedUser.email);
        setUser(profile ? { ...profile, ...updatedUser, role: profile.role as any } : null);
        await refresh();
        window.dispatchEvent(new CustomEvent("gsms:user-updated", {
          detail: updatedUser,
        }));
        setProfileMsg({ type: "success", text: "Profile saved." });
      } else {
        setProfileMsg({ type: "error", text: data.message });
      }
    } catch {
      setProfileMsg({ type: "error", text: "Network error." });
    } finally {
      setSavingProfile(false);
    }
  }

  // ── Save password ──────────────────────────────────────────────────────────
  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) { setPasswordMsg({ type: "error", text: "Passwords do not match." }); return; }
    if (newPw.length < 8)    { setPasswordMsg({ type: "error", text: "Password must be at least 8 characters." }); return; }
    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      const res = await fetch(`${API}/users/me`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (data.success) {
        setPasswordMsg({ type: "success", text: "Password changed." });
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
      } else {
        setPasswordMsg({ type: "error", text: data.message });
      }
    } catch {
      setPasswordMsg({ type: "error", text: "Network error." });
    } finally {
      setSavingPassword(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-[420px] bg-card border border-border rounded-sm shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-[15px] font-black tracking-wide">Account Settings</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Manage your profile and security</p>
          </div>
          <button type="button" onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          ><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* ── Avatar + name + censored email ───────────────────────── */}
              <div className="flex items-center gap-4">
                <Avatar size="lg" className="w-12 h-12 rounded-sm shrink-0">
                  <AvatarFallback className="rounded-sm text-sm font-black bg-muted">
                    {profile ? getInitials(profile.username) : "??"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold leading-tight">{profile?.username}</p>
                  <p className="text-[11px] text-muted-foreground tracking-wide mt-0.5">
                    {profile ? censorEmail(profile.email) : ""}
                  </p>
                  <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">
                    {profile?.role}
                  </span>
                </div>
              </div>

              <Separator />

              {/* ── Edit Profile trigger ─────────────────────────────────── */}
              <button
                type="button"
                onClick={() => setSection(section === "profile" ? null : "profile")}
                className="flex items-center justify-between w-full py-1 text-left group"
              >
                <span className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground group-hover:text-foreground transition-colors">
                  Profile
                </span>
                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${section === "profile" ? "rotate-90" : ""}`} />
              </button>

              {section === "profile" && (
                <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 -mt-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Username</label>
                    <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username" className="h-10 text-[13px] rounded-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Email</label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter email" className="h-10 text-[13px] rounded-sm" />
                  </div>
                  <Feedback msg={profileMsg} />
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" className="text-[11px] tracking-widest uppercase font-bold px-5"
                      disabled={savingProfile}
                    >
                      {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Profile"}
                    </Button>
                  </div>
                </form>
              )}

              <Separator />

              {/* ── Change Password trigger ──────────────────────────────── */}
              <button
                type="button"
                onClick={() => setSection(section === "password" ? null : "password")}
                className="flex items-center justify-between w-full py-1 text-left group"
              >
                <span className="text-[11px] font-bold tracking-[0.15em] uppercase text-muted-foreground group-hover:text-foreground transition-colors">
                  Change Password
                </span>
                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${section === "password" ? "rotate-90" : ""}`} />
              </button>

              {section === "password" && (
                <form onSubmit={handleSavePassword} className="flex flex-col gap-4 -mt-2">
                  <PasswordField id="cur-pw" label="Current Password"
                    value={currentPw} onChange={setCurrentPw} placeholder="Enter current password" />
                  <PasswordField id="new-pw" label="New Password"
                    value={newPw} onChange={setNewPw} placeholder="Min. 8 characters"
                    hint="Minimum 8 characters." />
                  <PasswordField id="con-pw" label="Confirm New Password"
                    value={confirmPw} onChange={setConfirmPw} placeholder="Re-enter new password" />
                  <Feedback msg={passwordMsg} />
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" className="text-[11px] tracking-widest uppercase font-bold px-5"
                      disabled={savingPassword || !currentPw || !newPw || !confirmPw}
                    >
                      {savingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Change Password"}
                    </Button>
                  </div>
                </form>
              )}

            </>
          )}
        </div>
      </div>
    </div>
  );
}
