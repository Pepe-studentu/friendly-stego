import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// The app is fully static (steganography runs in the browser), so there is no
// API to proxy — `npm run build` produces a folder any static host can serve.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    host: true, // expose on the local network so a phone on the same Wi-Fi can connect
  },
});
