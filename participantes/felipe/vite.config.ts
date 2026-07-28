import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
  },
  test: {
    pool: "threads",
    include: ["test/**/*.test.ts"],
  },
});
