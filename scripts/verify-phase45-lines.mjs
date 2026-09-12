import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Lightweight copy of splitRevealLines for a no-bundler check of the dog script.
function splitRevealLines(text) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const sentences = [];
  for (const block of blocks) {
    const parts = block.split(/(?<=[.!?])\s+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length) sentences.push(...parts);
    else sentences.push(block);
  }
  const lines = [];
  for (const sentence of sentences) {
    if (sentence.length <= 80) {
      lines.push(sentence);
      continue;
    }
    const words = sentence.split(/\s+/).filter(Boolean);
    let buffer = "";
    for (const word of words) {
      const next = buffer ? `${buffer} ${word}` : word;
      if (next.length > 80 && buffer) {
        lines.push(buffer);
        buffer = word;
      } else buffer = next;
    }
    if (buffer) lines.push(buffer);
  }
  return lines;
}

const body =
  "The dog is beautiful and smart. It runs quickly across the yard.\nIts loyalty is unwavering.";
const lines = splitRevealLines(body);
if (lines.length !== 3) throw new Error(`expected 3 lines, got ${JSON.stringify(lines)}`);
if (lines[0] !== "The dog is beautiful and smart.") throw new Error(lines[0]);
if (lines[1] !== "It runs quickly across the yard.") throw new Error(lines[1]);
if (lines[2] !== "Its loyalty is unwavering.") throw new Error(lines[2]);
console.log(JSON.stringify({ ok: true, lines }, null, 2));
void require;
