import { formatDistanceToNow } from "date-fns";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getInstructorProfile } from "@/lib/data/auth";
import { getClass, listRecentClasses } from "@/lib/data/classes";
import { listLevels, levelCopy } from "@/lib/data/levels";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profile, levels, recent] = await Promise.all([
    getInstructorProfile(),
    listLevels(),
    listRecentClasses(5),
  ]);

  return (
    <AppShell
      nav={{
        instructorName: profile.name,
        instructorInitials: profile.initials,
        levels: levels.map((level) => ({
          slug: level.slug,
          name: level.name,
          hint: levelCopy[level.slug]?.split("—")[0]?.trim() ?? "Ethics",
        })),
        recentClasses: await Promise.all(
          recent.map(async (item) => ({
            id: item.id,
            title: item.title,
            meta: formatDistanceToNow(new Date(item.updated_at), { addSuffix: true }),
            questionCount: (await getClass(item.id).catch(() => ({ questionCount: 0 }))).questionCount,
          })),
        ),
      }}
    >
      {children}
    </AppShell>
  );
}
