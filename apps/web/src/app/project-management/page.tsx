"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Zap,
  CheckSquare,
  Library,
  Bug,
  Users,
  LogOut,
  Plus,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import { CreateProjectModal } from "@/components/create-project-modal";
import { ProjectDetailModal } from "@/components/project-detail-modal";
import { Topbar } from "@/components/topbar";
import { useAuth } from "@/src/context/auth-context";
import { can } from "@/src/lib/permissions";

// ── Types ──────────────────────────────────────────────────────────────────────
type ProjectStatus = "Alpha" | "Beta" | "Pre-production" | "Live" | "Cancelled";

interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  deadline: string | null;
  leadProducer: { name: string; avatar: string; initials: string };
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const STATUSES: Array<"All" | ProjectStatus> = ["All", "Alpha", "Beta", "Pre-production", "Live", "Cancelled"];
const PAGE_SIZE = 4;

function formatProjectDeadline(value: string | null | undefined) {
  if (value == null) return "—";

  const raw = String(value).trim();
  if (!raw || raw === "null" || raw === "undefined") return "—";

  const zeroLikeDate = /^(?:0000|0001)-01-01(?:T.*)?$|^0{4}[-/]|^00\.00|^00:00|^0000-00-00/i;
  if (zeroLikeDate.test(raw)) return "—";

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Project Management", icon: FolderKanban, href: "/project-management" },
  { label: "Sprint", icon: Zap, href: "/sprint" },
  { label: "Tasks", icon: CheckSquare, href: "/tasks" },
  { label: "Asset Library", icon: Library, href: "/asset-library" },
  { label: "Bug Tracking", icon: Bug, href: "/bug-tracking" },
  { label: "Team", icon: Users, href: "/team" },
];

const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001";

// ── Status badge style map ─────────────────────────────────────────────────────
const statusVariant: Record<ProjectStatus, string> = {
  Beta:             "bg-blue-100 text-blue-700 border-blue-200",
  Alpha:            "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Pre-production": "bg-zinc-100 text-zinc-600 border-zinc-200",
  Live:             "bg-green-100 text-green-700 border-green-200",
  Cancelled:        "bg-red-100 text-red-700 border-red-200",
};

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({
  onLogout,
  onNav,
  onNewProject,
}: {
  onLogout: () => void;
  onNav: (href: string) => void;
  onNewProject: () => void;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside className="w-[196px] shrink-0 h-screen bg-card border-r border-border flex flex-col">
      {/* Logo */}
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

      {/* New Project Button — admin/producer only */}
      {can(user?.role, "project:create") && (
        <div className="px-3 py-3">
          <Button
            size="sm"
            className="w-full gap-1.5 text-[11px] tracking-widest uppercase font-bold"
            onClick={onNewProject}
          >
            <Plus className="w-3.5 h-3.5" />
            New Project
          </Button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-1 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map(({ label, icon: Icon, href }) => {
          const isActive = pathname === href;

          return (
            <Button
              key={label}
              variant={isActive ? "secondary" : "ghost"}
              size="sm"
              className="w-full justify-start gap-2.5 text-[12px] font-medium px-3"
              onClick={() => onNav(href)}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">{label}</span>
            </Button>
          );
        })}
      </nav>

      <Separator />

      {/* Bottom */}
      <div className="px-2 py-3 flex flex-col gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2.5 text-[12px]"
          onClick={onLogout}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Log Out
        </Button>
      </div>
    </aside>
  );
}

// ── Dropdown ───────────────────────────────────────────────────────────────────
function Dropdown<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium border border-border rounded-sm bg-background hover:bg-muted transition-colors"
      >
        {label}: <span className="font-bold">{value}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-sm shadow-md min-w-[140px] py-1">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-muted transition-colors ${
                value === opt ? "font-bold" : ""
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Action Menu ────────────────────────────────────────────────────────────────
function ActionMenu({
  onDetails,
  onEdit,
  onDelete,
}: {
  onDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { user } = useAuth();
  const canManage = can(user?.role, "project:manage");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative flex justify-end">
      <Button
        variant="ghost"
        size="icon"
        className="w-7 h-7"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="w-4 h-4" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-36 bg-card border border-border rounded-sm shadow-md py-1">
          <button
            type="button"
            onClick={() => { onDetails(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] hover:bg-muted transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            Details
          </button>
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => { onEdit(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] hover:bg-muted transition-colors"
              >
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                Edit
              </button>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                onClick={() => { onDelete(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Delete Confirmation Dialog ─────────────────────────────────────────────────
function DeleteConfirmDialog({
  project,
  onConfirm,
  onCancel,
  loading,
}: {
  project: { id: string; name: string } | null;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [confirmText, setConfirmText] = useState("");

  if (!project) return null;

  const confirmed = confirmText === project.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[480px] bg-card border-2 border-red-500 rounded-sm shadow-2xl flex flex-col overflow-hidden">

        {/* Red top bar */}
        <div className="h-1.5 w-full bg-red-500" />

        {/* Header */}
        <div className="flex items-center gap-4 px-6 pt-5 pb-4 border-b border-border">
          <div className="w-10 h-10 rounded-sm bg-red-500 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-[15px] font-black tracking-wide text-red-500 uppercase">
              Permanent Deletion
            </h2>
            <p className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase mt-0.5">
              This action cannot be reversed
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Project name callout */}
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-sm">
            <Folder className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-[13px] font-black text-red-600 truncate">{project.name}</span>
          </div>

          {/* Consequence list */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase mb-0.5">
              The following will be permanently deleted:
            </p>
            {[
              "Project record and all metadata",
              "All associated sprints and tasks",
              "Team member assignments",
              "Bug reports and asset links",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                <span className="text-[12px] text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>

          {/* Type-to-confirm */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase">
              Type <span className="text-foreground font-black">“{project.name}”</span> to confirm
            </label>
            <Input
              placeholder={project.name}
              className="h-9 text-[13px] rounded-sm border-red-200 focus-visible:ring-red-400"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="text-[12px] font-semibold px-4"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-[12px] font-black px-5 bg-red-500 text-white hover:bg-red-600 disabled:bg-red-200 disabled:text-red-400 min-w-[130px] tracking-wide uppercase transition-all"
            onClick={onConfirm}
            disabled={!confirmed || loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Deleting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5" />
                Delete Forever
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ProjectManagementPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | ProjectStatus>("All");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Delete state ─────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Fetch from API ───────────────────────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "All") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));

      const res = await fetch(`${API}/projects?${params.toString()}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Unknown error");

      setProjects(json.data);
      setPagination(json.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchProjects();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchProjects]);

  // Reset to page 1 when filters change
  function handleFilterChange() {
    setPage(1);
  }

  async function handleStatusChange(projectId: string, newStatus: ProjectStatus) {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, status: newStatus } : p))
    );

    try {
      const res = await fetch(`${API}/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to update status");
      }
      fetchProjects();
    } catch {
      fetchProjects();
    }
  }

  async function handleLogout() {
    // Call the logout endpoint so the server clears the httpOnly cookie
    await fetch(`${API}/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    router.push("/login");
  }

  function handleNav(href: string) {
    if (href !== "#") router.push(href);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    if (!can(user?.role, "project:manage")) return;

    setDeleteLoading(true);
    try {
      const res = await fetch(`${API}/projects/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Failed to delete project.");
      }

      setDeleteTarget(null);
      fetchProjects();
    } catch (err) {
      // Surface the error inside the dialog by re-using the page error state
      setError(err instanceof Error ? err.message : "Failed to delete project.");
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onLogout={handleLogout} onNav={handleNav} onNewProject={() => setModalOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <Topbar searchPlaceholder="Search project..." />

        {/* Body */}
        <main className="flex-1 overflow-y-auto px-8 py-6">
          {/* Page header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black">Project Management</h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Manage active titles, track production status, and oversee project timelines.
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-[11px] tracking-widest uppercase font-bold mt-1"
              onClick={() => setModalOpen(true)}
              style={{ display: can(user?.role, "project:create") ? undefined : "none" }}
            >
              <Plus className="w-3.5 h-3.5" />
              Create New Project
            </Button>
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-3 mb-5">
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Filter by project name..."
                className="pl-8 h-8 text-[12px] rounded-sm w-64"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  handleFilterChange();
                }}
              />
            </div>
            <Dropdown
              label="Status"
              options={STATUSES}
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                handleFilterChange();
              }}
            />
          </div>

          {/* Table */}
          <div className="border border-border rounded-sm bg-card">
            {/* Table header */}
            <div className="grid grid-cols-[2.5fr_1fr_1.4fr_1fr_0.4fr] px-5 py-2.5 border-b border-border bg-muted/40">
              {["Project Name", "Status", "Lead Producer", "Deadline", "Actions"].map((h) => (
                <span
                  key={h}
                  className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Loading */}
            {loading && (
              <div className="px-5 py-10 text-center text-[12px] text-muted-foreground">
                Loading projects...
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="px-5 py-10 text-center text-[12px] text-red-500">
                {error}
              </div>
            )}

            {/* Empty */}
            {!loading && !error && projects.length === 0 && (
              <div className="px-5 py-10 text-center text-[12px] text-muted-foreground">
                No projects match the current filters.
              </div>
            )}

            {/* Rows */}
            {!loading &&
              !error &&
              projects.map((project) => (
                <div
                  key={project.id}
                  className="grid grid-cols-[2.5fr_1fr_1.4fr_1fr_0.4fr] px-5 py-3.5 border-b border-border last:border-0 items-center hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setDetailProjectId(project.id)}
                >
                  {/* Project Name */}
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-sm bg-muted flex items-center justify-center shrink-0">
                      <Folder className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold">{project.name}</p>
                    </div>
                  </div>

                  {/* Status */}
                  <div onClick={(e) => e.stopPropagation()}>
                    {can(user?.role, "project:manage") ? (
                      <select
                        value={project.status}
                        onChange={(e) => handleStatusChange(project.id, e.target.value as ProjectStatus)}
                        className={`text-[11px] font-bold px-2 py-1 rounded-sm border appearance-none outline-none cursor-pointer transition-colors ${statusVariant[project.status]}`}
                      >
                        {STATUSES.filter((s) => s !== "All").map((s) => (
                          <option key={s} value={s} className="bg-background text-foreground font-semibold">
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[11px] font-semibold ${
                          statusVariant[project.status] ?? "bg-zinc-100 text-zinc-600 border-zinc-200"
                        }`}
                      >
                        {project.status}
                      </span>
                    )}
                  </div>

                  {/* Lead Producer */}
                  <div className="flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarImage
                        src={project.leadProducer.avatar}
                        alt={project.leadProducer.name}
                      />
                      <AvatarFallback className="text-[9px] font-bold">
                        {project.leadProducer.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[12px] text-muted-foreground">
                      {project.leadProducer.name}
                    </span>
                  </div>

                  {/* Deadline */}
                  <span className="text-[12px] text-muted-foreground">
                    {formatProjectDeadline(project.deadline)}
                  </span>

                  {/* Actions */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <ActionMenu
                      onDetails={() => setDetailProjectId(project.id)}
                      onEdit={() => {/* TODO: open edit modal */}}
                      onDelete={() => setDeleteTarget({ id: project.id, name: project.name })}
                    />
                  </div>
                </div>
              ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-[12px] text-muted-foreground">
              Showing{" "}
              <span className="font-semibold">
                {pagination.total === 0
                  ? 0
                  : (pagination.page - 1) * pagination.pageSize + 1}
                –{Math.min(pagination.page * pagination.pageSize, pagination.total)}
              </span>{" "}
              of <span className="font-semibold">{pagination.total}</span> projects
            </span>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                className="w-7 h-7"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>

              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "secondary" : "ghost"}
                  size="icon-sm"
                  className="w-7 h-7 text-[12px] font-semibold"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              ))}

              <Button
                variant="outline"
                size="icon-sm"
                className="w-7 h-7"
                disabled={page === pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </main>
      </div>

      <CreateProjectModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          fetchProjects(); // refresh list after creating a new project
        }}
      />

      <ProjectDetailModal
        projectId={detailProjectId}
        onClose={() => {
          setDetailProjectId(null);
          fetchProjects();
        }}
      />

      <DeleteConfirmDialog
        key={deleteTarget?.id ?? "none"}
        project={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    </div>
  );
}
