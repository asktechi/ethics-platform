"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import type { SidebarNavData } from "@/components/shell/nav-types";
import { TopNav } from "@/components/shell/top-nav";

const EXPANDED = 260;
const COLLAPSED = 76;

export function AppShell({
  children,
  nav,
}: {
  children: React.ReactNode;
  nav: SidebarNavData;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-navy text-ivory">
      <TopNav
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
        nav={nav}
      />
      <div className="flex min-h-0 flex-1">
        <motion.aside
          aria-label="Sidebar"
          initial={false}
          animate={{ width: collapsed ? COLLAPSED : EXPANDED }}
          transition={{ type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="hidden shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar md:block"
        >
          <ScrollArea className="h-[calc(100vh-4rem)]">
            <SidebarNav collapsed={collapsed} nav={nav} />
          </ScrollArea>
        </motion.aside>
        <main className="min-w-0 flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
