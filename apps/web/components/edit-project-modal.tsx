"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle2, XCircle, Loader2, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProjectStatus = "Pre-production" | "Alpha" | "Beta" | "Live" | "Cancelled";

const STATUSES: ProjectStatus[] = ["Pre-production", "Alpha", "Beta", "Live", "Cancelled"];

const GENRES = [
  "Action",
  "Adventure",
  "RPG",
  "Strategy",
  "Simulation",
  "Sports",
  "Puzzle",
  "Horror",
  "FPS",
  "MMORPG",
];

const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001";

interface EditProjectModalProps {
  projectId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function EditProjectModal({ projectId, open, onClose, onUpdated }: EditProjectModalProps) {
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("Pre-production");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!open || !projectId) return;

    let cancelled = false;
    setFetching(true);
    setResult(null);

    async function loadProject() {
      try {
        const res = await fetch(`${API}/projects/${projectId}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load project data");
        const json = await res.json();
        if (!cancelled && json.success && json.data) {
          const p = json.data;
          setName(p.name ?? "");
          setGenre(p.genre ?? "");
          setStatus(p.status ?? "Pre-production");
          setDeadline(p.deadline ? String(p.deadline).slice(0, 10) : "");
          setDescription(p.description ?? "");
        }
      } catch (err) {
        if (!cancelled) {
          setResult({
            type: "error",
            message: err instanceof Error ? err.message : "Failed to load project details.",
          });
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    }

    loadProject();

    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  if (!open || !projectId) return null;

  function handleClose() {
    if (loading) return;
    setResult(null);
    onClose();
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setResult({ type: "error", message: "Project name is required." });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`${API}/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          status,
          genre: genre || undefined,
          deadline: deadline || undefined,
          description: description || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult({ type: "success", message: "Project updated successfully." });
        if (onUpdated) onUpdated();
        setTimeout(() => {
          handleClose();
        }, 1000);
      } else {
        setResult({
          type: "error",
          message: data.message ?? "Failed to update project.",
        });
      }
    } catch {
      setResult({
        type: "error",
        message: "Could not reach the server.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-[600px] bg-card border border-border rounded-sm shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <FolderKanban className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-[15px] font-black tracking-wide">Edit Project</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="w-6 h-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
          {fetching ? (
            <div className="py-12 text-center text-[12px] text-muted-foreground">
              Loading project details...
            </div>
          ) : (
            <>
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="e.g. Project Nova"
                  className="h-9 text-[13px] rounded-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Status & Genre */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    disabled={loading}
                    className="h-9 px-3 text-[13px] bg-background border border-border rounded-sm outline-none focus:border-foreground/40 transition-colors text-foreground"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                    Genre
                  </label>
                  <select
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    disabled={loading}
                    className="h-9 px-3 text-[13px] bg-background border border-border rounded-sm outline-none focus:border-foreground/40 transition-colors text-foreground"
                  >
                    <option value="">Select Genre...</option>
                    {GENRES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Deadline */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                  Target Deadline
                </label>
                <Input
                  type="date"
                  className="h-9 text-[13px] rounded-sm"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Overview of the project goal and scope..."
                  className="w-full text-[12px] bg-background border border-border rounded-sm px-3 py-2 outline-none resize-y placeholder:text-muted-foreground/60 focus:border-foreground/40 transition-colors text-foreground"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                />
              </div>
            </>
          )}

          {/* Status Message */}
          {result && (
            <div
              className={`flex items-start gap-2 rounded-sm px-3 py-2.5 border text-[11px] font-semibold leading-snug ${
                result.type === "success"
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-red-50 border-red-200 text-red-600"
              }`}
            >
              {result.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{result.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="text-[12px] font-semibold px-4"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-[12px] font-bold px-5 bg-foreground text-background hover:bg-foreground/85 min-w-[130px]"
            onClick={handleSubmit}
            disabled={loading || fetching}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
