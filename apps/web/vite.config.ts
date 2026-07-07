import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The API runs on :3001 with CORS enabled for APP_URL, so the web app talks to
// it directly (no dev proxy). SSE (EventSource / fetch streams) works cross-origin.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5273,
    strictPort: true,
  },
});
