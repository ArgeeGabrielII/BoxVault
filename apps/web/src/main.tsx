import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles.css';
import App from './App';
import AdminApp from './admin/AdminApp';

function PreviewRouter() {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const update = () => setHash(location.hash);
    addEventListener('hashchange', update);
    return () => removeEventListener('hashchange', update);
  }, []);
  return hash === '#/admin' || hash.startsWith('#/admin/') ? <AdminApp /> : <App />;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreviewRouter />
  </React.StrictMode>,
);
