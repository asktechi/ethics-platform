import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PUBLIC_TABLES = [
  "users",
  "levels",
  "classes",
  "sections",
  "concepts",
  "standards",
  "concept_standards",
  "materials",
  "slides",
  "themes",
  "image_pools",
  "image_pool_items",
  "theme_assignments",
  "questions",
  "question_pools",
  "question_pool_items",
  "quiz_sessions",
  "quiz_participants",
  "quiz_responses",
] as const;

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("health_public_table_count");

    if (!error && typeof data === "number") {
      return NextResponse.json({ ok: true, tables: data });
    }

    let tables = 0;
    for (const name of PUBLIC_TABLES) {
      const result = await admin.from(name).select("*", { count: "exact", head: true });
      if (!result.error) tables += 1;
    }

    if (tables === 0) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? "no public tables reachable" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, tables });
  } catch (caught) {
    return NextResponse.json(
      {
        ok: false,
        error: caught instanceof Error ? caught.message : "db health failed",
      },
      { status: 500 },
    );
  }
}
