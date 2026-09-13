import "server-only";
import { fileTypeFromBuffer } from "file-type";
import { parseQuestionsCsv } from "@/lib/parsers/questions/parseQuestionsCsv";
import { parseQuestionsDocx } from "@/lib/parsers/questions/parseQuestionsDocx";
import { parseQuestionsPdf } from "@/lib/parsers/questions/parseQuestionsPdf";
import { parseQuestionsPptx } from "@/lib/parsers/questions/parseQuestionsPptx";
import { parseQuestionBlocks } from "@/lib/parsers/questions/text";
import type { ParseQuestionsResult, QuestionHint } from "@/lib/parsers/questions/types";

function extensionOf(filename: string) {
  return filename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
}

export async function parseQuestions(
  buffer: Buffer,
  filename: string,
  hint?: QuestionHint,
): Promise<ParseQuestionsResult> {
  const sniffed = await fileTypeFromBuffer(buffer).catch(() => undefined);
  const ext = extensionOf(filename);
  const mime = sniffed?.mime ?? "";
  const mcqHint = hint?.toLowerCase().includes("4-choice") || hint === "mcq";

  let result: ParseQuestionsResult;
  if (ext === ".csv" || mime.includes("csv") || mime === "text/plain" && ext === ".csv") {
    result = parseQuestionsCsv(buffer, filename);
  } else if (ext === ".docx" || mime.includes("wordprocessingml")) {
    result = await parseQuestionsDocx(buffer, filename);
  } else if (ext === ".pdf" || mime === "application/pdf") {
    result = await parseQuestionsPdf(buffer, filename);
  } else if (ext === ".pptx" || mime.includes("presentationml")) {
    result = await parseQuestionsPptx(buffer, filename);
  } else if (ext === ".txt" || ext === ".md" || mime.startsWith("text/")) {
    result = parseQuestionBlocks(buffer.toString("utf8"));
  } else {
    return { questions: [], warnings: [`Unsupported question file: ${filename}`] };
  }

  if (mcqHint) {
    result.questions.forEach((question) => {
      if (question.choices.length !== 4) {
        result.warnings.push(
          `Hint said 4-choice MCQ but a question has ${question.choices.length} choices: "${question.stem.slice(0, 40)}…"`,
        );
      }
    });
  }
  return result;
}
