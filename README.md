# 🎮 Game Studio Management System (GSMS)

A modern, high-performance, lightweight management suite purpose-built for game development studios. GSMS coordinates game production across developers, artists, producers, and QA engineers in a unified monorepo.

---

## ⚡ Tech Stack & Architecture

- **Backend**: [Bun](https://bun.com) runtime + [ElysiaJS](https://elysiajs.com) (ultra-low overhead, sub-millisecond routing)
- **Database & ORM**: MySQL + [Drizzle ORM](https://orm.drizzle.team) (type-safe, zero runtime engine bloat)
- **Frontend**: [Next.js 16](https://nextjs.org) (React 19) + [Tailwind CSS v4](https://tailwindcss.com) + [Base UI](https://base-ui.com)
- **Monorepo Engine**: [Turborepo](https://turbo.build) + [Bun](https://bun.com) / [pnpm](https://pnpm.io) Workspaces

```
game-studio-management-system/
├── apps/
│   ├── api/          # ElysiaJS + Bun REST API (Port 3001)
│   └── web/          # Next.js 16 Frontend App (Port 3000)
├── packages/
│   └── shared/       # Shared schemas, DTOs & TypeScript types
├── turbo.json        # Turborepo task pipeline configuration
└── package.json      # Monorepo root scripts & workspace configuration
```

---

## 👥 Role-Based Access Control (RBAC)

GSMS implements an action-level permission matrix tailored to studio pipelines:

| Role | Primary Responsibilities | Project Mgmt | Sprint Board | Asset Library | Bug Tracker | Team Mgmt | System Settings |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| 👑 **Admin** | Full studio administration & governance | ✅ Manage | ✅ Manage | ✅ Upload / Delete | ✅ Manage | ✅ Manage | ✅ Full Access |
| 🎬 **Producer** | Milestone delivery, schedules, team coordination | ✅ Manage | ✅ Manage | 👁️ Download Only | ✅ Manage | ✅ Invite | ❌ Read Only |
| 💻 **Developer** | Feature engineering & bug fixes | 👁️ View | ✏️ Update Tasks | 👁️ Download Only | ✅ Manage | 👁️ View | ❌ Read Only |
| 🎨 **Designer** | 3D models, textures, animations, UI assets | 👁️ View | ✏️ Update Tasks | ✅ Upload / Delete | 👁️ View | 👁️ View | ❌ Read Only |
| 🐞 **QA** | Quality assurance, defect filing & verification | 👁️ View | ✏️ Update Tasks | 👁️ Download Only | ✅ Manage | 👁️ View | ❌ Read Only |

### Default Seed Account
After running the database seed, you can log in with the default administrator account:
- **Username**: `mikka`
- **Password**: `thefool`
- **Role**: `Admin`

*(New studio members can register with Producer, Developer, Designer, or QA roles from the registration page).*

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **[Bun](https://bun.com/)** (`>= 1.3.0`) or **[Node.js](https://nodejs.org/)** (`>= 20`) with **[pnpm](https://pnpm.io/)**
- **[MySQL](https://www.mysql.com/)** (`>= 8.0`) or MariaDB running locally or in Docker

---

### 2. Installation

Clone the repository and install dependencies from the monorepo root:

```bash
# Using Bun (Recommended)
bun install

# Or using pnpm
pnpm install
```

---

### 3. Environment Setup

Create `apps/api/.env` (if not already present):

```env
DATABASE_URL=mysql://root@localhost:3306/gsms
JWT_SECRET=your-secure-random-jwt-secret-string-here
```

*(Ensure the MySQL database `gsms` is created in your MySQL server).*

---

### 4. Database Migration & Seeding

Navigate to the API folder (or execute via monorepo scripts) to initialize tables and default studio roles/seed user:

```bash
# Push schema migrations
cd apps/api
bun run migrate

# Seed roles and admin user
bun run seed

# Return to root
cd ../..
```

---

### 5. Running the Application

You can start the entire stack or individual applications from the root directory:

#### **Start Everything Concurrently (API + Web)**
```bash
# With Bun:
bun run dev

# With pnpm:
pnpm dev
```
- **Web App**: [http://localhost:3000](http://localhost:3000)
- **API Server & Swagger**: [http://localhost:3001](http://localhost:3001) / [http://localhost:3001/swagger](http://localhost:3001/swagger)

#### **Start Single App (Isolated)**
```bash
# Run only Frontend
bun run dev:web        # (or: pnpm dev:web)

# Run only Backend API
bun run dev:api        # (or: pnpm dev:api)
```

---

## ✨ Studio Feature Suite

- 📌 **Sprint Planning**: Interactive drag-and-drop Kanban board for agile milestone tracking.
- 📦 **Asset Library**: Centralized studio asset repository with multi-format support (`FBX`, `OBJ`, `PNG`, `JPG`, `PSD`, `WAV`, `MP3`, `MP4`, plus bulk archives `.zip`, `.7z`, `.rar`).
- 🐛 **Bug Tracker**: Severity levels, reproducible steps, real-time status transitions, and issue assignment.
- 📁 **Project Management**: Game milestones, target platforms, budget tracking, and progress metrics.
- 👥 **Team Directory**: Studio member profiles, roles, departments, and active statuses.

---

## 📜 License

Private Studio Project — Internal Use Only.
