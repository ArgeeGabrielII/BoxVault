import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * A narrowly scoped local-only bridge for health checks.
 * No arbitrary URL proxy, credentials, cookies, writes, or customer content.
 */
function localBackendHealth(): Plugin {
  return {
    name: 'vaultbox-local-backend-health',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__playground/health', async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.setHeader('Allow', 'GET');
          res.end(JSON.stringify({ status: 'unavailable', message: 'GET only' }));
          return;
        }

        const rawPort = process.env.BOXVAULT_LOCAL_API_PORT ?? '3000';
        const port = Number(rawPort);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          res.statusCode = 503;
          res.end(JSON.stringify({ status: 'unavailable', message: 'Invalid local API port configuration' }));
          return;
        }

        try {
          // Fixed loopback address and endpoint; no redirects, SSRF or user-provided target.
          const response = await fetch('http://127.0.0.1:' + port + '/api/v1/health', {
            method: 'GET',
            redirect: 'manual',
            signal: AbortSignal.timeout(5000),
            headers: { Accept: 'application/json' },
          });
          if (!response.ok) throw new Error('API returned HTTP ' + response.status);
          const payload: unknown = await response.json();
          if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid health response');
          const data = payload as Record<string, unknown>;
          // Whitelist only expected non-sensitive health fields, discarding everything else.
          const safe = {
            status: data.status === 'ok' ? 'ok' : 'unexpected',
            service: typeof data.service === 'string' ? data.service.slice(0, 80) : undefined,
            timestamp: typeof data.timestamp === 'string' ? data.timestamp.slice(0, 80) : undefined,
          };
          res.statusCode = 200;
          res.end(JSON.stringify(safe));
        } catch {
          res.statusCode = 502;
          res.end(JSON.stringify({ status: 'unavailable', message: 'Local backend health endpoint unavailable.' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localBackendHealth()],
  server: { port: 5174, host: '127.0.0.1', strictPort: true },
  build: {
    rollupOptions: {
      input: {
        playground: fileURLToPath(new URL('./index.html', import.meta.url)),
        qr: fileURLToPath(new URL('./qr/index.html', import.meta.url)),
        ui: fileURLToPath(new URL('./ui/index.html', import.meta.url)),
        backend: fileURLToPath(new URL('./backend/index.html', import.meta.url)),
      },
    },
  },
});
