import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ImportReview } from "@/components/questions/ImportReview";
import { getClass } from "@/lib/data/classes";

export default async function QuestionImportPage({ params }: { params: { id: string } }) {
  let detail;
  try {
    detail = await getClass(params.id);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: `/level/${detail.level.slug}`, label: detail.level.name },
          { href: `/class/${detail.id}`, label: detail.title },
          { href: `/class/${detail.id}/questions`, label: "Questions" },
          { label: "Import" },
        ]}
        title="Import questions"
        description="Parse any common file, review every row, then confirm. Nothing is written until you confirm."
      />
      <p className="mt-4 text-sm text-ivory/50">
        <Link href={`/class/${detail.id}/questions`} className="underline">
          Back to question bank
        </Link>
      </p>
      <div className="mt-8">
        <ImportReview classId={detail.id} />
      </div>
    </div>
  );
}
