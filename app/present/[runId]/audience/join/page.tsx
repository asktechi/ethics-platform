import { AudienceJoin } from "@/components/presentation/AudienceJoin";

export default function AudienceJoinPage({ params }: { params: { runId: string } }) {
  return <AudienceJoin runId={params.runId} />;
}
