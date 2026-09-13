import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "samples", "grammar");

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function buildDocx(lines) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  const paragraphs = lines
    .map((line) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`)
    .join("");
  zip.folder("word")?.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs}<w:sectPr/></w:body>
</w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

const good = [
  "Q1. A charterholder learns her firm omitted a material fact from a required regulatory filing and local law is silent. What is the first action under Standard I(A)?",
  "A) Ignore the omission because local law does not require reporting",
  "B) Dissociate from the activity and escalate the issue internally",
  "C) Resign immediately without telling anyone at the firm",
  "Standard: Standard I(A)",
  "Answer: B",
  "Explanation: I(A) requires dissociation from violations and following the stricter of law or the Code. Escalation comes before walking away silently.",
  "",
  "Q2. An analyst accepts a weekend at a client's ski house after publishing a buy recommendation on a stock the client owns. The most serious Standard I issue is which of the following?",
  "A) Independence and Objectivity because the gift could influence research",
  "B) Knowledge of the Law because travel gifts are always illegal",
  "C) Misrepresentation because the report did not disclose the trip",
  "Standard: Standard I(B)",
  "Answer: A",
  "Explanation: Gifts that could reasonably influence research impair independence and objectivity under Standard I(B) and must be refused or disclosed.",
  "",
  "Q3. A firm advertises that every employee is a CFA charterholder even though two associates have not earned the charter. This is primarily a violation of which Standard?",
  "A) I(A) Knowledge of the Law because advertising is a legal matter only",
  "B) I(C) Misrepresentation of professional qualifications",
  "C) II(A) Material Nonpublic Information about the associates",
  "Standard: Standard I(C)",
  "Answer: B",
  "Explanation: Claiming a designation people have not earned is a misrepresentation of qualifications under Standard I(C).",
  "",
  "Q4. A portfolio manager is convicted of a misdemeanor for disorderly conduct after a sports argument. Under Standard I(D), how should the conviction be viewed by the firm?",
  "A) It always bars the manager from the investment profession immediately",
  "B) It is misconduct only if it involves fraud, honesty, or professional integrity",
  "C) It must be disclosed to all clients within twenty-four hours by policy",
  "Standard: Standard I(D)",
  "Answer: B",
  "Explanation: I(D) targets honesty, integrity, and professional conduct, not every personal misdemeanor unrelated to professional honesty.",
  "",
  "Q5. An analyst overhears a CEO in an elevator confirm that an unannounced acquisition will close tomorrow. The analyst should take which of the following actions first?",
  "A) Trade immediately for discretionary client accounts before the news",
  "B) Keep the information confidential and refrain from trading on it",
  "C) Post an anonymous summary of the conversation on a public forum",
  "Standard: Standard II(A)",
  "Answer: B",
  "Explanation: Standard II(A) prohibits acting or causing others to act on material nonpublic information obtained in any setting.",
];

const decorated = [
  "Ethics Question Bank",
  "Instructor draft — 2026 Level II",
  "Table of Contents",
  "Answer Key",
  "Page 1",
  "12",
  "===START===",
  "=====",
  "---",
  "***",
  "___",
  ...good.flatMap((line, index) => {
    if (line.startsWith("Q") && index > 0) {
      return ["===END===", "---", "=====", "Page 2", "===START===", line];
    }
    return [line];
  }),
  "===END===",
  "=======",
];

const mixed = [
  "Q1. A research analyst copies a table from a sell-side report without attribution in a client memo. What Standard is most clearly at issue in this situation?",
  "A) I(C) Misrepresentation, including plagiarism of others' work",
  "B) II(A) Material Nonpublic Information obtained from the sell side",
  "C) III(B) Fair Dealing among the analyst's own clients",
  "Answer: A",
  "Explanation: Using another's work without attribution is plagiarism and a misrepresentation under Standard I(C).",
  "",
  "Q2) A supervisor learns a junior is front-running client orders and does nothing for two weeks. Which Standard best describes the supervisor's failure here?",
  "A) IV(C) Responsibilities of Supervisors to detect and prevent violations",
  "B) III(A) Loyalty, Prudence, and Care owed only to the junior",
  "C) I(B) Independence and Objectivity of the trading desk",
  "Answer: A",
  "Explanation: Supervisors must implement reasonable procedures to detect and prevent violations and must act when they learn of a breach.",
  "",
  "Question 3: A candidate discusses specific exam questions with a colleague who sits the next window. This conduct most directly violates which rule?",
  "A) VII(A) Conduct as Participants in CFA Institute Programs",
  "B) I(D) Misconduct limited to criminal convictions only",
  "C) V(B) Communication with Clients and Prospective Clients",
  "Answer: A",
  "Explanation: Sharing confidential exam information violates Standard VII(A) regarding conduct as participants in CFA Institute programs.",
  "",
  "4. A member sits on a public company's board and buys the stock before a vote she knows will pass. What should she do instead of trading on that knowledge?",
  "A) Trade only after the vote is public and information is no longer MNPI",
  "B) Trade immediately for clients because the vote is nearly certain",
  "C) Tell her largest client so they can trade first",
  "Answer: A",
  "Explanation: Board knowledge of a pending vote is material nonpublic information; she must wait until it is public under II(A).",
];

const missing = [
  "Q1. A manager guarantees a client that the portfolio will beat the benchmark this year. The communication problem is best described how in the Code and Standards?",
  "A) I(C) Misrepresentation of what can reasonably be promised",
  "B) III(E) Confidentiality of the benchmark construction",
  "C) II(B) Market Manipulation of the benchmark index",
  "Answer: A",
  "",
  "Q2. A private-wealth manager recommends a concentrated stock position because it is the manager's own largest holding. The loyalty problem is which of these?",
  "A) Failing to put the client's interests ahead of the manager's own",
  "B) Using material nonpublic information about the holding",
  "C) Misrepresenting the stock's historical dividend record",
  "Answer: A",
];

const four = [
  "Q1. A trader enters a series of small orders at the close to push a thinly traded stock higher so a month-end report looks better. This most clearly violates which Standard?",
  "A) II(B) Market Manipulation through distorting price or volume",
  "B) III(D) Performance Presentation because the report is public",
  "C) I(B) Independence and Objectivity of the research department",
  "D) IV(A) Loyalty to Employer because the firm is harmed",
  "Standard: Standard II(B)",
  "Answer: A",
  "Explanation: Transactions intended to distort price or volume are market manipulation under Standard II(B) even when each order is small.",
  "",
  "Q2. Two clients have the same mandate. The manager allocates a scarce IPO entirely to the larger fee-paying account. This most likely violates which Standard?",
  "A) III(A) Loyalty and Prudence only, because fees define the duty",
  "B) III(B) Fair Dealing when taking investment action for clients",
  "C) II(A) Material Nonpublic Information about the IPO book",
  "D) V(A) Diligence and Reasonable Basis for the issue itself",
  "Standard: Standard III(B)",
  "Answer: B",
  "Explanation: III(B) requires fair and objective dealing when taking investment action for clients with similar mandates, regardless of fee size.",
];

const two = [
  "Q1. A member must keep client information confidential even when using that information only as a classroom teaching example without consent.",
  "A) True — classroom use still requires consent or another permitted exception",
  "B) False — teaching examples are always exempt from confidentiality",
  "Standard: Standard III(E)",
  "Answer: A",
  "Explanation: Client information remains confidential unless the client consents, the activity is illegal, or the law requires disclosure.",
  "",
  "Q2. Promising a specific return or guaranteed outperformance is consistent with Standard I(C) when the manager is highly confident.",
  "A) True — confidence is a sufficient basis for a performance guarantee",
  "B) False — guaranteeing a return misrepresents what can reasonably be promised",
  "Standard: Standard I(C)",
  "Answer: B",
  "Explanation: Promising a specific return or outperformance is a misrepresentation of what investment results can be guaranteed.",
];

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "good-docx.docx"), await buildDocx(good));
await writeFile(join(outDir, "decorated-docx.docx"), await buildDocx(decorated));
await writeFile(join(outDir, "mixed-case.docx"), await buildDocx(mixed));
await writeFile(join(outDir, "missing-metadata.docx"), await buildDocx(missing));
await writeFile(join(outDir, "4-choices.docx"), await buildDocx(four));
await writeFile(join(outDir, "two-choices.docx"), await buildDocx(two));
console.log("Wrote grammar fixtures to", outDir);
