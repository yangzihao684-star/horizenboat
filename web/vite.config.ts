import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Static export only: no server runtime, deployable to Cloudflare Pages / GitHub Pages / any CDN.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    target: "es2020",
    outDir: "dist",
    assetsDir: "assets",
  },
});
