import "server-only";
import { createHash } from "crypto";
import { requireUser } from "@/lib/data/auth";
import { requireValue } from "@/lib/data/errors";
import { materialTypeFromFilename, parseMaterial } from "@/lib/parsers/parseIndex";
import {
  downloadOriginal,
  originalStoragePath,
  signedOriginalUrl,
  uploadOriginalImmutable,
} from "@/lib/storage/materials";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Material, Slide } from "@/types/db.helpers";
import type {
  ListMaterialsOptions,
  MaterialDetail,
  MaterialWithMeta,
} from "@/lib/data/materials.types";

export type {
  ListMaterialsOptions,
  MaterialDetail,
  MaterialListRow,
  MaterialWithMeta,
} from "@/lib/data/materials.types";

export function sha256Buffer(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function instructorOwnsClass(classId: string): Promise<boolean> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("created_by", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function listMaterials(
  classId: string,
  options: ListMaterialsOptions = {},
): Promise<MaterialWithMeta[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("materials")
    .select("*, slides(id, status, deleted_at)")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<
    Material & { slides?: Array<{ id: string; deleted_at: string | null }> }
  >;
  const labels = await versionLabels(rows);
  const visible = options.includeArchived
    ? rows
    : rows.filter((row) => !row.deleted_at);

  const mapped = visible.map((row) => ({
    ...row,
    archived: Boolean(row.deleted_at),
    slideCount: (row.slides ?? []).filter((slide) => !slide.deleted_at).length,
    versionLabel: labels.get(row.id) ?? "v1",
    warnings: [] as string[],
    uploaded_at: row.created_at,
  }));

  if (options.sort === "manual") {
    return mapped.sort((a, b) => {
      const left = a.list_order ?? Number.MAX_SAFE_INTEGER;
      const right = b.list_order ?? Number.MAX_SAFE_INTEGER;
      if (left !== right) return left - right;
      return b.created_at.localeCompare(a.created_at);
    });
  }

  return mapped.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function versionLabels(rows: Material[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  const byId = new Map(rows.map((row) => [row.id, row]));

  function depth(id: string, seen = new Set<string>()): number {
    if (seen.has(id)) return 1;
    seen.add(id);
    const row = byId.get(id);
    if (!row?.version_of) return 1;
    return 1 + depth(row.version_of, seen);
  }

  for (const row of rows) {
    labels.set(row.id, `v${depth(row.id)}`);
  }
  return labels;
}

export async function getMaterial(id: string): Promise<MaterialDetail> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("materials")
    .select("*, slides(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = requireValue(data as (Material & { slides?: Slide[] }) | null, "Material not found.");
  const slides = [...(row.slides ?? [])]
    .filter((slide) => !slide.deleted_at)
    .sort((a, b) => a.order - b.order);
  const versions = await listVersions(id);
  const labels = await versionLabels(versions);

  return {
    ...row,
    archived: Boolean(row.deleted_at),
    slideCount: slides.length,
    versionLabel: labels.get(row.id) ?? "v1",
    warnings: [],
    uploaded_at: row.created_at,
    slides,
    versions,
  };
}

export async function listVersions(materialId: string): Promise<Material[]> {
  const { supabase } = await requireUser();
  const { data: seed, error } = await supabase
    .from("materials")
    .select("*")
    .eq("id", materialId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!seed) return [];

  const { data: classMaterials, error: listError } = await supabase
    .from("materials")
    .select("*")
    .eq("class_id", (seed as Material).class_id);
  if (listError) throw new Error(listError.message);

  const all = (classMaterials ?? []) as Material[];
  const byId = new Map(all.map((row) => [row.id, row]));
  const children = new Map<string, Material[]>();
  for (const row of all) {
    if (!row.version_of) continue;
    const list = children.get(row.version_of) ?? [];
    list.push(row);
    children.set(row.version_of, list);
  }

  let root: Material = seed as Material;
  const seen = new Set<string>();
  while (root.version_of && byId.has(root.version_of) && !seen.has(root.id)) {
    seen.add(root.id);
    root = byId.get(root.version_of)!;
  }

  const chain: Material[] = [];
  const walk = (node: Material) => {
    chain.push(node);
    for (const child of children.get(node.id) ?? []) {
      walk(child);
    }
  };
  walk(root);
  return chain.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function findCurrentDuplicate(classId: string, sha256: string): Promise<Material | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("materials")
    .select("*")
    .eq("class_id", classId)
    .eq("sha256", sha256)
    .eq("is_current", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Material | null) ?? null;
}

export async function createMaterialFromUpload(input: {
  classId: string;
  conceptId?: string | null;
  filename: string;
  bytes: Buffer;
  mime?: string;
  forceVersion?: boolean;
  uploadedBy: string;
}): Promise<
  | { duplicate: true; existing_id: string }
  | { material_id: string; slide_count: number; warnings: string[] }
> {
  const sha256 = sha256Buffer(input.bytes);
  const existing = await findCurrentDuplicate(input.classId, sha256);
  if (existing && !input.forceVersion) {
    return { duplicate: true, existing_id: existing.id };
  }

  const parsed = await parseMaterial(input.bytes, input.filename, input.mime);
  const type = materialTypeFromFilename(input.filename);
  const { path } = await uploadOriginalImmutable({
    classId: input.classId,
    sha256,
    filename: input.filename,
    bytes: input.bytes,
    contentType: input.mime,
  });

  const admin = createAdminClient();
  if (existing && input.forceVersion) {
    await admin.from("materials").update({ is_current: false }).eq("id", existing.id);
  }

  const { count } = await admin
    .from("materials")
    .select("id", { count: "exact", head: true })
    .eq("class_id", input.classId);

  const { data: material, error } = await admin
    .from("materials")
    .insert({
      class_id: input.classId,
      concept_id: input.conceptId || null,
      type,
      original_filename: input.filename,
      storage_path: path,
      sha256,
      uploaded_by: input.uploadedBy,
      version_of: existing?.id ?? null,
      is_current: true,
      byte_size: input.bytes.byteLength,
      list_order: (count ?? 0) + 1,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  if (parsed.slides.length) {
    const { error: slideError } = await admin.from("slides").insert(
      parsed.slides.map((slide) => ({
        material_id: material.id,
        order: slide.order,
        title: slide.title,
        body: slide.body,
        cue: slide.cue,
        speaker_note: slide.speaker_note,
        layout: "point",
        status: "draft",
      })),
    );
    if (slideError) throw new Error(slideError.message);
  }

  return {
    material_id: material.id,
    slide_count: parsed.slides.length,
    warnings: (parsed.metadata.warnings as string[]) ?? [],
  };
}

export async function updateSlide(
  slideId: string,
  patch: Partial<Pick<Slide, "title" | "body" | "cue" | "speaker_note" | "layout" | "image_prompt" | "status">>,
): Promise<Slide> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("slides")
    .update(patch)
    .eq("id", slideId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Slide;
}

export async function reorderSlides(materialId: string, orderedIds: string[]): Promise<void> {
  const { supabase } = await requireUser();
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("slides").update({ order: index + 1 }).eq("id", id).eq("material_id", materialId),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);
}

export async function approveAllSlides(materialId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("slides")
    .update({ status: "approved" })
    .eq("material_id", materialId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
}

export async function renameMaterial(id: string, filename: string): Promise<Material> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("materials")
    .update({ original_filename: filename.trim() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Material;
}

export async function setCurrentVersion(id: string): Promise<void> {
  const versions = await listVersions(id);
  if (versions.length === 0) return;
  const admin = createAdminClient();
  const ids = versions.map((row) => row.id);
  const { error: clearError } = await admin
    .from("materials")
    .update({ is_current: false })
    .in("id", ids);
  if (clearError) throw new Error(clearError.message);
  const { error } = await admin.from("materials").update({ is_current: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reorderMaterials(classId: string, orderedIds: string[]): Promise<void> {
  const { supabase } = await requireUser();
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("materials").update({ list_order: index + 1 }).eq("id", id).eq("class_id", classId),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);
}

export async function reextractMaterial(id: string): Promise<{ slide_count: number; warnings: string[] }> {
  const detail = await getMaterial(id);
  const bytes = await downloadOriginal(detail.storage_path);
  const parsed = await parseMaterial(bytes, detail.original_filename);
  const admin = createAdminClient();
  await admin.from("slides").update({ deleted_at: new Date().toISOString() }).eq("material_id", id);
  if (parsed.slides.length) {
    const { error } = await admin.from("slides").insert(
      parsed.slides.map((slide) => ({
        material_id: id,
        order: slide.order,
        title: slide.title,
        body: slide.body,
        cue: slide.cue,
        speaker_note: slide.speaker_note,
        layout: "point",
        status: "draft",
      })),
    );
    if (error) throw new Error(error.message);
  }
  return {
    slide_count: parsed.slides.length,
    warnings: (parsed.metadata.warnings as string[]) ?? [],
  };
}

export async function softDeleteMaterial(id: string): Promise<Material> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("materials")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Material;
}

export async function restoreMaterial(id: string): Promise<Material> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("materials")
    .update({ deleted_at: null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Material;
}

export async function getSignedOriginal(id: string): Promise<string> {
  const detail = await getMaterial(id);
  return signedOriginalUrl(detail.storage_path);
}

export function canonicalPath(classId: string, sha256: string, filename: string) {
  return originalStoragePath(classId, sha256, filename);
}
