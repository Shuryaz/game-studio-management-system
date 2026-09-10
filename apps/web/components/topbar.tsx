"use client";

import { useState } from "react";
import { Search, Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SettingsModal } from "@/components/settings-modal";

interface TopbarProps {
  /** Controlled search value — pass undefined to hide the search box */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
}

export function Topbar({ searchValue, onSearchChange, searchPlaceholder = "Search..." }: TopbarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <header className="h-14 shrink-0 bg-card border-b border-border flex items-center px-6 gap-4">
        {/* Search — only rendered when caller passes searchValue */}
        {searchValue !== undefined && (
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={searchPlaceholder}
              className="pl-8 h-8 text-[12px] rounded-sm"
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
            />
          </div>
        )}

        <div className="flex-1" />

        <Button variant="ghost" size="icon" className="w-8 h-8" aria-label="Notifications">
          <Bell className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="w-4 h-4" />
        </Button>

        <Avatar size="default">
          <AvatarImage src="/logo.jpg" alt="User avatar" />
          <AvatarFallback className="text-xs font-bold">KS</AvatarFallback>
        </Avatar>
      </header>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
