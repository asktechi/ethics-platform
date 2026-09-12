import "server-only";
import { requireUser } from "@/lib/data/auth";
import { requireValue } from "@/lib/data/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_RUN_SETTINGS, parseRunSettings, type RunSettings } from "@/lib/themes/types";
import type { PresentationRun } from "@/types/db.helpers";
import type { Json } from "@/types/db";

export async function getOrCreateRun(classId: string, userId: string): Promise<PresentationRun> {
  const admin = createAdminClient();
  const { data: existing, error } = await admin
    .from("presentation_runs")
    .select("*")
    .eq("class_id", classId)
    .eq("status", "setup")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) return existing as PresentationRun;

  const { data, error: insertError } = await admin
    .from("presentation_runs")
    .insert({
      class_id: classId,
      started_by: userId,
      status: "setup",
      settings_json: DEFAULT_RUN_SETTINGS as unknown as Json,
    })
    .select("*")
    .single();
  if (insertError) throw new Error(insertError.message);
  return data as PresentationRun;
}

export async function getRunByPk(id: string): Promise<PresentationRun> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("presentation_runs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return requireValue(data as PresentationRun | null, "Presentation run not found.");
}

export async function getRunByPublicId(runId: string): Promise<PresentationRun | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("presentation_runs")
    .select("*")
    .eq("run_id", runId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PresentationRun | null) ?? null;
}

export async function listRecentRuns(classId: string, limit = 5): Promise<PresentationRun[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("presentation_runs")
    .select("*")
    .eq("class_id", classId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as PresentationRun[];
}

export async function updateRunSettings(id: string, settings: RunSettings): Promise<PresentationRun> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("presentation_runs")
    .update({ settings_json: settings as unknown as Json })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PresentationRun;
}

export async function startRun(id: string): Promise<PresentationRun> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("presentation_runs")
    .update({
      status: "live",
      started_at: new Date().toISOString(),
      ended_at: null,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PresentationRun;
}

export function settingsOf(run: PresentationRun): RunSettings {
  return parseRunSettings(run.settings_json);
}
