import { NextResponse } from "next/server";
import { requireUser } from "@/lib/data/auth";
import { loadQuestionsByIds } from "@/lib/data/games";
import { loadHostQuestions } from "@/lib/data/quiz";
import { runRehearsalTick } from "@/lib/games/rehearsal/bots";
import { createAdminClient } from "@/lib/supabase/admin";
import type { QuizSettings } from "@/lib/quiz/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const body = (await request.json()) as { sessionId?: string };
    if (!body.sessionId) {
      return NextResponse.json({ ok: false, error: "sessionId required" }, { status: 400 });
    }
    const admin = createAdminClient();
    const { data: session } = await admin
      .from("quiz_sessions")
      .select("id, host_id, mode, pool_id, settings_json")
      .eq("id", body.sessionId)
      .maybeSingle();
    if (!session || session.host_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const settings = (session.settings_json ?? {}) as QuizSettings;
    const loaded = session.pool_id
      ? await loadHostQuestions(session.pool_id)
      : await loadQuestionsByIds(settings.question_ids ?? []);
    const ordered = (settings.question_ids ?? loaded.map((item) => item.question_id))
      .map((id) => loaded.find((item) => item.question_id === id))
      .filter(Boolean)
      .map((item) => ({
        question_id: item!.question_id,
        answer_key: item!.answer_key,
        choices: item!.choices,
      }));
    const tick = await runRehearsalTick(admin, body.sessionId, {
      questions: ordered,
      mode: session.mode ?? "jeopardy",
    });
    return NextResponse.json({ ok: true, ...tick });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "tick failed" },
      { status: 500 },
    );
  }
}
