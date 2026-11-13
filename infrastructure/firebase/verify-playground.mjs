import { readdir, readFile, lstat } from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
const config = JSON.parse(await readFile(new URL('apps/playground/firebase.json', root), 'utf8'));
const hosting = config.hosting;
if (Object.keys(config).join() !== 'hosting' || hosting.site !== 'boxvault-playground-argee-2026' || hosting.public !== 'dist-public') throw Error('Unexpected Playground Hosting target');
if (hosting.rewrites || hosting.redirects || hosting.frameworksBackend) throw Error('Hosted Playground must not proxy any backend');
const csp = hosting.headers.flatMap(rule => rule.headers).find(header => header.key === 'Content-Security-Policy')?.value;
if (!csp?.includes("connect-src 'none'") || !csp.includes("script-src 'self'")) throw Error('Playground must prohibit backend connections and external scripts');
let total = 0;
const files = [];
async function walk(path = '') {
 for (const name of await readdir(new URL('apps/playground/dist-public/' + path, root))) {
  const relative = path + name;
  const url = new URL('apps/playground/dist-public/' + relative, root);
  const info = await lstat(url);
  if (info.isSymbolicLink()) throw Error('Symlink in public Playground');
  if (info.isDirectory()) { if (!['assets', 'qr', 'ui'].includes(relative)) throw Error('Unexpected Playground directory: ' + relative); await walk(relative + '/'); continue; }
  if (!info.isFile() || !(/^(index\.html|404\.html|robots\.txt|licenses\.txt|qr\/index\.html|ui\/index\.html)$/.test(relative) || /^assets\/[a-zA-Z0-9_-]+\.(js|css|svg|png|webp)$/.test(relative))) throw Error('Unexpected Playground file: ' + relative);
  const content = await readFile(url, 'utf8');
  if (/PRIVATE KEY|postgres(?:ql)?:\/\/|DATABASE_URL\s*=|127\.0\.0\.1|localhost|__playground\/health|\/api\/v1\/|href=["']\/backend\//i.test(content)) throw Error('Private/local backend artifact in public Playground: ' + relative);
  if (info.size > 1024 * 1024) throw Error('Oversized Playground asset');
  total += info.size; files.push(relative);
 }
}
await walk();
for (const entry of ['index.html', 'qr/index.html', 'ui/index.html', '404.html', 'robots.txt']) if (!files.includes(entry)) throw Error('Missing Playground entry: ' + entry);
if (total > 2 * 1024 * 1024) throw Error('Playground exceeds its 2 MiB artifact budget');
const catalog = await readFile(new URL('apps/playground/dist-public/index.html', root), 'utf8');
if (!catalog.includes('PUBLIC MOCK PLAYGROUND') || catalog.includes('Never deploy publicly') || catalog.includes('LOCAL DEVELOPMENT ONLY')) throw Error('Incorrect public catalog mode');
console.log('Verified public Playground:', files.length, 'files,', total, 'bytes. Local backend tester excluded.');
