import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
      vm: 'vm-browserify'
    },
  },
  define: {
    global: "globalThis",
  },
});