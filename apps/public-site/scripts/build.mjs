import { copyFile, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = join(root, 'static');
const destination = join(root, 'dist');
const expectedFiles = ['index.html', '404.html', 'styles.css', 'robots.txt'];
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
const entries = (await readdir(source)).sort();
if (entries.join('\n') !== [...expectedFiles].sort().join('\n')) {
  throw new Error('Public source files differ from approved allowlist: ' + entries.join(', '));
}
for (const file of expectedFiles) {
  const contents = await readFile(join(source, file));
  if (contents.length > 128 * 1024) throw new Error('Oversized public file: ' + file);
  await copyFile(join(source, file), join(destination, file));
}
const files = (await readdir(destination)).sort();
if (files.join('\n') !== [...expectedFiles].sort().join('\n')) throw new Error('Build output has unexpected files');
const total = (await Promise.all(files.map(async f => (await stat(join(destination, f))).size))).reduce((a, b) => a + b, 0);
if (total > 512 * 1024) throw new Error('Public site exceeds 512 KiB release cap');
const index = await readFile(join(destination, 'index.html'), 'utf8');
if (!index.includes('In development')) throw new Error('Missing public preview status notice');
for (const [name, value] of Object.entries({
  'private API reference': /localhost:3000|\/api\/v1\//i,
  'developer playground': /playground|localhost:5174/i,
  'development environment secret': /VITE_|DATABASE_URL|FIREBASE_SERVICE_ACCOUNT|PRIVATE_KEY/i,
  'external JavaScript': /<script\b/i,
})) {
  if (value.test(index)) throw new Error('Public page includes forbidden ' + name);
}
console.log('Approved public-site artifact:', files.join(', '), '(' + total + ' bytes)');
