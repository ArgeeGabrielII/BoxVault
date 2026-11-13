import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type HealthResult = {
  status: 'online' | 'unavailable' | 'unexpected';
  service?: string;
  backendTimestamp?: string;
  httpStatus: number;
  elapsedMs: number;
  checkedAt: string;
  message?: string;
};

function App() {
  const [result, setResult] = useState<HealthResult | null>(null);
  const [pending, setPending] = useState(false);

  async function checkHealth() {
    setPending(true);
    const started = performance.now();
    try {
      const response = await fetch('/__playground/health', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        signal: AbortSignal.timeout(8000),
      });
      const data: unknown = await response.json();
      const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      setResult({
        status: response.ok && record.status === 'ok' ? 'online' : response.ok ? 'unexpected' : 'unavailable',
        service: typeof record.service === 'string' ? record.service : undefined,
        backendTimestamp: typeof record.timestamp === 'string' ? record.timestamp : undefined,
        httpStatus: response.status,
        elapsedMs: Math.round(performance.now() - started),
        checkedAt: new Date().toLocaleString(),
        message: typeof record.message === 'string' ? record.message : undefined,
      });
    } catch (error) {
      setResult({
        status: 'unavailable',
        httpStatus: 0,
        elapsedMs: Math.round(performance.now() - started),
        checkedAt: new Date().toLocaleString(),
        message: error instanceof Error ? error.name === 'TimeoutError' ? 'Local API connection timed out.' : 'Cannot reach the Playground development bridge.' : 'Unable to test local API.',
      });
    } finally {
      setPending(false);
    }
  }

  return <div className="tester">
    <header><a className="back" href="/">← Developer Playground</a><span className="local-badge">LOCAL BACKEND · REAL REQUEST</span></header>
    <main>
      <div className="eyebrow">ENGINEERING / API TESTING</div>
      <h1>Local Backend Tester</h1>
      <p className="subtitle">Test your running NestJS API from the VaultBox Developer Playground without merging backend PR #4 or using mock responses.</p>
      <div className="notice"><strong>Local-only and read-only.</strong> The dev server calls <code>GET /api/v1/health</code> on <code>127.0.0.1:3000</code> by default. Only an allowlisted health endpoint is exposed by this first version. No login, tokens, writes, customer records or production infrastructure connections.</div>
      <div className="layout">
        <section className="panel">
          <div className="panel-top"><h2>API Health</h2><span className="method">GET</span></div>
          <div className="route">/api/v1/health</div>
          <p>Runs a live request against the backend already running on your machine.</p>
          <button onClick={checkHealth} disabled={pending}>{pending ? 'Checking local backend…' : 'Run health check'}</button>
          {result && <div className="response" role="status" aria-live="polite">
            <div className="response-top"><strong>{result.status === 'online' ? '✓ API online' : result.status === 'unexpected' ? '⚠ Unexpected response' : '✕ API unavailable'}</strong><span className={result.status === 'online' ? 'success' : 'failure'}>{result.httpStatus || 'Network error'}</span></div>
            <dl>
              <div><dt>Checked</dt><dd>{result.checkedAt}</dd></div>
              <div><dt>Round trip</dt><dd>{result.elapsedMs} ms</dd></div>
              {result.service && <div><dt>Service</dt><dd>{result.service}</dd></div>}
              {result.backendTimestamp && <div><dt>Server timestamp</dt><dd>{result.backendTimestamp}</dd></div>}
              {result.message && <div><dt>Details</dt><dd>{result.message}</dd></div>}
            </dl>
          </div>}
        </section>
        <aside className="panel guidance">
          <h2>How to use this tester</h2>
          <ol>
            <li>Start your BoxVault NestJS backend in a separate terminal using <code>pnpm dev:api</code>.</li>
            <li>Run the Developer Playground with <code>pnpm dev:playground</code>.</li>
            <li>Click <strong>Run health check</strong> to verify the actual API response.</li>
          </ol>
          <h3>Next API test modules</h3>
          <p>When backend features are approved, we can add guarded endpoint-specific test screens here, using synthetic fixtures, allowlisted routes, and explicit authorization. This tester is intentionally not an unrestricted API proxy.</p>
          <a href="/ui/">Explore the UI mock →</a>
        </aside>
      </div>
      <footer>VaultBox Developer Playground · Development mode only · No production backend connections</footer>
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
