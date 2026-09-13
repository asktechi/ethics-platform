import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/data/auth";
import { commitReviewedQuestions } from "@/lib/data/questions";

export const runtime = "nodejs";

const questionSchema = z.object({
  id: z.string(),
  stem: z.string(),
  choices: z.array(z.object({ key: z.string(), text: z.string() })),
  answer_key: z.string().nullable(),
  explanation: z.string().nullable(),
  standard_hint: z.string().nullable(),
  concept_hint: z.string().nullable(),
  difficulty_hint: z.enum(["easy", "medium", "hard"]).nullable(),
  warnings: z.array(z.string()),
  source: z.object({
    file: z.string(),
    slide_or_page: z.number().nullable(),
    row: z.number().nullable(),
  }),
  raw_text: z.string(),
});

export async function POST(request: Request) {
  try {
    await requireUser();
    const body = await request.json();
    const parsed = z
      .object({
        classId: z.string().uuid(),
        questions: z.array(questionSchema).min(1),
        importBatchName: z.string().min(1),
      })
      .safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid commit payload." }, { status: 400 });
    }
    const result = await commitReviewedQuestions(parsed.data);
    revalidatePath(`/class/${parsed.data.classId}`);
    revalidatePath(`/class/${parsed.data.classId}/questions`);
    return NextResponse.json({
      ok: true,
      importedCount: result.importedCount,
      questionIds: result.questionIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Commit failed";
    const status = message.includes("signed in") ? 401 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
