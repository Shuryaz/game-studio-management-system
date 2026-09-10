"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, Zap, CheckSquare, Library,
  Bug, Users, LogOut, Plus, Pencil, Trash2, User, Calendar,
  ChevronLeft, ChevronRight, X, ArrowUpDown, SlidersHorizontal,
  CheckCheck, MoreHorizontal, MoreVertical,
} from "lucide-react";

import { Badge }                             from "@/components/ui/badge";
import { Input }                             from "@/components/ui/input";
import { Button }                            from "@/components/ui/button";
import { Separator }                         from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CreateProjectModal }                from "@/components/create-project-modal";
import { Topbar }                            from "@/components/topbar";
import { useAuth }                           from "@/src/context/auth-context";
import { can }                               from "@/src/lib/permissions";

const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001";
const PAGE_SIZE = 15;

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

// ── Types ──────────────────────────────────────────────────────────────────────
type Priority = "High" | "Medium" | "Low";
type StatusId = "todo" | "in-progress" | "testing" | "done";

interface Task {
  id:         string;
  externalId: string;
  title:      string;
  description?: string;
  priority:   Priority;
  status:     StatusId;
  assignee:   string;
  deadline?:  string;
}

interface TaskForm {
  title:    string;
  desc:     string;
  priority: Priority;
  status:   StatusId;
  assignee: string;
  deadline: string;
}

interface AssigneeOption {
  id: string;
  username: string;
}

// ── Config ─────────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<StatusId, string> = {
  "todo":        "To Do",
  "in-progress": "In Progress",
  "testing":     "Testing",
  "done":        "Done",
};

const STATUS_DOT: Record<StatusId, string> = {
  "todo":        "bg-zinc-400",
  "in-progress": "bg-blue-500",
  "testing":     "bg-yellow-400",
  "done":        "bg-green-500",
};

const STATUS_BG: Record<StatusId, string> = {
  "todo":        "bg-zinc-100 text-zinc-600 border-zinc-200",
  "in-progress": "bg-blue-50 text-blue-700 border-blue-200",
  "testing":     "bg-yellow-50 text-yellow-700 border-yellow-200",
  "done":        "bg-green-50 text-green-700 border-green-200",
};

const PRIORITY_BG: Record<Priority, string> = {
  High:   "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low:    "bg-zinc-100 text-zinc-600 border-zinc-200",
};

const STATUS_ORDER: StatusId[] = ["todo", "in-progress", "testing", "done"];
const PRIORITY_ORDER: Priority[] = ["Low", "Medium", "High"];

function fmtDate(iso: string | undefined) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function deadlineColor(iso: string | undefined) {
  if (!iso) return "text-muted-foreground";
  const diff = new Date(iso + "T00:00:00").getTime() - Date.now();
  if (diff < 0) return "text-red-500 font-semibold";
  if (diff < 3 * 86400000) return "text-amber-500 font-semibold";
  return "text-muted-foreground";
}

// ── Task Modal ─────────────────────────────────────────────────────────────────
function TaskModal({
  open, editId, initial, assignees = [], onClose, onSubmit,
}: {
  open:     boolean;
  editId?:  string;
  initial?: Partial<TaskForm>;
  assignees?: AssigneeOption[];
  onClose:  () => void;
  onSubmit: (form: TaskForm, editId?: string) => void;
}) {
  const def: TaskForm = { title: "", desc: "", priority: "Medium", status: "todo", assignee: "", deadline: "" };
  const [form, setForm] = useState<TaskForm>(() => ({ ...def, ...initial }));

  useEffect(() => { if (open) setForm({ ...def, ...initial }); }, [open]);

  if (!open) return null;
  const isEdit = Boolean(editId);

  function set<K extends keyof TaskForm>(k: K, v: TaskForm[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[520px] bg-card border border-border rounded-sm shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <div>
            <h2 className="text-[15px] font-black tracking-wide">{isEdit ? "Edit Task" : "Create Task"}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isEdit ? "Update the task details." : "Add a new task to the backlog."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g., Fix login redirect bug"
              className="h-9 text-[12px] rounded-sm"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && !isEdit && form.title.trim() && (onSubmit(form, editId), onClose())}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Description</label>
            <textarea
              rows={3}
              placeholder="Describe what needs to be done..."
              className="w-full text-[12px] bg-background border border-border rounded-sm px-3 py-2 outline-none resize-y placeholder:text-muted-foreground/60 focus:border-foreground/40 transition-colors"
              value={form.desc}
              onChange={(e) => set("desc", e.target.value)}
            />
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Priority</label>
            <div className="flex">
              {PRIORITY_ORDER.map((p) => (
                <button key={p} type="button" onClick={() => set("priority", p)}
                  className={`flex-1 h-8 text-[12px] font-semibold border transition-colors first:rounded-l-sm last:rounded-r-sm ${
                    form.priority === p ? "bg-foreground text-background border-foreground" : "bg-background text-foreground border-border hover:bg-muted"
                  }`}
                >{p}</button>
              ))}
            </div>
          </div>

          {/* Status (edit only) */}
          {isEdit && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Status</label>
              <div className="flex">
                {STATUS_ORDER.map((s) => (
                  <button key={s} type="button" onClick={() => set("status", s)}
                    className={`flex-1 h-8 text-[11px] font-semibold border transition-colors first:rounded-l-sm last:rounded-r-sm ${
                      form.status === s ? "bg-foreground text-background border-foreground" : "bg-background text-foreground border-border hover:bg-muted"
                    }`}
                  >{STATUS_LABEL[s]}</button>
                ))}
              </div>
            </div>
          )}

          {/* Assignee + Deadline */}
          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Assignee</label>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <select
                  value={form.assignee || "Unassigned"}
                  onChange={(e) => set("assignee", e.target.value === "Unassigned" ? "" : e.target.value)}
                  className="w-full h-9 pl-8 pr-3 text-[12px] bg-background border border-border rounded-sm outline-none focus:border-foreground/40 transition-colors text-foreground appearance-none"
                >
                  <option value="Unassigned">Unassigned</option>
                  {assignees.map((member) => (
                    <option key={member.id} value={member.username}>{member.username}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Deadline</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input type="date" className="w-full h-9 pl-8 pr-3 text-[12px] bg-background border border-border rounded-sm outline-none focus:border-foreground/40 transition-colors text-foreground"
                  value={form.deadline} onChange={(e) => set("deadline", e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border">
          <Button variant="ghost" size="sm" className="text-[12px] font-semibold px-4" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="text-[12px] font-black px-5 tracking-wide uppercase"
            onClick={() => { if (form.title.trim()) { onSubmit(form, editId); onClose(); } }}
            disabled={!form.title.trim()}
          >
            {isEdit ? "Save Changes" : "Create Task"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm ─────────────────────────────────────────────────────────────
function DeleteConfirm({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[380px] bg-card border-2 border-red-500 rounded-sm shadow-2xl flex flex-col overflow-hidden">
        <div className="h-1.5 bg-red-500" />
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-sm bg-red-500 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[14px] font-black text-red-500 uppercase tracking-wide">Delete Task</p>
            <p className="text-[10px] text-muted-foreground tracking-[0.12em] uppercase mt-0.5">This cannot be undone</p>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-[12px] text-muted-foreground">Delete <span className="font-bold text-foreground">"{title}"</span>?</p>
        </div>
        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-border">
          <Button variant="ghost" size="sm" className="text-[12px] font-semibold px-4" onClick={onCancel}>Cancel</Button>
          <Button size="sm" className="text-[12px] font-black px-4 bg-red-500 text-white hover:bg-red-600 uppercase" onClick={onConfirm}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ onLogout, onNav, onNewProject }: { onLogout: () => void; onNav: (h: string) => void; onNewProject: () => void }) {
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
            className="w-full justify-start gap-2.5 text-[12px] font-medium px-3" onClick={() => onNav(href)}
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

// ── Row action dropdown menu (3-dots) ──────────────────────────────────────────
function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const canManage = can(user?.role, "task:manage");
  const canUpdate = can(user?.role, "task:update");

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!canManage && !canUpdate) return null;

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="w-7 h-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border/60 bg-background shadow-xs"
        title="More actions"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 w-36 bg-popover border border-border rounded-sm shadow-md py-1 text-popover-foreground animate-in fade-in-50 zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {canUpdate && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                onEdit();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium hover:bg-muted transition-colors text-left"
            >
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Edit Task</span>
            </button>
          )}

          {canManage && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                onDelete();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors text-left"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Task</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Table header cell ──────────────────────────────────────────────────────────
function TH({ children, sortable, active, asc, onClick, className = "" }: {
  children?: React.ReactNode; sortable?: boolean; active?: boolean; asc?: boolean; onClick?: () => void; className?: string;
}) {
  return (
    <th className={`px-4 py-3 text-left text-[11px] font-black tracking-[0.1em] uppercase text-muted-foreground whitespace-nowrap ${className}`}>
      {sortable ? (
        <button type="button" onClick={onClick} className="flex items-center gap-1 hover:text-foreground transition-colors">
          {children}
          {active ? <span className="text-[10px] font-black">{asc ? "↑" : "↓"}</span> : <ArrowUpDown className="w-3 h-3 opacity-30" />}
        </button>
      ) : children}
    </th>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [tasks,        setTasks]        = useState<Task[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusId | "all">("all");
  const [filterPrio,   setFilterPrio]   = useState<Priority | "all">("all");
  const [sortField,    setSortField]    = useState<"externalId" | "priority" | "status" | "deadline">("externalId");
  const [sortAsc,      setSortAsc]      = useState(true);
  const [page,         setPage]         = useState(1);

  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [modalOpen,      setModalOpen]      = useState(false);
  const [modalInitial,   setModalInitial]   = useState<Partial<TaskForm>>({});
  const [editingId,      setEditingId]      = useState<string | undefined>();
  const [deleteTarget,   setDeleteTarget]   = useState<Task | null>(null);
  const [toast,          setToast]          = useState<string | null>(null);
  const [assignees,      setAssignees]      = useState<AssigneeOption[]>([]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/team?pageSize=100`, { credentials: "include" });
      if (!res.ok) return;
      const json = await res.json();
      setAssignees((json.data ?? []).map((member: any) => ({
        id: String(member.id),
        username: member.name || member.username || "Member",
      })));
    } catch {
      setAssignees([]);
    }
  }, []);

  // ── Fetch tasks from API ───────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/tasks?pageSize=500`, { credentials: "include" });
      if (!res.ok) return;
      const json = await res.json();
      setTasks((json.data ?? []).map((r: any) => ({
        id:          String(r.id),
        externalId:  r.externalId,
        title:       r.title,
        description: r.description ?? undefined,
        priority:    (r.priority as Priority) ?? "Medium",
        status:      (r.status as StatusId) ?? "todo",
        assignee:    r.assignee ?? "Unassigned",
        deadline:    r.deadline ? String(r.deadline).slice(0, 10) : undefined,
      })));
    } catch { /* keep existing */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const PRIORITY_RANK: Record<Priority, number> = { Low: 1, Medium: 2, High: 3 };

  const filtered = tasks
    .filter((t) => {
      const q = search.toLowerCase();
      if (q && !t.title.toLowerCase().includes(q) && !t.externalId.toLowerCase().includes(q)) return false;
      if (filterStatus !== "all" && t.status   !== filterStatus) return false;
      if (filterPrio   !== "all" && t.priority  !== filterPrio)  return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if      (sortField === "externalId") cmp = a.externalId.localeCompare(b.externalId);
      else if (sortField === "deadline")   cmp = (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
      else if (sortField === "priority")   cmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      else if (sortField === "status")     cmp = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      return sortAsc ? cmp : -cmp;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortAsc((v) => !v);
    else { setSortField(field); setSortAsc(true); }
    setPage(1);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────
  function openCreate() {
    if (!can(user?.role, "task:manage")) return;
    setEditingId(undefined);
    setModalInitial({});
    setModalOpen(true);
  }

  function openEdit(task: Task) {
    if (!can(user?.role, "task:manage") && !can(user?.role, "task:update")) return;
    setEditingId(task.id);
    setModalInitial({
      title:    task.title,
      desc:     task.description ?? "",
      priority: task.priority,
      status:   task.status,
      assignee: task.assignee,
      deadline: task.deadline ?? "",
    });
    setModalOpen(true);
  }

  const handleSubmit = useCallback(async (form: TaskForm, editId?: string) => {
    try {
      if (editId) {
        // PUT /tasks/:id — use numeric DB id
        const res = await fetch(`${API}/tasks/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title:       form.title,
            description: form.desc || undefined,
            priority:    form.priority,
            status:      form.status,
            assignee:    form.assignee || undefined,
            deadline:    form.deadline || undefined,
          }),
          credentials: "include",
        });
        if (!res.ok) throw new Error("Update failed");
        setTasks((prev) => prev.map((t) => t.id !== editId ? t : {
          ...t,
          title:       form.title,
          description: form.desc || undefined,
          priority:    form.priority,
          status:      form.status,
          assignee:    form.assignee || "Unassigned",
          deadline:    form.deadline || undefined,
        }));
        setToast("Task updated.");
      } else {
        // POST /tasks
        const res = await fetch(`${API}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title:       form.title,
            description: form.desc || undefined,
            priority:    form.priority,
            status:      "todo",
            assignee:    form.assignee || undefined,
            deadline:    form.deadline || undefined,
          }),
          credentials: "include",
        });
        if (!res.ok) throw new Error("Create failed");
        const json = await res.json();
        const newTask: Task = {
          id:          String(json.data.id),
          externalId:  json.data.externalId,
          title:       form.title,
          description: form.desc || undefined,
          priority:    form.priority,
          status:      "todo",
          assignee:    form.assignee || "Unassigned",
          deadline:    form.deadline || undefined,
        };
        setTasks((prev) => [newTask, ...prev]);
        setToast("Task created.");
      }
    } catch { fetchTasks(); }
  }, [fetchTasks]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    if (!can(user?.role, "task:manage")) return;
    try {
      await fetch(`${API}/tasks/${deleteTarget.id}`, { method: "DELETE", credentials: "include" });
      setTasks((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setToast("Task deleted.");
    } catch { fetchTasks(); }
    setDeleteTarget(null);
  }, [deleteTarget, fetchTasks, user?.role]);

  async function handleStatusChange(task: Task, status: StatusId) {
    if (!can(user?.role, "task:update")) return;
    setTasks((prev) => prev.map((t) => t.id !== task.id ? t : { ...t, status }));
    try {
      await fetch(`${API}/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
    } catch { fetchTasks(); }
  }

  async function handleLogout() {
    await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    router.push("/login");
  }

  const done  = tasks.filter((t) => t.status === "done").length;
  const total = tasks.length;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onLogout={handleLogout} onNav={(h) => h !== "#" && router.push(h)} onNewProject={() => setNewProjectOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar searchValue={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} searchPlaceholder="Search tasks..." />

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black">Tasks</h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {loading ? "Loading…" : `${done} of ${total} completed`}
              </p>
            </div>
            {can(user?.role, "task:manage") && (
              <Button size="sm" className="gap-1.5 text-[11px] tracking-widest uppercase font-bold" onClick={openCreate}>
                <Plus className="w-3.5 h-3.5" />New Task
              </Button>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

            {/* Status filter */}
            <div className="flex items-center border border-border rounded-sm overflow-hidden text-[11px] font-semibold">
              {([["all", "All"] as const, ...STATUS_ORDER.map((s) => [s, STATUS_LABEL[s]] as const)]).map(([val, label]) => (
                <button key={val} type="button"
                  onClick={() => { setFilterStatus(val as StatusId | "all"); setPage(1); }}
                  className={`h-7 px-3 border-r last:border-r-0 border-border transition-colors ${
                    filterStatus === val ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >{label}</button>
              ))}
            </div>

            {/* Priority filter */}
            <div className="flex items-center border border-border rounded-sm overflow-hidden text-[11px] font-semibold">
              {([["all", "All Priority"] as const, ...PRIORITY_ORDER.map((p) => [p, p] as const)]).map(([val, label]) => (
                <button key={val} type="button"
                  onClick={() => { setFilterPrio(val as Priority | "all"); setPage(1); }}
                  className={`h-7 px-3 border-r last:border-r-0 border-border transition-colors ${
                    filterPrio === val ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >{label}</button>
              ))}
            </div>

            <span className="ml-auto text-[11px] text-muted-foreground">
              {filtered.length} task{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table */}
          <div className="flex-1 border border-border rounded-sm">
            <div className="overflow-x-auto min-h-[320px] pb-16">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <TH sortable active={sortField === "externalId"} asc={sortAsc} onClick={() => toggleSort("externalId")} className="w-[110px]">ID</TH>
                    <TH>Title</TH>
                    <TH sortable active={sortField === "priority"} asc={sortAsc} onClick={() => toggleSort("priority")} className="w-[110px]">Priority</TH>
                    <TH sortable active={sortField === "status"} asc={sortAsc} onClick={() => toggleSort("status")} className="w-[140px]">Status</TH>
                    <TH className="w-[140px]">Assignee</TH>
                    <TH sortable active={sortField === "deadline"} asc={sortAsc} onClick={() => toggleSort("deadline")} className="w-[130px]">Deadline</TH>
                    <TH className="w-[90px] text-right">Actions</TH>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-[12px] text-muted-foreground">Loading tasks…</td>
                    </tr>
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <p className="text-[13px] font-semibold text-muted-foreground">No tasks found</p>
                        <p className="text-[11px] text-muted-foreground mt-1">Create your first task to get started.</p>
                        {can(user?.role, "task:manage") && (
                          <Button size="sm" className="mt-3 gap-1.5 text-[11px] uppercase font-bold tracking-widest" onClick={openCreate}>
                            <Plus className="w-3.5 h-3.5" />New Task
                          </Button>
                        )}
                      </td>
                    </tr>
                  ) : paginated.map((task) => (
                    <tr key={task.id} className="group hover:bg-muted/30 transition-colors">
                      {/* ID */}
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-bold text-muted-foreground tracking-wide">{task.externalId}</span>
                      </td>

                      {/* Title */}
                      <td className="px-4 py-3 max-w-[320px]">
                        <p className="text-[13px] font-medium truncate">{task.title}</p>
                        {task.description && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{task.description}</p>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border ${PRIORITY_BG[task.priority]}`}>
                          {task.priority}
                        </span>
                      </td>

                      {/* Status — inline dropdown */}
                      <td className="px-4 py-3">
                        <select
                          value={task.status}
                          disabled={!can(user?.role, "task:update")}
                          onChange={(e) => handleStatusChange(task, e.target.value as StatusId)}
                          className={`text-[10px] font-bold px-2 py-1 rounded-sm border appearance-none outline-none ${STATUS_BG[task.status]} ${can(user?.role, "task:update") ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}
                        >
                          {STATUS_ORDER.map((s) => (
                            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                      </td>

                      {/* Assignee */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar size="sm">
                            <AvatarFallback className="text-[9px] font-bold">
                              {task.assignee === "Unassigned" ? "?" : task.assignee.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[12px] text-muted-foreground truncate max-w-[90px]">{task.assignee}</span>
                        </div>
                      </td>

                      {/* Deadline */}
                      <td className="px-4 py-3">
                        <span className={`text-[12px] flex items-center gap-1 ${deadlineColor(task.deadline)}`}>
                          {task.deadline && <Calendar className="w-3 h-3 shrink-0" />}
                          {fmtDate(task.deadline) || <span className="text-muted-foreground/40">—</span>}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="relative px-4 py-3 text-right whitespace-nowrap w-[90px] shrink-0">
                        <RowActions
                          onEdit={() => openEdit(task)}
                          onDelete={() => setDeleteTarget(task)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-[12px] text-muted-foreground pb-2">
              <span>Page {safePage} of {totalPages}</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce<(number | "…")[]>((acc, p, i, arr) => {
                    if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
                    acc.push(p); return acc;
                  }, [])
                  .map((p, i) => p === "…"
                    ? <span key={`e${i}`} className="px-1">…</span>
                    : <Button key={p} variant={p === safePage ? "secondary" : "ghost"} size="sm"
                        className="w-8 h-8 p-0 text-[12px]" onClick={() => setPage(p as number)}
                      >{p}</Button>
                  )}
                <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <CreateProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />

      <TaskModal
        key={`${modalOpen}-${editingId ?? "new"}`}
        open={modalOpen}
        editId={editingId}
        initial={modalInitial}
        assignees={assignees}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />

      {deleteTarget && (
        <DeleteConfirm
          title={deleteTarget.title}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
