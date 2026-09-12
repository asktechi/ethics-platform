"use client";

import Link from "next/link";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/shell/sidebar-nav";

type TopNavProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
};

export function TopNav({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onMobileOpenChange,
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-navy/95 px-3 backdrop-blur md:px-5">
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-ivory md:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">Instructor navigation</SheetTitle>
          <div className="border-b border-sidebar-border px-4 py-4">
            <Logo href="/dashboard" />
          </div>
          <SidebarNav collapsed={false} onNavigate={() => onMobileOpenChange(false)} />
        </SheetContent>
      </Sheet>

      <Button
        variant="ghost"
        size="icon"
        className="hidden text-ivory md:inline-flex"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-5 w-5" />
        ) : (
          <PanelLeftClose className="h-5 w-5" />
        )}
      </Button>

      <Logo href="/dashboard" className="min-w-0" />

      <nav className="ml-2 hidden items-center md:flex" aria-label="Primary">
        <Link
          href="/dashboard"
          className="border-b-2 border-gold px-3 py-5 text-sm font-medium text-ivory"
        >
          My Classes
        </Link>
      </nav>

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-full outline-none ring-offset-navy focus-visible:ring-2 focus-visible:ring-gold"
              aria-label="Instructor account"
            >
              <Avatar className="h-9 w-9 border border-gold/50">
                <AvatarFallback className="bg-cfaBlue text-xs font-semibold text-ivory">
                  IN
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <span className="block text-sm">Instructor</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Auth connects in Phase 1
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/login">Sign out</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
