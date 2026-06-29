import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server runs on 5173 to match the backend's CORS allow-list (see Program.cs).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  }
})
