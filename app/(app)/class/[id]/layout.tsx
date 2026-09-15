import Link from "next/link";
import { countQuestions } from "@/lib/data/questions";
import { cn } from "@/lib/utils";

export default async function ClassLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const questionCount = await countQuestions(params.id).catch(() => 0);

  const links = [
    { href: `/class/${params.id}`, label: "Overview" },
    { href: `/class/${params.id}/questions`, label: "Questions" },
    ...(questionCount > 0 ? [{ href: `/class/${params.id}/cases`, label: "Cases" }] : []),
    { href: `/class/${params.id}/materials`, label: "Materials" },
  ];

  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-2 text-sm" aria-label="Class">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn("border border-white/10 px-3 py-1.5 text-ivory/70 hover:border-gold hover:text-gold")}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
