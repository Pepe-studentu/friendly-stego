import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Dev: the Vue app runs on 5173 and proxies /api to the Express server on 3001,
// so the client only ever talks to a relative /api path.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_TARGET || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
