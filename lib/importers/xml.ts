export function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function extractTags(xml: string, tag: string) {
  const pattern = new RegExp(`<${tag}(?![a-zA-Z])[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g");
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) {
    const text = decodeXml(match[1]).trim();
    if (text) values.push(text);
  }
  return values;
}

export function extractDrawingText(xml: string) {
  return extractTags(xml, "a:t");
}

export function extractWordText(xml: string) {
  return extractTags(xml, "w:t");
}
