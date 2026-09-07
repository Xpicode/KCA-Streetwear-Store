/**
 * Where product photos live.
 *
 *  - Supabase Storage when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set: a public bucket
 *    called "products", created automatically on first use. Required on Vercel, which has no
 *    persistent disk.
 *  - Otherwise the local disk: public/uploads/products, served by Next as static files.
 *
 * Talks to the Storage REST API directly — upload, delete and create-bucket are three
 * requests, so no SDK is needed. The service-role key never leaves the server.
 */
import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const BUCKET = "products";
const LOCAL_DIR = ["uploads", "products"] as const;
const LOCAL_PREFIX = `/${LOCAL_DIR.join("/")}/`;

type Supabase = { url: string; key: string };

function supabase(): Supabase | null {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return { url, key };
  if (process.env.VERCEL) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY — Vercel has no persistent disk for photo uploads.");
  }
  return null;
}

const headers = (sb: Supabase, extra: Record<string, string> = {}) => ({
  Authorization: `Bearer ${sb.key}`,
  apikey: sb.key,
  ...extra,
});

function upload(sb: Supabase, name: string, bytes: Uint8Array<ArrayBuffer>, contentType: string) {
  return fetch(`${sb.url}/storage/v1/object/${BUCKET}/${name}`, {
    method: "POST",
    headers: headers(sb, { "Content-Type": contentType, "x-upsert": "false" }),
    body: bytes,
  });
}

/** Create the public bucket; "already exists" is fine. */
async function ensureBucket(sb: Supabase) {
  const res = await fetch(`${sb.url}/storage/v1/bucket`, {
    method: "POST",
    headers: headers(sb, { "Content-Type": "application/json" }),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: 5 * 1024 * 1024 }),
  });
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    if (!/already exists/i.test(text)) throw new Error(`Could not create the "${BUCKET}" bucket (${res.status}): ${text}`);
  }
}

/** Stores the bytes under `name` and returns the public URL to save on the product. */
export async function saveProductImage(bytes: Uint8Array<ArrayBuffer>, name: string, contentType: string): Promise<string> {
  const sb = supabase();
  if (!sb) {
    const dir = path.join(process.cwd(), "public", ...LOCAL_DIR);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), bytes);
    return `${LOCAL_PREFIX}${name}`;
  }

  let res = await upload(sb, name, bytes, contentType);
  if (!res.ok) {
    const text = await res.text();
    if (!/bucket not found/i.test(text)) throw new Error(`Supabase Storage upload failed (${res.status}): ${text}`);
    await ensureBucket(sb);
    res = await upload(sb, name, bytes, contentType);
    if (!res.ok) throw new Error(`Supabase Storage upload failed (${res.status}): ${await res.text()}`);
  }
  return `${sb.url}/storage/v1/object/public/${BUCKET}/${name}`;
}

/** Best-effort delete of a photo this app stored (never a pasted external link). */
export async function deleteProductImage(url: string | null | undefined) {
  if (!url) return;
  try {
    if (url.startsWith(LOCAL_PREFIX)) {
      await unlink(path.join(process.cwd(), "public", ...LOCAL_DIR, path.basename(url)));
      return;
    }
    const sb = supabase();
    const publicPrefix = sb ? `${sb.url}/storage/v1/object/public/${BUCKET}/` : null;
    if (sb && publicPrefix && url.startsWith(publicPrefix)) {
      const name = url.slice(publicPrefix.length);
      await fetch(`${sb.url}/storage/v1/object/${BUCKET}/${name}`, { method: "DELETE", headers: headers(sb) });
    }
  } catch {
    // already gone or storage unreachable — the product no longer points at it, which is what matters
  }
}
