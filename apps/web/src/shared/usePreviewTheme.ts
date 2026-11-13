import { useEffect, useState } from 'react';
export function usePreviewTheme() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => { try { const value = localStorage.getItem('boxvault-theme'); return value === 'light' || value === 'dark' ? value : 'system'; } catch { return 'system'; } });
  const [systemDark, setSystemDark] = useState(() => typeof window !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  useEffect(() => { const media = matchMedia('(prefers-color-scheme: dark)'); const change = (event: MediaQueryListEvent) => setSystemDark(event.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; document.documentElement.style.colorScheme = dark ? 'dark' : 'light'; try { localStorage.setItem('boxvault-theme', theme); } catch { /* Optional preference. */ } }, [theme, dark]);
  return { theme, setTheme, dark };
}
