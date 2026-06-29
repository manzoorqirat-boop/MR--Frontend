import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server runs on 5173 to match the backend's CORS allow-list (see Program.cs).
// FILE RENAME FIX: original was named "viteconfig.js" — Vite only auto-detects
// "vite.config.js" (or .ts/.mjs/.cjs). The old file was silently ignored, so the
// React plugin and port setting were never applied.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  }
})
