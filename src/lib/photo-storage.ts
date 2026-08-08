import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

/**
 * Two backends behind one interface.
 *
 * Vercel's filesystem is ephemeral — anything written during a request is gone
 * on the next cold start — so in production photos go to Supabase Storage. When
 * those variables are absent (local development) it falls back to
 * /public/uploads, which keeps `npm run dev` working with no cloud setup.
 */

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "product-photos";
const LOCAL_DIR = path.join(process.cwd(), "public", "uploads");
const LOCAL_PREFIX = "/uploads/";

export function usingSupabaseStorage(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function storageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // The service-role key bypasses row-level security, so it is read only on the
  // server and must never be exposed to the browser.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase storage is not configured.");

  return createClient(url, key, { auth: { persistSession: false } });
}

export async function storePhoto(
  filename: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  if (!usingSupabaseStorage()) {
    await mkdir(LOCAL_DIR, { recursive: true });
    await writeFile(path.join(LOCAL_DIR, filename), bytes);
    return `${LOCAL_PREFIX}${filename}`;
  }

  const supabase = storageClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, bytes, { contentType, upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

/**
 * Removes a previously stored photo. Anything that is not ours is ignored — the
 * column could hold an arbitrary URL, and a stray value must never turn into a
 * filesystem or bucket delete of something unrelated.
 */
export async function deletePhoto(photoUrl: string | null): Promise<void> {
  if (!photoUrl) return;

  if (photoUrl.startsWith(LOCAL_PREFIX)) {
    const filename = path.basename(photoUrl.slice(LOCAL_PREFIX.length));
    if (!filename || filename === "." || filename === "..") return;

    const target = path.join(LOCAL_DIR, filename);
    if (path.dirname(target) !== LOCAL_DIR) return;

    await unlink(target).catch(() => {});
    return;
  }

  if (!usingSupabaseStorage()) return;

  // Public URLs look like .../storage/v1/object/public/<bucket>/<file>
  const marker = `/object/public/${BUCKET}/`;
  const index = photoUrl.indexOf(marker);
  if (index === -1) return;

  const key = decodeURIComponent(photoUrl.slice(index + marker.length));
  if (!key || key.includes("..")) return;

  await storageClient()
    .storage.from(BUCKET)
    .remove([key])
    .catch(() => {
      // Already gone, or never written — not worth failing the request over.
    });
}
