import { NextResponse } from "next/server";
import { generateAdaptiveHint } from "@/lib/ai/hint";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    session_id?: string;
    participant_token?: string;
    question_id?: string;
  } | null;
  if (!body?.session_id || !body.participant_token || !body.question_id) {
    return NextResponse.json({ error: "session_id, participant_token, and question_id are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: people, error } = await admin.rpc("get_participant_by_token", { p_token: body.participant_token });
  const participant = Array.isArray(people) ? people[0] : people;
  if (error || !participant || participant.session_id !== body.session_id) {
    return NextResponse.json({ error: "Invalid participant token." }, { status: 401 });
  }

  const { data: session } = await admin
    .from("quiz_sessions")
    .select("host_id, pool_id, mode, settings_json")
    .eq("id", body.session_id)
    .maybeSingle();
  if (!session || session.mode !== "adaptive") {
    return NextResponse.json({ error: "Not an adaptive session." }, { status: 400 });
  }
  const allowHint = (session.settings_json as { mode_config?: { allow_hint?: boolean } } | null)?.mode_config?.allow_hint !== false;
  if (!allowHint) {
    return NextResponse.json({ error: "Hints are disabled for this drill." }, { status: 400 });
  }

  const { data: applied, error: hintError } = await admin.rpc("apply_adaptive_hint", {
    p_participant_token: body.participant_token,
    p_question_id: body.question_id,
  });
  if (hintError) {
    return NextResponse.json({ error: hintError.message }, { status: 400 });
  }
  const appliedRow = Array.isArray(applied) ? applied[0] : applied;
  if (appliedRow?.already_hinted) {
    return NextResponse.json({ error: "Hint already used on this question." }, { status: 429 });
  }

  const { data: question } = await admin
    .from("questions")
    .select("stem, choices_json, class_id")
    .eq("id", body.question_id)
    .maybeSingle();
  if (!question) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  const generated = await generateAdaptiveHint({
    userId: session.host_id,
    classId: question.class_id,
    stem: question.stem,
    choices: Array.isArray(question.choices_json) ? (question.choices_json as Array<{ key: string; text: string }>) : [],
  });

  return NextResponse.json({
    hint: generated.hint,
    points_cost: appliedRow?.points_cost ?? 50,
  });
}
