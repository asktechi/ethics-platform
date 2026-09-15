import { NextResponse } from "next/server";
import {
  ImageGenerationError,
  attachGeneratedImage,
  discardGeneratedImage,
  instructorOwnsSlide,
  listCurrentGeneratedForSlides,
  listPendingGeneratedForSlide,
  setImagePreference,
  setSlideStockImage,
  softDeleteCurrentImage,
} from "@/lib/ai/images";
import { IMAGE_GENERATION_COST_USD, aiImageMonthlyCapUsd, classImageSpendMonth } from "@/lib/ai/usage";
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
      .select(
        "image_status, image_preference, generated_image_id, image_prompt, stock_image_url, stock_attribution",
      )
      .eq("id", params.slideId)
      .maybeSingle();
    const current = await listCurrentGeneratedForSlides([params.slideId]);
    const row = current.get(params.slideId);
    const url = row ? await signedGeneratedUrl(row.storagePath) : null;
    const pendingRow = await listPendingGeneratedForSlide(params.slideId);
    const pending = pendingRow
      ? {
          imageId: pendingRow.id,
          url: await signedGeneratedUrl(pendingRow.storagePath),
          cost: pendingRow.cost,
          model: pendingRow.model,
        }
      : null;
    const { slidePoolHint } = await import("@/lib/themes/engine");
    const poolHint = await slidePoolHint(params.slideId);
    const monthSpend = owned.classId ? await classImageSpendMonth(owned.classId) : 0;
    return NextResponse.json({
      url,
      pending,
      status: slide?.image_status ?? "none",
      preference: slide?.image_preference === "pool" || slide?.image_preference === "ai" ? slide.image_preference : "none",
      prompt: slide?.image_prompt ?? "",
      stockUrl: slide?.stock_image_url ?? null,
      stockAttribution: slide?.stock_attribution ?? null,
      poolHint,
      monthSpend,
      monthCap: aiImageMonthlyCapUsd(),
      costEach: IMAGE_GENERATION_COST_USD,
      model: "gpt-image-1",
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Lookup failed";
    const status = message.includes("signed in") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { slideId: string } },
) {
  try {
    const { user } = await requireUser();
    const url = new URL(request.url);
    const imageId = url.searchParams.get("imageId");
    if (imageId) {
      await discardGeneratedImage({ slideId: params.slideId, userId: user.id, imageId });
      return NextResponse.json({ ok: true });
    }
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
      action?: "attach" | "discard" | "stock";
      imageId?: string;
      stock_image_url?: string | null;
      stock_attribution?: string | null;
    };
    if (body.action === "attach" && body.imageId) {
      await attachGeneratedImage({
        slideId: params.slideId,
        userId: user.id,
        imageId: body.imageId,
      });
      return NextResponse.json({ ok: true, attached: body.imageId });
    }
    if (body.action === "discard" && body.imageId) {
      await discardGeneratedImage({
        slideId: params.slideId,
        userId: user.id,
        imageId: body.imageId,
      });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "stock" || body.stock_image_url !== undefined) {
      await setSlideStockImage({
        slideId: params.slideId,
        userId: user.id,
        url: body.stock_image_url ?? null,
        attribution: body.stock_attribution,
      });
      return NextResponse.json({ ok: true, preference: body.stock_image_url ? "pool" : "none" });
    }
    if (!body.preference) return NextResponse.json({ error: "preference required" }, { status: 400 });
    await setImagePreference(params.slideId, user.id, body.preference);
    return NextResponse.json({ ok: true, preference: body.preference === "auto" ? "none" : body.preference });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Update failed";
    const status =
      message.includes("signed in") ? 401 : caught instanceof ImageGenerationError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
