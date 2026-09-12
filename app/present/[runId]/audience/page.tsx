import { AudienceView } from "@/components/presentation/AudienceView";

export const dynamic = "force-dynamic";

export default function AudiencePage({ params }: { params: { runId: string } }) {
  return <AudienceView runId={params.runId} />;
}
