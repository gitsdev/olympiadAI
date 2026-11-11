// Private Storage access for question papers. Service role only: the bucket
// has no user policies, so every path here is chosen by the server and
// handed to the browser only as a short-lived signed URL.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "question-papers";
const DOWNLOAD_URL_TTL_SECONDS = 300;

export const paths = {
  folder: (userId: string, jobId: string) => `${userId}/${jobId}`,
  source: (userId: string, jobId: string, ext: string) => `${userId}/${jobId}/source.${ext}`,
  image: (userId: string, jobId: string, id: string, ext: string) => `${userId}/${jobId}/images/${id}.${ext}`,
  export: (userId: string, jobId: string, version: number, ext: "pdf" | "docx") => `${userId}/${jobId}/exports/answers-v${version}.${ext}`,
};

export async function createUploadUrl(db: SupabaseClient, path: string): Promise<{ signedUrl: string; token: string }> {
  // upsert: a retried (interrupted) upload replaces the partial object.
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data) throw new Error(`Could not create upload URL: ${error?.message ?? "unknown"}`);
  return { signedUrl: data.signedUrl, token: data.token };
}

export async function downloadBytes(db: SupabaseClient, path: string): Promise<Uint8Array> {
  const { data, error } = await db.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`Could not download ${path}: ${error?.message ?? "not found"}`);
  return new Uint8Array(await data.arrayBuffer());
}

/** Size of an uploaded object, or null if it doesn't exist. */
export async function objectSize(db: SupabaseClient, userId: string, jobId: string, fileName: string): Promise<number | null> {
  const { data, error } = await db.storage.from(BUCKET).list(paths.folder(userId, jobId), { search: fileName, limit: 10 });
  if (error) throw new Error(`Could not check upload: ${error.message}`);
  const obj = data?.find((o) => o.name === fileName);
  if (!obj) return null;
  const size = (obj.metadata as { size?: number } | null)?.size;
  return typeof size === "number" ? size : 0;
}

export async function uploadBytes(db: SupabaseClient, path: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Could not store ${path}: ${error.message}`);
}

export async function signedDownloadUrl(db: SupabaseClient, path: string, downloadName: string): Promise<string> {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, DOWNLOAD_URL_TTL_SECONDS, { download: downloadName });
  if (error || !data) throw new Error(`Could not create download link: ${error?.message ?? "unknown"}`);
  return data.signedUrl;
}

/** Deletes every object under the job's folder (source, images, exports). */
export async function removeJobFiles(db: SupabaseClient, userId: string, jobId: string): Promise<void> {
  const root = paths.folder(userId, jobId);
  const toRemove: string[] = [];
  for (const dir of [root, `${root}/images`, `${root}/exports`]) {
    const { data } = await db.storage.from(BUCKET).list(dir, { limit: 1000 });
    for (const o of data ?? []) {
      // Folders come back with id === null.
      if (o.id) toRemove.push(`${dir}/${o.name}`);
    }
  }
  if (toRemove.length) {
    const { error } = await db.storage.from(BUCKET).remove(toRemove);
    if (error) throw new Error(`Could not delete files: ${error.message}`);
  }
}

/** Deletes only the uploaded source and extracted images (retention). */
export async function removeSourceFiles(db: SupabaseClient, userId: string, jobId: string): Promise<void> {
  const root = paths.folder(userId, jobId);
  const toRemove: string[] = [];
  for (const dir of [root, `${root}/images`]) {
    const { data } = await db.storage.from(BUCKET).list(dir, { limit: 1000 });
    for (const o of data ?? []) if (o.id) toRemove.push(`${dir}/${o.name}`);
  }
  if (toRemove.length) await db.storage.from(BUCKET).remove(toRemove);
}
