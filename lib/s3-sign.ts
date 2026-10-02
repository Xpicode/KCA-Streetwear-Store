/**
 * AWS Signature Version 4 for one S3-style request. Cloudflare R2 speaks the S3 API, and
 * a signed PUT / DELETE is all the app needs, so this replaces a whole SDK.
 * Pure (no env, no network) so it can be tested against AWS's published example.
 */
import { createHash, createHmac } from "node:crypto";

const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();

export type S3Credentials = { accessKeyId: string; secretAccessKey: string; region: string };

/** Returns the headers to send with the request (everything given, plus the date, body hash and Authorization). */
export function signS3(
  method: string,
  url: URL,
  headers: Record<string, string>,
  body: Uint8Array | null,
  creds: S3Credentials,
  now = new Date()
): Record<string, string> {
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, ""); // 20130524T000000Z
  const day = amzDate.slice(0, 8);
  const bodyHash = sha256(body ?? "");

  const signed: Record<string, string> = { host: url.host, "x-amz-content-sha256": bodyHash, "x-amz-date": amzDate };
  for (const [k, v] of Object.entries(headers)) signed[k.toLowerCase()] = v.trim();
  const names = Object.keys(signed).sort();

  // ponytail: no query string and no path re-encoding — object keys here are slugs. Add both if that changes.
  const canonical = [method, url.pathname, "", names.map((n) => `${n}:${signed[n]}\n`).join(""), names.join(";"), bodyHash].join("\n");
  const scope = `${day}/${creds.region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const key = ["s3", "aws4_request"].reduce((k, part) => hmac(k, part), hmac(hmac(`AWS4${creds.secretAccessKey}`, day), creds.region));
  const signature = createHmac("sha256", key).update(toSign).digest("hex");

  const { host: _host, ...send } = signed; // fetch sets Host itself
  return { ...send, Authorization: `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope},SignedHeaders=${names.join(";")},Signature=${signature}` };
}
