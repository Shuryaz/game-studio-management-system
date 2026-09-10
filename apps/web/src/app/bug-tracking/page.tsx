"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, Zap, CheckSquare, Library,
  Bug, Users, LogOut, Plus, ChevronLeft, ChevronRight,
  MoreHorizontal, AlertTriangle, AlertCircle, CheckCircle2,
  Circle, ArrowUpRight, Pencil, Trash2, X, CheckCheck, FileImage, Clock,
} from "lucide-react";

import { Badge }                               from "@/components/ui/badge";
import { Button }                              from "@/components/ui/button";
import { Separator }                           from "@/components/ui/separator";
import { Input }                               from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CreateProjectModal }                  from "@/components/create-project-modal";
import { Topbar }                              from "@/components/topbar";
import { useAuth }                             from "@/src/context/auth-context";
import { can }                                 from "@/src/lib/permissions";

const API      = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001";
const PAGE_SIZE = 10;

// ── Types ──────────────────────────────────────────────────────────────────────
type Severity  = "Critical" | "High" | "Medium" | "Low";
type BugStatus = "Open" | "In Progress" | "Resolved";

interface BugReport {
  id:          string;
  title:       string;
  description: string | null;
  severity:    Severity;
  priority:    string;
  status:      BugStatus;
  project:     string | null;
  assignee:    string | null;
  reportedBy:  string | null;
  evidenceFile: string | null;
  createdAt:   string;
}

const SEVERITIES: readonly Severity[]  = ["Critical", "High", "Medium", "Low"];
const STATUSES:   readonly BugStatus[] = ["Open", "In Progress", "Resolved"];

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

function timeAgo(iso: string) {
  if (!iso) return "Just now";
  let date = new Date(iso);
  if (isNaN(date.getTime())) return "Just now";
  let diff = Date.now() - date.getTime();

  if (diff < -60000) {
    const tzOffsetMs = new Date().getTimezoneOffset() * 60000;
    date = new Date(date.getTime() + tzOffsetMs);
    diff = Date.now() - date.getTime();
  }

  if (diff < 30000) return "Just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30)  return `${days}d ago`;
  return date.toLocaleDateString();
}

// ── Severity Badge ─────────────────────────────────────────────────────────────
function SeverityBadge({ severity }: { severity: Severity }) {
  if (severity === "Critical") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-red-300 bg-red-50 text-red-600 text-[11px] font-bold uppercase tracking-wide">
      <AlertTriangle className="w-3 h-3" />Critical
    </span>
  );
  if (severity === "High") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-border bg-background text-foreground text-[11px] font-bold uppercase tracking-wide">
      <ArrowUpRight className="w-3 h-3" />High
    </span>
  );
  if (severity === "Medium") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-border bg-background text-muted-foreground text-[11px] font-medium">Medium</span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-border bg-background text-muted-foreground text-[11px] font-medium">Low</span>
  );
}

// ── Status Badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: BugStatus }) {
  if (status === "Open") return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-green-600">
      <CheckCircle2 className="w-3.5 h-3.5" />Open
    </span>
  );
  if (status === "In Progress") return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-yellow-600">
      <AlertCircle className="w-3.5 h-3.5" />In Progress
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
      <Circle className="w-3.5 h-3.5" />Resolved
    </span>
  );
}

// ── Filter Dropdown ────────────────────────────────────────────────────────────
function FilterDropdown<T extends string>({ value, options, onChange }: {
  value: T; options: readonly T[]; onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium border border-border rounded-sm bg-background hover:bg-muted transition-colors"
      >
        {value}
        <ChevronRight className="w-3 h-3 text-muted-foreground rotate-90" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[160px] bg-card border border-border rounded-sm shadow-md py-1">
          {options.map((opt) => (
            <button key={opt} type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-muted transition-colors ${value === opt ? "font-bold" : ""}`}
            >{opt}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Row Menu ───────────────────────────────────────────────────────────────────
function RowMenu({ bug, onEdit, onDelete, onStatusChange }: {
  bug:            BugReport;
  onEdit:         () => void;
  onDelete:       () => void;
  onStatusChange: (s: BugStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const nextStatuses = STATUSES.filter((s) => s !== bug.status);

  return (
    <div ref={ref} className="relative flex justify-end">
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="w-7 h-7 flex items-center justify-center rounded-sm hover:bg-muted transition-colors text-muted-foreground"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-card border border-border rounded-sm shadow-md py-1">
          <button type="button" onClick={() => { onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] hover:bg-muted transition-colors"
          ><Pencil className="w-3.5 h-3.5 text-muted-foreground" />Edit</button>
          <div className="my-1 border-t border-border" />
          {nextStatuses.map((s) => (
            <button key={s} type="button" onClick={() => { onStatusChange(s); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] hover:bg-muted transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
              Mark as {s}
            </button>
          ))}
          <div className="my-1 border-t border-border" />
          <button type="button" onClick={() => { onDelete(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-50 transition-colors"
          ><Trash2 className="w-3.5 h-3.5" />Delete</button>
        </div>
      )}
    </div>
  );
}

// ── Report / Edit Bug Modal ────────────────────────────────────────────────────
function BugModal({ open, editBug, onClose, onSubmit }: {
  open:     boolean;
  editBug?: BugReport;
  onClose:  () => void;
  onSubmit: (fd: FormData, id?: string) => void;
}) {
  const { user } = useAuth();
  const isEdit = Boolean(editBug);
  const [title,        setTitle]        = useState("");
  const [description,  setDescription]  = useState("");
  const [steps,        setSteps]        = useState("");
  const [severity,     setSeverity]     = useState<Severity>("Medium");
  const [priority,     setPriority]     = useState("P2 - Backlog");
  const [project,      setProject]      = useState("");
  const [assignee,     setAssignee]     = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [dragOver,     setDragOver]     = useState(false);
  const [projectList,  setProjectList]  = useState<{ id: string; name: string }[]>([]);
  const [assigneeList, setAssigneeList] = useState<{ id: string; username: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(editBug?.title ?? "");
    setDescription(editBug?.description ?? "");
    setSeverity(editBug?.severity ?? "Medium");
    setPriority(editBug?.priority ?? "P2 - Backlog");
    setProject(editBug?.project ?? "");
    setAssignee(editBug?.assignee ?? "");
    setSteps("");
    setEvidenceFile(null);

    // Fetch real projects from API
    fetch(`${API}/projects?pageSize=100`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => setProjectList(json.data ?? []))
      .catch(() => {});

    // Fetch team members from API
    fetch(`${API}/team?pageSize=100`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => setAssigneeList(
        (json.data ?? []).map((m: any) => ({
          id: String(m.id),
          username: m.name || m.username || "Member",
        }))
      ))
      .catch(() => {});
  }, [open, editBug]);

  if (!open) return null;

  const SEVERITY_OPTIONS = [
    { value: "Critical", label: "Critical - System Down" },
    { value: "High",     label: "Major - Significant Impact" },
    { value: "Medium",   label: "Minor - Limited Impact" },
    { value: "Low",      label: "Low - Cosmetic Issue" },
  ];
  const PRIORITY_OPTIONS = ["P0 - Immediate", "P1 - Urgent", "P2 - Backlog", "P3 - Nice to Have"];

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setEvidenceFile(f);
  }

  function handleSubmitClick() {
    if (!title.trim()) return;
    const fd = new FormData();
    fd.append("title",       title.trim());
    fd.append("description", description);
    fd.append("steps",       steps);
    fd.append("severity",    severity);
    fd.append("priority",    priority);
    fd.append("project",     project);
    if (!isEdit) {
      const authorName = user?.name || user?.username || "User";
      fd.append("reportedBy", authorName);
    }
    if (assignee) fd.append("assignee", assignee);
    if (evidenceFile) fd.append("evidence", evidenceFile);
    onSubmit(fd, editBug?.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[580px] bg-card border border-border rounded-sm shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Bug className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-[15px] font-black tracking-wide">
              {isEdit ? "Edit Bug Report" : "Create Bug Report"}
            </h2>
          </div>
          <button type="button" onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          ><X className="w-3.5 h-3.5" /></button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto max-h-[75vh]">

          {!isEdit && (
            <div className="flex items-center justify-between px-3.5 py-2 bg-muted/40 border border-border rounded-sm text-[11px]">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-semibold text-foreground">Time Sync:</span>
                <span>Automated Real-Time (Synced)</span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground bg-background px-2 py-0.5 border border-border rounded">
                {new Date().toLocaleTimeString()}
              </span>
            </div>
          )}

          {/* Bug Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Bug Title</label>
            <Input placeholder="Brief summary of the issue..."
              className="h-9 text-[12px] rounded-sm"
              value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>

          {/* Project + Assignee + Severity + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Project</label>
              <div className="relative">
                <select value={project} onChange={(e) => setProject(e.target.value)}
                  className="w-full h-9 pl-3 pr-8 text-[12px] bg-background border border-border rounded-sm outline-none focus:border-foreground/40 transition-colors text-foreground appearance-none"
                >
                  <option value="">Select Project...</option>
                  {projectList.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
                <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none rotate-90" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Assignee</label>
              <div className="relative">
                <select value={assignee} onChange={(e) => setAssignee(e.target.value)}
                  className="w-full h-9 pl-3 pr-8 text-[12px] bg-background border border-border rounded-sm outline-none focus:border-foreground/40 transition-colors text-foreground appearance-none"
                >
                  <option value="">Unassigned</option>
                  {assigneeList.map((m) => (
                    <option key={m.id} value={m.username}>{m.username}</option>
                  ))}
                </select>
                <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none rotate-90" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Severity</label>
              <div className="relative">
                <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}
                  className="w-full h-9 pl-3 pr-8 text-[12px] bg-background border border-border rounded-sm outline-none focus:border-foreground/40 transition-colors text-foreground appearance-none"
                >
                  {SEVERITY_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none rotate-90" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Priority</label>
              <div className="relative">
                <select value={priority} onChange={(e) => setPriority(e.target.value)}
                  className="w-full h-9 pl-3 pr-8 text-[12px] bg-background border border-border rounded-sm outline-none focus:border-foreground/40 transition-colors text-foreground appearance-none"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none rotate-90" />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Description</label>
            <textarea rows={4}
              placeholder="Provide a detailed description of the expected vs actual behavior."
              className="w-full text-[12px] bg-background border border-border rounded-sm px-3 py-2 outline-none resize-y placeholder:text-muted-foreground/60 focus:border-foreground/40 transition-colors"
              value={description} onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Reproduction Steps */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Reproduction Steps</label>
            <textarea rows={5}
              placeholder={"1. Navigate to...\n2. Click on...\n3. Observe error..."}
              className="w-full text-[12px] font-mono bg-background border border-border rounded-sm px-3 py-2 outline-none resize-y placeholder:text-muted-foreground/60 focus:border-foreground/40 transition-colors"
              value={steps} onChange={(e) => setSteps(e.target.value)}
            />
          </div>

          {/* Upload Evidence */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Upload Evidence</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-sm flex flex-col items-center justify-center py-7 gap-1.5 cursor-pointer transition-colors select-none ${
                dragOver ? "border-foreground bg-muted" : "border-border hover:border-foreground/40 hover:bg-muted/30"
              }`}
            >
              {evidenceFile ? (
                <>
                  <FileImage className="w-7 h-7 text-muted-foreground/60" />
                  <p className="text-[12px] font-semibold text-foreground">{evidenceFile.name}</p>
                  <p className="text-[11px] text-muted-foreground">{(evidenceFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </>
              ) : (
                <>
                  <FileImage className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-[12px]">
                    <span className="text-blue-500 font-semibold underline">Click to upload</span>
                    <span className="text-muted-foreground"> or drag and drop</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">PNG, JPG, MP4, LOG (Max. 50MB)</p>
                </>
              )}
              <input ref={fileInputRef} type="file" className="hidden"
                accept=".png,.jpg,.jpeg,.mp4,.log,.gif,.webp"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setEvidenceFile(f); }}
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border">
          <Button variant="outline" size="sm" className="text-[12px] font-semibold px-4" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" className="text-[12px] font-black px-5 tracking-wide uppercase gap-1.5"
            onClick={handleSubmitClick} disabled={!title.trim()}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Submit Report
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
            <p className="text-[14px] font-black text-red-500 uppercase tracking-wide">Delete Bug</p>
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
function Sidebar({ onLogout, onNav, onNewProject, openCount }: {
  onLogout: () => void; onNav: (h: string) => void; onNewProject: () => void; openCount: number;
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
            className="w-full justify-start gap-2.5 text-[12px] font-medium px-3" onClick={() => onNav(href)}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            {label === "Bug Tracking" && openCount > 0 && (
              <Badge variant="default" className="text-[10px] h-4 min-w-4 px-1 flex items-center justify-center rounded-full">
                {openCount}
              </Badge>
            )}
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
export default function BugTrackingPage() {
  const router = useRouter();

  const [bugs,           setBugs]           = useState<BugReport[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [projects,       setProjects]       = useState<string[]>([]);
  const [openCount,      setOpenCount]      = useState(0);

  const [search,         setSearch]         = useState("");
  const [projectFilter,  setProjectFilter]  = useState("All Projects");
  const [statusFilter,   setStatusFilter]   = useState<BugStatus | "All Statuses">("All Statuses");
  const [severityFilter, setSeverityFilter] = useState<Severity | "All Severities">("All Severities");
  const [page,           setPage]           = useState(1);

  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [modalOpen,      setModalOpen]      = useState(false);
  const [editingBug,     setEditingBug]     = useState<BugReport | undefined>();
  const [deleteTarget,   setDeleteTarget]   = useState<BugReport | null>(null);
  const [toast,          setToast]          = useState<string | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchBugs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/bugs?pageSize=500`, { credentials: "include" });
      if (!res.ok) return;
      const json = await res.json();
      setBugs(json.data ?? []);
      setProjects(json.meta?.projects ?? []);
      setOpenCount(json.meta?.openCount ?? 0);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBugs(); }, [fetchBugs]);

  // Filter
  const filtered = bugs.filter((b) => {
    if (search) {
      const q = search.toLowerCase();
      if (!b.title.toLowerCase().includes(q) && !b.id.includes(q)) return false;
    }
    if (projectFilter  !== "All Projects"   && b.project  !== projectFilter)  return false;
    if (statusFilter   !== "All Statuses"   && b.status   !== statusFilter)   return false;
    if (severityFilter !== "All Severities" && b.severity !== severityFilter) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function resetPage() { setPage(1); }

  // ── CRUD ───────────────────────────────────────────────────────────────────
  async function handleSubmit(fd: FormData, id?: string) {
    try {
      if (id) {
        // Edit: use JSON PUT (no file re-upload on edit)
        const res = await fetch(`${API}/bugs/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title:       fd.get("title"),
            description: fd.get("description"),
            steps:       fd.get("steps"),
            severity:    fd.get("severity"),
            priority:    fd.get("priority"),
            project:     fd.get("project"),
          }),
          credentials: "include",
        });
        if (!res.ok) throw new Error();
        setBugs((prev) => prev.map((b) => b.id !== id ? b : {
          ...b,
          title:       String(fd.get("title") ?? b.title),
          description: String(fd.get("description") ?? ""),
          severity:    (fd.get("severity") as Severity) ?? b.severity,
          priority:    String(fd.get("priority") ?? b.priority),
          project:     fd.get("project") ? String(fd.get("project")) : b.project,
        }));
        setToast("Bug updated.");
      } else {
        const res = await fetch(`${API}/bugs`, {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        if (!res.ok) throw new Error();
        const json = await res.json();
        const nb = json.data as BugReport;
        setBugs((prev) => [nb, ...prev]);
        setOpenCount((c) => c + 1);
        const proj = String(fd.get("project") ?? "");
        if (proj && !projects.includes(proj)) setProjects((prev) => [...prev, proj]);
        setToast("Bug reported.");
      }
    } catch { fetchBugs(); }
  }

  async function handleStatusChange(bug: BugReport, status: BugStatus) {
    const wasOpen = bug.status === "Open";
    const isNowOpen = status === "Open";
    setBugs((prev) => prev.map((b) => b.id !== bug.id ? b : { ...b, status }));
    if (wasOpen && status !== "Open") setOpenCount((c) => Math.max(0, c - 1));
    if (!wasOpen && isNowOpen) setOpenCount((c) => c + 1);
    try {
      await fetch(`${API}/bugs/${bug.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      setToast(`Marked as ${status}.`);
    } catch { fetchBugs(); }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await fetch(`${API}/bugs/${deleteTarget.id}`, { method: "DELETE", credentials: "include" });
      setBugs((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      if (deleteTarget.status === "Open") setOpenCount((c) => Math.max(0, c - 1));
      setToast("Bug deleted.");
    } catch { fetchBugs(); }
    setDeleteTarget(null);
  }

  async function handleLogout() {
    await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    router.push("/login");
  }

  const projectOptions = ["All Projects", ...projects] as const;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar
        onLogout={handleLogout}
        onNav={(h) => h !== "#" && router.push(h)}
        onNewProject={() => setNewProjectOpen(true)}
        openCount={openCount}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar searchValue={search} onSearchChange={(v) => { setSearch(v); resetPage(); }} searchPlaceholder="Search bugs..." />

        {/* Toast */}
        {toast && (
          <div className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold border-b bg-green-50 border-green-200 text-green-700 animate-in slide-in-from-top-1 duration-200">
            <CheckCheck className="w-3.5 h-3.5 shrink-0" />
            <span>{toast}</span>
            <button type="button" onClick={() => setToast(null)} className="ml-auto opacity-50 hover:opacity-100 text-[11px] uppercase font-semibold tracking-wide">dismiss</button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-8 py-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black">Bug Tracking</h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {loading ? "Loading…" : `${openCount} open · ${bugs.length} total`}
              </p>
            </div>
            <Button size="sm" className="gap-1.5 text-[11px] tracking-widest uppercase font-bold mt-1"
              onClick={() => { setEditingBug(undefined); setModalOpen(true); }}
            >
              <Plus className="w-3.5 h-3.5" />Report Bug
            </Button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <FilterDropdown
              value={projectFilter}
              options={projectOptions as unknown as readonly string[]}
              onChange={(v) => { setProjectFilter(v); resetPage(); }}
            />
            <FilterDropdown
              value={statusFilter}
              options={["All Statuses", ...STATUSES] as const}
              onChange={(v) => { setStatusFilter(v as BugStatus | "All Statuses"); resetPage(); }}
            />
            <FilterDropdown
              value={severityFilter}
              options={["All Severities", ...SEVERITIES] as const}
              onChange={(v) => { setSeverityFilter(v as Severity | "All Severities"); resetPage(); }}
            />
            <span className="ml-auto text-[11px] text-muted-foreground">{filtered.length} bug{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Table */}
          <div className="border border-border rounded-sm bg-card">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_3fr_1.2fr_1.1fr_1.2fr_1.2fr_0.4fr] px-5 py-2.5 border-b border-border bg-muted/40">
              {["ID", "Title", "Severity", "Status", "Project", "Assignee", ""].map((h, i) => (
                <span key={i} className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{h}</span>
              ))}
            </div>

            {/* Empty */}
            {!loading && paginated.length === 0 && (
              <div className="px-5 py-12 text-center">
                <p className="text-[13px] font-semibold text-muted-foreground">No bugs found</p>
                <p className="text-[11px] text-muted-foreground mt-1">Report your first bug to start tracking.</p>
                <Button size="sm" className="mt-3 gap-1.5 text-[11px] uppercase font-bold tracking-widest"
                  onClick={() => { setEditingBug(undefined); setModalOpen(true); }}
                >
                  <Plus className="w-3.5 h-3.5" />Report Bug
                </Button>
              </div>
            )}

            {loading && (
              <div className="px-5 py-12 text-center text-[12px] text-muted-foreground">Loading bugs…</div>
            )}

            {/* Rows */}
            {paginated.map((bug) => {
              const isResolved = bug.status === "Resolved";
              return (
                <div key={bug.id}
                  className="grid grid-cols-[1fr_3fr_1.2fr_1.1fr_1.2fr_1.2fr_0.4fr] px-5 py-3.5 border-b border-border last:border-0 items-center hover:bg-muted/30 transition-colors group"
                >
                  <span className={`text-[11px] font-bold tracking-wide ${isResolved ? "text-muted-foreground" : ""}`}>
                    BUG-{bug.id.padStart(4, "0")}
                  </span>
                  <div>
                    <p className={`text-[12px] font-semibold leading-tight ${isResolved ? "line-through text-muted-foreground" : ""}`}>
                      {bug.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {bug.reportedBy ? `${bug.reportedBy} · ` : ""}{timeAgo(bug.createdAt)}
                    </p>
                  </div>
                  <div><SeverityBadge severity={bug.severity} /></div>
                  <div><StatusBadge status={bug.status} /></div>
                  <span className="text-[12px] text-muted-foreground">{bug.project ?? "—"}</span>
                  <div className="flex items-center gap-2">
                    {bug.assignee ? (
                      <>
                        <Avatar size="sm">
                          <AvatarFallback className="text-[9px] font-bold">
                            {bug.assignee.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[12px] text-muted-foreground truncate max-w-[80px]">{bug.assignee}</span>
                      </>
                    ) : (
                      <span className="text-[12px] text-muted-foreground italic">Unassigned</span>
                    )}
                  </div>
                  <RowMenu
                    bug={bug}
                    onEdit={() => { setEditingBug(bug); setModalOpen(true); }}
                    onDelete={() => setDeleteTarget(bug)}
                    onStatusChange={(s) => handleStatusChange(bug, s)}
                  />
                </div>
              );
            })}

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="text-[11px] text-muted-foreground">
                {filtered.length === 0 ? "0" : `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)}`} of {filtered.length} bugs
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="w-7 h-7" disabled={safePage === 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="w-7 h-7" disabled={safePage === totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <CreateProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />

      <BugModal
        key={`${modalOpen}-${editingBug?.id ?? "new"}`}
        open={modalOpen}
        editBug={editingBug}
        onClose={() => { setModalOpen(false); setEditingBug(undefined); }}
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
