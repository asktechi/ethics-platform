import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import * as XLSX from "xlsx";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "fixtures", "samples");

const csvRows = [
  ["stem", "a", "b", "c", "answer", "explanation"],
  [
    "A charterholder learns her firm omitted a material fact from a required regulatory filing and local law is silent. What is the first action under Standard I(A)?",
    "Ignore the omission because local law does not require reporting",
    "Dissociate from the activity and escalate the issue internally",
    "Resign immediately without telling anyone at the firm",
    "B",
    "I(A) requires dissociation from violations and following the stricter of law or the Code. Escalation comes before walking away silently.",
  ],
  [
    "An analyst accepts a weekend at a client's ski house after publishing a buy recommendation on a stock the client owns. The most serious Standard I issue is which of the following?",
    "Independence and Objectivity because the gift could influence research",
    "Knowledge of the Law because travel gifts are always illegal",
    "Misrepresentation because the report did not disclose the trip",
    "A",
    "Gifts that could reasonably influence research impair independence and objectivity under Standard I(B) and must be refused or disclosed.",
  ],
  [
    "A firm advertises that every employee is a CFA charterholder even though two associates have not earned the charter. This is primarily a violation of which Standard?",
    "I(A) Knowledge of the Law because advertising is a legal matter only",
    "I(C) Misrepresentation of professional qualifications",
    "II(A) Material Nonpublic Information about the associates",
    "B",
    "Claiming a designation people have not earned is a misrepresentation of qualifications under Standard I(C).",
  ],
  [
    "A portfolio manager is convicted of a misdemeanor for disorderly conduct after a sports argument. Under Standard I(D), how should the conviction be viewed by the firm?",
    "It always bars the manager from the investment profession immediately",
    "It is misconduct only if it involves fraud, honesty, or professional integrity",
    "It must be disclosed to all clients within twenty-four hours by policy",
    "B",
    "I(D) targets honesty, integrity, and professional conduct, not every personal misdemeanor unrelated to professional honesty.",
  ],
  [
    "An analyst overhears a CEO in an elevator confirm that an unannounced acquisition will close tomorrow. The analyst should take which of the following actions first?",
    "Trade immediately for discretionary client accounts before the news",
    "Keep the information confidential and refrain from trading on it",
    "Post an anonymous summary of the conversation on a public forum",
    "B",
    "Standard II(A) prohibits acting or causing others to act on material nonpublic information obtained in any setting.",
  ],
];

function csvEscape(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function escapePdf(text) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdf(pages) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const contentIds = pages.map((page) => {
    const lines = ["BT", "/F1 11 Tf", "48 720 Td"];
    for (const line of page) {
      lines.push(`(${escapePdf(line)}) Tj`);
      lines.push("0 -16 Td");
    }
    lines.push("ET");
    const stream = lines.join("\n");
    return add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });
  const pageIds = contentIds.map((contentId) =>
    add(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    ),
  );
  const pagesId = add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  for (const pageId of pageIds) {
    objects[pageId - 1] = objects[pageId - 1].replace("/Parent 0 0 R", `/Parent ${pagesId} 0 R`);
  }
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let offset = 0;
  const chunks = ["%PDF-1.4\n"];
  offset = Buffer.byteLength(chunks[0]);
  const xref = [0];
  objects.forEach((body, index) => {
    xref.push(offset);
    const obj = `${index + 1} 0 obj\n${body}\nendobj\n`;
    chunks.push(obj);
    offset += Buffer.byteLength(obj);
  });
  chunks.push(
    `xref\n0 ${objects.length + 1}\n`,
    "0000000000 65535 f \n",
    ...xref.slice(1).map((value) => `${String(value).padStart(10, "0")} 00000 n \n`),
    `trailer << /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${offset}\n%%EOF\n`,
  );
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

async function buildDocx(blocks) {
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
  const paragraphs = blocks
    .flatMap((block) => block.map((line) => `<w:p><w:r><w:t xml:space="preserve">${line}</w:t></w:r></w:p>`))
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

function slideXml(lines) {
  const paragraphs = lines
    .map((line) => `<a:p><a:r><a:t>${line.replace(/&/g, "&amp;")}</a:t></a:r></a:p>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Body"/><p:cNvSpPr/><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr>
        <p:spPr/>
        <p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs}</p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;
}

async function buildPptx(slides) {
  const zip = new JSZip();
  const overrides = slides
    .map(
      (_, index) =>
        `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
    )
    .join("");
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${overrides}
</Types>`,
  );
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
  );
  zip.folder("ppt")?.folder("_rels")?.file(
    "presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${slides
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`,
    )
    .join("")}
</Relationships>`,
  );
  zip.folder("ppt")?.file(
    "presentation.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>${slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`).join("")}</p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000" type="screen4x3"/>
</p:presentation>`,
  );
  slides.forEach((lines, index) => {
    zip.folder("ppt")?.folder("slides")?.file(`slide${index + 1}.xml`, slideXml(lines));
  });
  return zip.generateAsync({ type: "nodebuffer" });
}

const xlsxRows = [
  ["question", "choice_a", "choice_b", "choice_c", "choice_d", "correct_answer", "rationale"],
  [
    "A trader enters a series of small orders at the close to push a thinly traded stock higher so a month-end report looks better. This most clearly violates which Standard?",
    "II(B) Market Manipulation through distorting price or volume",
    "III(D) Performance Presentation because the report is public",
    "I(B) Independence and Objectivity of the research department",
    "IV(A) Loyalty to Employer because the firm is harmed",
    "A",
    "Transactions intended to distort price or volume are market manipulation under Standard II(B) even when the size of each order is small.",
  ],
  [
    "A manager learns a client will inherit a large taxable estate and immediately buys municipal bonds before discussing the change. The suitability problem is best described how?",
    "Failing to update the IPS and judge the whole portfolio first",
    "Using material nonpublic information about the inheritance",
    "Misrepresenting historical municipal-bond performance to the client",
    "Failing to supervise a junior who entered the trades",
    "A",
    "III(C) requires inquiry and suitability in the context of the client's circumstances and the whole portfolio before acting on a new fact.",
  ],
  [
    "Two clients have the same mandate. The manager allocates a scarce IPO entirely to the larger fee-paying account. This most likely violates which Standard?",
    "III(A) Loyalty and Prudence only, because fees define the duty",
    "III(B) Fair Dealing when taking investment action for clients",
    "II(A) Material Nonpublic Information about the IPO book",
    "V(A) Diligence and Reasonable Basis for the issue itself",
    "B",
    "III(B) requires fair and objective dealing when taking investment action for clients with similar mandates, regardless of fee size.",
  ],
  [
    "A firm reports a composite return that silently drops two accounts that lost money last quarter. This is a problem under which Standard?",
    "III(D) Performance Presentation because losers were omitted",
    "I(A) Knowledge of the Law because composites are a legal filing",
    "II(B) Market Manipulation of the firm's own share price",
    "III(E) Confidentiality of the dropped client accounts",
    "A",
    "Performance must be fair, accurate, and complete; dropping losing accounts is a misleading presentation under Standard III(D).",
  ],
  [
    "A banker discusses a client's pending divorce settlement with a colleague who does not work on the account. The primary Standard implicated is which one?",
    "III(E) Preservation of Confidentiality of client information",
    "II(A) Material Nonpublic Information about the settlement",
    "I(C) Misrepresentation of the colleague's role on the account",
    "IV(C) Responsibilities of Supervisors for the colleague",
    "A",
    "Client information stays confidential unless there is illegal activity, a legal requirement, or client consent under Standard III(E).",
  ],
];

const docxBlocks = [
  [
    "1. A research analyst copies a table from a sell-side report without attribution in a client memo. What Standard is most clearly at issue in this situation?",
    "A. I(C) Misrepresentation, including plagiarism of others' work",
    "B. II(A) Material Nonpublic Information obtained from the sell side",
    "C. III(B) Fair Dealing among the analyst's own clients",
    "Answer: A",
    "Explanation: Using another's work without attribution is plagiarism and a misrepresentation under Standard I(C).",
  ],
  [
    "2. A supervisor learns a junior is front-running client orders and does nothing for two weeks. Which Standard best describes the supervisor's failure here?",
    "A. IV(C) Responsibilities of Supervisors to detect and prevent violations",
    "B. III(A) Loyalty, Prudence, and Care owed only to the junior",
    "C. I(B) Independence and Objectivity of the trading desk",
    "Answer: A",
    "Explanation: Supervisors must implement reasonable procedures to detect and prevent violations and must act when they learn of a breach.",
  ],
  [
    "3. A candidate discusses specific exam questions with a colleague who sits the next window. This conduct most directly violates which rule?",
    "A. VII(A) Conduct as Participants in CFA Institute Programs",
    "B. I(D) Misconduct limited to criminal convictions only",
    "C. V(B) Communication with Clients and Prospective Clients",
    "Answer: A",
    "Explanation: Sharing confidential exam information violates Standard VII(A) regarding conduct as participants in CFA Institute programs.",
  ],
];

const pdfPages = [
  [
    "1. A member sits on a public company's board and buys the stock before a vote she knows will pass. What should she do instead?",
    "A. Trade only after the vote is public and information is no longer MNPI.",
    "B. Trade immediately for clients because the vote is nearly certain.",
    "C. Tell her largest client so they can trade first.",
    "D. Hedge with options in a personal account only.",
    "Answer: A",
    "Explanation: Board knowledge of a pending vote is material nonpublic information; she must wait until it is public under II(A).",
  ],
  [
    "2. A manager guarantees a client that the portfolio will beat the benchmark this year. The communication problem is best described how?",
    "A. I(C) Misrepresentation of what can reasonably be promised.",
    "B. III(E) Confidentiality of the benchmark construction.",
    "C. II(B) Market Manipulation of the benchmark index.",
    "D. IV(B) Additional Compensation from the guarantee.",
    "Answer: A",
    "Explanation: Promising a specific return or outperformance is a misrepresentation of what investment results can be guaranteed.",
  ],
  [
    "3. A firm pays a bonus to an analyst solely for issuing a buy rating on an investment-banking client. Independence is threatened because of which fact?",
    "A. Compensation is tied to a specific recommendation on a banking client.",
    "B. The analyst used a discounted cash flow model.",
    "C. The company is in the same industry as another coverage name.",
    "D. The bonus is paid in cash rather than stock.",
    "Answer: A",
    "Explanation: Pay linked to a particular rating on a banking client impairs independence and objectivity under Standard I(B).",
  ],
  [
    "4. A private-wealth manager recommends a concentrated stock position because it is the manager's own largest holding. The loyalty problem is which of these?",
    "A. Failing to put the client's interests ahead of the manager's own.",
    "B. Using material nonpublic information about the holding.",
    "C. Misrepresenting the stock's historical dividend record.",
    "D. Failing to sit for the next CFA exam window.",
    "Answer: A",
    "Explanation: III(A) requires loyalty, prudence, and care; recommending a position because it benefits the manager violates that duty.",
  ],
];

const txt = `Q1. A consultant uses a client's confidential IPS as a teaching example without consent. Which Standard is breached in this classroom use?
A. III(E) Preservation of Confidentiality of client information
B. I(A) Knowledge of the Law because teaching is unregulated
C. V(A) Diligence and Reasonable Basis for the example
Answer: A
Explanation: Client information remains confidential unless the client consents, the activity is illegal, or the law requires disclosure.

Q2. An analyst issues a buy rating after a ten-minute scan of a press release and no model. Diligence is lacking because of which failure?
A. V(A) Diligence and Reasonable Basis for the recommendation
B. II(A) Material Nonpublic Information in the press release
C. III(B) Fair Dealing among accounts that will trade
Answer: A
Explanation: Recommendations must rest on thorough, independent investigation; a ten-minute skim is not a reasonable basis.

Q3. A member omits a material risk from a client report to keep the narrative simple. Communication with clients is deficient for what reason?
A. V(B) requires disclosing basic format and relevant risk factors
B. I(D) Misconduct applies only when a crime is charged
C. VII(B) Reference to CFA Institute is the only issue
Answer: A
Explanation: V(B) requires distinguishing fact from opinion and communicating relevant risk factors that affect the analysis.`;

const vignetteSlides = [
  [
    "A Level II candidate, Maya, is a research analyst covering regional banks. During a charity dinner she overhears the CFO of a covered bank confirm that an unannounced capital raise will be priced before the open. Maya's largest client has asked for a morning note. The dinner conversation lasted more than two minutes and included specific size and timing details that have not been released to the market.",
  ],
  ["A. Publish the morning note using the overheard details so the client is first.", "B. Wait until the information is public and do not trade or cause others to trade.", "C. Tell only the firm's proprietary desk so the firm can hedge.", "D. Ask the CFO to confirm the facts in writing after dinner."],
  ["B is correct because Standard II(A) prohibits acting or causing others to act on material nonpublic information, including information overheard socially."],
  [
    "Jordan manages two similar balanced accounts. A scarce IPO is allocated. Account A pays a higher fee. Jordan gives the entire IPO to Account A and tells Account B the deal was too small to bother with, even though both IPS documents permit IPO participation and both clients have asked about new issues this quarter.",
  ],
  ["A. Fee size may determine IPO allocation when mandates are identical.", "B. III(B) Fair Dealing requires objective allocation across similar clients.", "C. The smaller account has no right to scarce new issues.", "D. Oral notice to Account B cures any allocation problem."],
  ["B is correct because Standard III(B) requires fair and objective dealing when taking investment action for clients with similar mandates. Standard III(B)."],
];

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "questions-import-5.csv"), csvRows.map((row) => row.map(csvEscape).join(",")).join("\n"));

const sheet = XLSX.utils.aoa_to_sheet(xlsxRows);
const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, sheet, "Questions");
XLSX.writeFile(book, join(outDir, "questions-import-5.xlsx"));

await writeFile(join(outDir, "questions-import-3.docx"), await buildDocx(docxBlocks));
await writeFile(join(outDir, "questions-import-4.pdf"), buildPdf(pdfPages));
await writeFile(join(outDir, "questions-import-vignette.pptx"), await buildPptx(vignetteSlides));
await writeFile(join(outDir, "questions-import-3.txt"), txt);

const many = [["stem", "a", "b", "c", "d", "answer", "explanation"]];
for (let index = 1; index <= 200; index += 1) {
  many.push([
    `Synthetic review-row ${index}: a charterholder faces a professionalism fact pattern that requires identifying the correct Standard and the first required action in the circumstance described here.`,
    "Dissociate and escalate internally under the Code",
    "Ignore the fact pattern because it is only a teaching case",
    "Guarantee the client a specific investment outcome",
    "Share the exam question with a colleague",
    "A",
    "This synthetic row exists so the review table can be virtualized; the explanation is long enough to avoid a weak-explanation warning.",
  ]);
}
await writeFile(join(outDir, "questions-import-200.csv"), many.map((row) => row.map(csvEscape).join(",")).join("\n"));

console.log("Wrote import fixtures to", outDir);
