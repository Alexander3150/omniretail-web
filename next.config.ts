import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera .next/standalone con un server.js minimo: la imagen Docker de produccion no necesita node_modules completo.
  output: "standalone",
};

export default nextConfig;
