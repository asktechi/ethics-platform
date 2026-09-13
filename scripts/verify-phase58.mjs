import { readFileSync } from "node:fs";
import { join } from "node:path";
import { alignToGrammar, isDecorativeLine, tokenize } from "@/lib/importers/grammar.ts";
import { importFile } from "@/lib/importers/index.ts";

const results = [];
function pass(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${step}${detail ? ` — ${detail}` : ""}`);
}

const fixtures = join(process.cwd(), "fixtures", "samples", "grammar");

async function parseNamed(name) {
  const buffer = readFileSync(join(fixtures, name));
  return importFile(buffer, name);
}

function decorativeInStems(questions) {
  return questions.some((question) =>
    /===\s*(START|END)|^=+$|^-+$|Page \d+|Table of Contents|Answer Key/i.test(question.stem),
  );
}

const decorativeSamples = ["===START===", "===END===", "=====", "---", "----", "***", "___", "=======", "Page 1", "12"];
pass(
  "decorative classifier",
  decorativeSamples.every((line) => isDecorativeLine(line)),
  decorativeSamples.map((line) => `${line}=>${isDecorativeLine(line)}`).join(", "),
);

const decorativeTokens = tokenize(
  ["Ethics title", "===START===", "=====", "---", "Q1. Stem long enough to keep.", "A) One", "B) Two", "Answer: A", "===END==="].join("\n"),
);
const decorativeTypes = decorativeTokens.filter((token) =>
  ["===START===", "=====", "---", "===END==="].includes(token.raw.trim()),
);
pass(
  "tokenize marks separators decorative",
  decorativeTypes.length === 4 && decorativeTypes.every((token) => token.type === "decorative"),
  decorativeTypes.map((token) => `${token.raw.trim()}:${token.type}`).join(" "),
);

const cases = [
  { file: "good-docx.docx", expected: 5, choices: 3, warn: false },
  { file: "decorated-docx.docx", expected: 5, choices: 3, warn: false },
  { file: "mixed-case.docx", expected: 4, choices: 3, warn: false },
  { file: "missing-metadata.docx", expected: 2, choices: 3, warn: true },
  { file: "4-choices.docx", expected: 2, choices: 4, warn: false },
  { file: "two-choices.docx", expected: 2, choices: 2, warn: false },
];

const table = [];
for (const item of cases) {
  const parsed = await parseNamed(item.file);
  const warningTotal = parsed.questions.reduce((sum, row) => sum + row.warnings.length, 0);
  const stemsClean = !decorativeInStems(parsed.questions);
  const choiceOk = parsed.questions.every((row) => row.choices.length === item.choices);
  const answersOk = parsed.questions.every((row) => row.answer_key);
  const warnOk = item.warn
    ? parsed.questions.every((row) => row.warnings.some((warning) => /explanation/i.test(warning)))
    : warningTotal === 0 || parsed.questions.every((row) => row.warnings.every((warning) => !/decorative|START|END/i.test(warning)));
  const ok =
    parsed.questions.length === item.expected &&
    stemsClean &&
    choiceOk &&
    answersOk &&
    (item.warn ? warnOk : parsed.questions.every((row) => row.stem.length > 10));
  table.push({
    file: item.file,
    expected: item.expected,
    actual: parsed.questions.length,
    warnings: warningTotal,
    pattern: parsed.detectedPattern,
  });
  pass(
    item.file,
    ok && stemsClean && choiceOk,
    `expected=${item.expected} actual=${parsed.questions.length} warnings=${warningTotal} choices=${parsed.questions.map((row) => row.choices.length).join("/")} keys=${parsed.questions.map((row) => row.answer_key).join("")} pattern=${parsed.detectedPattern} decorativeStem=${!stemsClean}`,
  );
}

const good = await parseNamed("good-docx.docx");
const decorated = await parseNamed("decorated-docx.docx");
pass(
  "decorated matches good stems",
  good.questions.length === 5 &&
    decorated.questions.length === 5 &&
    good.questions.every((row, index) => row.stem === decorated.questions[index].stem && row.answer_key === decorated.questions[index].answer_key),
  "same 5 stems and keys",
);

const four = await parseNamed("4-choices.docx");
pass(
  "4 choices preserved",
  four.questions.every((row) => row.choices.map((choice) => choice.key).join("") === "ABCD"),
  four.questions.map((row) => row.choices.map((choice) => choice.key).join("")).join(","),
);

const two = await parseNamed("two-choices.docx");
pass(
  "2 choices preserved",
  two.questions.every((row) => row.choices.length === 2),
  two.questions.map((row) => row.choices.length).join(","),
);

const missing = await parseNamed("missing-metadata.docx");
pass(
  "missing metadata warns, keeps rows",
  missing.questions.length === 2 &&
    missing.questions.every((row) => row.standard_hint === null && row.warnings.some((warning) => /explanation/i.test(warning))),
  missing.questions.map((row) => row.warnings.join("|")).join(" || "),
);

const generated = {
  stem: "A member uses a client's confidential IPS as a teaching example without consent. Which Standard is breached?",
  choices: [
    { key: "A", text: "III(E) Preservation of Confidentiality of client information" },
    { key: "B", text: "I(A) Knowledge of the Law because teaching is unregulated" },
    { key: "C", text: "V(A) Diligence and Reasonable Basis for the example" },
    { key: "D", text: "VII(B) Reference to CFA Institute in the classroom" },
  ],
  answer_key: "A",
  explanation: "A is correct because client information remains confidential unless the client consents, the activity is illegal, or the law requires disclosure.",
};
const aligned = alignToGrammar(generated, "ai-generated");
pass(
  "AI serialize/reparse keeps 4 choices and shape",
  Boolean(aligned) &&
    aligned.choices.length === 4 &&
    aligned.answer_key === "A" &&
    aligned.stem.includes("confidential IPS") &&
    aligned.explanation?.startsWith("A is correct because") &&
    !aligned.stem.startsWith("Q1"),
  `choices=${aligned?.choices.length} key=${aligned?.answer_key} stemPrefix=${aligned?.stem.slice(0, 24)}`,
);

const importedTwin = await importFile(Buffer.from(`Q1. ${generated.stem}
A) ${generated.choices[0].text}
B) ${generated.choices[1].text}
C) ${generated.choices[2].text}
D) ${generated.choices[3].text}
Answer: A
Explanation: ${generated.explanation}
`, "utf8"), "pasted.txt");
pass(
  "AI shape matches imported grammar TXT",
  importedTwin.questions.length === 1 &&
    importedTwin.questions[0].stem === aligned.stem &&
    importedTwin.questions[0].answer_key === aligned.answer_key &&
    importedTwin.questions[0].choices.map((choice) => choice.text).join("|") === aligned.choices.map((choice) => choice.text).join("|"),
  "identical CanonicalQuestion fields",
);

console.log(JSON.stringify({ results, table }, null, 2));
if (results.some((item) => !item.ok)) process.exit(1);
process.exit(0);
