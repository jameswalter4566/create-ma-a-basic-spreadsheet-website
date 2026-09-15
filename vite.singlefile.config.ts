import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Builds the entire app into a single self-contained index.html
// with all JS/CSS inlined (zero external asset requests).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "dist-singlefile",
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
});
