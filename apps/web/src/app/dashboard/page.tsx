"use client";

import { useState } from "react";
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

const navItems = [
  { label: "Dashboard",          icon: LayoutDashboard, href: "/dashboard" },
  { label: "Project Management", icon: FolderKanban,    href: "/project-management" },
  { label: "Sprint",             icon: Zap,             href: "/sprint" },
  { label: "Tasks",              icon: CheckSquare,     href: "/tasks" },
  { label: "Asset Library",      icon: Library,         href: "#" },
  { label: "Bug Tracking",       icon: Bug,             href: "#", badge: 5 },
  { label: "Team",               icon: Users,           href: "#" },
];

function Sidebar({ onLogout, onNav, onNewProject }: { onLogout: () => void; onNav: (href: string) => void; onNewProject: () => void }) {
  const pathname = usePathname();

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

      {/* New Project Button */}
      <div className="px-3 py-3">
        <Button size="sm" className="w-full gap-1.5 text-[11px] tracking-widest uppercase font-bold" onClick={onNewProject}>
          <Plus className="w-3.5 h-3.5" />
          New Project
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-1 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map(({ label, icon: Icon, badge, href }) => {
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
              {badge && (
                <Badge variant="default" className="text-[10px] h-4 w-4 p-0 flex items-center justify-center rounded-full">
                  {badge}
                </Badge>
              )}
            </Button>
          );
        })}
      </nav>

      <Separator />

      {/* Bottom */}
      <div className="px-2 py-3 flex flex-col gap-0.5">
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2.5 text-[12px]">
          <Activity className="w-4 h-4 shrink-0" />
          System Status
        </Button>
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

// ── Recent Activity data ───────────────────────────────────────────────────────
const activities = [
  {
    icon: Upload,
    event: "New character asset uploaded",
    project: "Project Nexus",
    time: "10m ago",
    status: "Complete",
    variant: "secondary" as const,
  },
  {
    icon: CirclePlay,
    event: "Sprint 4 completed",
    project: "Void Meteor",
    time: "2h ago",
    status: "Complete",
    variant: "secondary" as const,
  },
  {
    icon: ShieldCheck,
    event: "Bug #402 resolved",
    project: "Engine Core",
    time: "5h ago",
    status: "Resolved",
    variant: "outline" as const,
  },
];

// ── Build Servers data ─────────────────────────────────────────────────────────
const servers = [
  { name: "Render Node Alpha", status: "Online", color: "bg-green-500" },
  { name: "Asset Pipeline", status: "Online", color: "bg-green-500" },
  { name: "QA DB Replica", status: "Syncing", color: "bg-yellow-400" },
];

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  async function handleLogout() {
    // Call the logout endpoint so the server clears the httpOnly cookie
    await fetch("http://localhost:3001/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {}); // ignore network errors — redirect regardless
    router.push("/login");
  }

  function handleNav(href: string) {
    if (href !== "#") router.push(href);
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onLogout={handleLogout} onNav={handleNav} onNewProject={() => setModalOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
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
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <Settings className="w-4 h-4" />
          </Button>
          <Avatar size="default">
            <AvatarImage src="/logo.jpg" alt="User avatar" />
            <AvatarFallback className="text-xs font-bold">KS</AvatarFallback>
          </Avatar>
        </header>

        {/* Body */}
        <main className="flex-1 overflow-y-auto px-8 py-6">
          {/* Page header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black">Studio Overview</h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Real-time metrics and recent activities across all production pipelines.
              </p>
            </div>
            <span className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase mt-1">
              Last Updated: Just Now
            </span>
          </div>

          {/* Stat cards */}
          <div className="flex gap-4 mb-6">
            <StatCard
              label="Total Projects"
              value={12}
              sub="+2 this month"
              subIcon={<TrendingUp className="w-3 h-3" />}
              icon={Folder}
            />
            <StatCard
              label="Total Tasks"
              value={148}
              sub="32 due this week"
              subIcon={<Clock className="w-3 h-3" />}
              icon={CheckCheck}
            />
            <StatCard
              label="Open Bugs"
              value={24}
              sub="5 critical severity"
              subIcon={<AlertTriangle className="w-3 h-3" />}
              icon={BugIcon}
            />
          </div>

          {/* Bottom section */}
          <div className="flex gap-4">
            {/* Recent Activity */}
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
                {/* Table header */}
                <div className="grid grid-cols-[2fr_1.2fr_0.8fr_0.8fr] px-5 py-2 border-b border-border">
                  {["Event", "Project", "Time", "Status"].map((h) => (
                    <span key={h} className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      {h}
                    </span>
                  ))}
                </div>
                {/* Rows */}
                {activities.map(({ icon: Icon, event, project, time, status, variant }, i) => (
                  <div
                    key={i}
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
                ))}
              </CardContent>
            </Card>

            {/* Right column */}
            <div className="flex-1 flex flex-col gap-4">
              {/* Milestone Progress */}
              <Card className="rounded-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13px] font-bold">Milestone Progress</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold">Alpha Release</span>
                    <span className="text-[12px] font-black">75%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-foreground rounded-full" style={{ width: "75%" }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Expected delivery: Oct 15</p>
                </CardContent>
              </Card>

              {/* Build Servers */}
              <Card className="rounded-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13px] font-bold">Build Servers</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {servers.map(({ name, status, color }) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-[12px] text-muted-foreground">{name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${color}`} />
                        <span className="text-[11px] font-semibold text-muted-foreground">{status}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      <CreateProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
