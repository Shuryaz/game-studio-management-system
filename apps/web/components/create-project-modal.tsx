"use client";

import { useState } from "react";
import { X, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Types ──────────────────────────────────────────────────────────────────────
type Platform = "PC" | "PlayStation" | "Xbox" | "Switch" | "Mobile";

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

const PLATFORMS: Platform[] = ["PC", "PlayStation", "Xbox", "Switch", "Mobile"];

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
}

// ── Modal ──────────────────────────────────────────────────────────────────────
export function CreateProjectModal({ open, onClose }: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [deadline, setDeadline] = useState("");
  const [budget, setBudget] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [genreOpen, setGenreOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  if (!open) return null;

  function togglePlatform(platform: Platform) {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  }

  function resetForm() {
    setName("");
    setGenre("");
    setDeadline("");
    setBudget("");
    setPlatforms([]);
    setGenreOpen(false);
    setStatus(null);
  }

  function handleClose() {
    if (loading) return; // prevent closing mid-request
    resetForm();
    onClose();
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setStatus({ type: "error", message: "Project name is required." });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("http://localhost:3001/projects", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          genre: genre || undefined,
          deadline: deadline || undefined,
          platforms: platforms.length > 0 ? platforms : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus({ type: "success", message: `"${data.data.name}" has been created.` });
        // Close after a short delay so the user sees the success message
        setTimeout(() => {
          resetForm();
          onClose();
        }, 1200);
      } else {
        setStatus({
          type: "error",
          message: data.message ?? "Failed to create project. Please try again.",
        });
      }
    } catch {
      setStatus({
        type: "error",
        message: "Could not reach the server. Make sure the API is running.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Modal panel */}
      <div className="w-[640px] bg-card border border-border rounded-sm shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <h2 className="text-[15px] font-black tracking-wide">Create New Project</h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="w-6 h-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Project Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-[0.12em] text-amber-600 uppercase">
              Project Name <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g. Project Nova"
              className="h-9 text-[13px] rounded-sm border-border bg-transparent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Genre + Deadline row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Genre */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold tracking-[0.12em] text-amber-600 uppercase">
                Genre
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setGenreOpen((v) => !v)}
                  disabled={loading}
                  className="w-full flex items-center justify-between h-9 px-3 text-[13px] border border-border rounded-sm bg-transparent hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className={genre ? "text-foreground" : "text-muted-foreground"}>
                    {genre || "Select Genre"}
                  </span>
                  <svg
                    className="w-4 h-4 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {genreOpen && (
                  <div className="absolute top-full left-0 mt-1 z-50 w-full bg-card border border-border rounded-sm shadow-md py-1">
                    {GENRES.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          setGenre(g);
                          setGenreOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-muted transition-colors ${
                          genre === g ? "font-bold" : ""
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Deadline */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold tracking-[0.12em] text-amber-600 uppercase">
                Deadline
              </label>
              <Input
                type="date"
                className="h-9 text-[13px] rounded-sm border-border bg-transparent"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Budget Allocation */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-[0.12em] text-amber-600 uppercase">
              Budget Allocation
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground select-none">
                $
              </span>
              <Input
                type="number"
                min={0}
                placeholder="0"
                className="h-9 pl-6 text-[13px] rounded-sm border-border bg-transparent"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Target Platforms */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-[0.12em] text-amber-600 uppercase">
              Target Platforms
            </label>
            <div className="flex items-center gap-5">
              {PLATFORMS.map((platform) => (
                <label
                  key={platform}
                  className={`flex items-center gap-1.5 select-none ${
                    loading ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 accent-foreground cursor-pointer"
                    checked={platforms.includes(platform)}
                    onChange={() => togglePlatform(platform)}
                    disabled={loading}
                  />
                  <span className="text-[12px] font-medium">{platform}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Status message */}
          {status && (
            <div
              className={`flex items-start gap-2 rounded-sm px-3 py-2.5 border text-[11px] font-semibold leading-snug ${
                status.type === "success"
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-red-50 border-red-200 text-red-600"
              }`}
            >
              {status.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{status.message}</span>
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
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Creating...
              </span>
            ) : (
              "Create Project"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
