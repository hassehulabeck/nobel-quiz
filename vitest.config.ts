import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    // Mirrors tsconfig.json's "@/*" -> "./src/*" path mapping, which
    // Next.js resolves natively but Vitest needs told about explicitly.
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
});
