import { AppShell } from "@/components/shell/app-shell";

/**
 * Auth-gated instructor shell.
 * Phase 0: visual shell only. Magic-link session checks land in Phase 1.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
