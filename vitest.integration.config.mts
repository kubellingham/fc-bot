import path from "node:path";
import { defineConfig } from "vitest/config";

// Integration tests run against the local Supabase stack (`pnpm db:start`).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "test/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
