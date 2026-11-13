import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const output = new URL('../dist/', import.meta.url);
const expected = ['404.html', 'index.html', 'robots.txt', 'styles.css'];
const found = (await readdir(output)).sort();
if (JSON.stringify(found) !== JSON.stringify(expected)) throw new Error('Forbidden or missing public artifact files');
let total = 0;
for (const name of found) {
  const path = new URL(name, output);
  const info = await stat(path);
  if (!info.isFile() || info.size > 128 * 1024) throw new Error('Unsafe public file: ' + name);
  total += info.size;
  const bytes = await readFile(path);
  const digest = createHash('sha256').update(bytes).digest('hex');
  const text = bytes.toString('utf8');
  if (/PRIVATE KEY|DATABASE_URL|FIREBASE_SERVICE_ACCOUNT|localhost:(3000|5174)|\/api\/v1\//i.test(text))
    throw new Error('Secret/private-API indicator in public artifact: ' + name);
  if (/<script\b/i.test(text)) throw new Error('JavaScript prohibited in public static artifact: ' + name);
  console.log(name, info.size + 'B', digest);
}
if (total > 512 * 1024) throw new Error('Public site exceeds 512 KiB');
const firebase = JSON.parse(await readFile(new URL('../../../firebase.json', import.meta.url), 'utf8'));
if (Object.keys(firebase).join(',') !== 'hosting') throw new Error('Hosting is the only allowed Firebase resource');
const hosting = firebase.hosting;
if (Array.isArray(hosting) || hosting.public !== 'apps/public-site/dist') throw new Error('Unexpected Firebase Hosting target');
if (hosting.rewrites || hosting.redirects || hosting.functions || hosting.frameworksBackend) throw new Error('Firebase compute/rewrites are not allowed');
console.log('Hosting-only artifact verified; total', total, 'bytes');
