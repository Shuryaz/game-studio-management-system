"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, Zap, CheckSquare, Library,
  Bug, Users, LogOut, Plus
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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

export function Sidebar({ 
  onLogout, 
  onNav, 
  onNewProject, 
  openCount 
}: { 
  onLogout: () => void; 
  onNav: (href: string) => void; 
  onNewProject: () => void;
  openCount?: number; 
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  
  // If openCount is provided as a prop, we use it directly (like in BugTrackingPage).
  // Otherwise we fetch it independently.
  const [fetchedCount, setFetchedCount] = useState<number>(0);
  
  useEffect(() => {
    if (openCount !== undefined) return; // parent manages it
    
    const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001";
    fetch(`${API}/bugs/count`, { credentials: "include" })
      .then(res => res.json())
      .then(json => {
        if (json.success) setFetchedCount(json.data.open);
      })
      .catch(() => {});
  }, [openCount]);

  const displayCount = openCount !== undefined ? openCount : fetchedCount;

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
            <Plus className="w-3.5 h-3.5" />
            New Project
          </Button>
        </div>
      )}
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
              {label === "Bug Tracking" && displayCount > 0 && (
                <Badge variant="default" className="text-[10px] h-4 min-w-4 px-1 flex items-center justify-center rounded-full">
                  {displayCount}
                </Badge>
              )}
            </Button>
          );
        })}
      </nav>
      <Separator />
      <div className="px-2 py-3 flex flex-col gap-0.5">
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2.5 text-[12px]" onClick={onLogout}>
          <LogOut className="w-4 h-4 shrink-0" />
          Log Out
        </Button>
      </div>
    </aside>
  );
}
