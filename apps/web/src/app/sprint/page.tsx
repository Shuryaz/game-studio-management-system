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
  LogOut,
  Plus,
  ChevronDown,
  MessageSquare,
  GitBranch,
  MoreVertical,
  Pencil,
  Trash2,
  ArrowRight,
  X,
  User,
  Calendar,
  CheckCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/src/context/auth-context";
import { can } from "@/src/lib/permissions";
import { Separator } from "@/components/ui/separator";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import { CreateProjectModal } from "@/components/create-project-modal";
import { Topbar } from "@/components/topbar";

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
type Priority = "High" | "Medium" | "Lo";
type TaskType = "Standard Task" | "Sprint Item";
type ColumnId = "todo" | "in-progress" | "testing" | "done";

interface TaskCard {
  id:        string;
  type:      TaskType;
  title:     string;
  desc?:     string;
  priority:  Priority;
  assignee:  string;
  tag?:      string;
  comments?: number;
  branches?: number;
  columnId:  ColumnId;
}

interface Column {
  id:    ColumnId;
  label: string;
  tasks: TaskCard[];
}

interface Sprint {
  id:    string;
  label: string;
  start: string;
  end:   string;
}

interface AssigneeOption {
  id: string;
  username: string;
}

// ── Toast notice ───────────────────────────────────────────────────────────────
interface MoveNotice {
  taskId:    string;
  taskTitle: string;
  toLabel:   string;
}

// ── Column order ───────────────────────────────────────────────────────────────
const COLUMN_ORDER: ColumnId[] = ["todo", "in-progress", "testing", "done"];

// ── Column human labels ────────────────────────────────────────────────────────
const columnLabel: Record<ColumnId, string> = {
  "todo":        "To Do",
  "in-progress": "In Progress",
  "testing":     "Testing",
  "done":        "Done",
};

// ── Priority badge styles ──────────────────────────────────────────────────────
const priorityStyle: Record<Priority, string> = {
  High:   "bg-foreground text-background",
  Medium: "bg-zinc-500 text-white",
  Lo:     "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
};

// ── Column dot colors ──────────────────────────────────────────────────────────
const columnDot: Record<ColumnId, string> = {
  "todo":        "bg-zinc-400",
  "in-progress": "bg-blue-500",
  "testing":     "bg-yellow-400",
  "done":        "bg-green-500",
};

// ── Next-state menu labels ─────────────────────────────────────────────────────
const nextStateLabel: Partial<Record<ColumnId, string>> = {
  "todo":        "Move to In Progress",
  "in-progress": "Move to Testing",
  "testing":     "Move to Done",
};

// ── Initial data (cleaned up: columns start empty; persistent data should come from DB)
const initialSprints: Sprint[] = [];

const initialColumns: Column[] = [
  { id: "todo", label: "TO DO", tasks: [] },
  { id: "in-progress", label: "IN PROGRESS", tasks: [] },
  { id: "testing", label: "TESTING", tasks: [] },
  { id: "done", label: "DONE", tasks: [] },
];

// ── ID counters ────────────────────────────────────────────────────────────────
let taskCounter   = 200;
let sprintCounter = 13;
function nextTaskId()   { return `KITS-${++taskCounter}`; }
function nextSprintId() { return `s${++sprintCounter}`; }

// ── sessionStorage keys for cross-page handoff ─────────────────────────────────
const SPRINT_HANDOFF_KEY = "kits_sprint_handoff";
const TASKS_HANDOFF_KEY  = "kits_tasks_handoff";

// ── Format ISO → "Oct 12" ─────────────────────────────────────────────────────
function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────
// ── MOVE NOTICE BANNER ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function MoveNoticeBanner({ notice, onDismiss }: { notice: MoveNotice | null; onDismiss: () => void }) {
  // Auto-dismiss after 3 s
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
// ── CREATE / EDIT TASK MODAL ──────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
interface TaskFormState {
  type:     TaskType;
  title:    string;
  desc:     string;
  priority: Priority;
  assignee: string;
  deadline: string;
  columnId: ColumnId;
}

function CreateSprintItemModal({
  open,
  initial,
  editId,
  assignees = [],
  onClose,
  onSubmit,
}: {
  open:     boolean;
  initial?: Partial<TaskFormState>;
  editId?:  string;
  assignees?: AssigneeOption[];
  onClose:  () => void;
  onSubmit: (form: TaskFormState, editId?: string) => void;
}) {
  const makeDefault = useCallback((): TaskFormState => ({
    type:     "Sprint Item",
    title:    "",
    desc:     "",
    priority: "Medium",
    assignee: "",
    deadline: "",
    columnId: "todo",
  }), []);

  const [form, setForm] = useState<TaskFormState>(() => ({ ...makeDefault(), ...initial }));

  if (!open) return null;

  const isEdit = Boolean(editId);

  function set<K extends keyof TaskFormState>(k: K, v: TaskFormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function handleSubmit() {
    if (!form.title.trim()) return;
    onSubmit(form, editId);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[520px] bg-card border border-border rounded-sm shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border">
          <div>
            <h2 className="text-[15px] font-black tracking-wide">
              {isEdit ? "Edit Sprint Item" : "Create Sprint Item"}
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isEdit ? "Update the item details below." : "Add a new item to the sprint board."}
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

          {/* Title */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g., Implement UI wireframes"
              className="h-9 text-[12px] rounded-sm"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Description</label>
            <textarea
              rows={3}
              placeholder="Detailed description of the item..."
              className="w-full text-[12px] bg-background border border-border rounded-sm px-3 py-2 outline-none resize-y placeholder:text-muted-foreground/60 focus:border-foreground/40 transition-colors"
              value={form.desc}
              onChange={(e) => set("desc", e.target.value)}
            />
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Priority</label>
            <div className="flex">
              {(["Lo", "Medium", "High"] as Priority[]).map((p) => (
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

          {/* Assignee */}
          <div className="flex flex-col gap-2">
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

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border">
          <Button variant="ghost" size="sm" className="text-[12px] font-semibold px-4" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-[12px] font-black px-5 tracking-wide uppercase"
            onClick={handleSubmit}
            disabled={!form.title.trim()}
          >
            {isEdit ? "Save Changes" : "Create Item"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── NEW SPRINT MODAL ──────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function NewSprintModal({
  open,
  onClose,
  onSubmit,
}: {
  open:     boolean;
  onClose:  () => void;
  onSubmit: (name: string, start: string, end: string) => void;
}) {
  const [name,  setName]  = useState("");
  const [start, setStart] = useState("");
  const [end,   setEnd]   = useState("");

  if (!open) return null;

  function handleSubmit() {
    if (!name.trim()) return;
    onSubmit(name.trim(), start, end);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[420px] bg-card border border-border rounded-sm shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border">
          <div>
            <h2 className="text-[15px] font-black tracking-wide">New Sprint</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Define the sprint name and time range.</p>
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

        <div className="px-6 py-5 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Sprint Name <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g., Nexus Beta"
              className="h-9 text-[12px] rounded-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col gap-2 flex-1">
              <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="date"
                  className="w-full h-9 pl-8 pr-3 text-[12px] bg-background border border-border rounded-sm outline-none focus:border-foreground/40 transition-colors text-foreground"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="date"
                  className="w-full h-9 pl-8 pr-3 text-[12px] bg-background border border-border rounded-sm outline-none focus:border-foreground/40 transition-colors text-foreground"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border">
          <Button variant="ghost" size="sm" className="text-[12px] font-semibold px-4" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="text-[12px] font-black px-5 tracking-wide uppercase" onClick={handleSubmit} disabled={!name.trim()}>
            Create Sprint
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── DELETE CONFIRM ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function DeleteConfirm({ taskTitle, onConfirm, onCancel }: { taskTitle: string; onConfirm: () => void; onCancel: () => void }) {
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
          <Button size="sm" className="text-[12px] font-black px-4 bg-red-500 text-white hover:bg-red-600 uppercase tracking-wide" onClick={onConfirm}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── CARD ACTION MENU ──────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function CardMenu({ columnId, onEdit, onDelete, onAdvance }: {
  columnId:  ColumnId;
  onEdit:    () => void;
  onDelete:  () => void;
  onAdvance: () => void;
}) {
  const { user } = useAuth();
  const canManage = can(user?.role, "sprint:manage");
  const canUpdate = can(user?.role, "sprint:update");
  const showAdvance = canUpdate && columnId !== "done";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!showAdvance && !canManage) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="w-6 h-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Task actions"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-card border border-border rounded-sm shadow-md py-1">
          {showAdvance && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAdvance(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] hover:bg-muted transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                {nextStateLabel[columnId]}
              </button>
              {canManage && <div className="my-1 border-t border-border" />}
            </>
          )}
          {canManage && (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── TASK CARD ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function KanbanCard({ task, onEdit, onDelete, onAdvance }: {
  task:      TaskCard;
  onEdit:    () => void;
  onDelete:  () => void;
  onAdvance: () => void;
}) {
  return (
    <div className="group bg-card border border-border rounded-sm p-3.5 flex flex-col gap-3 hover:shadow-sm transition-shadow cursor-pointer">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">{task.id}</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm ${priorityStyle[task.priority]}`}>
            {task.priority}
          </span>
          <CardMenu columnId={task.columnId} onEdit={onEdit} onDelete={onDelete} onAdvance={onAdvance} />
        </div>
      </div>

      <p className="text-[12px] font-medium leading-snug">{task.title}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Avatar size="sm">
            <AvatarFallback className="text-[9px] font-bold">
              {task.assignee ? task.assignee.slice(0, 2).toUpperCase() : "??"}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="flex items-center gap-2">
          {task.comments !== undefined && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <MessageSquare className="w-3 h-3" />
              <span className="text-[11px]">{task.comments}</span>
            </div>
          )}
          {task.branches !== undefined && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <GitBranch className="w-3 h-3" />
              <span className="text-[11px]">{task.branches}</span>
            </div>
          )}
          {task.tag && (
            <span className="text-[10px] font-semibold text-muted-foreground border border-border rounded-sm px-1.5 py-0.5">
              {task.tag}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── KANBAN COLUMN ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function KanbanColumn({ column, onEditTask, onDeleteTask, onAdvanceTask }: {
  column:        Column;
  onEditTask:    (task: TaskCard) => void;
  onDeleteTask:  (task: TaskCard) => void;
  onAdvanceTask: (task: TaskCard) => void;
}) {
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-3">
      <div className="flex items-center gap-2 pb-3 border-b-2 border-border">
        <span className={`w-2 h-2 rounded-full shrink-0 ${columnDot[column.id]}`} />
        <span className="text-[11px] font-black tracking-[0.15em] text-foreground uppercase">{column.label}</span>
        <span className="text-[11px] font-semibold text-muted-foreground ml-0.5">{column.tasks.length}</span>
      </div>

      <div className="flex flex-col gap-3">
        {column.tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            onEdit={() => onEditTask(task)}
            onDelete={() => onDeleteTask(task)}
            onAdvance={() => onAdvanceTask(task)}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── SPRINT SELECTOR ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function SprintSelector({ sprints, activeSprint, onSelect, onNewSprint }: {
  sprints:      Sprint[];
  activeSprint: Sprint | null;
  onSelect:     (sprint: Sprint) => void;
  onNewSprint:  () => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold border border-border rounded-sm bg-background hover:bg-muted transition-colors"
      >
        {activeSprint ? activeSprint.label : "Select Sprint"}
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-sm shadow-md w-64 py-1">
          {sprints.map((sprint) => (
            <div key={sprint.id} className="w-full flex items-center justify-between px-2 py-1">
              <button
                type="button"
                onClick={() => { onSelect(sprint); setOpen(false); }}
                className={`flex-1 text-left px-3 py-2 text-[12px] hover:bg-muted transition-colors flex items-center ${
                  activeSprint && sprint.id === activeSprint.id ? "font-bold" : ""
                }`}
              >
                <span>{sprint.label}</span>
              </button>
              <div className="flex items-center gap-2 pr-2">
                {activeSprint && sprint.id === activeSprint.id && <span className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />}
                {can(user?.role, "sprint:manage") && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm(`Delete sprint '${sprint.label}'? This will not delete tasks but will disassociate them.`)) return;
                      window.dispatchEvent(new CustomEvent('gsms:deleteSprint', { detail: { id: sprint.id } }));
                      setOpen(false);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-sm text-red-500 hover:bg-red-50 transition-colors"
                    aria-label={`Delete sprint ${sprint.label}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {can(user?.role, "sprint:manage") && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                onClick={() => { setOpen(false); onNewSprint(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors group"
              >
                <Plus className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                New Sprint
              </button>
            </>
          )}
        </div>
      )}
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
            <Plus className="w-3.5 h-3.5" />
            New Project
          </Button>
        </div>
      )}
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
      <div className="px-2 py-3 flex flex-col gap-0.5">
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
export default function SprintPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newSprintOpen,  setNewSprintOpen]  = useState(false);

  const [taskModalOpen,    setTaskModalOpen]    = useState(false);
  const [taskModalInitial, setTaskModalInitial] = useState<Partial<TaskFormState>>({});
  const [editingTaskId,    setEditingTaskId]    = useState<string | undefined>();

  const [deleteTarget, setDeleteTarget] = useState<TaskCard | null>(null);
  const [moveNotice,   setMoveNotice]   = useState<MoveNotice | null>(null);

  const [columns,      setColumns]      = useState<Column[]>(initialColumns);
  const [sprints,      setSprints]      = useState<Sprint[]>(initialSprints);
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(initialSprints[0] ?? null);
  const [assignees,    setAssignees]    = useState<AssigneeOption[]>([]);

  // ── Fetch team members for assignee dropdown ─────────────────────────────────
  useEffect(() => {
    async function fetchAssignees() {
      try {
        const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001";
        const res = await fetch(`${API}/team?pageSize=100`, { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setAssignees(
            json.data.map((m: { id: string; name: string; username?: string }) => ({
              id: m.id,
              username: m.name || m.username || "Member",
            }))
          );
        }
      } catch {}
    }
    fetchAssignees();
  }, []);

  // ── Read sessionStorage handoff from Tasks page ────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(SPRINT_HANDOFF_KEY);
    if (!raw) return;

    let timeoutId: number | undefined;
    try {
      const data = JSON.parse(raw) as { source: "tasks"; form: Partial<TaskFormState> };
      if (data.source === "tasks") {
        sessionStorage.removeItem(SPRINT_HANDOFF_KEY);
        // Defer state updates to avoid synchronous setState inside the effect
        timeoutId = window.setTimeout(() => {
          setEditingTaskId(undefined);
          setTaskModalInitial({ ...data.form, type: "Sprint Item", columnId: "todo" });
          setTaskModalOpen(true);
        }, 0);
      }
    } catch {
      sessionStorage.removeItem(SPRINT_HANDOFF_KEY);
    }

    return () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  async function handleLogout() {
    await fetch("http://localhost:3001/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    router.push("/login");
  }
  function handleNav(href: string) {
    if (href !== "#") router.push(href);
  }

  function openAddTask() {
    if (!can(user?.role, "sprint:manage")) return;
    setEditingTaskId(undefined);
    setTaskModalInitial({ columnId: "todo" });
    setTaskModalOpen(true);
  }

  function openEditTask(task: TaskCard) {
    if (!can(user?.role, "sprint:manage")) return;
    setEditingTaskId(task.id);
    setTaskModalInitial({
      type:     task.type,
      title:    task.title,
      desc:     task.desc ?? "",
      priority: task.priority,
      assignee: task.assignee,
      columnId: task.columnId,
    });
    setTaskModalOpen(true);
  }

  // ── Cross-page handoff: send Standard Task to Tasks list ───────────────────
  function handleSendToTasks(form: TaskFormState) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        TASKS_HANDOFF_KEY,
        JSON.stringify({
          source: "sprint",
          form: {
            title:    form.title,
            desc:     form.desc,
            priority: form.priority,
            assignee: form.assignee,
          },
        })
      );
    }
    router.push("/tasks");
  }

  const handleTaskSubmit = useCallback((form: TaskFormState, editId?: string) => {
    if (editId) {
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          tasks: col.tasks.map((t) => t.id !== editId ? t : { ...t, ...form }),
        }))
      );
    } else {
      (async () => {
        try {
          // Always a Sprint Item on this page — POST /sprints/:id/items
          if (activeSprint) {
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001"}/sprints/${activeSprint.id}/items`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: form.title,
                  description: form.desc || undefined,
                  priority: form.priority,
                  status: form.columnId,
                  assignee: form.assignee || undefined,
                }),
                credentials: "include",
              }
            );
            if (!res.ok) throw new Error("API error");
            const data = await res.json();
            const displayId = data?.data?.externalId ?? nextTaskId();
            const newTask: TaskCard = {
              id:       displayId,
              type:     "Sprint Item",
              title:    form.title,
              desc:     form.desc || undefined,
              priority: form.priority,
              assignee: form.assignee || "Unassigned",
              columnId: form.columnId,
            };
            setColumns((prev) =>
              prev.map((col) => col.id !== newTask.columnId ? col : { ...col, tasks: [...col.tasks, newTask] })
            );
          }
        } catch (err) {
          // fallback to local-only creation
          const newTask: TaskCard = {
            id:       nextTaskId(),
            type:     form.type,
            title:    form.title,
            desc:     form.desc || undefined,
            priority: form.priority,
            assignee: form.assignee || "Unassigned",
            columnId: form.columnId,
          };
          setColumns((prev) => prev.map((col) => col.id !== newTask.columnId ? col : { ...col, tasks: [...col.tasks, newTask] }));
        }
      })();
    }
  }, [activeSprint]);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    if (!can(user?.role, "sprint:manage")) return;
    setColumns((prev) =>
      prev.map((col) => ({ ...col, tasks: col.tasks.filter((t) => t.id !== deleteTarget.id) }))
    );
    setDeleteTarget(null);
  }, [deleteTarget, user?.role]);

  const handleAdvanceTask = useCallback((task: TaskCard) => {
    if (!can(user?.role, "sprint:update")) return;
    const idx = COLUMN_ORDER.indexOf(task.columnId);
    if (idx === -1 || idx === COLUMN_ORDER.length - 1) return;
    const nextId = COLUMN_ORDER[idx + 1];

    setColumns((prev) =>
      prev.map((col) => {
        if (col.id === task.columnId) return { ...col, tasks: col.tasks.filter((t) => t.id !== task.id) };
        if (col.id === nextId)        return { ...col, tasks: [...col.tasks, { ...task, columnId: nextId }] };
        return col;
      })
    );

    // Show the notice banner below the topbar
    setMoveNotice({ taskId: task.id, taskTitle: task.title, toLabel: columnLabel[nextId] });
  }, [user?.role]);

  const handleCreateSprint = useCallback((name: string, start: string, end: string) => {
    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001"}/sprints`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            label: name, 
            startDate: start && start.trim() ? start : undefined, 
            endDate: end && end.trim() ? end : undefined 
          }),
          credentials: "include",
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.message || `Failed to create sprint (${res.status})`);
        }
        const json = await res.json();
        const created = json.data;
        const newSprint: Sprint = { 
          id: String(created.id), 
          label: created.label ?? name, 
          start: created.startDate ?? "", 
          end: created.endDate ?? "" 
        };
        setSprints((prev) => [newSprint, ...prev]);
        setActiveSprint(newSprint);
      } catch (err) {
        console.error("Sprint creation error:", err);
        // fallback to local-only when API unavailable
        const n = sprintCounter;
        const newSprint: Sprint = { id: nextSprintId(), label: `Sprint ${n}: ${name}`, start, end };
        setSprints((prev) => [newSprint, ...prev]);
        setActiveSprint(newSprint);
      }
    })();
  }, []);

  // Delete sprint handler (listens for custom event from SprintSelector)
  const handleDeleteSprint = useCallback(async (sprintId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001"}/sprints/${sprintId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      setSprints((prev) => prev.filter((s) => s.id !== sprintId));
      if (activeSprint && activeSprint.id === sprintId) {
        setActiveSprint((prev) => {
          const remaining = sprints.filter((s) => s.id !== sprintId);
          return remaining[0] ?? null;
        });
        // clear columns
        setColumns(initialColumns);
      }
    } catch (e) {
      // fallback: remove locally
      setSprints((prev) => prev.filter((s) => s.id !== sprintId));
      if (activeSprint && activeSprint.id === sprintId) {
        const remaining = sprints.filter((s) => s.id !== sprintId);
        setActiveSprint(remaining[0] ?? null);
        setColumns(initialColumns);
      }
    }
  }, [activeSprint, sprints]);

  useEffect(() => {
    function onDelete(e: any) {
      const id = e?.detail?.id;
      if (id) handleDeleteSprint(String(id));
    }
    window.addEventListener('gsms:deleteSprint', onDelete as EventListener);
    return () => window.removeEventListener('gsms:deleteSprint', onDelete as EventListener);
  }, [handleDeleteSprint]);

  // Fetch sprints from API on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001"}/sprints`, { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        const rows = json.data ?? [];
        const mapped: Sprint[] = rows.map((r: any) => ({ id: String(r.id), label: r.label, start: r.startDate ?? "", end: r.endDate ?? "" }));
        if (mapped.length) {
          setSprints(mapped);
          setActiveSprint(mapped[0]);
        }
      } catch (e) {
        // ignore — keep local defaults
      }
    })();
  }, []);

  // When activeSprint changes, load its tasks from the API
  const loadedSprintIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeSprint) return;
    // Only re-fetch when the sprint *id* actually changes, not on every reference update.
    // This prevents the effect from overwriting optimistic column state after task creation.
    if (loadedSprintIdRef.current === activeSprint.id) return;
    loadedSprintIdRef.current = activeSprint.id;
    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001"}/sprints/${activeSprint.id}/items`, { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        const rows = json.data ?? [];
        // Map to TaskCard and distribute into columns by status
        const tasksByCol: Record<ColumnId, TaskCard[]> = { todo: [], "in-progress": [], testing: [], done: [] };
        for (const r of rows) {
          const colId = (r.status as ColumnId) ?? "todo";
          const card: TaskCard = {
            id: String(r.externalId ?? r.id),
            type: "Sprint Item",
            title: r.title,
            desc: r.description ?? undefined,
            priority: (r.priority as Priority) ?? "Medium",
            assignee: r.assignee ?? "Unassigned",
            columnId: colId,
          };
          tasksByCol[colId].push(card);
        }
        setColumns(initialColumns.map((c) => ({ ...c, tasks: tasksByCol[c.id] })));
      } catch (e) {
        // ignore, keep local columns
      }
    })();
  }, [activeSprint]);

  const sprintDates = activeSprint && activeSprint.start && activeSprint.end
    ? `${fmtDate(activeSprint.start)} - ${fmtDate(activeSprint.end)}`
    : "TBD";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onLogout={handleLogout} onNav={handleNav} onNewProject={() => setNewProjectOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <Topbar searchPlaceholder="Search tasks, assets..." />

        {/* Move notice — sits right below the topbar, above the body */}
        <MoveNoticeBanner notice={moveNotice} onDismiss={() => setMoveNotice(null)} />

        {/* Body */}
        <main className="flex-1 overflow-y-auto px-8 py-6 flex flex-col">
          {/* Page header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-black">Sprint Board</h1>
            {can(user?.role, "sprint:manage") && (
              <Button size="sm" className="gap-1.5 text-[11px] tracking-widest uppercase font-bold" onClick={openAddTask}>
                <Plus className="w-3.5 h-3.5" />
                Add Task
              </Button>
            )}
          </div>

          {/* Sprint selector */}
          <div className="flex items-center gap-3 mb-6">
            <SprintSelector
              sprints={sprints}
              activeSprint={activeSprint}
              onSelect={setActiveSprint}
              onNewSprint={() => setNewSprintOpen(true)}
            />
            <span className="text-[12px] text-muted-foreground">{sprintDates}</span>
          </div>

          {/* Kanban board */}
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-5 min-w-[860px] h-full">
              {columns.map((col) => (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  onEditTask={openEditTask}
                  onDeleteTask={(task) => setDeleteTarget(task)}
                  onAdvanceTask={handleAdvanceTask}
                />
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Modals */}
      <CreateProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />

      <NewSprintModal
        key={newSprintOpen ? "new-sprint-open" : "new-sprint-closed"}
        open={newSprintOpen}
        onClose={() => setNewSprintOpen(false)}
        onSubmit={handleCreateSprint}
      />

      <CreateSprintItemModal
        key={`${taskModalOpen ? "task-open" : "task-closed"}-${editingTaskId ?? "new"}-${taskModalInitial.columnId ?? "todo"}`}
        open={taskModalOpen}
        initial={taskModalInitial}
        editId={editingTaskId}
        assignees={assignees}
        onClose={() => setTaskModalOpen(false)}
        onSubmit={handleTaskSubmit}
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
