import { NextResponse } from "next/server";
import { getRunByPublicId } from "@/lib/data/presentation-runs";
import { loadApprovedDeck } from "@/lib/presentation/deck";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseRunSettings } from "@/lib/themes/types";
import type { AudienceDeckResponse } from "@/lib/presentation/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: { runId: string } },
) {
  const runId = params.runId;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("get_run_by_run_id", { p_run_id: runId });
    if (error) {
      return NextResponse.json({ error: "Live sync lookup failed" }, { status: 500 });
    }

    const live = Array.isArray(data) ? data[0] : data;
    if (live) {
      const settings = parseRunSettings(live.settings_json);
      const slides = await loadApprovedDeck(live.class_id, live.run_id, {
        includeInstructorFields: false,
      });
      const payload: AudienceDeckResponse = {
        status: "live",
        publicRunId: live.run_id,
        settings: {
          teleprompter_wpm: settings.teleprompter_wpm,
          allow_audience_advance: settings.allow_audience_advance === true,
          current_slide_index: settings.current_slide_index ?? 0,
        },
        slides,
      };
      return NextResponse.json(payload);
    }

    const run = await getRunByPublicId(runId);
    if (!run) {
      return NextResponse.json({ status: "not_found" } satisfies AudienceDeckResponse, { status: 404 });
    }
    if (run.status === "ended") {
      return NextResponse.json({ status: "ended", thankYou: true } satisfies AudienceDeckResponse);
    }
    return NextResponse.json({ status: "setup" } satisfies AudienceDeckResponse);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Deck load failed";
    console.error("[present] audience deck", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
