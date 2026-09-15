import { NextResponse } from "next/server";
import { generateSlideImage, ImageGenerationError } from "@/lib/ai/images";
import { requireUser } from "@/lib/data/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: { slideId: string } },
) {
  try {
    const { user } = await requireUser();
    const body = (await request.json().catch(() => ({}))) as {
      prompt?: string;
      style?: string;
      mock?: boolean;
    };
    const result = await generateSlideImage({
      slideId: params.slideId,
      userId: user.id,
      prompt: body.prompt,
      style: body.style,
      mock: body.mock,
      regenerate: true,
    });
    return NextResponse.json(result);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Regenerate failed";
    const status =
      message.includes("signed in") ? 401 : caught instanceof ImageGenerationError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
