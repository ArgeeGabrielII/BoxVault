import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174, host: '127.0.0.1', strictPort: true },
  build: {
    rollupOptions: {
      input: {
        playground: fileURLToPath(new URL('./index.html', import.meta.url)),
        qr: fileURLToPath(new URL('./qr/index.html', import.meta.url)),
        ui: fileURLToPath(new URL('./ui/index.html', import.meta.url)),
      },
    },
  },
});
