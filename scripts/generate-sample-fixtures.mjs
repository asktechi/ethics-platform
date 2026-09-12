import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "fixtures", "samples");

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
    const lines = [
      "BT",
      "/F1 18 Tf",
      "72 720 Td",
      `(${escapePdf(page.title)}) Tj`,
      "/F1 12 Tf",
      "0 -28 Td",
    ];
    for (const line of page.body) {
      lines.push(`(${escapePdf(line)}) Tj`);
      lines.push("0 -18 Td");
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
  objects[pageIds[0] - 1] = objects[pageIds[0] - 1]; // keep reference stable
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
  const startxref = offset;
  const xrefLines = [
    `xref\n0 ${objects.length + 1}\n`,
    "0000000000 65535 f \n",
    ...xref.slice(1).map((value) => `${String(value).padStart(10, "0")} 00000 n \n`),
    `trailer << /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${startxref}\n%%EOF\n`,
  ];
  chunks.push(...xrefLines);
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

async function buildDocx() {
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
  zip.folder("word")?.folder("_rels")?.file(
    "document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`,
  );

  const sections = [
    {
      title: "Knowledge of the Law",
      body: "Members must understand and comply with all applicable laws, rules, and regulations. When a conflict exists, follow the stricter requirement.",
    },
    {
      title: "Independence and Objectivity",
      body: "Use reasonable care to maintain independence and objectivity. Do not offer, solicit, or accept gifts that reasonably could be expected to compromise that independence.",
    },
    {
      title: "Misrepresentation",
      body: "Do not knowingly make any misrepresentations relating to investment analysis, recommendations, actions, or other professional activities.",
    },
    {
      title: "Misconduct",
      body: "Do not engage in any professional conduct involving dishonesty, fraud, or deceit, or commit any act that reflects adversely on professional reputation.",
    },
  ];

  const paragraphs = sections
    .map(
      (section) => `
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t xml:space="preserve">${section.title}</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t xml:space="preserve">${section.body}</w:t></w:r>
    </w:p>`,
    )
    .join("");

  zip.folder("word")?.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs}
    <w:sectPr/>
  </w:body>
</w:document>`,
  );

  return zip.generateAsync({ type: "nodebuffer" });
}

function slideXml(title, body) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/><a:lstStyle/>
          <a:p><a:r><a:t>${title}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/><a:lstStyle/>
          <a:p><a:r><a:t>${body}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;
}

async function buildPptx() {
  const slides = [
    ["Standard I Overview", "Professionalism is the foundation of the CFA Institute Code of Ethics."],
    ["Knowledge of the Law", "Comply with the stricter of applicable law and the Code and Standards."],
    ["Independence", "Protect independence and objectivity in all professional activities."],
    ["Misrepresentation", "Never knowingly misrepresent analysis, credentials, or performance."],
    ["Misconduct", "Dishonesty, fraud, and deceit are incompatible with membership."],
    ["Classroom cue", "Ask for one example of a gift that would compromise independence."],
  ];

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
  <p:sldIdLst>
    ${slides
      .map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`)
      .join("")}
  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000" type="screen4x3"/>
</p:presentation>`,
  );

  slides.forEach(([title, body], index) => {
    zip.folder("ppt")?.folder("slides")?.file(`slide${index + 1}.xml`, slideXml(title, body));
  });

  return zip.generateAsync({ type: "nodebuffer" });
}

const pdf = buildPdf([
  {
    title: "Standard I: Professionalism",
    body: [
      "Standard I is the first pillar of the Code and Standards.",
      "It covers law, independence, misrepresentation, and misconduct.",
    ],
  },
  {
    title: "A. Knowledge of the Law",
    body: [
      "Know and comply with all applicable laws and regulations.",
      "Follow the stricter rule when requirements conflict.",
    ],
  },
  {
    title: "B. Independence and Objectivity",
    body: [
      "Use reasonable care and judgment to remain independent.",
      "Gifts or favors must not compromise analysis.",
    ],
  },
  {
    title: "C. Misrepresentation",
    body: [
      "Do not misrepresent analysis, credentials, or performance.",
      "Plagiarism is a form of misrepresentation.",
    ],
  },
  {
    title: "D. Misconduct",
    body: [
      "Honesty is a professional requirement, not a private option.",
      "Fraud and deceit reflect adversely on the profession.",
    ],
  },
]);

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "sample-ethics-1.pdf"), pdf);
await writeFile(join(outDir, "sample-ethics-2.docx"), await buildDocx());
await writeFile(join(outDir, "sample-ethics-3.pptx"), await buildPptx());
console.log("Wrote fixtures to", outDir);
