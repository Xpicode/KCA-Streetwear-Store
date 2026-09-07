import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // product photo uploads go through a server action as multipart form data
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
