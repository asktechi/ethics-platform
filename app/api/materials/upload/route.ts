import { NextResponse } from "next/server";
import {
  createMaterialFromUpload,
  instructorOwnsClass,
} from "@/lib/data/materials";
import { UnsupportedFormatError } from "@/lib/parsers/types";
import { requireUser } from "@/lib/data/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    const classId = String(form.get("class_id") ?? "");
    const conceptId = String(form.get("concept_id") ?? "") || null;
    const forceVersion = String(form.get("force_version") ?? "") === "true";

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "File is required." }, { status: 400 });
    }
    if (!classId) {
      return NextResponse.json({ ok: false, error: "class_id is required." }, { status: 400 });
    }

    const owns = await instructorOwnsClass(classId);
    if (!owns) {
      return NextResponse.json({ ok: false, error: "You do not own this class." }, { status: 403 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await createMaterialFromUpload({
      classId,
      conceptId,
      filename: file.name,
      bytes,
      mime: file.type,
      forceVersion,
      uploadedBy: user.id,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof UnsupportedFormatError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 415 });
    }
    const message = error instanceof Error ? error.message : "Upload failed.";
    if (message === "You must be signed in.") {
      return NextResponse.json({ ok: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
