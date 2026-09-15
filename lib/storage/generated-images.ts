import { createAdminClient } from "@/lib/supabase/admin";

export const GENERATED_IMAGES_BUCKET = "generated-images";

export function generatedImagePath(slideId: string, sha256: string) {
  return `${slideId}/${sha256}.png`;
}

export async function uploadGeneratedPng(params: {
  slideId: string;
  sha256: string;
  bytes: Buffer;
}) {
  const admin = createAdminClient();
  const path = generatedImagePath(params.slideId, params.sha256);
  const { error } = await admin.storage.from(GENERATED_IMAGES_BUCKET).upload(path, params.bytes, {
    contentType: "image/png",
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function signedGeneratedUrl(storagePath: string, expiresIn = 60 * 60 * 6) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(GENERATED_IMAGES_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Unable to sign generated image URL");
  }
  return data.signedUrl;
}
