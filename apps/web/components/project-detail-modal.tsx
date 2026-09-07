"use client";

import { useEffect, useState } from "react";
import {
  X,
  Pencil,
  RefreshCw,
  DollarSign,
  RefreshCcw,
  Calendar,
  Monitor,
  Users,
  ExternalLink,
  Loader2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// ── Types ──────────────────────────────────────────────────────────────────────
interface TimelineStage {
  name: string;
  done: boolean;
  current: boolean;
}

interface Member {
  userId: number;
  username: string;
  projectRole: string;
  initials: string;
  avatar: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  platforms: string[];
  status: string;
  startDate: string | null;
  deadline: string | null;
  createdAt: string;
  progress: number;
  leadProducer: { name: string; initials: string; avatar: string } | null;
  members: Member[];
  timeline: { stages: TimelineStage[] };
}

interface ProjectDetailModalProps {
  projectId: string | null;
  onClose: () => void;
}

// ── Platform abbreviation map ──────────────────────────────────────────────────
const platformAbbr: Record<string, string> = {
  PC:          "PC",
  PlayStation: "PS5",
  Xbox:        "XB",
  Switch:      "NSW",
  Mobile:      "MOB",
};

// ── Modal ──────────────────────────────────────────────────────────────────────
export function ProjectDetailModal({ projectId, onClose }: ProjectDetailModalProps) {
  const [detail, setDetail]   = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setDetail(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`http://localhost:3001/projects/${projectId}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.message ?? "Failed to load project.");
        setDetail(json.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load project.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [projectId]);

  if (!projectId) return null;

  // ── Backdrop click to close ────────────────────────────────────────────────
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-[900px] max-h-[90vh] bg-card border border-border rounded-sm shadow-2xl flex flex-col overflow-hidden">

        {/* ── Loading state ──────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* ── Error state ────────────────────────────────────────────────── */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <p className="text-[13px] text-red-500">{error}</p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-6 h-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Content ────────────────────────────────────────────────────── */}
        {!loading && !error && detail && (
          <>
            {/* Top bar: ID + Status badge + close */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <span className="text-[12px] text-muted-foreground font-mono tracking-wide">
                  ID: PRJ-{detail.id.padStart(4, "0")}
                </span>
                <StatusBadge status={detail.status} />
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-6 h-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1">
              {/* Title row */}
              <div className="flex items-center justify-between px-6 pt-6 pb-5">
                <h2 className="text-[26px] font-black tracking-tight">{detail.name}</h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-[12px] font-semibold rounded-sm"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 text-[12px] font-semibold rounded-sm bg-foreground text-background hover:bg-foreground/85"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Status
                  </Button>
                </div>
              </div>

              {/* Two-column layout */}
              <div className="px-6 pb-6 flex gap-4">
                {/* Left column */}
                <div className="flex-1 flex flex-col gap-4 min-w-0">

                  {/* Overview Matrix */}
                  <section className="border border-border rounded-sm p-4">
                    <p className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase mb-4">
                      Overview Matrix
                    </p>
                    <div className="grid grid-cols-4 gap-4">
                      {/* Budget */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                          <DollarSign className="w-3 h-3" />
                          Budget
                        </div>
                        <span className="text-[20px] font-black">
                          {detail.genre ? `${detail.genre}` : "—"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{detail.genre ?? "No genre"}</span>
                      </div>

                      {/* Progress */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                          <RefreshCcw className="w-3 h-3" />
                          Progress
                        </div>
                        <span className="text-[20px] font-black">{detail.progress}%</span>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-0.5">
                          <div
                            className="h-full bg-foreground rounded-full transition-all"
                            style={{ width: `${detail.progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Deadline */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                          <Calendar className="w-3 h-3" />
                          Deadline
                        </div>
                        <span className="text-[20px] font-black">
                          {detail.deadline ?? "—"}
                        </span>
                      </div>

                      {/* Platforms */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                          <Monitor className="w-3 h-3" />
                          Platforms
                        </div>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {detail.platforms.length > 0 ? (
                            detail.platforms.map((p) => (
                              <span
                                key={p}
                                className="px-1.5 py-0.5 bg-muted border border-border rounded-sm text-[10px] font-bold"
                              >
                                {platformAbbr[p] ?? p}
                              </span>
                            ))
                          ) : (
                            <span className="text-[12px] text-muted-foreground">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Production Timeline */}
                  <section className="border border-border rounded-sm p-4">
                    <div className="flex items-center justify-between mb-5">
                      <p className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
                        Production Timeline
                      </p>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 font-semibold transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Gantt Chart
                      </button>
                    </div>

                    {/* Timeline track */}
                    <div className="relative flex items-center justify-between px-4">
                      {/* Track line */}
                      <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-0.5 bg-border" />

                      {/* Progress line — covers done + current stages */}
                      <ProgressLine stages={detail.timeline.stages} />

                      {/* Stage nodes */}
                      {detail.timeline.stages.map((stage) => (
                        <div key={stage.name} className="relative flex flex-col items-center gap-2 z-10">
                          <StageNode done={stage.done} current={stage.current} />
                          <span
                            className={`text-[11px] font-semibold mt-1 ${
                              stage.done || stage.current
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {stage.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Description (if any) */}
                  {detail.description && (
                    <section className="border border-border rounded-sm p-4">
                      <p className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase mb-2">
                        Description
                      </p>
                      <p className="text-[13px] text-muted-foreground leading-relaxed">
                        {detail.description}
                      </p>
                    </section>
                  )}
                </div>

                {/* Right column — Department Leads */}
                <div className="w-[220px] shrink-0">
                  <section className="border border-border rounded-sm p-4 h-full">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
                        Department Leads
                      </p>
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>

                    <div className="flex flex-col gap-2">
                      {/* Lead Producer */}
                      {detail.leadProducer ? (
                        <MemberRow
                          initials={detail.leadProducer.initials}
                          avatar={detail.leadProducer.avatar}
                          name={detail.leadProducer.name}
                          role="Lead Producer"
                          highlighted
                        />
                      ) : (
                        <UnassignedRow role="Lead Producer" />
                      )}

                      {/* Project members */}
                      {detail.members.length > 0 ? (
                        detail.members.map((m) => (
                          <MemberRow
                            key={m.userId}
                            initials={m.initials}
                            avatar={m.avatar}
                            name={m.username}
                            role={m.projectRole}
                          />
                        ))
                      ) : (
                        <UnassignedRow role="Game Design" />
                      )}

                      <button
                        type="button"
                        className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors font-medium"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Add member
                      </button>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Beta:             "bg-blue-50 text-blue-700 border-blue-200",
    Alpha:            "bg-yellow-50 text-yellow-700 border-yellow-200",
    "Pre-production": "bg-zinc-100 text-zinc-600 border-zinc-200",
    Live:             "bg-green-50 text-green-700 border-green-200",
    Cancelled:        "bg-red-50 text-red-500 border-red-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 border rounded-sm text-[11px] font-bold tracking-wide uppercase ${
        styles[status] ?? "bg-zinc-100 text-zinc-600 border-zinc-200"
      }`}
    >
      {status}
    </span>
  );
}

function StageNode({ done, current }: { done: boolean; current: boolean }) {
  if (done) {
    return (
      <div className="w-7 h-7 rounded-full bg-foreground border-2 border-foreground flex items-center justify-center shadow-sm">
        <svg className="w-3.5 h-3.5 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (current) {
    return (
      <div className="w-7 h-7 rounded-full border-2 border-foreground bg-background flex items-center justify-center shadow-sm">
        <div className="w-2.5 h-2.5 rounded-full bg-foreground" />
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-full border-2 border-border bg-background" />
  );
}

function ProgressLine({ stages }: { stages: TimelineStage[] }) {
  // Find the index of the current or last done stage
  const currentIndex = stages.findIndex((s) => s.current);
  const lastDoneIndex = stages.reduce((acc, s, i) => (s.done ? i : acc), -1);
  const fillUpTo = currentIndex !== -1 ? currentIndex : lastDoneIndex;

  if (fillUpTo < 0 || stages.length < 2) return null;

  // Progress percentage: each stage is evenly spaced
  const pct = (fillUpTo / (stages.length - 1)) * 100;

  return (
    <div
      className="absolute left-4 top-1/2 -translate-y-1/2 h-0.5 bg-foreground z-0"
      style={{ width: `${pct}%` }}
    />
  );
}

function MemberRow({
  initials,
  avatar,
  name,
  role,
  highlighted = false,
}: {
  initials: string;
  avatar: string;
  name: string;
  role: string;
  highlighted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar size="sm" className={highlighted ? "ring-2 ring-foreground ring-offset-1" : ""}>
        {avatar ? <AvatarImage src={avatar} alt={name} /> : null}
        <AvatarFallback className="text-[9px] font-black">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold truncate">{name}</p>
        <p className="text-[10px] text-muted-foreground truncate">{role}</p>
      </div>
    </div>
  );
}

function UnassignedRow({ role }: { role: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-6 h-6 rounded-full border border-dashed border-border bg-muted/50 flex items-center justify-center">
        <UserPlus className="w-3 h-3 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-muted-foreground italic">Unassigned</p>
        <p className="text-[10px] text-muted-foreground truncate">{role}</p>
      </div>
    </div>
  );
}
