import { headerSelectState, pageSlice, questionMatchesFilters, replaceIds, unionIds } from "@/lib/questions/selection.ts";

const results = [];
function pass(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${step}${detail ? ` — ${detail}` : ""}`);
}

const selected = replaceIds(["ii-1", "ii-2"]);
pass("replace selection", selected.size === 2 && selected.has("ii-1"), `size=${selected.size}`);

const afterFilterChange = new Set(selected);
pass("selection persists after filter change", afterFilterChange.has("ii-1") && afterFilterChange.has("ii-2"), "II ids remain");

const added = unionIds(afterFilterChange, ["iii-1", "iii-2"]);
pass("quick select add unions", added.size === 4 && added.has("iii-1"), `size=${added.size}`);

const replaced = replaceIds(["iii-1"]);
pass("quick select replace", replaced.size === 1 && !replaced.has("ii-1"), `size=${replaced.size}`);

const page = pageSlice(Array.from({ length: 50 }, (_, index) => index), 0, 25);
pass("page slice is 25", page.length === 25 && page[0] === 0 && page[24] === 24, `len=${page.length}`);

const pageIds = ["a", "b", "c"];
pass("header none", headerSelectState(pageIds, new Set()) === "none");
pass("header some", headerSelectState(pageIds, new Set(["a"])) === "some");
pass("header all page", headerSelectState(pageIds, new Set(["a", "b", "c"])) === "all");
pass("header some when selected off-page", headerSelectState(pageIds, new Set(["z"])) === "some");

const hardIII = {
  id: "1",
  stem: "x",
  approved: false,
  rejected: false,
  source: "imported",
  standard_id: "std-iii",
  concept_id: null,
  difficulty: "hard",
  deleted_at: null,
  ai_tag_confidence: 0.9,
};
pass(
  "quick-select matcher",
  questionMatchesFilters(hardIII, { standardIds: ["std-iii"], difficulty: ["hard"], includeArchived: false }),
);

console.log(JSON.stringify({ results }, null, 2));
if (results.some((item) => !item.ok)) process.exit(1);
process.exit(0);
