import { hostedFetch } from './waf-api.ts';
// Access credentials live only in memory; browser refresh uses HttpOnly cookie.
let access = '';
let expiresAt = 0;
let renewing: Promise<boolean> | null = null;
export function clearSession() { access = ''; expiresAt=0; window.dispatchEvent(new Event('boxvault-session-ended')); }
export function rememberSession(value: string, seconds=600) { access=value; expiresAt=Date.now()+seconds*1000; }
export class ApiError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status=status; } }
export async function refreshSession() {
 if (!renewing) renewing = (async () => {
  try { const r = await hostedFetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: '{}' }); if (!r.ok) return false; const session=await r.json(); rememberSession(session.accessToken, session.accessExpiresIn ?? 600); return true; }
  catch { return false; }
 })().finally(() => { renewing = null; });
 return renewing;
}
export async function api<T = any>(path: string, method = 'GET', body?: unknown, auth = true): Promise<T> {
 if(auth && access && Date.now()>expiresAt-15000 && !await refreshSession()) { clearSession(); throw new ApiError('Please sign in again.',401); }
 async function send() { return hostedFetch('/api/v1' + path, { method, credentials: 'same-origin', cache: 'no-store', headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(auth && access ? { authorization: 'Bearer ' + access } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); }
 const sessionRoute = auth && !['/auth/mfa/','/auth/providers/','/auth/step-up'].some(prefix=>path.startsWith(prefix));
 let r: Response;
 try { r = await send(); if (sessionRoute && r.status === 401 && await refreshSession()) r = await send(); }
 catch { throw new ApiError(import.meta.env?.MODE === 'aws' ? 'Your workspace is temporarily unavailable. Please try again.' : 'The local API is unavailable. Check that BoxVault is running.', 0); }
 const data = await r.json().catch(() => ({}));
 if (!r.ok) { if (r.headers.get('x-amzn-waf-action')) throw new ApiError('Complete the security check, then try again.',r.status); if (sessionRoute && r.status === 401) clearSession(); const message = data.error?.message ?? data.message; throw new ApiError(typeof message === 'string' ? message : 'The request could not be completed.', r.status); }
 return data as T;
}
export async function localRequest(path: string, body?: unknown) {
 if (import.meta.env?.MODE === 'aws') throw new ApiError('Development services are unavailable.',404);
 const r = await fetch('/__local/' + path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: { ...(body ? { 'content-type': 'application/json', authorization: 'Bearer ' + access } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
 const data = await r.json(); if (!r.ok) throw new ApiError(data.message ?? 'Local service unavailable.', r.status); return data;
}
