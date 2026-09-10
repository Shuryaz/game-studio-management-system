import { Elysia, t } from "elysia";
import { db } from "../../db";
import { assets } from "../../db/schema/asset";
import { eq, asc, like, and } from "drizzle-orm";
import { join } from "path";
import { writeFile, unlink, mkdir } from "fs/promises";

const STORAGE_DIR = "C:/Users/ArkTsuruya/Documents/PROJECT/ASSETS_LIBRARY";

import { validateAssetFile } from "../../utils/file-security";

// Supported MIME types → format label
const MIME_TO_FORMAT: Record<string, string> = {
  "model/fbx":              "FBX",
  "application/octet-stream": "FBX", // .fbx often comes as octet-stream
  "model/obj":              "OBJ",
  "image/png":              "PNG",
  "image/jpeg":             "JPG",
  "image/psd":              "PSD",
  "image/webp":             "WEBP",
  "audio/wav":              "WAV",
  "audio/mpeg":             "MP3",
  "video/mp4":              "MP4",
  "image/svg+xml":          "SVG",
};

function extToFormat(filename: string): string {
  const ext = filename.split(".").pop()?.toUpperCase() ?? "FILE";
  return ext;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toIsoString(val: any): string {
  if (!val) return new Date().toISOString();
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return new Date().toISOString();
  const diff = Date.now() - d.getTime();
  if (diff < -60000) {
    const tzOffsetMs = new Date().getTimezoneOffset() * 60000;
    return new Date(d.getTime() + tzOffsetMs).toISOString();
  }
  return d.toISOString();
}

export const assetRoutes = new Elysia({ prefix: "/assets" })

  // ── GET /assets ─────────────────────────────────────────────────────────────
  .get("/", async ({ query }) => {
    const { category, search, page = 1, pageSize = 50 } = query;

    const all = await db.select().from(assets).orderBy(asc(assets.createdAt));

    const filtered = all.filter((a) => {
      const matchCat = !category || category === "All Assets" || a.category === category;
      const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });

    const total = filtered.length;
    const safePage = Math.max(1, Number(page));
    const safePageSize = Math.max(1, Number(pageSize));
    const paginated = filtered.slice((safePage - 1) * safePageSize, safePage * safePageSize);

    return {
      success: true,
      data: paginated.map((a) => ({
        id: String(a.id),
        name: a.name,
        assetType: a.assetType,
        category: a.category,
        status: a.status,
        format: a.format,
        fileSize: formatBytes(a.fileSize),
        fileName: a.fileName,
        version: a.version ?? null,
        description: a.description ?? null,
        createdAt: toIsoString(a.createdAt),
      })),
      pagination: { page: safePage, pageSize: safePageSize, total, totalPages: Math.max(1, Math.ceil(total / safePageSize)) },
    };
  }, {
    query: t.Object({
      category: t.Optional(t.String()),
      search: t.Optional(t.String()),
      page: t.Optional(t.Numeric()),
      pageSize: t.Optional(t.Numeric()),
    }),
  })

  // ── POST /assets (multipart upload) ─────────────────────────────────────────
  .post("/", async ({ body, set }) => {
    const { file, name, assetType, category, version, description } = body;

    // Security validation (blacklist executable scripts, enforce studio whitelist)
    const validation = validateAssetFile(file);
    if (!validation.valid) {
      set.status = 400;
      return { success: false, message: validation.error };
    }

    // Ensure category subdir exists
    const categoryDir = join(STORAGE_DIR, category);
    await mkdir(categoryDir, { recursive: true });

    // Save file to disk first
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${timestamp}_${safeName}`;
    const filePath = join(categoryDir, fileName);
    const arrayBuffer = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(arrayBuffer));

    const format = extToFormat(file.name);
    const normalizedPath = filePath.replace(/\\/g, "/");

    // Insert into DB — if this fails, return the error clearly
    try {
      await db.insert(assets).values({
        name: name.trim(),
        assetType: assetType as "3D Model" | "Texture" | "Audio" | "VFX" | "UI",
        category: category as "Characters" | "Environment" | "Audio" | "VFX" | "UI",
        status: "Draft",
        format,
        filePath: normalizedPath,
        fileName: file.name,
        fileSize: file.size,
        version: version?.trim() || null,
        description: description?.trim() || null,
      });
    } catch (dbErr: any) {
      set.status = 500;
      return {
        success: false,
        message: `File saved but DB insert failed: ${dbErr?.message ?? String(dbErr)}`,
      };
    }

    const created = await db.select().from(assets).orderBy(asc(assets.createdAt));
    const newAsset = created[created.length - 1]!;

    set.status = 201;
    return {
      success: true,
      data: {
        id: String(newAsset.id),
        name: newAsset.name,
        assetType: newAsset.assetType,
        category: newAsset.category,
        status: newAsset.status,
        format: newAsset.format,
        fileSize: formatBytes(newAsset.fileSize),
        fileName: newAsset.fileName,
        version: newAsset.version ?? null,
      },
    };
  }, {
    body: t.Object({
      file: t.File(),
      name: t.String(),
      assetType: t.String(),
      category: t.String(),
      version: t.Optional(t.String()),
      description: t.Optional(t.String()),
    }),
  })

  // ── GET /assets/:id/download ──────────────────────────────────────────────────
  .get("/:id/download", async ({ params, set }) => {
    const id = Number(params.id);
    const rows = await db.select().from(assets).where(eq(assets.id, id));
    if (!rows.length) {
      set.status = 404;
      return { success: false, message: "Asset not found" };
    }

    const asset = rows[0]!;
    const file = Bun.file(asset.filePath);
    if (!(await file.exists())) {
      set.status = 404;
      return { success: false, message: "Asset file does not exist on disk" };
    }

    set.headers["content-disposition"] = `attachment; filename="${encodeURIComponent(asset.fileName || asset.name)}"`;
    return file;
  }, { params: t.Object({ id: t.Numeric() }) })

  // ── DELETE /assets/:id ───────────────────────────────────────────────────────
  .delete("/:id", async ({ params, set }) => {
    const id = Number(params.id);
    const rows = await db.select().from(assets).where(eq(assets.id, id));
    if (!rows.length) { set.status = 404; return { success: false, message: "Not found" }; }

    const asset = rows[0]!;
    // Delete file from disk (best-effort)
    await unlink(asset.filePath).catch(() => {});
    await db.delete(assets).where(eq(assets.id, id));
    return { success: true };
  }, { params: t.Object({ id: t.Numeric() }) });
