import { cp, mkdir } from 'node:fs/promises';
const target = new URL('../public/', import.meta.url);
for (const name of ['icons','social']) { await mkdir(new URL(name, target), {recursive:true}); await cp(new URL('../../../packages/assets/generated/' + name, import.meta.url), new URL(name, target), {recursive:true}); }
await mkdir(new URL('brand', target), {recursive:true});
await cp(new URL('../../../packages/assets/images/logo.svg',import.meta.url),new URL('brand/logo.svg',target));
await cp(new URL('../../../packages/assets/generated/icons/favicon.ico',import.meta.url),new URL('favicon.ico',target));
