import { formatDistanceToNow } from "date-fns";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getInstructorProfile, requireUser } from "@/lib/data/auth";
import { listRecentClasses } from "@/lib/data/classes";
import { listLevels, levelCopy } from "@/lib/data/levels";
import { countQuestionsForClasses } from "@/lib/data/questions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireUser();
  } catch {
    redirect("/login");
  }

  const [profile, levels, recent] = await Promise.all([
    getInstructorProfile(),
    listLevels(),
    listRecentClasses(5),
  ]);
  const questionCounts = await countQuestionsForClasses(recent.map((item) => item.id));

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
        recentClasses: recent.map((item) => ({
          id: item.id,
          title: item.title,
          meta: formatDistanceToNow(new Date(item.updated_at), { addSuffix: true }),
          questionCount: questionCounts[item.id] ?? 0,
        })),
      }}
    >
      {children}
    </AppShell>
  );
}
