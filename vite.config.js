import { defineConfig } from 'vite'
// React apps: uncomment the next line and the plugins entry below.
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Project sites are served from https://<owner>.github.io/<repo>/
  // Use '/' only when the repo is named <owner>.github.io
  base: '/mileage-tracker/',
  plugins: [react()],
})
