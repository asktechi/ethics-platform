import { PHASE46_SLIDES, paginateFixture } from "@/lib/presentation/phase46-fixtures.ts";

const CANONICAL = { width: 1920, height: 1080 };
const CORNER = { width: 800, height: 600 };

const a = paginateFixture(PHASE46_SLIDES.A, CANONICAL);
const b = paginateFixture(PHASE46_SLIDES.B, CANONICAL);
const c = paginateFixture(PHASE46_SLIDES.C, CANONICAL);
const d = paginateFixture(PHASE46_SLIDES.D, CANONICAL);
const blank = paginateFixture(PHASE46_SLIDES.blank, CANONICAL);
const cCorner = paginateFixture(PHASE46_SLIDES.C, CORNER);
const aCorner = paginateFixture(PHASE46_SLIDES.A, CORNER);

const report = {
  A: { fontSize: a.fontSize, beats: a.beats.length, lines: a.beats[0]?.lines.length ?? 0 },
  B: { fontSize: b.fontSize, beats: b.beats.length, lines: b.beats.reduce((n, beat) => n + beat.lines.length, 0) },
  C: { fontSize: c.fontSize, beats: c.beats.length, lines: c.beats.reduce((n, beat) => n + beat.lines.length, 0) },
  D: { fontSize: d.fontSize, beats: d.beats.length, title: PHASE46_SLIDES.D.title },
  blank: { fontSize: blank.fontSize, beats: blank.beats.length },
  C_800x600: { fontSize: cCorner.fontSize, beats: cCorner.beats.length },
  A_800x600: { fontSize: aCorner.fontSize, beats: aCorner.beats.length },
};

const failures = [];
if (a.fontSize !== 96) failures.push(`A expected 96px, got ${a.fontSize}`);
if (a.beats.length !== 1) failures.push(`A expected 1 beat, got ${a.beats.length}`);
if (d.fontSize !== 96) failures.push(`D expected 96px, got ${d.fontSize}`);
if (d.beats.length !== 1) failures.push(`D expected 1 beat, got ${d.beats.length}`);
if (blank.fontSize !== 96) failures.push(`blank expected 96px, got ${blank.fontSize}`);
if (b.fontSize > 96 || b.fontSize < 34) failures.push(`B font out of range: ${b.fontSize}`);
if (c.fontSize > b.fontSize) failures.push(`C should not be larger than B (${c.fontSize} > ${b.fontSize})`);
if (c.fontSize > 48) failures.push(`C expected a reduced size, got ${c.fontSize}`);
if (cCorner.beats.length < 2) failures.push(`C at 800x600 should paginate, got ${cCorner.beats.length} beats`);

console.log(JSON.stringify({ ok: failures.length === 0, report, failures }, null, 2));
if (failures.length) process.exit(1);
