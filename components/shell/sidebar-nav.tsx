"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { levels, questionBank, recentClasses } from "@/components/shell/nav-config";
import { cn } from "@/lib/utils";

type SidebarNavProps = {
  collapsed: boolean;
  onNavigate?: () => void;
};

export function SidebarNav({ collapsed, onNavigate }: SidebarNavProps) {
  return (
    <nav className="flex flex-col gap-6 px-3 py-5" aria-label="Instructor navigation">
      <NavGroup title="Levels" collapsed={collapsed}>
        {levels.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center rounded-sm px-2 py-2 text-sm text-ivory/80 transition-colors hover:bg-sidebar-accent hover:text-ivory",
                collapsed ? "justify-center" : "gap-3",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 text-gold" />
              {!collapsed ? (
                <span className="min-w-0">
                  <span className="block font-medium">{item.label}</span>
                  <span className="block text-xs text-ivory/45">{item.hint}</span>
                </span>
              ) : null}
            </Link>
          );
        })}
      </NavGroup>

      <NavGroup title="Recent Classes" collapsed={collapsed}>
        {recentClasses.length === 0 ? (
          <p className={cn("px-2 text-xs text-ivory/45", collapsed && "sr-only")}>
            No classes yet. They will appear here after Phase 2.
          </p>
        ) : (
          recentClasses.map((item) => (
            <Link
              key={item.title}
              href={item.href}
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

      <NavGroup title="Bank" collapsed={collapsed}>
        <Link
          href={questionBank.href}
          onClick={onNavigate}
          title={collapsed ? questionBank.label : undefined}
          className={cn(
            "flex items-center rounded-sm px-2 py-2 text-sm text-ivory/80 transition-colors hover:bg-sidebar-accent hover:text-ivory",
            collapsed ? "justify-center" : "gap-3",
          )}
        >
          <questionBank.icon className="h-4 w-4 shrink-0 text-gold" />
          {!collapsed ? <span className="font-medium">{questionBank.label}</span> : null}
        </Link>
      </NavGroup>
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
