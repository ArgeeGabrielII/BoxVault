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

export default defineConfig(({ mode }) => {
  const publicPreview = mode === 'public-preview';
  const publicCatalog: Plugin = {
    name: 'boxvault-public-playground-catalog',
    transformIndexHtml(html) {
      if (!publicPreview) return html;
      return html
        .replace(/<a class="card" href="\/backend\/">[\s\S]*?<\/a>/, '')
        .replace('LOCAL DEVELOPMENT ONLY', 'PUBLIC MOCK PLAYGROUND')
        .replace('VaultBox Developer Playground', 'BoxVault Developer Playground')
        .replace('Vault<b>Box</b>', 'Box<b>Vault</b>')
        .replace('A dedicated local development environment for BoxVault mockups and safe real-backend checks. No production credentials, private customer records or payment flows. The core web and API applications remain unchanged.', 'A browser-based collection of BoxVault mockups and developer tools. Explore fictional UI, generate test QR codes, and browse the role sitemap. No live backend, credentials or private customer records.')
        .replace('VaultBox Developer Playground · Mock UI + local-only backend verification · Never deploy publicly', 'BoxVault Developer Playground · Public mock tools only · Local backend tester is excluded')
        .replace('</section>', '<a class="card" href="https://boxvault-argee-2026.web.app/#/sitemap"><span class="mark">⌘</span><h2>All Role Sitemaps</h2><p>Explore customer, platform, System Support and developer screen maps, with mock and planned states clearly marked.</p><strong>Explore the role map →</strong></a><a class="card" href="https://boxvault-argee-2026.web.app/#/login"><span class="mark">↗</span><h2>Role-based UI Previews</h2><p>Use a demo username and a blank password to open the customer, admin or support console.</p><strong>Open demo login →</strong></a></section>');
    },
  };
  return {
  plugins: [react(), localBackendHealth(), publicCatalog],
  server: { port: 5174, host: '127.0.0.1', strictPort: true },
  build: {
    outDir: publicPreview ? 'dist-public' : 'dist',
    rollupOptions: {
      input: {
        playground: fileURLToPath(new URL('./index.html', import.meta.url)),
        qr: fileURLToPath(new URL('./qr/index.html', import.meta.url)),
        ui: fileURLToPath(new URL('./ui/index.html', import.meta.url)),
        ...(publicPreview ? {} : { backend: fileURLToPath(new URL('./backend/index.html', import.meta.url)) }),
      },
    },
  },
  };
});
