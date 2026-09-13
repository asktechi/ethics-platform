"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError } from "@/lib/data/errors";
import {
  archiveGameTemplate,
  cloneGameTemplate,
  convertGameToJeopardy,
  createGameTemplate,
  launchGameFromTemplate,
  previewGameSource,
  scheduleGameInstance,
  updateGameTemplate,
} from "@/lib/data/games";
import { GameLaunchBlockedError, type ResolveDiagnostics } from "@/lib/games/resolve";
import { defaultGameFilter, defaultGameSettings, type WizardState } from "@/lib/games/types";

const filterSchema = z.object({
  standards: z.array(z.string()),
  concepts: z.array(z.string()),
  difficulty: z.array(z.enum(["easy", "medium", "hard"])),
  sources: z.array(z.enum(["imported", "ai_generated", "mine"])),
  approved_only: z.boolean(),
  search: z.string().optional(),
});

const wizardSchema = z.object({
  classId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  tags: z.array(z.string()),
  source: z.enum(["pool", "filter"]),
  poolId: z.string(),
  filter: filterSchema,
  mode: z.literal("jeopardy"),
  settings: z.object({
    time_per_q: z.number().int().min(5).max(300),
    base_points: z.number().int().min(0).max(1000),
    time_bonus: z.boolean(),
    streak_bonus: z.boolean(),
    shuffle_questions: z.boolean(),
    show_leaderboard_to_players: z.boolean(),
    show_correct_answer_after: z.boolean(),
    allow_late_join: z.boolean(),
    allow_audience_advance: z.boolean(),
  }),
});

function asWizard(input: unknown): WizardState {
  const parsed = wizardSchema.parse(input);
  return {
    ...parsed,
    filter: { ...defaultGameFilter(), ...parsed.filter },
    settings: { ...defaultGameSettings(), ...parsed.settings },
    mode: "jeopardy",
  };
}

export async function saveGameAction(input: unknown) {
  try {
    const wizard = asWizard(input);
    const row = await createGameTemplate(wizard);
    revalidatePath("/games");
    revalidatePath("/dashboard");
    return { ok: true as const, id: row.id };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function updateGameAction(id: string, input: unknown) {
  try {
    const wizard = asWizard(input);
    const row = await updateGameTemplate(id, { ...wizard, bumpVersion: true });
    revalidatePath("/games");
    revalidatePath(`/games/${id}`);
    return { ok: true as const, version: row.version };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function startGameAction(templateId: string) {
  try {
    const session = await launchGameFromTemplate(templateId);
    revalidatePath(`/games/${templateId}`);
    return { ok: true as const, sessionId: session.id, joinCode: session.join_code };
  } catch (error) {
    if (error instanceof GameLaunchBlockedError || (error instanceof Error && error.name === "GameLaunchBlockedError")) {
      return {
        ok: false as const,
        error: error.message,
        cannotStart: true as const,
        diagnostics: error instanceof GameLaunchBlockedError ? error.diagnostics : undefined,
      };
    }
    return { ok: false as const, error: actionError(error) };
  }
}

export async function scheduleGameAction(templateId: string, when: string) {
  try {
    if (!when) return { ok: false as const, error: "Pick a date and time." };
    const row = await scheduleGameInstance(templateId, new Date(when).toISOString());
    revalidatePath(`/games/${templateId}`);
    return { ok: true as const, instanceId: row.id };
  } catch (error) {
    if (error instanceof GameLaunchBlockedError || (error instanceof Error && error.name === "GameLaunchBlockedError")) {
      return {
        ok: false as const,
        error: error.message,
        cannotStart: true as const,
        diagnostics: error instanceof GameLaunchBlockedError ? error.diagnostics : undefined,
      };
    }
    return { ok: false as const, error: actionError(error) };
  }
}

export async function archiveGameAction(id: string, restore = false) {
  try {
    await archiveGameTemplate(id, restore);
    revalidatePath("/games");
    revalidatePath(`/games/${id}`);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function cloneGameAction(id: string) {
  try {
    const row = await cloneGameTemplate(id);
    revalidatePath("/games");
    return { ok: true as const, id: row.id };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function convertToJeopardyAction(id: string) {
  try {
    const row = await convertGameToJeopardy(id);
    revalidatePath(`/games/${id}`);
    revalidatePath("/games");
    return { ok: true as const, version: row.version };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function previewFilterQuestions(filter: unknown, classId: string) {
  try {
    const parsed = filterSchema.parse(filter);
    const preview = await previewGameSource({ classId, source: "filter", filter: parsed });
    return {
      ok: true as const,
      count: preview.count,
      sample: preview.sample,
      diagnostics: preview.diagnostics as ResolveDiagnostics,
    };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function previewGameSourceAction(input: {
  classId: string;
  source: "pool" | "filter";
  poolId?: string;
  filter?: unknown;
}) {
  try {
    const filter = input.filter ? filterSchema.parse(input.filter) : undefined;
    const preview = await previewGameSource({
      classId: input.classId,
      source: input.source,
      poolId: input.poolId,
      filter,
    });
    return { ok: true as const, ...preview };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}
