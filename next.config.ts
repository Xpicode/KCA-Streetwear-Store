import type { NextConfig } from "next";

/** Sent with every response. The Content-Security-Policy is set per request in proxy.ts (it needs a nonce). */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // browsers only honour this over https; harmless on plain http during setup
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // product photo uploads go through a server action as multipart form data
      bodySizeLimit: "8mb",
    },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
