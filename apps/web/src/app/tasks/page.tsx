"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Zap,
  CheckSquare,
  Library,
  Bug,
  Users,
  Activity,
  LogOut,
  Plus,
  Search,
  Bell,
  Settings,
  Pencil,
  Trash2,
  User,
  Calendar,
  LayoutList,
  LayoutGrid,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  CheckCheck,
  ArrowRight,
  MoreVertical,
  X,
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

const navItems = [
  { label: "Dashboard",          icon: LayoutDashboard, href: "/dashboard" },
  { label: "Project Management", icon: FolderKanban,    href: "/project-management" },
  { label: "Sprint",             icon: Zap,             href: "/sprint" },
  { label: "Tasks",              icon: CheckSquare,     href: "/tasks" },
  { label: "Asset Library",      icon: Library,         href: "#" },
  { label: "Bug Tracking",       icon: Bug,             href: "#", badge: 5 },
  { label: "Team",               icon: Users,           href: "#" },
];

// ── Types ──────────────────────────────────────────────────────────────────────
type Priority = "High" | "Medium" | "Low";
type StatusId = "todo" | "in-progress" | "testing" | "done";
type TaskType = "Standard Task" | "Sprint Item";

interface TaskRow {
  id:        string;
  title:     string;
  priority:  Priority;
  status:    StatusId;
  assignee:  string;
  deadline?: string;
  desc?:     string;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<StatusId, string> = {
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

const STATUS_ORDER: StatusId[] = ["todo", "in-progress", "testing", "done"];

const PRIORITY_STYLE: Record<Priority, string> = {
  High:   "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low:    "bg-zinc-100 text-zinc-600 border-zinc-200",
};

const PRIORITY_RANK: Record<Priority, number> = { High: 3, Medium: 2, Low: 1 };

const PAGE_SIZE = 10;

// ── Initial data ───────────────────────────────────────────────────────────────
const INITIAL_TASKS: TaskRow[] = [
  { id: "KITS-102", title: "Rig main character model skeleton",     priority: "High",   status: "in-progress", assignee: "Alex Chen",    deadline: "2024-10-12" },
  { id: "KITS-103", title: "Implement combat hit stop feedback",    priority: "Medium", status: "todo",        assignee: "Unassigned",   deadline: "2024-10-15" },
  { id: "KITS-098", title: "Optimize foliage LOD meshes",           priority: "Low",    status: "testing",     assignee: "Sarah Jenkins", deadline: "2024-10-18" },
  { id: "KITS-089", title: "Draft initial narrative lore document", priority: "Medium", status: "done",        assignee: "Elena Rostova", deadline: "2024-10-20" },
  { id: "KITS-081", title: "Implement audio cues for stealth",      priority: "Low",    status: "todo",        assignee: "Unassigned",   deadline: "2024-10-22" },
  { id: "KITS-076", title: "Design main menu UI wireframes",        priority: "Medium", status: "todo",        assignee: "Alex Chen",    deadline: "2024-10-25" },
  { id: "KITS-071", title: "Fix lighting bugs in Sector 7",         priority: "High",   status: "in-progress", assignee: "Sarah Jenkins", deadline: "2024-10-28" },
  { id: "KITS-065", title: "Refactor player inventory state",       priority: "Medium", status: "testing",     assignee: "Elena Rostova", deadline: "2024-10-30" },
  { id: "KITS-059", title: "Optimize polygon count on boss model",  priority: "High",   status: "done",        assignee: "Alex Chen",    deadline: "2024-11-02" },
  { id: "KITS-053", title: "Setup level streaming boundaries",      priority: "Medium", status: "done",        assignee: "Sarah Jenkins", deadline: "2024-11-05" },
  { id: "KITS-047", title: "Update placeholder textures tutorial",  priority: "Low",    status: "done",        assignee: "Elena Rostova", deadline: "2024-11-08" },
  { id: "KITS-041", title: "Build particle system for explosions",  priority: "High",   status: "in-progress", assignee: "Alex Chen",    deadline: "2024-11-10" },
];

let taskCounter = 300;
function nextId() { return `KITS-${++taskCounter}`; }

function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isDeadlineSoon(iso: string | undefined) {
  if (!iso) return false;
  const diff = new Date(iso + "T00:00:00").getTime() - Date.now();
  return diff >= 0 && diff < 3 * 24 * 60 * 60 * 1000;
}

function isDeadlinePast(iso: string | undefined) {
  if (!iso) return false;
  return new Date(iso + "T00:00:00").getTime() < Date.now();
}

// ─────────────────────────────────────────────────────────────────────────────
// ── FILTER PILL DROPDOWN ──────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function FilterPill<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label:    string;
  value:    T;
  options:  { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
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

  const display = options.find((o) => o.value === value)?.label ?? value;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 h-7 px-3 text-[11px] font-semibold border border-border rounded-sm bg-background hover:bg-muted transition-colors"
      >
        <span className="text-muted-foreground">{label}:</span>
        <span className="ml-0.5">{display}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-40 bg-card border border-border rounded-sm shadow-md py-1">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-muted transition-colors flex items-center justify-between ${
                o.value === value ? "font-bold" : ""
              }`}
            >
              {o.label}
              {o.value === value && <span className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SortIcon({
  field,
  sortField,
  sortAsc,
}: {
  field: "id" | "deadline" | "priority" | "status";
  sortField: "id" | "deadline" | "priority" | "status";
  sortAsc: boolean;
}) {
  if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30 ml-1 shrink-0" />;
  return <span className="ml-1 text-[10px] font-black shrink-0 opacity-70">{sortAsc ? "↑" : "↓"}</span>;
}

// ── sessionStorage key for cross-page handoff ──────────────────────────────────
const TASKS_HANDOFF_KEY  = "kits_tasks_handoff";
const SPRINT_HANDOFF_KEY = "kits_sprint_handoff";

// ─────────────────────────────────────────────────────────────────────────────
// ── CREATE / EDIT TASK MODAL ──────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
interface TaskFormState {
  taskType: TaskType;
  title:    string;
  desc:     string;
  priority: Priority;
  deadline: string;
  assignee: string;
  status:   StatusId;
}

function TaskModal({
  open,
  initial,
  editId,
  onClose,
  onSubmit,
  onSendToSprint,
}: {
  open:           boolean;
  initial?:       Partial<TaskFormState>;
  editId?:        string;
  onClose:        () => void;
  onSubmit:       (form: TaskFormState, editId?: string) => void;
  onSendToSprint: (form: TaskFormState) => void;
}) {
  const makeDefault = (): TaskFormState => ({
    taskType: "Standard Task",
    title: "", desc: "", priority: "Medium", deadline: "", assignee: "", status: "todo",
  });

  const [form, setForm] = useState<TaskFormState>(() => ({ ...makeDefault(), ...initial }));

  if (!open) return null;

  const isEdit = Boolean(editId);
  const isSendingToSprint = form.taskType === "Sprint Item";

  function set<K extends keyof TaskFormState>(k: K, v: TaskFormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function handleSubmit() {
    if (!form.title.trim()) return;
    if (isSendingToSprint && !isEdit) {
      // Hand off to sprint page
      onClose();
      onSendToSprint(form);
    } else {
      onSubmit(form, editId);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[520px] bg-card border border-border rounded-sm shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border">
          <div>
            <h2 className="text-[15px] font-black tracking-wide">{isEdit ? "Edit Task" : "Create Task"}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isEdit ? "Update the task details below." : "Add a new task to the production queue."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-6 h-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mt-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-5 overflow-y-auto max-h-[70vh]">

          {/* Task Type toggle — only show on create */}
          {!isEdit && (
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Task Type</label>
              <div className="flex">
                {(["Standard Task", "Sprint Item"] as TaskType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("taskType", t)}
                    className={`flex-1 h-8 text-[12px] font-semibold border transition-colors first:rounded-l-sm last:rounded-r-sm ${
                      form.taskType === t
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {/* Hint label when Sprint Item is selected */}
              {isSendingToSprint && (
                <p className="text-[11px] text-blue-500 font-semibold flex items-center gap-1.5">
                  <ArrowRight className="w-3 h-3 shrink-0" />
                  This task will be added to the Sprint Board.
                </p>
              )}
            </div>
          )}

          {/* Title */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Task Title <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g., Implement UI wireframes"
              className="h-9 text-[12px] rounded-sm"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Description</label>
            <textarea
              rows={3}
              placeholder="Detailed description of the task requirements..."
              className="w-full text-[12px] bg-background border border-border rounded-sm px-3 py-2 outline-none resize-y placeholder:text-muted-foreground/60 focus:border-foreground/40 transition-colors"
              value={form.desc}
              onChange={(e) => set("desc", e.target.value)}
            />
          </div>

          {/* Status — hide for Sprint Item since Sprint uses columnId */}
          {!isSendingToSprint && (
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Status</label>
              <div className="flex">
                {STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("status", s)}
                    className={`flex-1 h-8 text-[11px] font-semibold border transition-colors first:rounded-l-sm last:rounded-r-sm ${
                      form.status === s
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Priority + Deadline */}
          <div className="flex gap-5">
            <div className="flex flex-col gap-2 flex-1">
              <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Priority</label>
              <div className="flex">
                {(["Low", "Medium", "High"] as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set("priority", p)}
                    className={`flex-1 h-8 text-[12px] font-semibold border transition-colors first:rounded-l-sm last:rounded-r-sm ${
                      form.priority === p
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 flex-1">
              <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Deadline
              </label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="date"
                  className="w-full h-9 pl-8 pr-3 text-[12px] bg-background border border-border rounded-sm outline-none focus:border-foreground/40 transition-colors text-foreground"
                  value={form.deadline}
                  onChange={(e) => set("deadline", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Assignee */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Assignee</label>
            <div className="relative">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Unassigned"
                className="pl-8 h-9 text-[12px] rounded-sm"
                value={form.assignee}
                onChange={(e) => set("assignee", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border">
          <Button variant="ghost" size="sm" className="text-[12px] font-semibold px-4" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className={`text-[12px] font-black px-5 tracking-wide uppercase ${
              isSendingToSprint && !isEdit ? "bg-blue-600 hover:bg-blue-700 text-white" : ""
            }`}
            onClick={handleSubmit}
            disabled={!form.title.trim()}
          >
            {isEdit
              ? "Save Changes"
              : isSendingToSprint
              ? "Send to Sprint →"
              : "Create Task"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── DELETE CONFIRM ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function DeleteConfirm({ taskTitle, onConfirm, onCancel }: {
  taskTitle: string;
  onConfirm: () => void;
  onCancel:  () => void;
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
            <p className="text-[14px] font-black text-red-500 uppercase tracking-wide">Delete Task</p>
            <p className="text-[10px] text-muted-foreground tracking-[0.12em] uppercase mt-0.5">This cannot be undone</p>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-[12px] text-muted-foreground">
            Are you sure you want to delete <span className="font-bold text-foreground">“{taskTitle}”</span>?
          </p>
        </div>
        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-border">
          <Button variant="ghost" size="sm" className="text-[12px] font-semibold px-4" onClick={onCancel}>Cancel</Button>
          <Button
            size="sm"
            className="text-[12px] font-black px-4 bg-red-500 text-white hover:bg-red-600 uppercase tracking-wide"
            onClick={onConfirm}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── MOVE NOTICE BANNER ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
interface MoveNotice {
  taskId:  string;
  toLabel: string;
}

function MoveNoticeBanner({ notice, onDismiss }: { notice: MoveNotice | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [notice, onDismiss]);

  if (!notice) return null;
  const isDone = notice.toLabel === "Done";

  return (
    <div
      className={`flex items-center gap-2.5 px-4 py-2 text-[12px] font-semibold border-b animate-in slide-in-from-top-1 duration-200 ${
        isDone
          ? "bg-green-50 border-green-200 text-green-700"
          : "bg-blue-50 border-blue-200 text-blue-700"
      }`}
    >
      {isDone
        ? <CheckCheck className="w-3.5 h-3.5 shrink-0" />
        : <ArrowRight className="w-3.5 h-3.5 shrink-0" />
      }
      <span>
        <span className="font-black">{notice.taskId}</span>
        {" moved to "}
        <span className="font-black">{notice.toLabel}</span>
        {isDone && " — marked as complete"}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-auto text-current opacity-50 hover:opacity-100 transition-opacity text-[11px] font-semibold tracking-wide uppercase"
      >
        dismiss
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── ROW ACTION MENU ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function RowMenu({ status, onEdit, onDelete, onAdvance }: {
  status:    StatusId;
  onEdit:    () => void;
  onDelete:  () => void;
  onAdvance: () => void;
}) {
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

  const nextStatus = STATUS_ORDER[STATUS_ORDER.indexOf(status) + 1] as StatusId | undefined;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="w-7 h-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Task actions"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-card border border-border rounded-sm shadow-md py-1">
          {nextStatus && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAdvance(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] hover:bg-muted transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                Move to {STATUS_LABELS[nextStatus]}
              </button>
              <div className="my-1 border-t border-border" />
            </>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] hover:bg-muted transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            Edit
          </button>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── GRID CARD ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function GridCard({ task, onEdit, onDelete, onAdvance }: {
  task:      TaskRow;
  onEdit:    () => void;
  onDelete:  () => void;
  onAdvance: () => void;
}) {
  const deadlinePast = isDeadlinePast(task.deadline);
  const deadlineSoon = isDeadlineSoon(task.deadline);

  return (
    <div className="group bg-card border border-border rounded-sm p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">{task.id}</span>
          <p className="text-[12px] font-medium leading-snug line-clamp-2">{task.title}</p>
        </div>
        <RowMenu status={task.status} onEdit={onEdit} onDelete={onDelete} onAdvance={onAdvance} />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border ${PRIORITY_STYLE[task.priority]}`}>
          {task.priority}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[task.status]}`} />
          <span className="text-[11px] text-muted-foreground">{STATUS_LABELS[task.status]}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar size="sm">
            <AvatarFallback className="text-[9px] font-bold">
              {task.assignee === "Unassigned"
                ? "?"
                : task.assignee.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-[11px] text-muted-foreground truncate max-w-[90px]">{task.assignee}</span>
        </div>
        {task.deadline && (
          <div className={`flex items-center gap-1 text-[10px] font-semibold ${
            deadlinePast ? "text-red-500" : deadlineSoon ? "text-amber-500" : "text-muted-foreground"
          }`}>
            <Calendar className="w-3 h-3" />
            {fmtDate(task.deadline)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── SIDEBAR ───────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function Sidebar({ onLogout, onNav, onNewProject }: {
  onLogout:     () => void;
  onNav:        (href: string) => void;
  onNewProject: () => void;
}) {
  const pathname = usePathname();

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
      <div className="px-3 py-3">
        <Button size="sm" className="w-full gap-1.5 text-[11px] tracking-widest uppercase font-bold" onClick={onNewProject}>
          <Plus className="w-3.5 h-3.5" />
          New Project
        </Button>
      </div>
      <nav className="flex-1 px-2 py-1 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map(({ label, icon: Icon, badge, href }) => {
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
              {badge && (
                <Badge variant="default" className="text-[10px] h-4 w-4 p-0 flex items-center justify-center rounded-full">
                  {badge}
                </Badge>
              )}
            </Button>
          );
        })}
      </nav>
      <Separator />
      <div className="px-2 py-3 flex flex-col gap-0.5">
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2.5 text-[12px]">
          <Activity className="w-4 h-4 shrink-0" />
          System Status
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2.5 text-[12px]" onClick={onLogout}>
          <LogOut className="w-4 h-4 shrink-0" />
          Log Out
        </Button>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const router = useRouter();

  const [tasks,        setTasks]        = useState<TaskRow[]>(INITIAL_TASKS);
  const [view,         setView]         = useState<"list" | "grid">("list");
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusId | "all">("all");
  const [filterPrio,   setFilterPrio]   = useState<Priority | "all">("all");
  const [filterAssign, setFilterAssign] = useState<string>("any");
  const [sortField,    setSortField]    = useState<"id" | "deadline" | "priority" | "status">("id");
  const [sortAsc,      setSortAsc]      = useState(true);
  const [page,         setPage]         = useState(1);

  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [modalOpen,      setModalOpen]      = useState(false);
  const [modalInitial,   setModalInitial]   = useState<Partial<TaskFormState>>({});
  const [editingId,      setEditingId]      = useState<string | undefined>();
  const [deleteTarget,   setDeleteTarget]   = useState<TaskRow | null>(null);
  const [moveNotice,     setMoveNotice]     = useState<MoveNotice | null>(null);

  // ── Read sessionStorage handoff from Sprint page ───────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(TASKS_HANDOFF_KEY);
    if (!raw) return;
    let timeoutId: number | undefined;
    try {
      const data = JSON.parse(raw) as { source: "sprint"; form: Partial<TaskFormState> };
      if (data.source === "sprint") {
        sessionStorage.removeItem(TASKS_HANDOFF_KEY);
        // Defer state updates to avoid calling setState synchronously inside the effect
        timeoutId = window.setTimeout(() => {
          setEditingId(undefined);
          setModalInitial({ ...data.form, taskType: "Standard Task" });
          setModalOpen(true);
        }, 0);
      }
    } catch {
      sessionStorage.removeItem(TASKS_HANDOFF_KEY);
    }

    return () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  // Derived assignee list for the filter pill
  const assignees = Array.from(new Set(tasks.map((t) => t.assignee)));

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filtered = tasks
    .filter((t) => {
      const q = search.toLowerCase();
      if (q && !t.title.toLowerCase().includes(q) && !t.id.toLowerCase().includes(q)) return false;
      if (filterStatus !== "all" && t.status   !== filterStatus)   return false;
      if (filterPrio   !== "all" && t.priority  !== filterPrio)     return false;
      if (filterAssign !== "any" && t.assignee  !== filterAssign)   return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if      (sortField === "id")       cmp = a.id.localeCompare(b.id);
      else if (sortField === "deadline") cmp = (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
      else if (sortField === "priority") cmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      else if (sortField === "status")   cmp = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      return sortAsc ? cmp : -cmp;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleSearchChange(nextValue: string) {
    setSearch(nextValue);
    setPage(1);
  }

  function handleFilterStatusChange(nextValue: StatusId | "all") {
    setFilterStatus(nextValue);
    setPage(1);
  }

  function handleFilterPrioChange(nextValue: Priority | "all") {
    setFilterPrio(nextValue);
    setPage(1);
  }

  function handleFilterAssignChange(nextValue: string) {
    setFilterAssign(nextValue);
    setPage(1);
  }

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortAsc((v) => !v);
    else { setSortField(field); setSortAsc(true); }
    setPage(1);
  }

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  function openCreate() {
    setEditingId(undefined);
    setModalInitial({ taskType: "Standard Task" });
    setModalOpen(true);
  }

  function openEdit(task: TaskRow) {
    setEditingId(task.id);
    setModalInitial({
      taskType: "Standard Task",
      title:    task.title,
      desc:     task.desc ?? "",
      priority: task.priority,
      deadline: task.deadline ?? "",
      assignee: task.assignee,
      status:   task.status,
    });
    setModalOpen(true);
  }

  // ── Cross-page handoff: send Sprint Item to Sprint board ───────────────────
  function handleSendToSprint(form: TaskFormState) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        SPRINT_HANDOFF_KEY,
        JSON.stringify({
          source: "tasks",
          form: {
            title:    form.title,
            desc:     form.desc,
            priority: form.priority,
            deadline: form.deadline,
            assignee: form.assignee,
          },
        })
      );
    }
    router.push("/sprint");
  }

  const handleSubmit = useCallback((form: TaskFormState, editId?: string) => {
    if (editId) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id !== editId ? t : {
            ...t,
            title:    form.title,
            desc:     form.desc || undefined,
            priority: form.priority,
            deadline: form.deadline || undefined,
            assignee: form.assignee || "Unassigned",
            status:   form.status,
          }
        )
      );
    } else {
      const newTask: TaskRow = {
        id:       nextId(),
        title:    form.title,
        desc:     form.desc || undefined,
        priority: form.priority,
        status:   form.status,
        assignee: form.assignee || "Unassigned",
        deadline: form.deadline || undefined,
      };
      setTasks((prev) => [newTask, ...prev]);
    }
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    setTasks((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    setDeleteTarget(null);
  }, [deleteTarget]);

  const handleAdvance = useCallback((task: TaskRow) => {
    const idx = STATUS_ORDER.indexOf(task.status);
    if (idx === -1 || idx === STATUS_ORDER.length - 1) return;
    const nextStatus = STATUS_ORDER[idx + 1];
    setTasks((prev) => prev.map((t) => t.id !== task.id ? t : { ...t, status: nextStatus }));
    setMoveNotice({ taskId: task.id, toLabel: STATUS_LABELS[nextStatus] });
  }, []);

  async function handleLogout() {
    await fetch("http://localhost:3001/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    router.push("/login");
  }

  function handleNav(href: string) {
    if (href !== "#") router.push(href);
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onLogout={handleLogout} onNav={handleNav} onNewProject={() => setNewProjectOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="h-14 shrink-0 bg-card border-b border-border flex items-center px-6 gap-4">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search tasks, projects, or assets..."
              className="pl-8 h-8 text-[12px] rounded-sm"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="w-8 h-8"><Bell className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="w-8 h-8"><Settings className="w-4 h-4" /></Button>
          <Avatar size="default">
            <AvatarImage src="/logo.jpg" alt="User avatar" />
            <AvatarFallback className="text-xs font-bold">KS</AvatarFallback>
          </Avatar>
        </header>

        {/* Move notice banner */}
        <MoveNoticeBanner notice={moveNotice} onDismiss={() => setMoveNotice(null)} />

        {/* Body */}
        <main className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-5">

          {/* Page header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-black">All Tasks</h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Manage and track production tasks across active sprints.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-[12px] font-semibold">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters
              </Button>
              <Button
                size="sm"
                className="gap-1.5 text-[11px] tracking-widest uppercase font-bold"
                onClick={openCreate}
              >
                <Plus className="w-3.5 h-3.5" />
                Create Task
              </Button>
            </div>
          </div>

          {/* Quick filters + view toggle */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] font-black tracking-[0.12em] text-muted-foreground uppercase shrink-0">
              Quick Filters:
            </span>

            <FilterPill<StatusId | "all">
              label="Status"
              value={filterStatus}
              options={[
                { value: "all",         label: "All" },
                { value: "todo",        label: "To Do" },
                { value: "in-progress", label: "In Progress" },
                { value: "testing",     label: "Testing" },
                { value: "done",        label: "Done" },
              ]}
              onChange={handleFilterStatusChange}
            />

            <FilterPill<Priority | "all">
              label="Priority"
              value={filterPrio}
              options={[
                { value: "all",    label: "All" },
                { value: "High",   label: "High" },
                { value: "Medium", label: "Medium" },
                { value: "Low",    label: "Low" },
              ]}
              onChange={handleFilterPrioChange}
            />

            <FilterPill<string>
              label="Assignee"
              value={filterAssign}
              options={[
                { value: "any", label: "Any" },
                ...assignees.map((a) => ({ value: a, label: a })),
              ]}
              onChange={handleFilterAssignChange}
            />

            {/* List / Grid toggle */}
            <div className="ml-auto flex items-center border border-border rounded-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setView("list")}
                className={`w-8 h-7 flex items-center justify-center transition-colors ${
                  view === "list"
                    ? "bg-foreground text-background"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
                aria-label="List view"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setView("grid")}
                className={`w-8 h-7 flex items-center justify-center transition-colors ${
                  view === "grid"
                    ? "bg-foreground text-background"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
                aria-label="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ── LIST VIEW ─────────────────────────────────────────────────── */}
          {view === "list" && (
            <div className="flex flex-col border border-border rounded-sm overflow-hidden">

              {/* Table header */}
              <div className="grid grid-cols-[110px_1fr_120px_150px_180px_120px_36px] bg-muted/40 border-b border-border px-4 py-2.5 gap-4 items-center">
                <button
                  type="button"
                  onClick={() => toggleSort("id")}
                  className="flex items-center text-[11px] font-black tracking-[0.12em] text-muted-foreground uppercase text-left"
                >
                  ID <SortIcon field="id" sortField={sortField} sortAsc={sortAsc} />
                </button>
                <span className="text-[11px] font-black tracking-[0.12em] text-muted-foreground uppercase">Task Name</span>
                <button
                  type="button"
                  onClick={() => toggleSort("priority")}
                  className="flex items-center text-[11px] font-black tracking-[0.12em] text-muted-foreground uppercase text-left"
                >
                  Priority <SortIcon field="priority" sortField={sortField} sortAsc={sortAsc} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleSort("status")}
                  className="flex items-center text-[11px] font-black tracking-[0.12em] text-muted-foreground uppercase text-left"
                >
                  Status <SortIcon field="status" sortField={sortField} sortAsc={sortAsc} />
                </button>
                <span className="text-[11px] font-black tracking-[0.12em] text-muted-foreground uppercase">Assignee</span>
                <button
                  type="button"
                  onClick={() => toggleSort("deadline")}
                  className="flex items-center text-[11px] font-black tracking-[0.12em] text-muted-foreground uppercase text-left"
                >
                  Deadline <SortIcon field="deadline" sortField={sortField} sortAsc={sortAsc} />
                </button>
                <span />
              </div>

              {/* Rows */}
              {paginated.length === 0 ? (
                <div className="py-12 text-center text-[12px] text-muted-foreground">
                  No tasks match the current filters.
                </div>
              ) : (
                paginated.map((task) => {
                  const deadlinePast = isDeadlinePast(task.deadline);
                  const deadlineSoon = isDeadlineSoon(task.deadline);
                  return (
                    <div
                      key={task.id}
                      className="group grid grid-cols-[110px_1fr_120px_150px_180px_120px_36px] items-center px-4 py-3 gap-4 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">{task.id}</span>
                      <span className="text-[12px] font-medium truncate">{task.title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border w-fit ${PRIORITY_STYLE[task.priority]}`}>
                        {task.priority}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[task.status]}`} />
                        <span className="text-[12px]">{STATUS_LABELS[task.status]}</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar size="sm">
                          <AvatarFallback className="text-[9px] font-bold">
                            {task.assignee === "Unassigned"
                              ? "?"
                              : task.assignee.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[12px] truncate">{task.assignee}</span>
                      </div>
                      <span className={`text-[12px] font-medium ${
                        deadlinePast ? "text-red-500" : deadlineSoon ? "text-amber-500" : ""
                      }`}>
                        {task.deadline ? fmtDate(task.deadline) : "—"}
                      </span>
                      <RowMenu
                        status={task.status}
                        onEdit={() => openEdit(task)}
                        onDelete={() => setDeleteTarget(task)}
                        onAdvance={() => handleAdvance(task)}
                      />
                    </div>
                  );
                })
              )}

              {/* Pagination footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
                <span className="text-[11px] text-muted-foreground">
                  Showing{" "}
                  {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}{" "}
                  of {filtered.length} tasks
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="w-7 h-7 flex items-center justify-center rounded-sm border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="w-7 h-7 flex items-center justify-center rounded-sm border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── GRID VIEW ─────────────────────────────────────────────────── */}
          {view === "grid" && (
            <div className="flex flex-col gap-4">
              {paginated.length === 0 ? (
                <div className="py-12 text-center text-[12px] text-muted-foreground border border-border rounded-sm">
                  No tasks match the current filters.
                </div>
              ) : (
                <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                  {paginated.map((task) => (
                    <GridCard
                      key={task.id}
                      task={task}
                      onEdit={() => openEdit(task)}
                      onDelete={() => setDeleteTarget(task)}
                      onAdvance={() => handleAdvance(task)}
                    />
                  ))}
                </div>
              )}

              {/* Grid pagination */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Showing{" "}
                  {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}{" "}
                  of {filtered.length} tasks
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="w-7 h-7 flex items-center justify-center rounded-sm border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="w-7 h-7 flex items-center justify-center rounded-sm border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Modals */}
      <CreateProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />

      <TaskModal
        key={`${modalOpen ? "open" : "closed"}-${editingId ?? "new-task"}`}
        open={modalOpen}
        initial={modalInitial}
        editId={editingId}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        onSendToSprint={handleSendToSprint}
      />

      {deleteTarget && (
        <DeleteConfirm
          taskTitle={deleteTarget.title}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
