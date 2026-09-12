import { createAdminClient } from "@/lib/supabase/admin";

export function originalStoragePath(classId: string, sha256: string, filename: string): string {
  const ext = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() ?? "bin" : "bin";
  return `classes/${classId}/originals/${sha256}.${ext}`;
}

export async function uploadOriginalImmutable(params: {
  classId: string;
  sha256: string;
  filename: string;
  bytes: Buffer;
  contentType?: string;
}): Promise<{ path: string; reused: boolean }> {
  const admin = createAdminClient();
  const path = originalStoragePath(params.classId, params.sha256, params.filename);

  const { data: existing } = await admin.storage.from("materials").list(
    `classes/${params.classId}/originals`,
    { search: `${params.sha256}` },
  );
  if (existing?.some((item) => item.name.startsWith(params.sha256))) {
    return { path, reused: true };
  }

  const { error } = await admin.storage.from("materials").upload(path, params.bytes, {
    contentType: params.contentType,
    upsert: false,
  });

  if (error && !/already exists|Duplicate/i.test(error.message)) {
    throw new Error(error.message);
  }

  return { path, reused: Boolean(error) };
}

export async function signedOriginalUrl(storagePath: string, expiresIn = 60 * 10) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("materials")
    .createSignedUrl(storagePath, expiresIn);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Unable to sign original URL");
  }
  return data.signedUrl;
}

export async function downloadOriginal(storagePath: string): Promise<Buffer> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("materials").download(storagePath);
  if (error || !data) {
    throw new Error(error?.message ?? "Unable to download original");
  }
  const bytes = await data.arrayBuffer();
  return Buffer.from(bytes);
}
