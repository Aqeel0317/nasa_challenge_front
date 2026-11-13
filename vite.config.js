import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development, /api/* is forwarded to FastAPI on port 8000,
// so the browser sees one origin and no CORS setup is needed locally.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8000" },
  },
  // `npm run preview` can talk to any API: API_PROXY=https://... npm run preview
  preview: {
    proxy: { "/api": { target: process.env.API_PROXY || "http://localhost:8000", changeOrigin: true } },
  },
});
