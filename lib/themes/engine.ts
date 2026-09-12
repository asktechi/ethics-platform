import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateRun, listRecentRuns, settingsOf, updateRunSettings } from "@/lib/data/presentation-runs";
import {
  parseRunSettings,
  type ThemePalette,
  type ThemeReelItem,
} from "@/lib/themes/types";
import type { ImagePool, ImagePoolItem, PresentationRun, Slide, Theme } from "@/types/db.helpers";
import type { Json } from "@/types/db";

export type ClassSlide = Slide & {
  material_concept_id: string | null;
  material_title: string;
};

type ThemeRow = Theme & { palette: ThemePalette };

function asPalette(theme: Theme): ThemePalette {
  const raw = (theme.palette_json ?? {}) as ThemePalette;
  return {
    bg: raw.bg ?? "#0B1B2B",
    accent: raw.accent ?? "#C9A227",
    text: raw.text ?? "#F5F1E8",
    name: theme.name,
  };
}

function varyPalette(palette: ThemePalette, index: number): ThemePalette {
  return {
    ...palette,
    gradientAngle: (18 + index * 27) % 360,
    vignette: Number((0.26 + (index % 5) * 0.07).toFixed(2)),
  };
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

export async function listClassSlides(classId: string): Promise<ClassSlide[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("slides")
    .select("*, materials!inner(id, class_id, concept_id, original_filename, is_current, deleted_at, list_order, created_at)")
    .eq("materials.class_id", classId)
    .eq("materials.is_current", true)
    .is("materials.deleted_at", null)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<
    Slide & {
      materials: {
        concept_id: string | null;
        original_filename: string;
        list_order: number | null;
        created_at: string;
      };
    }
  >;

  return rows
    .sort((a, b) => {
      const left = a.materials.list_order ?? Number.MAX_SAFE_INTEGER;
      const right = b.materials.list_order ?? Number.MAX_SAFE_INTEGER;
      if (left !== right) return left - right;
      const created = a.materials.created_at.localeCompare(b.materials.created_at);
      if (created !== 0) return created;
      return a.order - b.order;
    })
    .map((row) => ({
      ...row,
      material_concept_id: row.materials.concept_id,
      material_title: row.materials.original_filename,
    }));
}

export async function listApprovedSlides(classId: string): Promise<ClassSlide[]> {
  const slides = await listClassSlides(classId);
  const approved = slides.filter((slide) => slide.status === "approved");
  return approved.length ? approved : slides;
}

async function loadLockedThemes(): Promise<ThemeRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("themes")
    .select("*")
    .eq("is_professional_locked", true)
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Theme[]).map((theme) => ({
    ...theme,
    palette: asPalette(theme),
  }));
}

async function lastSlotThemeIds(publicRunId: string, slots = 5): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("theme_assignments")
    .select("theme_id, assigned_at, created_at")
    .eq("run_id", publicRunId)
    .is("deleted_at", null)
    .order("assigned_at", { ascending: true });
  if (error) throw new Error(error.message);
  const ids = ((data ?? []) as Array<{ theme_id: string }>).map((row) => row.theme_id);
  return ids.slice(-slots);
}

function chooseDeck(themes: ThemeRow[], excluded: Set<string>): ThemeRow[] {
  const remaining = themes.filter((theme) => !excluded.has(theme.id));
  if (remaining.length) return shuffle(remaining);
  return shuffle(themes);
}

async function exclusionSet(classId: string, current: PresentationRun): Promise<Set<string>> {
  const recent = (await listRecentRuns(classId, 6)).filter((run) => run.id !== current.id);
  const prior = recent.slice(0, 5);
  const excluded = new Set<string>();
  for (const run of prior) {
    for (const id of run.theme_ids_used ?? []) excluded.add(id);
  }
  const remaining = (await loadLockedThemes()).filter((theme) => !excluded.has(theme.id));
  if (remaining.length) return excluded;

  const latest = prior[0];
  if (!latest) return new Set(current.theme_ids_used ?? []);
  const lastSlots = await lastSlotThemeIds(latest.run_id, 5);
  return new Set(lastSlots);
}

async function loadLockedPoolMap(conceptIds: string[]) {
  const unique = [...new Set(conceptIds.filter(Boolean))];
  const map = new Map<string, ImagePoolItem[]>();
  if (unique.length === 0) return map;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("image_pools")
    .select("*, items:image_pool_items(*)")
    .in("concept_id", unique)
    .eq("is_locked", true)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as Array<ImagePool & { items?: ImagePoolItem[] }>) {
    const items = (row.items ?? []).filter((item) => !item.deleted_at);
    if (items.length) map.set(row.concept_id, items);
  }
  return map;
}

function conceptFor(slide: ClassSlide): string | null {
  return slide.concept_id ?? slide.material_concept_id;
}

async function buildAssignments(
  run: PresentationRun,
  commit: boolean,
): Promise<ThemeReelItem[]> {
  const settings = settingsOf(run);
  const themes = await loadLockedThemes();
  if (themes.length === 0) {
    throw new Error("No professional themes are seeded.");
  }

  const slides = await listApprovedSlides(run.class_id);
  const excluded = await exclusionSet(run.class_id, run);
  if ((run.theme_ids_used ?? []).length) {
    for (const id of run.theme_ids_used) excluded.add(id);
  }

  let deck: ThemeRow[];
  if (settings.theme_mode === "locked" && settings.locked_theme_id) {
    const locked = themes.find((theme) => theme.id === settings.locked_theme_id);
    deck = locked ? [locked] : chooseDeck(themes, excluded);
  } else {
    deck = chooseDeck(themes, excluded);
  }

  const pools = settings.use_image_pools
    ? await loadLockedPoolMap(slides.map((slide) => conceptFor(slide) ?? ""))
    : new Map<string, ImagePoolItem[]>();

  const byId = new Map(themes.map((theme) => [theme.id, theme]));
  const used: string[] = [];
  const items: ThemeReelItem[] = [];

  for (const [index, slide] of slides.entries()) {
    const overrideId = settings.theme_overrides?.[slide.id];
    const chosen =
      (overrideId ? byId.get(overrideId) : undefined) ??
      deck[index % deck.length];
    const palette = varyPalette(chosen.palette, index);
    const conceptId = conceptFor(slide);
    const image = conceptId ? pickRandom(pools.get(conceptId) ?? []) : null;
    if (!used.includes(chosen.id)) used.push(chosen.id);

    items.push({
      slide_id: slide.id,
      title: slide.title ?? "Untitled slide",
      body: slide.body ?? "",
      status: slide.status,
      theme_id: chosen.id,
      theme_name: chosen.name,
      theme_json: palette,
      image_url: image?.url ?? null,
      image_attribution: image
        ? `${image.photographer ?? "Unknown"} / ${image.source ?? "pool"}`
        : null,
      override: Boolean(overrideId),
    });
  }

  if (commit) {
    const admin = createAdminClient();
    await admin.from("theme_assignments").delete().eq("run_id", run.run_id);
    if (items.length) {
      const { error } = await admin.from("theme_assignments").insert(
        items.map((item) => ({
          class_id: run.class_id,
          slide_id: item.slide_id,
          theme_id: item.theme_id,
          theme_override_id: item.override ? item.theme_id : null,
          image_url: item.image_url,
          image_attribution: item.image_attribution,
          variation_json: {
            gradientAngle: item.theme_json.gradientAngle,
            vignette: item.theme_json.vignette,
          } as unknown as Json,
          run_id: run.run_id,
        })),
      );
      if (error) throw new Error(error.message);
    }
    await admin
      .from("presentation_runs")
      .update({ theme_ids_used: used })
      .eq("id", run.id);
  }

  return items;
}

export async function assignThemeForRunRecord(run: PresentationRun): Promise<ThemeReelItem[]> {
  return buildAssignments(run, true);
}

export async function assignThemeForRun(runId: string): Promise<ThemeReelItem[]> {
  const { getRunByPk } = await import("@/lib/data/presentation-runs");
  const run = await getRunByPk(runId);
  return assignThemeForRunRecord(run);
}

export async function clearAssignmentsForRun(run: PresentationRun): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("theme_assignments").delete().eq("run_id", run.run_id);
  if (error) throw new Error(error.message);
}

export async function clearAssignments(runId: string): Promise<void> {
  const { getRunByPk } = await import("@/lib/data/presentation-runs");
  const run = await getRunByPk(runId);
  await clearAssignmentsForRun(run);
}

export async function getAssignmentsForRun(runId: string): Promise<
  Array<{
    slide_id: string;
    theme_json: ThemePalette;
    image_url: string | null;
    image_attribution: string | null;
  }>
> {
  const { getRunByPk } = await import("@/lib/data/presentation-runs");
  const run = await getRunByPk(runId);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("theme_assignments")
    .select("slide_id, theme_id, image_url, image_attribution, variation_json, themes!theme_assignments_theme_id_fkey(name, palette_json)")
    .eq("run_id", run.run_id)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as Array<{
    slide_id: string | null;
    image_url: string | null;
    image_attribution: string | null;
    variation_json: Json;
    themes: { name: string; palette_json: Json } | Array<{ name: string; palette_json: Json }> | null;
  }>)
    .filter((row) => row.slide_id)
    .map((row) => {
      const variation = (row.variation_json ?? {}) as ThemePalette;
      const theme = Array.isArray(row.themes) ? row.themes[0] : row.themes;
      const base = (theme?.palette_json ?? {}) as ThemePalette;
      return {
        slide_id: row.slide_id as string,
        theme_json: {
          bg: base.bg ?? "#0B1B2B",
          accent: base.accent ?? "#C9A227",
          text: base.text ?? "#F5F1E8",
          name: theme?.name,
          gradientAngle: variation.gradientAngle,
          vignette: variation.vignette,
        },
        image_url: row.image_url,
        image_attribution: row.image_attribution,
      };
    });
}

export async function getThemeReel(classId: string): Promise<ThemeReelItem[]> {
  const { requireUser } = await import("@/lib/data/auth");
  const { user } = await requireUser();
  const run = await getOrCreateRun(classId, user.id);
  return buildAssignments(run, false);
}

export async function reshuffleRun(runId: string): Promise<ThemeReelItem[]> {
  await clearAssignments(runId);
  return assignThemeForRun(runId);
}

export async function pinThemeToSlide(
  runId: string,
  slideId: string,
  themeId: string,
): Promise<void> {
  const { getRunByPk } = await import("@/lib/data/presentation-runs");
  const run = await getRunByPk(runId);
  const settings = parseRunSettings(run.settings_json);
  const overrides = { ...(settings.theme_overrides ?? {}), [slideId]: themeId };
  await updateRunSettings(run.id, { ...settings, theme_overrides: overrides });
  const admin = createAdminClient();
  const { data: theme, error: themeError } = await admin
    .from("themes")
    .select("*")
    .eq("id", themeId)
    .maybeSingle();
  if (themeError) throw new Error(themeError.message);
  if (!theme) throw new Error("Theme not found.");

  const { data: existing } = await admin
    .from("theme_assignments")
    .select("id")
    .eq("run_id", run.run_id)
    .eq("slide_id", slideId)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("theme_assignments")
      .update({ theme_id: themeId, theme_override_id: themeId })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await admin.from("theme_assignments").insert({
    class_id: run.class_id,
    slide_id: slideId,
    theme_id: themeId,
    theme_override_id: themeId,
    run_id: run.run_id,
  });
  if (error) throw new Error(error.message);
}

export { getOrCreateRun };
