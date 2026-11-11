import { useEffect, useState } from 'react';
import logo from '@boxvault/assets/logo.svg';

type Health = { status: string; service: string };
const api = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export default function App() {
  const [health, setHealth] = useState('Checking API…');

  useEffect(() => {
    const controller = new AbortController();
    fetch(api + '/health', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('API unavailable');
        return response.json() as Promise<Health>;
      })
      .then((data) => setHealth(data.status === 'ok' ? 'API online' : 'API unavailable'))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setHealth('API unavailable — run pnpm dev:api');
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="container py-5">
      <header className="d-flex align-items-center gap-3 mb-5">
        <img src={logo} alt="BoxVault" width={60} height={60} />
        <div>
          <h1 className="mb-0">BoxVault</h1>
          <span className="text-secondary">Smart QR & NFC storage organization</span>
        </div>
      </header>
      <div className="card shadow-sm p-4">
        <span className="text-uppercase small text-secondary">Development starter</span>
        <h2 className="h4 mt-2">Your multi-app workspace is ready.</h2>
        <p className="mb-2">Next: authentication, tenant authorization, containers, inventory, and manual credits.</p>
        <span className="badge text-bg-secondary align-self-start">{health}</span>
      </div>
      <p className="text-secondary mt-4 small">Web purchases only. The iOS companion app will not contain payment flows.</p>
    </main>
  );
}
