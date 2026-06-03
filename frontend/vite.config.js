import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/thoughts': 'http://localhost:8000',
      '/chat': 'http://localhost:8000',
      '/graph': 'http://localhost:8000',
      '/analytics': 'http://localhost:8000',
      '/reminders': 'http://localhost:8000',
      '/videos': 'http://localhost:8000',
      '/get-videos': 'http://localhost:8000',
      '/save-video': 'http://localhost:8000',
      '/delete-video': 'http://localhost:8000',
      '/mood-timeline': 'http://localhost:8000',
      '/brain-summary': 'http://localhost:8000',
      '/analyze-text': 'http://localhost:8000',
      '/room': 'http://localhost:8000',
      '/categories': 'http://localhost:8000',
      '/transcribe': 'http://localhost:8000',
      '/search': 'http://localhost:8000',
      '/room/save-video': 'http://localhost:8000'
    }
  }
})