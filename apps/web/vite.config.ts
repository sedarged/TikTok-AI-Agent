import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // Expose on all network interfaces (0.0.0.0)
    // Allow Codespaces and other hosts
    hmr: {
      clientPort: 443, // For Codespaces HTTPS
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/artifacts': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
