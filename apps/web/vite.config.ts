import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig(({mode}) => ({
 plugins: [react()],
 publicDir: mode === 'prerender' ? false : 'public',
 server: { port: 5173 },
 build: { rollupOptions: mode === 'prerender' ? { output: {entryFileNames:'render.mjs'} } : { input: { main: fileURLToPath(new URL('./index.html', import.meta.url)), analytics: fileURLToPath(new URL('./analytics-frame.html', import.meta.url)) } } },
}));
