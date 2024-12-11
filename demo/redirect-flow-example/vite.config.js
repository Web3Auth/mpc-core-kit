import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss],
    },
  },
  resolve: {
    alias: {
      stream: 'stream-browserify',
      crypto: 'crypto-browserify',
      path: 'path-browserify',
      os: 'os-browserify',
      https: 'https-browserify',
      http: 'stream-http',
      assert: 'assert',
      url: 'url',
      zlib: 'browserify-zlib',
    },
  },
  define: {
    global: "globalThis",
  },
});