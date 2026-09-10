"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  Upload,
  Download,
  Box,
  Image as ImageIcon,
  Music,
  Sparkles,
  X,
  CloudUpload,
  Trash2,
  MoreVertical,
  Eye,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CreateProjectModal } from "@/components/create-project-modal";
import { Topbar } from "@/components/topbar";
import { useAuth } from "@/src/context/auth-context";
import { can } from "@/src/lib/permissions";

const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001";

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
type AssetType     = "3D Model" | "Texture" | "Audio" | "VFX" | "UI";
type AssetCategory = "All Assets" | "Characters" | "Environment" | "Audio" | "VFX" | "UI";
type AssetStatus   = "Approved" | "In Review" | "Draft";

interface Asset {
  id:          string;
  name:        string;
  assetType:   AssetType;
  category:    Exclude<AssetCategory, "All Assets">;
  status:      AssetStatus;
  format:      string;
  fileSize:    string;
  fileName:    string;
  version:     string | null;
  description: string | null;
  createdAt:   string;
}

const ASSET_TYPES:  AssetType[]     = ["3D Model", "Texture", "Audio", "VFX", "UI"];
const CATEGORIES:   AssetCategory[] = ["All Assets", "Characters", "Environment", "Audio", "VFX", "UI"];
const CAT_OPTIONS   = CATEGORIES.filter((c) => c !== "All Assets") as Exclude<AssetCategory, "All Assets">[];

const STATUS_DOT: Record<AssetStatus, string> = {
  Approved:   "bg-green-500",
  "In Review": "bg-yellow-400",
  Draft:       "bg-zinc-400",
};

const TYPE_ICON: Record<AssetType, React.ElementType> = {
  "3D Model": Box,
  Texture:    ImageIcon,
  Audio:      Music,
  VFX:        Sparkles,
  UI:         ImageIcon,
};

// ── Upload Asset Modal ─────────────────────────────────────────────────────────
function UploadAssetModal({
  open,
  onClose,
  onUploaded,
}: {
  open:       boolean;
  onClose:    () => void;
  onUploaded: (asset: Asset) => void;
}) {
  const [dragOver,    setDragOver]    = useState(false);
  const [file,        setFile]        = useState<File | null>(null);
  const [progress,    setProgress]    = useState(0);
  const [uploading,   setUploading]   = useState(false);
  const [name,        setName]        = useState("");
  const [assetType,   setAssetType]   = useState<AssetType>("3D Model");
  const [category,    setCategory]    = useState<Exclude<AssetCategory, "All Assets">>("Characters");
  const [version,     setVersion]     = useState("");
  const [description, setDescription] = useState("");
  const [error,       setError]       = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setFile(null); setProgress(0); setUploading(false);
      setName(""); setAssetType("3D Model"); setCategory("Characters");
      setVersion(""); setDescription(""); setError("");
    }
  }, [open]);

  if (!open) return null;

  function pickFile(f: File) {
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
    setError("");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }

  async function handleSubmit() {
    if (!file)        { setError("Please select a file."); return; }
    if (!name.trim()) { setError("Asset name is required."); return; }

    setUploading(true);
    setError("");

    // Simulate progress while XHR uploads
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 8, 90));
    }, 120);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name.trim());
      fd.append("assetType", assetType);
      fd.append("category", category);
      if (version.trim())     fd.append("version", version.trim());
      if (description.trim()) fd.append("description", description.trim());

      const res = await fetch(`${API}/assets`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      clearInterval(interval);
      setProgress(100);

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message ?? `Upload failed (${res.status})`);
      }

      const json = await res.json();
      onUploaded(json.data);
      setTimeout(onClose, 400);
    } catch (err: any) {
      clearInterval(interval);
      setProgress(0);
      setUploading(false);
      setError(err.message ?? "Upload failed");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[560px] bg-card border border-border rounded-sm shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <h2 className="text-[15px] font-black tracking-wide">Upload New Asset</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-5 overflow-y-auto max-h-[75vh]">

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-sm flex flex-col items-center justify-center py-10 gap-2 transition-colors cursor-pointer select-none ${
              dragOver
                ? "border-foreground bg-muted"
                : "border-border hover:border-foreground/40 hover:bg-muted/40"
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <CloudUpload className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-[13px] font-semibold text-blue-500">
              Drag and drop files here or click to browse
            </p>
            <p className="text-[11px] text-muted-foreground">
              Supported formats: FBX, OBJ, PNG, JPG, WAV, MP3, MP4, SVG
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".fbx,.obj,.png,.jpg,.jpeg,.psd,.wav,.mp3,.mp4,.svg,.webp"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
            />
          </div>

          {/* Asset Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Asset Name <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g., Hero_Character_Rig"
              className="h-9 text-[12px] rounded-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Asset Type + Category */}
          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Asset Type</label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value as AssetType)}
                className="h-9 px-3 text-[12px] bg-background border border-border rounded-sm outline-none focus:border-foreground/40 transition-colors text-foreground"
              >
                {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Exclude<AssetCategory, "All Assets">)}
                className="h-9 px-3 text-[12px] bg-background border border-border rounded-sm outline-none focus:border-foreground/40 transition-colors text-foreground"
              >
                {CAT_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Version (optional) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Version <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span></label>
            <Input
              placeholder="e.g., v05"
              className="h-9 text-[12px] rounded-sm"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </div>

          {/* Selected file + progress */}
          {file && (
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Selected File (1)
              </label>
              <div className="bg-muted rounded-sm px-3 py-2.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Box className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-[12px] font-medium truncate max-w-[320px]">{file.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {uploading && (
                      <span className="text-[11px] font-semibold text-muted-foreground">{progress}%</span>
                    )}
                    {!uploading && (
                      <button type="button" onClick={() => setFile(null)} className="text-muted-foreground hover:text-red-500 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {uploading && (
                  <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full transition-all duration-150"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-[11px] text-red-500 font-semibold">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border">
          <Button variant="outline" size="sm" className="text-[12px] font-semibold px-4" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-[12px] font-black px-5 tracking-wide uppercase gap-1.5"
            onClick={handleSubmit}
            disabled={!file || !name.trim() || uploading}
          >
            <Upload className="w-3.5 h-3.5" />
            {uploading ? "Uploading…" : "Upload Asset"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm ─────────────────────────────────────────────────────────────
function DeleteAssetConfirm({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[380px] bg-card border-2 border-red-500 rounded-sm shadow-2xl flex flex-col overflow-hidden">
        <div className="h-1.5 bg-red-500" />
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-sm bg-red-500 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[14px] font-black text-red-500 uppercase tracking-wide">Delete Asset</p>
            <p className="text-[10px] text-muted-foreground tracking-[0.12em] uppercase mt-0.5">This cannot be undone</p>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-[12px] text-muted-foreground">
            Are you sure you want to delete <span className="font-bold text-foreground">"{name}"</span>?
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

// ── Asset Detail Modal ────────────────────────────────────────────────────────
function AssetDetailModal({
  asset,
  onClose,
  onDownload,
}: {
  asset: Asset | null;
  onClose: () => void;
  onDownload: () => void;
}) {
  const { user } = useAuth();
  if (!asset) return null;
  const Icon = TYPE_ICON[asset.assetType];
  const canDownload = can(user?.role, "asset:download");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[480px] bg-card border border-border rounded-sm shadow-2xl flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-muted flex items-center justify-center">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-[14px] font-black tracking-wide leading-tight">{asset.name}</h2>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{asset.category} • {asset.assetType}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 text-[12px] bg-muted/40 p-3 rounded-sm border border-border">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Format</span>
              <span className="font-semibold">{asset.format}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">File Size</span>
              <span className="font-semibold">{asset.fileSize}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Version</span>
              <span className="font-semibold">{asset.version || "v1.0"}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Status</span>
              <span className="font-semibold">{asset.status}</span>
            </div>
          </div>

          {asset.description && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</span>
              <p className="text-[12px] text-muted-foreground leading-relaxed">{asset.description}</p>
            </div>
          )}

          <div className="text-[11px] text-muted-foreground">
            Uploaded file: <span className="font-mono text-foreground font-semibold">{asset.fileName}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border">
          <Button variant="ghost" size="sm" className="text-[11px] font-semibold px-4" onClick={onClose}>Close</Button>
          {canDownload && (
            <Button size="sm" className="text-[11px] font-bold px-4 gap-1.5 uppercase tracking-wide" onClick={onDownload}>
              <Download className="w-3.5 h-3.5" />Download Asset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Asset Card ─────────────────────────────────────────────────────────────────
function AssetCard({
  asset,
  onDetail,
  onDelete,
}: {
  asset: Asset;
  onDetail: (asset: Asset) => void;
  onDelete: (id: string) => void;
}) {
  const { user } = useAuth();
  const Icon = TYPE_ICON[asset.assetType];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const canDownload = can(user?.role, "asset:download");
  const canDelete   = can(user?.role, "asset:delete");

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

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = `${API}/assets/${asset.id}/download`;
    a.download = asset.fileName || asset.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-card border border-border rounded-sm overflow-hidden hover:shadow-md transition-all flex flex-col justify-between">
      {/* Preview area */}
      <div className="relative h-[110px] bg-muted/60 flex items-center justify-center border-b border-border/40">
        {asset.version && (
          <span className="absolute top-2 right-2 text-[9px] font-bold tracking-widest text-muted-foreground uppercase bg-background/90 border border-border px-1.5 py-0.5 rounded-sm">
            {asset.version}
          </span>
        )}
        <Icon className="w-9 h-9 text-muted-foreground/40" strokeWidth={1.25} />
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5 flex-1 justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
              {asset.assetType}
            </span>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[asset.status]}`} />
              <span className="text-[9px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                {asset.status}
              </span>
            </div>
          </div>
          <p className="text-[13px] font-bold leading-tight truncate" title={asset.name}>{asset.name}</p>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
          <span>{asset.format}</span>
          <span>{asset.fileSize}</span>
        </div>
      </div>

      {/* Action Button Bar */}
      <div className="px-3 pb-3 pt-0 flex items-center gap-1.5">
        {canDownload && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="flex-1 h-7 text-[11px] font-bold gap-1.5 justify-center tracking-wide hover:bg-muted"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </Button>
        )}

        {/* 3-dots Menu Button */}
        <div ref={ref} className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((prev) => !prev);
            }}
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 rounded-sm border border-border/40"
            title="More Options"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </Button>

          {open && (
            <div
              className="absolute right-0 bottom-full mb-1 z-50 w-36 bg-popover border border-border rounded-sm shadow-md py-1 text-popover-foreground animate-in fade-in-50 zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onDetail(asset);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium hover:bg-muted transition-colors text-left"
              >
                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Detail</span>
              </button>

              {canDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    onDelete(asset.id);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ onLogout, onNav, onNewProject }: { onLogout: () => void; onNav: (href: string) => void; onNewProject: () => void }) {
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
          <Button
            key={label}
            variant={pathname === href ? "secondary" : "ghost"}
            size="sm"
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
export default function AssetLibraryPage() {
  const router = useRouter();

  const [newProjectOpen,  setNewProjectOpen]  = useState(false);
  const [uploadOpen,      setUploadOpen]      = useState(false);
  const [deleteTarget,    setDeleteTarget]    = useState<Asset | null>(null);
  const [detailTarget,    setDetailTarget]    = useState<Asset | null>(null);

  const [assets,          setAssets]          = useState<Asset[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [activeCategory,  setActiveCategory]  = useState<AssetCategory>("All Assets");
  const [search,          setSearch]          = useState("");

  // Fetch assets from API
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "100" });
      if (activeCategory !== "All Assets") params.set("category", activeCategory);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`${API}/assets?${params}`, { credentials: "include" });
      if (!res.ok) return;
      const json = await res.json();
      setAssets(json.data ?? []);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [activeCategory, search]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  async function handleDelete(id: string) {
    try {
      await fetch(`${API}/assets/${id}`, { method: "DELETE", credentials: "include" });
      setAssets((prev) => prev.filter((a) => a.id !== id));
    } catch {}
    setDeleteTarget(null);
  }

  async function handleLogout() {
    await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    router.push("/login");
  }

  function handleNav(href: string) {
    if (href !== "#") router.push(href);
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onLogout={handleLogout} onNav={handleNav} onNewProject={() => setNewProjectOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search assets..." />

        <main className="flex-1 overflow-y-auto px-8 py-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black">Asset Library</h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">Manage and organize production assets.</p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 text-[11px] tracking-widest uppercase font-bold mt-1"
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Asset
            </Button>
          </div>

          {/* Category filter pills */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`h-7 px-3.5 text-[11px] font-semibold rounded-full border transition-colors ${
                  activeCategory === cat
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Asset grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-[12px] text-muted-foreground">Loading assets…</p>
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Library className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-[13px] font-semibold text-muted-foreground">No assets found</p>
              <p className="text-[11px] text-muted-foreground mt-1">Upload your first asset to get started.</p>
              <Button size="sm" className="mt-4 gap-1.5 text-[11px] uppercase font-bold tracking-widest" onClick={() => setUploadOpen(true)}>
                <Upload className="w-3.5 h-3.5" />Upload Asset
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onDetail={(a) => setDetailTarget(a)}
                  onDelete={(id) => setDeleteTarget(assets.find((a) => a.id === id) ?? null)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <CreateProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />

      <UploadAssetModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(asset) => setAssets((prev) => [asset, ...prev])}
      />

      {detailTarget && (
        <AssetDetailModal
          asset={detailTarget}
          onClose={() => setDetailTarget(null)}
          onDownload={() => {
            const a = document.createElement("a");
            a.href = `${API}/assets/${detailTarget.id}/download`;
            a.download = detailTarget.fileName || detailTarget.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }}
        />
      )}

      {deleteTarget && (
        <DeleteAssetConfirm
          name={deleteTarget.name}
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
