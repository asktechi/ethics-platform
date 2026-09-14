import { jeopardyScoreResponse } from "@/lib/games/modes/jeopardy";
import type { GameModeDefinition } from "@/lib/games/modes/types";

export const caseStudyMode: GameModeDefinition = {
  id: "case_study",
  name: "Case Study",
  shortDescription: "Multi-question vignette on one scenario.",
  longDescription:
    "Players read a shared vignette, then answer a sequence of questions on that case. Scoring matches Jeopardy: 100 base plus time and streak bonuses.",
  icon: "▣",
  accentColor: "#2A9D8F",
  status: "playable",
  configSchema: [
    {
      key: "show_scenario_before_each_question",
      label: "Show scenario before each question",
      type: "boolean",
      default: true,
    },
    { key: "min_case_size", label: "Minimum questions per case", type: "number", default: 3, min: 1, max: 8 },
    { key: "max_case_size", label: "Maximum questions per case", type: "number", default: 8, min: 3, max: 20 },
    { key: "transition_delay_ms", label: "Case transition delay (ms)", type: "number", default: 800, min: 0, max: 5000 },
    { key: "allow_case_review_at_end", label: "Allow case review at the end", type: "boolean", default: true },
  ],
  scoreResponse: jeopardyScoreResponse,
};
