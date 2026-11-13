import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles.css';
import App from './App';
import AdminApp from './admin/AdminApp';
import RoleSitemap from './roles/RoleSitemap';
import SupportApp from './support/SupportApp';
import LandingPage from './public/LandingPage';
import LoginPage from './public/LoginPage';

function PreviewRouter() {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const update = () => setHash(location.hash);
    addEventListener('hashchange', update);
    return () => removeEventListener('hashchange', update);
  }, []);
  const path = hash.split('?')[0];
  useEffect(() => { if (path.startsWith('#/')) window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [path]);
  if (path === '#/login') return <LoginPage />;
  if (path === '#/sitemap') return <RoleSitemap />;
  if (hash === '#/support' || hash.startsWith('#/support/')) return <SupportApp />;
  if (path === '#/admin' || path.startsWith('#/admin/')) return <AdminApp />;
  if (path.startsWith('#/app/')) return <App />;
  return <LandingPage />;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreviewRouter />
  </React.StrictMode>,
);
