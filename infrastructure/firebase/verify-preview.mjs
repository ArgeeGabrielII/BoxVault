import { readFile, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../../', import.meta.url);
const read = async path => readFile(new URL(path, root), 'utf8');
const config = JSON.parse(await read('firebase.json'));
if (Object.keys(config).join() !== 'hosting') throw Error('Only Hosting may be deployed');
const hosting = config.hosting;
if (hosting.site !== 'boxvault-argee-2026' || hosting.public !== 'apps/web/dist') throw Error('Unexpected preview deployment target');
if (hosting.rewrites || hosting.redirects || hosting.frameworksBackend) throw Error('Backend routing is prohibited');
const csp = hosting.headers?.flatMap(rule => rule.headers).find(h => h.key === 'Content-Security-Policy')?.value;
if (!csp?.includes("connect-src 'none'") || !csp.includes("script-src 'self'")) throw Error('Preview must block backend connections and external scripts');
const app = await read('apps/web/src/App.tsx');
if (!app.includes('Sample data only')) throw Error('Preview must retain its sample-data notice');
async function verifySource(directory) {
 for (const entry of await readdir(new URL(directory, root), { withFileTypes: true })) {
  const path = directory + entry.name;
  if (entry.isDirectory()) await verifySource(path + '/');
  else if (/\.tsx?$/.test(entry.name) && /\b(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|\baxios\b|import\.meta\.env|\/api\/v1\//.test(await read(path))) throw Error('Backend integration is not allowed in the public mock: ' + path);
 }
}
await verifySource('apps/web/src/');
let total = 0;
const files = [];
async function walk(path = '') {
 for (const entry of await readdir(new URL('apps/web/dist/' + path, root))) {
  const relative = path + entry;
  const url = new URL('apps/web/dist/' + relative, root);
  const info = await lstat(url);
  if (info.isSymbolicLink()) throw Error('Symlink in deployment output');
  if (info.isDirectory()) {
   if (!['assets', 'icons', 'brand', 'social'].includes(relative)) throw Error('Unexpected deployment directory: ' + relative);
   await walk(relative + '/'); continue;
  }
  if (!info.isFile() || !(/^(index|login|privacy|terms|thank-you|404|analytics-frame)\.html$|^(robots\.txt|licenses\.txt|sitemap\.xml|site\.webmanifest|favicon\.ico)$/.test(relative) || /^(assets|icons|brand|social)\/[a-zA-Z0-9_-]+\.(js|css|svg|png|webp|ico)$/.test(relative))) throw Error('Unexpected deployment file: ' + relative);
  if (info.size > 1024 * 1024) throw Error('Oversized deployment file');
  const bytes = await readFile(url);
  if (/PRIVATE KEY|postgres(?:ql)?:\/\/|DATABASE_URL\s*=|localhost:3000|\/api\/v1\//i.test(bytes.toString())) throw Error('Private service reference in ' + relative);
  total += info.size; files.push(relative);
  console.log(relative, info.size + 'B', createHash('sha256').update(bytes).digest('hex'));
 }
}
await walk();
if (!files.includes('index.html') || !files.some(p => p.endsWith('.js')) || total > 2 * 1024 * 1024) throw Error('Missing or oversized preview build');
const titles = new Set(), descriptions = new Set();
for (const route of ['index', 'login', 'privacy', 'terms', 'thank-you', '404']) {
 const html = await read('apps/web/dist/' + route + '.html');
 const title = html.match(/<title>(.*?)<\/title>/)?.[1];
 const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
 if (!title || !description || titles.has(title) || descriptions.has(description)) throw Error('Missing or duplicate metadata: ' + route);
 titles.add(title); descriptions.add(description);
 if (!html.includes('rel="canonical"') || !html.includes('property="og:image"') || !html.includes('rel="icon"')) throw Error('Missing public SEO tags: ' + route);
 if (route !== 'index' && !html.includes('noindex, nofollow')) throw Error('Demo or draft page must be noindex: ' + route);
 if (!html.includes('<main') || !html.includes('<h1')) throw Error('Missing prerendered page content: ' + route);
 for (const match of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt="[^"]*"/.test(match[0])) throw Error('Missing image alternative: ' + route);
 for (const match of html.matchAll(/(?:src|href)="(\/(?:assets|icons|social|brand)\/[^"?#]+)"/g)) if (!files.includes(match[1].slice(1))) throw Error('Missing referenced asset: ' + match[1]);
}
const sitemap = await read('apps/web/dist/sitemap.xml');
for (const entry of sitemap.matchAll(/<loc>(.*?)<\/loc>/g)) { const url = new URL(entry[1]); if (url.origin !== 'https://boxvault-argee-2026.web.app' || !['/', '/privacy', '/terms'].includes(url.pathname) || url.search || url.hash) throw Error('Private or transactional sitemap entry'); }
if (!sitemap.includes('<loc>https://boxvault-argee-2026.web.app/</loc>')) throw Error('Missing canonical landing sitemap entry');
if (!files.includes('social/boxvault-og.png') || !files.includes('favicon.ico')) throw Error('Missing social image or favicon');
console.log('Verified mock website artifact:', files.length, 'files,', total, 'bytes; six unique prerendered pages.');
