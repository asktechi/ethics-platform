import { NextResponse } from "next/server";
import { requireUser } from "@/lib/data/auth";
import { importFile } from "@/lib/importers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireUser();
    const form = await request.formData();
    const files = form.getAll("files").filter((item): item is File => item instanceof File);
    const single = form.get("file");
    if (single instanceof File) files.push(single);
    if (files.length === 0) {
      return NextResponse.json({ ok: false, error: "Drop at least one file." }, { status: 400 });
    }

    const results = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      results.push(await importFile(buffer, file.name));
    }
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Parse failed";
    const status = message.includes("signed in") ? 401 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
