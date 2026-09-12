"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BookOpen, GraduationCap, Layers3, Library } from "lucide-react";
import type { SidebarNavData } from "@/components/shell/nav-types";
import { cn } from "@/lib/utils";

const levelIcons = [GraduationCap, Layers3, BookOpen];

type SidebarNavProps = {
  collapsed: boolean;
  nav: SidebarNavData;
  onNavigate?: () => void;
};

export function SidebarNav({ collapsed, nav, onNavigate }: SidebarNavProps) {
  return (
    <nav className="flex h-full flex-col gap-6 px-3 py-5" aria-label="Instructor navigation">
      <NavGroup title="Levels" collapsed={collapsed}>
        {nav.levels.map((item, index) => {
          const Icon = levelIcons[index] ?? BookOpen;
          return (
            <Link
              key={item.slug}
              href={`/level/${item.slug}`}
              onClick={onNavigate}
              title={collapsed ? item.name : undefined}
              className={cn(
                "group flex items-center rounded-sm px-2 py-2 text-sm text-ivory/80 transition-colors hover:bg-sidebar-accent hover:text-ivory",
                collapsed ? "justify-center" : "gap-3",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 text-gold" />
              {!collapsed ? (
                <span className="min-w-0">
                  <span className="block font-medium">{item.name}</span>
                  <span className="block text-xs text-ivory/45">{item.hint}</span>
                </span>
              ) : null}
            </Link>
          );
        })}
      </NavGroup>

      <NavGroup title="Recent Classes" collapsed={collapsed}>
        {nav.recentClasses.length === 0 ? (
          <p className={cn("px-2 text-xs text-ivory/45", collapsed && "sr-only")}>
            No classes yet.
          </p>
        ) : (
          nav.recentClasses.map((item) => (
            <Link
              key={item.id}
              href={`/class/${item.id}`}
              onClick={onNavigate}
              title={collapsed ? item.title : undefined}
              className={cn(
                "rounded-sm px-2 py-2 text-sm text-ivory/80 transition-colors hover:bg-sidebar-accent hover:text-ivory",
                collapsed && "flex justify-center",
              )}
            >
              {collapsed ? (
                <span className="h-1.5 w-1.5 rounded-full bg-gold/80" aria-hidden />
              ) : (
                <>
                  <span className="block truncate font-medium">{item.title}</span>
                  <span className="block truncate text-xs text-ivory/45">{item.meta}</span>
                </>
              )}
            </Link>
          ))
        )}
      </NavGroup>

      <div className="mt-auto">
        <NavGroup title="Bank" collapsed={collapsed}>
          <span
            title="Question Bank — Phase 5"
            className={cn(
              "flex cursor-not-allowed items-center rounded-sm px-2 py-2 text-sm text-ivory/35",
              collapsed ? "justify-center" : "gap-3",
            )}
          >
            <Library className="h-4 w-4 shrink-0" />
            {!collapsed ? <span className="font-medium">Question Bank</span> : null}
          </span>
        </NavGroup>
      </div>
    </nav>
  );
}

function NavGroup({
  title,
  collapsed,
  children,
}: {
  title: string;
  collapsed: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <p
        className={cn(
          "px-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-gold/80",
          collapsed && "sr-only",
        )}
      >
        {title}
      </p>
      <div className={cn("mt-2 flex flex-col", collapsed && "items-stretch")}>{children}</div>
    </div>
  );
}
