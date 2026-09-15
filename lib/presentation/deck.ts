import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAssignmentsForRun, listClassSlides, type ClassSlide } from "@/lib/themes/engine";
import { parseRunSettings, type ThemePalette } from "@/lib/themes/types";
import type { Json } from "@/types/db";
import type { PresentationRun } from "@/types/db.helpers";
import { normalizeLayout, type SlideAssignment } from "@/lib/presentation/types";

const FALLBACK_THEME: ThemePalette = {
  bg: "#0B1B2B",
  accent: "#C9A227",
  text: "#F5F1E8",
  name: "Navy",
  gradientAngle: 210,
  vignette: 0.32,
};

type AssignmentRow = {
  slide_id: string | null;
  image_url: string | null;
  image_attribution: string | null;
  variation_json: Json;
  themes: { name: string; palette_json: Json } | Array<{ name: string; palette_json: Json }> | null;
};

function paletteFromAssignment(row: AssignmentRow): ThemePalette {
  const variation = (row.variation_json ?? {}) as ThemePalette;
  const theme = Array.isArray(row.themes) ? row.themes[0] : row.themes;
  const base = (theme?.palette_json ?? {}) as ThemePalette;
  return {
    bg: base.bg ?? FALLBACK_THEME.bg,
    accent: base.accent ?? FALLBACK_THEME.accent,
    text: base.text ?? FALLBACK_THEME.text,
    name: theme?.name,
    gradientAngle: variation.gradientAngle,
    vignette: variation.vignette,
  };
}

export async function loadAssignmentsByPublicRunId(publicRunId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("theme_assignments")
    .select("slide_id, theme_id, image_url, image_attribution, variation_json, themes!theme_assignments_theme_id_fkey(name, palette_json)")
    .eq("run_id", publicRunId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  const map = new Map<
    string,
    { theme: ThemePalette; imageUrl: string | null; imageAttribution: string | null }
  >();
  for (const row of (data ?? []) as unknown as AssignmentRow[]) {
    if (!row.slide_id) continue;
    map.set(row.slide_id, {
      theme: paletteFromAssignment(row),
      imageUrl: row.image_url,
      imageAttribution: row.image_attribution,
    });
  }
  return map;
}

function toAssignment(
  slide: ClassSlide,
  assignment:
    | { theme: ThemePalette; imageUrl: string | null; imageAttribution: string | null }
    | undefined,
  includeInstructorFields: boolean,
): SlideAssignment {
  const layout = normalizeLayout(slide.layout);
  const isCue = layout === "cue";
  return {
    slideId: slide.id,
    title: includeInstructorFields || !isCue ? (slide.title ?? "Untitled slide") : "Break",
    body: includeInstructorFields || !isCue ? (slide.body ?? "") : "",
    cue: includeInstructorFields ? slide.cue : null,
    speakerNote: includeInstructorFields ? slide.speaker_note : null,
    layout,
    theme: assignment?.theme ?? FALLBACK_THEME,
    imageUrl: assignment?.imageUrl ?? null,
    imageAttribution: includeInstructorFields ? (assignment?.imageAttribution ?? null) : null,
    // Phase 7.5: populate generatedImageUrl when AI images exist; it overrides imageUrl on stage.
    generatedImageUrl: null,
  };
}

export async function loadApprovedDeck(
  classId: string,
  publicRunId: string,
  options: { includeInstructorFields: boolean },
): Promise<SlideAssignment[]> {
  const slides = (await listClassSlides(classId)).filter((slide) => slide.status === "approved");
  const assignments = await loadAssignmentsByPublicRunId(publicRunId);
  return slides.map((slide) =>
    toAssignment(slide, assignments.get(slide.id), options.includeInstructorFields),
  );
}

export async function loadHostAssignmentsByPk(runPk: string) {
  return getAssignmentsForRun(runPk);
}

export type HostDeckPayload = {
  classId: string;
  classTitle: string;
  runPk: string;
  publicRunId: string;
  status: PresentationRun["status"];
  startedAt: string | null;
  endedAt: string | null;
  settings: ReturnType<typeof parseRunSettings>;
  slides: SlideAssignment[];
};

export function runSettingsOf(run: PresentationRun) {
  return parseRunSettings(run.settings_json);
}

export async function loadHostDeck(
  classId: string,
  publicRunId: string,
): Promise<HostDeckPayload | null> {
  const { getClass } = await import("@/lib/data/classes");
  const { getRunByPublicId } = await import("@/lib/data/presentation-runs");
  const [klass, run] = await Promise.all([getClass(classId), getRunByPublicId(publicRunId)]);
  if (!run || run.class_id !== classId) return null;
  const slides = await loadApprovedDeck(classId, run.run_id, { includeInstructorFields: true });
  return {
    classId,
    classTitle: klass.title,
    runPk: run.id,
    publicRunId: run.run_id,
    status: run.status,
    startedAt: run.started_at,
    endedAt: run.ended_at,
    settings: parseRunSettings(run.settings_json),
    slides,
  };
}
