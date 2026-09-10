"use client";

import { useEffect, useState } from "react";
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
  Folder,
  CheckCheck,
  Bug as BugIcon,
  TrendingUp,
  Clock,
  Upload,
  CirclePlay,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { SettingsModal } from "@/components/settings-modal";
import { useAuth } from "@/src/context/auth-context";
import { can } from "@/src/lib/permissions";

const navItems = [
  { label: "Dashboard",          icon: LayoutDashboard, href: "/dashboard" },
  { label: "Project Management", icon: FolderKanban,    href: "/project-management" },
  { label: "Sprint",             icon: Zap,             href: "/sprint" },
  { label: "Tasks",              icon: CheckSquare,     href: "/tasks" },
  { label: "Asset Library",      icon: Library,         href: "/asset-library" },
  { label: "Bug Tracking",       icon: Bug,             href: "/bug-tracking" },
  { label: "Team",               icon: Users,           href: "/team" },
];

function Sidebar({ onLogout, onNav, onNewProject }: { onLogout: () => void; onNav: (href: string) => void; onNewProject: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside className="w-[196px] shrink-0 h-screen bg-card border-r border-border flex flex-col">
      {/* Logo */}
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

      {/* New Project Button — admin/producer only */}
      {can(user?.role, "project:create") && (
        <div className="px-3 py-3">
          <Button size="sm" className="w-full gap-1.5 text-[11px] tracking-widest uppercase font-bold" onClick={onNewProject}>
            <Plus className="w-3.5 h-3.5" />
            New Project
          </Button>
        </div>
      )}

      {/* Nav */}
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

      {/* Bottom */}
      <div className="px-2 py-3 flex flex-col gap-0.5">
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2.5 text-[12px]" onClick={onLogout}>
          <LogOut className="w-4 h-4 shrink-0" />
          Log Out
        </Button>
      </div>
    </aside>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  subIcon,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  subIcon: React.ReactNode;
  icon: React.ElementType;
}) {
  return (
    <Card className="flex-1 rounded-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">{label}</span>
          <Icon className="w-4 h-4 text-muted-foreground/40" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-4xl font-black">{value}</p>
        <div className="flex items-center gap-1 text-muted-foreground">
          {subIcon}
          <span className="text-[11px]">{sub}</span>
        </div>
      </CardContent>
    </Card>
  );
}

const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001";

type DashboardProject = {
  id: string;
  name: string;
  status: string | null;
  createdAt?: string | null;
};

type DashboardTask = {
  id: string;
  title: string;
  status: string;
  deadline?: string | null;
  assignee?: string | null;
  createdAt?: string | null;
};

type DashboardSprint = {
  id: string;
  label: string;
  status?: string | null;
  createdAt?: string | null;
};

type DashboardBug = {
  id: string;
  title: string;
  severity: string;
  status: string;
  project?: string | null;
  createdAt?: string | null;
};

type DashboardAsset = {
  id: string;
  name: string;
  category: string;
  status: string;
  createdAt?: string | null;
};

function timeAgo(value?: string | null): string {
  if (!value) return "Recently";
  let date = new Date(value);
  if (isNaN(date.getTime())) return "Recently";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < -60000) {
    const tzOffsetMs = new Date().getTimezoneOffset() * 60000;
    date = new Date(date.getTime() + tzOffsetMs);
  }
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getStatusProgress(status?: string | null) {
  switch (status) {
    case "Pre-production": return 15;
    case "Alpha":          return 35;
    case "Beta":           return 60;
    case "Live":           return 100;
    case "Cancelled":      return 0;
    default:               return 0;
  }
}

function getStatusColor(status?: string | null) {
  switch (status) {
    case "Pre-production": return "bg-zinc-400";
    case "Alpha":          return "bg-amber-400";
    case "Beta":           return "bg-blue-500";
    case "Live":           return "bg-green-500";
    case "Cancelled":      return "bg-red-500";
    default:               return "bg-muted-foreground";
  }
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const { clearUser } = useAuth();
  const [modalOpen,          setModalOpen]          = useState(false);
  const [settingsOpen,       setSettingsOpen]       = useState(false);
  const [loading,            setLoading]            = useState(true);

  const [projectTotal,       setProjectTotal]       = useState(0);
  const [taskTotal,          setTaskTotal]          = useState(0);
  const [taskCompletedCount, setTaskCompletedCount] = useState(0);
  const [sprintActiveCount,  setSprintActiveCount]  = useState(0);
  const [openBugsCount,      setOpenBugsCount]      = useState(0);
  const [highBugsCount,      setHighBugsCount]      = useState(0);
  const [assetTotal,         setAssetTotal]         = useState(0);

  const [activities, setActivities] = useState<Array<{
    icon: React.ElementType;
    event: string;
    project: string;
    time: string;
    status: string;
    variant: "secondary" | "outline";
  }>>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<Array<{ name: string; count: number; color: string }>>([]);
  const [milestonePercent, setMilestonePercent] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      try {
        const [projectsRes, tasksRes, sprintsRes, bugsRes, assetsRes] = await Promise.all([
          fetch(`${API}/projects?page=1&pageSize=100`, { credentials: "include" }),
          fetch(`${API}/tasks?page=1&pageSize=500`, { credentials: "include" }),
          fetch(`${API}/sprints?page=1&pageSize=100`, { credentials: "include" }),
          fetch(`${API}/bugs?page=1&pageSize=100`, { credentials: "include" }),
          fetch(`${API}/assets?page=1&pageSize=100`, { credentials: "include" }),
        ]);

        const projectsJson = projectsRes.ok ? await projectsRes.json() : { data: [] };
        const tasksJson    = tasksRes.ok    ? await tasksRes.json()    : { data: [] };
        const sprintsJson  = sprintsRes.ok  ? await sprintsRes.json()  : { data: [] };
        const bugsJson     = bugsRes.ok     ? await bugsRes.json()     : { data: [] };
        const assetsJson   = assetsRes.ok   ? await assetsRes.json()   : { data: [] };

        if (cancelled) return;

        const projects: DashboardProject[] = Array.isArray(projectsJson.data) ? projectsJson.data : [];
        const tasks:    DashboardTask[]    = Array.isArray(tasksJson.data)    ? tasksJson.data    : [];
        const sprints:  DashboardSprint[]  = Array.isArray(sprintsJson.data)  ? sprintsJson.data  : [];
        const bugs:     DashboardBug[]     = Array.isArray(bugsJson.data)     ? bugsJson.data     : [];
        const assets:   DashboardAsset[]   = Array.isArray(assetsJson.data)   ? assetsJson.data   : [];

        // Project Status Breakdown
        const statusNames = ["Pre-production", "Alpha", "Beta", "Live", "Cancelled"];
        const statusCounts = statusNames.map((name) => ({
          name,
          count: projects.filter((project) => project.status === name).length,
          color: getStatusColor(name),
        }));

        // Tasks & Bugs
        const completedTasks = tasks.filter((t) => t.status === "done").length;
        const openBugs = bugs.filter((b) => b.status === "Open");
        const criticalBugs = bugs.filter((b) => b.severity === "Critical" || b.severity === "High");

        // Active Sprints
        const activeSprints = sprints.filter((s) => s.status === "active");

        // Milestone % (Completed tasks % or Project Progress)
        const taskPercent = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
        const avgProjProgress = projects.length > 0
          ? Math.round(projects.reduce((sum, p) => sum + getStatusProgress(p.status), 0) / projects.length)
          : 0;
        const overallMilestone = tasks.length > 0 ? taskPercent : avgProjProgress;

        // Real-time Recent Activity Stream (combined & chronologically sorted)
        const recentList: Array<{
          timestamp: number;
          icon: React.ElementType;
          event: string;
          project: string;
          time: string;
          status: string;
          variant: "secondary" | "outline";
        }> = [];

        projects.slice(0, 3).forEach((p) => {
          recentList.push({
            timestamp: p.createdAt ? new Date(p.createdAt).getTime() : Date.now() - 100000,
            icon: Folder,
            event: `Project: ${p.name}`,
            project: p.name,
            time: timeAgo(p.createdAt),
            status: p.status ?? "Planned",
            variant: "secondary",
          });
        });

        tasks.slice(0, 4).forEach((t) => {
          recentList.push({
            timestamp: t.createdAt ? new Date(t.createdAt).getTime() : Date.now() - 200000,
            icon: CheckCheck,
            event: `Task: ${t.title}`,
            project: t.assignee ?? "Unassigned",
            time: timeAgo(t.createdAt),
            status: t.status,
            variant: "outline",
          });
        });

        bugs.slice(0, 3).forEach((b) => {
          recentList.push({
            timestamp: b.createdAt ? new Date(b.createdAt).getTime() : Date.now() - 300000,
            icon: BugIcon,
            event: `Bug: ${b.title}`,
            project: b.project ?? "General",
            time: timeAgo(b.createdAt),
            status: b.status,
            variant: "secondary",
          });
        });

        assets.slice(0, 3).forEach((a) => {
          recentList.push({
            timestamp: a.createdAt ? new Date(a.createdAt).getTime() : Date.now() - 400000,
            icon: Library,
            event: `Asset: ${a.name}`,
            project: a.category,
            time: timeAgo(a.createdAt),
            status: a.status,
            variant: "outline",
          });
        });

        recentList.sort((a, b) => b.timestamp - a.timestamp);

        setProjectTotal(projects.length);
        setTaskTotal(tasks.length);
        setTaskCompletedCount(completedTasks);
        setSprintActiveCount(activeSprints.length || sprints.length);
        setOpenBugsCount(openBugs.length);
        setHighBugsCount(criticalBugs.length);
        setAssetTotal(assets.length);

        setStatusBreakdown(statusCounts.filter((item) => item.count > 0));
        setMilestonePercent(overallMilestone);
        setActivities(recentList.slice(0, 5));
      } catch {
        if (!cancelled) {
          setProjectTotal(0);
          setTaskTotal(0);
          setSprintActiveCount(0);
          setOpenBugsCount(0);
          setAssetTotal(0);
          setStatusBreakdown([]);
          setMilestonePercent(0);
          setActivities([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOverview();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    await fetch(`${API}/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    clearUser();
    router.push("/login");
  }

  function handleNav(href: string) {
    if (href !== "#") router.push(href);
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onLogout={handleLogout} onNav={handleNav} onNewProject={() => setModalOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 shrink-0 bg-card border-b border-border flex items-center px-6 gap-4">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search project..."
              className="pl-8 h-8 text-[12px] rounded-sm"
            />
          </div>

          <div className="flex-1" />

          <Button variant="ghost" size="icon" className="w-8 h-8">
            <Bell className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setSettingsOpen(true)} aria-label="Settings">
            <Settings className="w-4 h-4" />
          </Button>
          <Avatar size="default">
            <AvatarImage src="/logo.jpg" alt="User avatar" />
            <AvatarFallback className="text-xs font-bold">KS</AvatarFallback>
          </Avatar>
        </header>

        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black">Studio Overview</h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Live metrics across projects, sprint flow, and production workload.
              </p>
            </div>
            <span className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase mt-1">
              {loading ? "Loading data" : "Last Updated: Just Now"}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <StatCard
              label="Total Projects"
              value={loading ? "—" : projectTotal}
              sub={projectTotal > 0 ? `${projectTotal} active pipeline` : "No projects"}
              subIcon={<TrendingUp className="w-3 h-3 text-emerald-500" />}
              icon={Folder}
            />
            <StatCard
              label="Total Tasks"
              value={loading ? "—" : taskTotal}
              sub={taskTotal > 0 ? `${taskCompletedCount}/${taskTotal} completed` : "No tasks"}
              subIcon={<CheckCheck className="w-3 h-3 text-blue-500" />}
              icon={CheckCheck}
            />
            <StatCard
              label="Active Sprints"
              value={loading ? "—" : sprintActiveCount}
              sub={sprintActiveCount > 0 ? `${sprintActiveCount} sprint cycles` : "No active sprints"}
              subIcon={<Zap className="w-3 h-3 text-amber-500" />}
              icon={Zap}
            />
            <StatCard
              label="Open Bugs"
              value={loading ? "—" : openBugsCount}
              sub={highBugsCount > 0 ? `${highBugsCount} critical/high` : "0 high priority"}
              subIcon={<AlertTriangle className="w-3 h-3 text-red-500" />}
              icon={BugIcon}
            />
            <StatCard
              label="Asset Library"
              value={loading ? "—" : assetTotal}
              sub={assetTotal > 0 ? `${assetTotal} stored assets` : "No assets"}
              subIcon={<Library className="w-3 h-3 text-purple-500" />}
              icon={Library}
            />
          </div>

          <div className="flex gap-4">
            <Card className="flex-[2] rounded-sm">
              <CardHeader className="border-b border-border py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[13px] font-bold">Recent Activity</CardTitle>
                  <Button variant="ghost" size="sm" className="text-[11px] h-7 px-2 text-muted-foreground">
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-[2fr_1.2fr_0.8fr_0.8fr] px-5 py-2 border-b border-border">
                  {["Event", "Project", "Time", "Status"].map((h) => (
                    <span key={h} className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      {h}
                    </span>
                  ))}
                </div>

                {activities.length === 0 ? (
                  <div className="px-5 py-6 text-[12px] text-muted-foreground">
                    No activity available yet.
                  </div>
                ) : (
                  activities.map(({ icon: Icon, event, project, time, status, variant }, i) => (
                    <div
                      key={`${event}-${i}`}
                      className="grid grid-cols-[2fr_1.2fr_0.8fr_0.8fr] px-5 py-3.5 border-b border-border last:border-0 items-center"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-sm bg-muted flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <span className="text-[12px] font-medium">{event}</span>
                      </div>
                      <span className="text-[12px] text-muted-foreground">{project}</span>
                      <span className="text-[12px] text-muted-foreground">{time}</span>
                      <Badge variant={variant} className="text-[11px] w-fit">
                        {status}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <div className="flex-1 flex flex-col gap-4">
              <Card className="rounded-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13px] font-bold">Milestone Progress</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold">Project health</span>
                    <span className="text-[12px] font-black">{milestonePercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-foreground rounded-full" style={{ width: `${milestonePercent}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {projectTotal > 0 ? `${projectTotal} projects in the current pipeline` : "Awaiting project data"}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13px] font-bold">Project Status</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {statusBreakdown.length === 0 ? (
                    <div className="text-[12px] text-muted-foreground">No project status data.</div>
                  ) : (
                    statusBreakdown.map(({ name, count, color }) => (
                      <div key={name} className="flex items-center justify-between">
                        <span className="text-[12px] text-muted-foreground">{name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${color}`} />
                          <span className="text-[11px] font-semibold text-muted-foreground">{count}</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      <CreateProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
