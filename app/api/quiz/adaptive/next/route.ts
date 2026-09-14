import { NextResponse } from "next/server";
import { loadAdaptivePlayQuestion } from "@/lib/games/adaptive-next";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    session_id?: string;
    participant_token?: string;
  } | null;
  if (!body?.session_id || !body.participant_token) {
    return NextResponse.json({ error: "session_id and participant_token are required." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_participant_by_token", { p_token: body.participant_token });
  const participant = Array.isArray(data) ? data[0] : data;
  if (error || !participant || participant.session_id !== body.session_id) {
    return NextResponse.json({ error: "Invalid participant token." }, { status: 401 });
  }
  try {
    const question = await loadAdaptivePlayQuestion(body.session_id, participant.id);
    return NextResponse.json(question);
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "Could not pick a question." },
      { status: 400 },
    );
  }
}
