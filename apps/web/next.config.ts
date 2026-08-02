import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@tripplanner/ui",
    "@tripplanner/shared-types",
    "@tripplanner/shared-validation",
  ],
  // Racine du monorepo fixée explicitement : un package-lock.json hors du
  // dépôt (répertoire home de la machine) fait sinon dévier l'inférence
  // automatique de Next.js vers le mauvais répertoire.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
