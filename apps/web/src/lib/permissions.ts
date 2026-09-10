import type { Role } from "@/src/context/auth-context";

export function normalizeRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === "admin" || normalized === "producer" || normalized === "developer" || normalized === "designer" || normalized === "qa") {
    return normalized as Role;
  }

  return null;
}

// ── Permission matrix from GSMS-Permission-Matrix.xlsx ────────────────────────
//
// Pages each role can navigate to
export const ROLE_NAV: Record<Role, string[]> = {
  admin:     ["/dashboard", "/project-management", "/sprint", "/tasks", "/asset-library", "/bug-tracking", "/team"],
  producer:  ["/dashboard", "/project-management", "/sprint", "/tasks", "/asset-library", "/bug-tracking", "/team"],
  developer: ["/dashboard", "/project-management", "/sprint", "/tasks", "/asset-library", "/bug-tracking", "/team"],
  designer:  ["/dashboard", "/project-management", "/sprint", "/tasks", "/asset-library", "/bug-tracking", "/team"],
  qa:        ["/dashboard", "/project-management", "/sprint", "/tasks", "/asset-library", "/bug-tracking", "/team"],
};
// All roles can see all pages — access is controlled at the action level, not nav level.
// (Hiding nav items causes confusion; restricted pages show read-only views instead.)

// ── Action-level permissions ───────────────────────────────────────────────────
export type Action =
  // Global
  | "project:create"       // New Project button
  // Project Management
  | "project:manage"       // Edit/delete projects
  // Sprint
  | "sprint:manage"        // Create/delete sprints
  | "sprint:update"        // Add/edit sprint items
  // Tasks
  | "task:manage"          // Create/delete tasks
  | "task:update"          // Edit status/progress on own tasks
  // Asset Library
  | "asset:upload"         // Upload new assets
  | "asset:delete"         // Delete assets
  | "asset:download"       // Download assets
  // Bug Tracking
  | "bug:manage"           // Create/edit/delete bugs
  | "bug:view"             // View only
  // Team
  | "team:invite"          // Add/remove team members
  // Settings
  | "settings:system"      // System-level settings (admin only)
  | "settings:account";    // Own account settings

const PERMISSIONS: Record<Role, Set<Action>> = {
  // Admin — Full access on everything + system settings + team invite
  admin: new Set([
    "project:create", "project:manage",
    "sprint:manage",  "sprint:update",
    "task:manage",    "task:update",
    "asset:upload",   "asset:delete", "asset:download",
    "bug:manage",     "bug:view",
    "team:invite",
    "settings:system", "settings:account",
  ]),
  // Producer — Create/manage projects, manage sprints/tasks/bugs, download assets, view team
  producer: new Set([
    "project:create", "project:manage",
    "sprint:manage",  "sprint:update",
    "task:manage",    "task:update",
    "asset:download",
    "bug:manage",     "bug:view",
    "team:invite",
    "settings:account",
  ]),
  // Developer — View dashboard/PM/team, update sprint progress & tasks, download assets, manage bugs
  developer: new Set([
    "sprint:update",
    "task:update",
    "asset:download",
    "bug:manage",     "bug:view",
    "settings:account",
  ]),
  // Designer — View dashboard/PM/team, update sprint progress & tasks, manage assets, view bugs
  designer: new Set([
    "sprint:update",
    "task:update",
    "asset:upload",   "asset:delete", "asset:download",
    "bug:view",
    "settings:account",
  ]),
  // QA — View dashboard/PM/team, update sprint progress & tasks, download assets, manage bugs
  qa: new Set([
    "sprint:update",
    "task:update",
    "asset:download",
    "bug:manage",     "bug:view",
    "settings:account",
  ]),
};

/** Returns true if the given role has the given permission */
export function can(role: Role | null | undefined | string, action: Action): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  return PERMISSIONS[normalized]?.has(action) ?? false;
}

/** Returns true if this role can access Team page with write access */
export function isTeamReadOnly(role: Role | null | undefined | string): boolean {
  const normalized = normalizeRole(role);
  return normalized !== "admin" && normalized !== "producer";
}
