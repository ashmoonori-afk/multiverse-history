import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(import.meta.dirname, "../../web"),
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5273,
    proxy: { "/api": "http://127.0.0.1:3100" },
  },
});
