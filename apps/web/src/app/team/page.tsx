"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, Zap, CheckSquare, Library,
  Bug, Users, LogOut, Plus, MoreHorizontal, Pencil, Trash2,
  X, ChevronLeft, ChevronRight, UserPlus, CheckCheck, Search, Eye, EyeOff,
} from "lucide-react";

import { Badge }                               from "@/components/ui/badge";
import { Button }                              from "@/components/ui/button";
import { Input }                               from "@/components/ui/input";
import { Separator }                           from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CreateProjectModal }                  from "@/components/create-project-modal";
import { Topbar }                              from "@/components/topbar";
import { useAuth }                             from "@/src/context/auth-context";
import { can }                                 from "@/src/lib/permissions";

const API       = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001";
const PAGE_SIZE = 8;

// ── Types ──────────────────────────────────────────────────────────────────────
type Department   = "Engineering" | "Art & Design" | "Game Design" | "Production" | "QA" | "Audio";
type MemberStatus = "Active" | "OOO" | "Inactive";

interface Member {
  id:         string;
  name:       string;
  email:      string;
  jobTitle:   string | null;
  department: Department;
  status:     MemberStatus;
  statusNote: string | null;
  avatarUrl:  string | null;
}

const DEPARTMENTS: Department[] = ["Engineering", "Art & Design", "Game Design", "Production", "QA", "Audio"];

const DEPT_COLOR: Record<Department, string> = {
  "Engineering":  "bg-blue-100 text-blue-700 border-blue-200",
  "Art & Design": "bg-purple-100 text-purple-700 border-purple-200",
  "Game Design":  "bg-orange-100 text-orange-700 border-orange-200",
  "Production":   "bg-green-100 text-green-700 border-green-200",
  "QA":           "bg-red-100 text-red-700 border-red-200",
  "Audio":        "bg-yellow-100 text-yellow-700 border-yellow-200",
};

const STATUS_DOT: Record<MemberStatus, string> = {
  Active:   "bg-green-500",
  OOO:      "bg-yellow-400",
  Inactive: "bg-zinc-400",
};

// ── Nav ────────────────────────────────────────────────────────────────────────
const navItems = [
  { label: "Dashboard",          icon: LayoutDashboard, href: "/dashboard" },
  { label: "Project Management", icon: FolderKanban,    href: "/project-management" },
  { label: "Sprint",             icon: Zap,             href: "/sprint" },
  { label: "Tasks",              icon: CheckSquare,     href: "/tasks" },
  { label: "Asset Library",      icon: Library,         href: "/asset-library" },
  { label: "Bug Tracking",       icon: Bug,             href: "/bug-tracking" },
  { label: "Team",               icon: Users,           href: "/team" },
];

function initials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ── Add Account / Edit Member Modal ───────────────────────────────────────────
function MemberModal({ open, editMember, onClose, onSubmit }: {
  open:        boolean;
  editMember?: Member;
  onClose:     () => void;
  onSubmit:    (data: Omit<Member, "id" | "avatarUrl"> & { username?: string; password?: string; systemRole?: string }, id?: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const isEdit = Boolean(editMember);
  const [name,         setName]         = useState("");
  const [username,     setUsername]     = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [email,        setEmail]        = useState("");
  const [department,   setDepartment]   = useState<Department>("Engineering");
  const [systemRole,   setSystemRole]   = useState("producer");
  const [error,        setError]        = useState("");
  const [submitting,   setSubmitting]   = useState(false);

  // Role descriptions for the select dropdown
  const ROLE_OPTIONS: { value: string; label: string; description: string }[] = [
    { value: "admin",     label: "Admin",     description: "Full system administration & team access" },
    { value: "producer",  label: "Producer",  description: "Manage projects, sprints, tasks & bugs" },
    { value: "developer", label: "Developer", description: "Update progress & tasks, manage bugs" },
    { value: "designer",  label: "Designer",  description: "Manage assets, update progress & tasks" },
    { value: "qa",        label: "QA",        description: "Manage bugs, update progress & tasks" },
  ];

  useEffect(() => {
    if (!open) return;
    setName(editMember?.name ?? "");
    setUsername(editMember?.name?.toLowerCase().replace(/\s+/g, ".") ?? "");
    setPassword("");
    setShowPassword(false);
    setEmail(editMember?.email      ?? "");
    setDepartment(editMember?.department ?? "Engineering");
    setSystemRole(
      editMember?.jobTitle?.toLowerCase() === "admin" ? "admin"
      : editMember?.jobTitle?.toLowerCase() === "producer" ? "producer"
      : editMember?.jobTitle?.toLowerCase() === "developer" ? "developer"
      : editMember?.jobTitle?.toLowerCase() === "designer" ? "designer"
      : editMember?.jobTitle?.toLowerCase() === "qa" ? "qa"
      : "producer"
    );
    setError("");
    setSubmitting(false);
  }, [open, editMember]);

  if (!open) return null;

  const canSubmit = !submitting && name.trim() && email.trim() && department && systemRole && (isEdit || (username.trim() && password.trim()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[460px] bg-card border border-border rounded-sm shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h2 className="text-[16px] font-black tracking-wide">
            {isEdit ? "Edit Member" : "Add Account"}
          </h2>
          <button type="button" onClick={onClose} disabled={submitting}
            className="w-6 h-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          ><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="px-6 pb-5 flex flex-col gap-4">

          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Full Name</label>
            <Input
              placeholder="e.g. Akira Tanaka"
              className="h-10 text-[13px] rounded-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Email Address</label>
            <Input
              placeholder="colleague@kitsunestudio.com"
              className="h-10 text-[13px] rounded-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Username + Password (create only) */}
          {!isEdit && (
            <div className="flex gap-3">
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Username</label>
                <Input
                  placeholder="e.g. akira.tanaka"
                  className="h-10 text-[13px] rounded-sm"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    className="h-10 text-[13px] rounded-sm pr-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={submitting}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Role Level — 4 roles only (Admin excluded) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Role Level</label>
            <div className="relative">
              <select
                value={systemRole}
                onChange={(e) => setSystemRole(e.target.value)}
                disabled={submitting}
                className="w-full h-10 pl-3 pr-8 text-[13px] bg-background border border-border rounded-sm outline-none focus:border-foreground/40 transition-colors text-foreground appearance-none disabled:opacity-50"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label} — {r.description}
                  </option>
                ))}
              </select>
              <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none rotate-90" />
            </div>
          </div>

          {/* Department */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Department</label>
            <div className="relative">
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as Department)}
                disabled={submitting}
                className="w-full h-10 pl-3 pr-8 text-[13px] bg-background border border-border rounded-sm outline-none focus:border-foreground/40 transition-colors text-foreground appearance-none disabled:opacity-50"
              >
                <option value="">Assign Department</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none rotate-90" />
            </div>
          </div>

          {/* Error */}
          {error && <p className="text-[11px] text-red-500 font-semibold bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-sm px-3 py-2">{error}</p>}

          {/* Info note */}
          {!isEdit && (
            <div className="flex items-start gap-2.5 bg-muted/60 border border-border rounded-sm px-3 py-2.5">
              <span className="text-muted-foreground mt-0.5 shrink-0 text-[13px]">ⓘ</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Account will be created immediately. The assigned role determines access permissions across all modules.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border">
          <Button variant="outline" size="sm" className="text-[11px] font-bold px-5 tracking-widest uppercase" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" className="text-[11px] font-black px-5 tracking-widest uppercase"
            disabled={!canSubmit}
            onClick={async () => {
              if (!canSubmit) return;
              if (!isEdit && password.trim().length < 8) {
                setError("Password must be at least 8 characters.");
                return;
              }
              setError("");
              setSubmitting(true);
              const selectedRole = ROLE_OPTIONS.find((r) => r.value === systemRole);
              const result = await onSubmit({
                name:       name.trim() || username.trim() || email.split("@")[0],
                email:      email.trim(),
                jobTitle:   selectedRole?.label ?? null,
                department: department || "Engineering",
                status:     editMember?.status ?? "Active",
                statusNote: editMember?.statusNote ?? null,
                username:   username.trim() || undefined,
                password:   password.trim() || undefined,
                systemRole: systemRole || undefined,
              }, editMember?.id);

              setSubmitting(false);
              if (result.success) {
                onClose();
              } else if (result.error) {
                setError(result.error);
              }
            }}
          >
            {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Member"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm ─────────────────────────────────────────────────────────────
function DeleteConfirm({ name, onConfirm, onCancel }: {
  name: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[380px] bg-card border-2 border-red-500 rounded-sm shadow-2xl flex flex-col overflow-hidden">
        <div className="h-1.5 bg-red-500" />
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-sm bg-red-500 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[14px] font-black text-red-500 uppercase tracking-wide">Remove Member</p>
            <p className="text-[10px] text-muted-foreground tracking-[0.12em] uppercase mt-0.5">This cannot be undone</p>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-[12px] text-muted-foreground">
            Remove <span className="font-bold text-foreground">"{name}"</span> from the team?
          </p>
        </div>
        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-border">
          <Button variant="ghost" size="sm" className="text-[12px] font-semibold px-4" onClick={onCancel}>Cancel</Button>
          <Button size="sm" className="text-[12px] font-black px-4 bg-red-500 text-white hover:bg-red-600 uppercase" onClick={onConfirm}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Row Menu ───────────────────────────────────────────────────────────────────
function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className="relative flex justify-end">
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="w-7 h-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
      ><MoreHorizontal className="w-4 h-4" /></button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-36 bg-card border border-border rounded-sm shadow-md py-1">
          <button type="button" onClick={() => { onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] hover:bg-muted transition-colors"
          ><Pencil className="w-3.5 h-3.5 text-muted-foreground" />Edit</button>
          <div className="my-1 border-t border-border" />
          <button type="button" onClick={() => { onDelete(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-50 transition-colors"
          ><Trash2 className="w-3.5 h-3.5" />Remove</button>
        </div>
      )}
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ onLogout, onNav, onNewProject }: {
  onLogout: () => void; onNav: (h: string) => void; onNewProject: () => void;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  return (
    <aside className="w-[196px] shrink-0 h-screen bg-card border-r border-border flex flex-col">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <Avatar size="default" className="rounded-sm">
          <AvatarImage src="/logo.jpg" alt="Kitsune Studio" />
          <AvatarFallback className="rounded-sm text-xs font-bold">KS</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-[12px] font-black tracking-wide leading-tight">Kitsune Studio</p>
          <p className="text-[9px] tracking-[0.18em] text-muted-foreground uppercase">Production Hub</p>
        </div>
      </div>
      <Separator />
      {can(user?.role, "project:create") && (
        <div className="px-3 py-3">
          <Button size="sm" className="w-full gap-1.5 text-[11px] tracking-widest uppercase font-bold" onClick={onNewProject}>
            <Plus className="w-3.5 h-3.5" />New Project
          </Button>
        </div>
      )}
      <nav className="flex-1 px-2 py-1 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map(({ label, icon: Icon, href }) => (
          <Button key={label} variant={pathname === href ? "secondary" : "ghost"} size="sm"
            className="w-full justify-start gap-2.5 text-[12px] font-medium px-3"
            onClick={() => onNav(href)}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">{label}</span>
          </Button>
        ))}
      </nav>
      <Separator />
      <div className="px-2 py-3">
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2.5 text-[12px]" onClick={onLogout}>
          <LogOut className="w-4 h-4 shrink-0" />Log Out
        </Button>
      </div>
    </aside>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [memberList,     setMemberList]     = useState<Member[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [deptCounts,     setDeptCounts]     = useState<Record<string, number>>({});
  const [totalCount,     setTotalCount]     = useState(0);

  const [search,         setSearch]         = useState("");
  const [activeDept,     setActiveDept]     = useState<Department | "All">("All");
  const [page,           setPage]           = useState(1);
  const [totalPages,     setTotalPages]     = useState(1);

  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [modalOpen,      setModalOpen]      = useState(false);
  const [editingMember,  setEditingMember]  = useState<Member | undefined>();
  const [deleteTarget,   setDeleteTarget]   = useState<Member | null>(null);
  const [toast,          setToast]          = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: String(PAGE_SIZE), page: String(page) });
      if (activeDept !== "All") params.set("department", activeDept);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`${API}/team?${params}`, { credentials: "include" });
      if (!res.ok) return;
      const json = await res.json();
      setMemberList(json.data ?? []);
      setTotalPages(json.pagination?.totalPages ?? 1);
      setTotalCount(json.meta?.total ?? 0);
      setDeptCounts(json.meta?.deptCounts ?? {});
    } catch {} finally { setLoading(false); }
  }, [page, activeDept, search]);

  useEffect(() => {
    const handleUserUpdated = () => {
      fetchMembers();
    };

    window.addEventListener("gsms:user-updated", handleUserUpdated);
    return () => {
      window.removeEventListener("gsms:user-updated", handleUserUpdated);
    };
  }, [fetchMembers]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  async function handleSubmit(data: Omit<Member, "id" | "avatarUrl"> & { username?: string; password?: string; systemRole?: string }, id?: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (id) {
        // Edit existing member
        const res = await fetch(`${API}/team/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name:       data.name,
            email:      data.email,
            jobTitle:   data.jobTitle ?? undefined,
            department: data.department,
            status:     data.status,
            statusNote: data.statusNote ?? undefined,
            systemRole: data.systemRole ?? undefined,
          }),
          credentials: "include",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { success: false, error: json.message ?? "Could not update member." };
        }
        setMemberList((prev) => prev.map((m) => m.id !== id ? m : { ...m, ...data }));
        setToast("Member updated.");
        fetchMembers();
        return { success: true };
      } else {
        // Single POST call creating both user account in users table and member entry in members table
        const res = await fetch(`${API}/team`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name:       data.name,
            email:      data.email,
            jobTitle:   data.jobTitle ?? undefined,
            department: data.department,
            status:     data.status,
            statusNote: data.statusNote ?? undefined,
            username:   data.username ?? undefined,
            password:   data.password ?? undefined,
            systemRole: data.systemRole ?? undefined,
          }),
          credentials: "include",
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { success: false, error: json.message ?? "Could not create account." };
        }

        setToast("Account created and member added.");
        fetchMembers();
        return { success: true };
      }
    } catch {
      return { success: false, error: "Network or server error. Please try again." };
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${API}/team/${deleteTarget.id}`, { method: "DELETE", credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(json.message ?? "Tidak dapat menghapus member ini.");
        setDeleteTarget(null);
        return;
      }
      setMemberList((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setTotalCount((c) => Math.max(0, c - 1));
      setDeptCounts((prev) => ({
        ...prev,
        [deleteTarget.department]: Math.max(0, (prev[deleteTarget.department] ?? 1) - 1),
      }));
      setToast("Member removed.");
    } catch { fetchMembers(); }
    setDeleteTarget(null);
  }

  async function handleLogout() {
    await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    router.push("/login");
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onLogout={handleLogout} onNav={(h) => router.push(h)} onNewProject={() => setNewProjectOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar searchValue={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} searchPlaceholder="Search workspace..." />

        {/* Toast */}
        {toast && (
          <div className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold border-b bg-green-50 border-green-200 text-green-700 animate-in slide-in-from-top-1 duration-200">
            <CheckCheck className="w-3.5 h-3.5 shrink-0" />
            <span>{toast}</span>
            <button type="button" onClick={() => setToast(null)} className="ml-auto opacity-50 hover:opacity-100 text-[11px] uppercase font-semibold tracking-wide">dismiss</button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-5">

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-black">Team Directory</h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Manage department roles, statuses, and studio access.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input placeholder="Search members..."
                  className="pl-8 h-9 text-[12px] rounded-sm w-52"
                  value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              {can(user?.role, "team:invite") && (
                <Button size="sm" className="gap-1.5 text-[11px] tracking-widest uppercase font-bold"
                  onClick={() => { setEditingMember(undefined); setModalOpen(true); }}
                >
                  <UserPlus className="w-3.5 h-3.5" />Add Member
                </Button>
              )}
            </div>
          </div>

          {/* Department tabs */}
          <div className="flex items-center gap-0 border-b border-border overflow-x-auto">
            {([
              { key: "All" as const, label: "ALL DEPARTMENTS" },
              ...DEPARTMENTS.map((d) => ({ key: d, label: `${d.toUpperCase()} (${deptCounts[d] ?? 0})` })),
            ]).map(({ key, label }) => (
              <button key={key} type="button"
                onClick={() => { setActiveDept(key); setPage(1); }}
                className={`px-4 py-2.5 text-[11px] font-semibold tracking-wide whitespace-nowrap border-b-2 transition-colors ${
                  activeDept === key
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >{label}</button>
            ))}
          </div>

          {/* Table */}
          <div className="border border-border rounded-sm bg-card">
            {/* Table header */}
            <div className="grid grid-cols-[2.5fr_1.5fr_1.5fr_1fr_0.4fr] px-5 py-2.5 border-b border-border bg-muted/40">
              {["Member", "Role", "Department", "Status", ""].map((h, i) => (
                <span key={i} className="text-[10px] font-black tracking-[0.14em] text-muted-foreground uppercase">{h}</span>
              ))}
            </div>

            {loading && (
              <div className="px-5 py-12 text-center text-[12px] text-muted-foreground">Loading members…</div>
            )}

            {!loading && memberList.length === 0 && (
              <div className="px-5 py-12 text-center">
                <p className="text-[13px] font-semibold text-muted-foreground">No members found</p>
                <p className="text-[11px] text-muted-foreground mt-1">Add your first team member to get started.</p>
                {can(user?.role, "team:invite") && (
                  <Button size="sm" className="mt-3 gap-1.5 text-[11px] uppercase font-bold tracking-widest"
                    onClick={() => { setEditingMember(undefined); setModalOpen(true); }}
                  >
                    <UserPlus className="w-3.5 h-3.5" />Add Member
                  </Button>
                )}
              </div>
            )}

            {memberList.map((member) => (
              <div key={member.id}
                className="grid grid-cols-[2.5fr_1.5fr_1.5fr_1fr_0.4fr] px-5 py-3.5 border-b border-border last:border-0 items-center hover:bg-muted/30 transition-colors group"
              >
                {/* Member */}
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar size="default" className="rounded-full shrink-0">
                    {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.name} />}
                    <AvatarFallback className="text-[11px] font-bold rounded-full">
                      {initials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-tight truncate">{member.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>
                  </div>
                </div>

                {/* Role */}
                <span className="text-[12px] text-foreground truncate pr-4">
                  {member.jobTitle ?? <span className="text-muted-foreground italic">—</span>}
                </span>

                {/* Department */}
                <div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border ${DEPT_COLOR[member.department]}`}>
                    {member.department}
                  </span>
                </div>

                {/* Status */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[member.status]}`} />
                    <span className="text-[12px] font-medium">{member.status}</span>
                  </div>
                  {member.statusNote && (
                    <p className="text-[10px] text-muted-foreground leading-tight pl-3.5">{member.statusNote}</p>
                  )}
                </div>

                {/* Actions */}
                {can(user?.role, "team:invite") ? (
                  <RowMenu
                    onEdit={() => { setEditingMember(member); setModalOpen(true); }}
                    onDelete={() => setDeleteTarget(member)}
                  />
                ) : <div />}
              </div>
            ))}

            {/* Pagination footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="text-[11px] text-muted-foreground">
                {loading
                  ? "…"
                  : `Showing ${memberList.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + memberList.length} of ${totalCount} members`
                }
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="w-7 h-7"
                  disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Button key={p} variant={p === page ? "secondary" : "ghost"} size="sm"
                    className="w-7 h-7 p-0 text-[12px]" onClick={() => setPage(p)}
                  >{p}</Button>
                ))}
                <Button variant="outline" size="icon" className="w-7 h-7"
                  disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

        </main>
      </div>

      {/* Modals */}
      <CreateProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />

      <MemberModal
        key={`${modalOpen}-${editingMember?.id ?? "new"}`}
        open={modalOpen}
        editMember={editingMember}
        onClose={() => { setModalOpen(false); setEditingMember(undefined); }}
        onSubmit={handleSubmit}
      />

      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
