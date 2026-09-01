import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite Dev Server config with Base Path and API proxying to FastAPI backend on port 8000
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
