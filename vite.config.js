import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the build works from any folder or address
  base: './',
  // api/ calls go to the Node server in development, so LRS keys stay off the browser
  server: { proxy: { '/api': 'http://localhost:3030' } },
})
