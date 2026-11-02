import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Static export only: no server runtime, deployable to Cloudflare Pages / GitHub Pages / any CDN.
export default defineConfig({
  // 绝对 base：index.html 里引用 /assets/*，这样 /任意/路径 回落到 index.html 时
  // 资源仍从站点根加载。用相对 base 的话，/work/xxx 这类路径会把 ./assets 解析成
  // /work/assets，拿到的是 HTML 而不是 JS，页面直接白屏。
  base: "/",
  plugins: [react(), tailwindcss()],
  build: {
    target: "es2020",
    outDir: "dist",
    assetsDir: "assets",
  },
});
