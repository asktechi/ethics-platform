import { NextResponse } from "next/server";
import { generateSlideImage, ImageGenerationError } from "@/lib/ai/images";
import { requireUser } from "@/lib/data/auth";
import { getRunByPublicId } from "@/lib/data/presentation-runs";
import { createAdminClient } from "@/lib/supabase/admin";
import { listClassSlides } from "@/lib/themes/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: { runId: string } },
) {
  try {
    const { user } = await requireUser();
    const body = (await request.json().catch(() => ({}))) as {
      limit?: number;
      mock?: boolean;
    };
    const limit = Math.min(3, Math.max(1, Number(body.limit ?? 3) || 3));
    const run = await getRunByPublicId(params.runId);
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    const admin = createAdminClient();
    const { data: klass } = await admin
      .from("classes")
      .select("id, created_by")
      .eq("id", run.class_id)
      .maybeSingle();
    if (!klass || klass.created_by !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const slides = (await listClassSlides(run.class_id)).filter((slide) => slide.status === "approved");
    const { data: assignments } = await admin
      .from("theme_assignments")
      .select("slide_id, image_url")
      .eq("run_id", run.run_id)
      .is("deleted_at", null);

    const curated = new Set(
      (assignments ?? [])
        .filter((row) => row.slide_id && row.image_url)
        .map((row) => row.slide_id as string),
    );

    const missing = slides.filter((slide) => {
      if (slide.image_preference === "none" || slide.image_preference === "pool") return false;
      if (slide.image_status === "ready" && slide.generated_image_id) return false;
      if (curated.has(slide.id) && slide.image_preference !== "ai") return false;
      return true;
    });

    const totalNeed = missing.length;
    const batch = missing.slice(0, 1);
    const generated: string[] = [];
    const results: Array<{ slideId: string; imageId: string; url: string }> = [];
    const errors: string[] = [];
    for (const slide of batch) {
      try {
        const result = await generateSlideImage({
          slideId: slide.id,
          userId: user.id,
          mock: body.mock,
        });
        generated.push(slide.id);
        results.push({ slideId: slide.id, imageId: result.imageId, url: result.url });
      } catch (caught) {
        errors.push(caught instanceof Error ? caught.message : "failed");
      }
    }

    const remaining = Math.max(0, totalNeed - generated.length);
    return NextResponse.json({
      total: slides.length,
      need: totalNeed,
      ready: Math.max(0, slides.filter((s) => s.image_status === "ready").length + generated.length),
      remaining,
      generated,
      results,
      errors,
      done: remaining === 0,
      limit,
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Preload failed";
    const status = message.includes("signed in") ? 401 : caught instanceof ImageGenerationError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
