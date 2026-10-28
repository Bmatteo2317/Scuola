import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  experimental: {
    serverActions: {
      // Il limite delle funzioni Vercel e' 4,5 MB per richiesta: teniamo 8 MB
      // lato Next per poter mostrare un messaggio d'errore comprensibile.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
