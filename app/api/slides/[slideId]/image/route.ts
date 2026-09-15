import { NextResponse } from "next/server";
import {
  ImageGenerationError,
  instructorOwnsSlide,
  listCurrentGeneratedForSlides,
  setImagePreference,
  softDeleteCurrentImage,
} from "@/lib/ai/images";
import { requireUser } from "@/lib/data/auth";
import { signedGeneratedUrl } from "@/lib/storage/generated-images";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { slideId: string } },
) {
  try {
    const { user } = await requireUser();
    const owned = await instructorOwnsSlide(user.id, params.slideId);
    if (!owned.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const admin = createAdminClient();
    const { data: slide } = await admin
      .from("slides")
      .select("image_status, image_preference, generated_image_id, image_prompt")
      .eq("id", params.slideId)
      .maybeSingle();
    const current = await listCurrentGeneratedForSlides([params.slideId]);
    const row = current.get(params.slideId);
    const url = row ? await signedGeneratedUrl(row.storagePath) : null;
    const { slidePoolHint } = await import("@/lib/themes/engine");
    const poolHint = await slidePoolHint(params.slideId);
    return NextResponse.json({
      url,
      status: slide?.image_status ?? "none",
      preference: slide?.image_preference ?? "auto",
      prompt: slide?.image_prompt ?? "",
      poolHint,
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Lookup failed";
    const status = message.includes("signed in") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { slideId: string } },
) {
  try {
    const { user } = await requireUser();
    await softDeleteCurrentImage(params.slideId, user.id);
    await setImagePreference(params.slideId, user.id, "none");
    return NextResponse.json({ ok: true });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Delete failed";
    const status =
      message.includes("signed in") ? 401 : caught instanceof ImageGenerationError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { slideId: string } },
) {
  try {
    const { user } = await requireUser();
    const body = (await request.json().catch(() => ({}))) as {
      preference?: "auto" | "pool" | "ai" | "none";
    };
    if (!body.preference) return NextResponse.json({ error: "preference required" }, { status: 400 });
    await setImagePreference(params.slideId, user.id, body.preference);
    return NextResponse.json({ ok: true, preference: body.preference });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Update failed";
    const status = message.includes("signed in") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
