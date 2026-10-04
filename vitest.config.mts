import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` throws outside the React Server bundle; it is a build-time guard, so stub it in tests.
      "server-only": path.resolve(import.meta.dirname, "test/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", "supabase/**"],
    setupFiles: ["test/setup.ts"],
    restoreMocks: true,
  },
});
