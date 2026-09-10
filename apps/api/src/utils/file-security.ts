// ── Studio File Security & Restricted Extension Handler ──────────────────────────

const DANGEROUS_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "sh", "bash", "ps1", "psm1", "vbs", "vbe", "js", "jse",
  "mjs", "cjs", "php", "py", "rb", "pl", "jar", "msi", "dll", "sys", "scr",
  "hta", "cpl", "com", "pif", "lnk", "reg", "wsf", "wsh", "asp", "aspx", "cgi",
  "htm", "html", "xhtml", "wasm", "elf", "app", "dmg", "deb", "rpm"
]);

const ASSET_WHITELIST = new Set([
  // 3D Models
  "fbx", "obj", "gltf", "glb", "blend", "max", "ma", "mb", "dae", "stl", "usd", "usda", "usdc", "usdz",
  // Textures & Images
  "png", "jpg", "jpeg", "psd", "tga", "exr", "hdr", "webp", "tif", "tiff", "bmp", "ico", "svg",
  // Audio
  "wav", "mp3", "ogg", "flac", "aac", "m4a",
  // Video & VFX
  "mp4", "mov", "avi", "webm", "mkv",
  // Archives & Packages
  "zip", "rar", "7z", "tar", "gz", "unitypackage"
]);

const BUG_EVIDENCE_WHITELIST = new Set([
  "png", "jpg", "jpeg", "webp", "gif", "bmp",
  "mp4", "webm", "mov", "avi", "wav", "mp3", "ogg",
  "txt", "log", "pdf", "json", "zip", "rar", "7z"
]);

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  ext?: string;
}

export function validateAssetFile(file: File, maxSizeMB: number = 500): FileValidationResult {
  if (!file || !file.name) {
    return { valid: false, error: "No valid file uploaded." };
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { valid: false, error: `File size exceeds maximum allowed limit of ${maxSizeMB}MB.` };
  }

  const parts = file.name.split(".");
  if (parts.length < 2) {
    return { valid: false, error: "File must have a valid extension." };
  }
  const ext = parts.pop()!.toLowerCase().trim();

  // 1. Strict Executable Blacklist Check
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Restricted File Type: Executable files and scripts (.${ext}) are strictly forbidden for studio security reasons.`,
    };
  }

  // 2. Studio Whitelist Check
  if (!ASSET_WHITELIST.has(ext)) {
    return {
      valid: false,
      error: `Unsupported format (.${ext}). Allowed formats include 3D models (FBX, OBJ, GLTF, Blend), images (PNG, JPG, PSD, TGA, EXR), audio (WAV, MP3, OGG), videos (MP4, MOV), and archives (ZIP, RAR, 7Z).`,
    };
  }

  return { valid: true, ext };
}

export function validateBugEvidenceFile(file: File, maxSizeMB: number = 100): FileValidationResult {
  if (!file || !file.name) {
    return { valid: false, error: "No valid file uploaded." };
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { valid: false, error: `Evidence file size exceeds limit of ${maxSizeMB}MB.` };
  }

  const parts = file.name.split(".");
  if (parts.length < 2) {
    return { valid: false, error: "Evidence file must have a valid extension." };
  }
  const ext = parts.pop()!.toLowerCase().trim();

  // 1. Strict Executable Blacklist Check
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Restricted File Type: Executable files and scripts (.${ext}) cannot be uploaded as bug evidence.`,
    };
  }

  // 2. Bug Evidence Whitelist Check
  if (!BUG_EVIDENCE_WHITELIST.has(ext)) {
    return {
      valid: false,
      error: `Unsupported evidence format (.${ext}). Allowed formats are images, videos, audio, text/log files, PDFs, and archives.`,
    };
  }

  return { valid: true, ext };
}
