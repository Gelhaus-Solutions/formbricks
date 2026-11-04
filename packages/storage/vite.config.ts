/// <reference types="vitest" />
import { builtinModules } from "node:module";
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "formbricksStorage",
      fileName: "index",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      // The local backend uses node:fs, node:crypto and node:stream; they stay imports, never browser shims.
      external: [
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
        "@aws-sdk/client-s3",
        "@aws-sdk/lib-storage",
        "@aws-sdk/s3-presigned-post",
        "@aws-sdk/s3-request-presigner",
        "@formbricks/logger",
      ],
    },
  },
  test: {
    environment: "node",
    globals: true,
    coverage: {
      reporter: ["text", "json", "html", "lcov"],
      exclude: ["src/types/**"],
      include: ["src/**/*.ts"],
    },
  },
});
