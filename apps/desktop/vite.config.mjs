import path from "node:path";
import { fileURLToPath } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const rendererRoot = path.resolve(currentDir, "src", "renderer");
const outputDir = path.resolve(currentDir, "..", "..", "dist", "apps", "desktop", "src", "renderer");

export default defineConfig({
  root: rendererRoot,
  base: "./",
  plugins: [vue()],
  build: {
    outDir: outputDir,
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll("\\", "/");

          if (normalizedId.includes("/node_modules/vue/") || normalizedId.includes("/node_modules/@vue/")) {
            return "vue-vendor";
          }

          if (normalizedId.includes("/node_modules/")) {
            return "vendor";
          }

          return undefined;
        }
      }
    }
  },
  resolve: {
    alias: {
      "@renderer": path.resolve(rendererRoot, "src")
    }
  }
});
