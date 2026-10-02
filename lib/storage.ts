/**
 * Where product photos live.
 *
 *  - Cloudflare R2 when the five R2_* variables are set: uploaded with the S3 API, shown to
 *    buyers from the bucket's public address (R2_PUBLIC_URL). Required on Vercel, which has
 *    no persistent disk.
 *  - Otherwise the local disk: public/uploads/products, served by Next as static files.
 *
 * One signed PUT to store and one signed DELETE to remove (lib/s3-sign.ts), so no SDK is
 * needed. The R2 keys never leave the server.
 */
import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { signS3, type S3Credentials } from "@/lib/s3-sign";

const FOLDER = "products";
const LOCAL_DIR = ["uploads", FOLDER] as const;
const LOCAL_PREFIX = `/${LOCAL_DIR.join("/")}/`;

type R2 = { endpoint: string; publicUrl: string; creds: S3Credentials };

function r2(): R2 | null {
  const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: id, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET: bucket, R2_PUBLIC_URL: publicUrl } = process.env;
  if (account && id && secret && bucket && publicUrl) {
    return {
      endpoint: `https://${account}.r2.cloudflarestorage.com/${bucket}`,
      publicUrl: publicUrl.replace(/\/+$/, ""),
      creds: { accessKeyId: id, secretAccessKey: secret, region: "auto" },
    };
  }
  if (process.env.VERCEL) {
    throw new Error("Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_URL — Vercel has no persistent disk for photo uploads.");
  }
  return null;
}

/** Stores the bytes under `name` and returns the public URL to save on the product. */
export async function saveProductImage(bytes: Uint8Array<ArrayBuffer>, name: string, contentType: string): Promise<string> {
  const store = r2();
  if (!store) {
    const dir = path.join(process.cwd(), "public", ...LOCAL_DIR);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), bytes);
    return `${LOCAL_PREFIX}${name}`;
  }

  const url = new URL(`${store.endpoint}/${FOLDER}/${name}`);
  // names are unique (they carry a timestamp), so browsers may keep a photo for good
  const headers = signS3("PUT", url, { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" }, bytes, store.creds);
  const res = await fetch(url, { method: "PUT", headers, body: bytes });
  if (!res.ok) throw new Error(`R2 upload failed (${res.status}): ${await res.text()}`);
  return `${store.publicUrl}/${FOLDER}/${name}`;
}

/** Best-effort delete of a photo this app stored (never a pasted external link). */
export async function deleteProductImage(url: string | null | undefined) {
  if (!url) return;
  try {
    if (url.startsWith(LOCAL_PREFIX)) {
      await unlink(path.join(process.cwd(), "public", ...LOCAL_DIR, path.basename(url)));
      return;
    }
    const store = r2();
    if (store && url.startsWith(`${store.publicUrl}/${FOLDER}/`)) {
      const target = new URL(`${store.endpoint}/${FOLDER}/${path.posix.basename(url)}`);
      await fetch(target, { method: "DELETE", headers: signS3("DELETE", target, {}, null, store.creds) });
    }
  } catch {
    // already gone or storage unreachable — the product no longer points at it, which is what matters
  }
}
