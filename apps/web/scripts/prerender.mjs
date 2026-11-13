import { readFile, writeFile } from 'node:fs/promises';
import { renderPublicPage, metadataFor, publicMetadata, siteConfig } from '../.prerender/render.mjs';
const output = new URL('../dist/', import.meta.url);
const base = await readFile(new URL('index.html', output), 'utf8');
const escape = value => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
if(siteConfig.origin !== 'https://boxvault-argee-2026.web.app') throw Error('Unexpected canonical origin');
if(siteConfig.legal.privacyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(siteConfig.legal.privacyEmail)) throw Error('Invalid policy contact');
for(const route of Object.keys(publicMetadata)){
 const meta = metadataFor(route);
 const tags = `<title>${escape(meta.title)}</title>\n<meta name="description" content="${escape(meta.description)}">\n<meta name="robots" content="${meta.indexable?'index, follow':'noindex, nofollow'}">\n<link rel="canonical" href="${siteConfig.origin+meta.canonical}">\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="BoxVault">\n<meta property="og:title" content="${escape(meta.title)}">\n<meta property="og:description" content="${escape(meta.description)}">\n<meta property="og:url" content="${siteConfig.origin+meta.canonical}">\n<meta property="og:image" content="${siteConfig.origin}/social/boxvault-og.png">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:image:alt" content="BoxVault — Find what you stored. Make room for living.">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${siteConfig.origin}/social/boxvault-og.png">`;
 const html = base.replace(/<title>[\s\S]*?<\/title>/,'').replace(/<meta name="(?:description|robots)"[^>]*>/g,'').replace('</head>',tags+'\n</head>').replace('<div id="root"></div>','<div id="root">'+renderPublicPage(route)+'</div>');
 await writeFile(new URL(route === '/' ? 'index.html' : route.slice(1)+'.html',output),html);
}
const indexable=Object.entries(publicMetadata).filter(([,meta])=>meta.indexable);
await writeFile(new URL('sitemap.xml',output),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+indexable.map(([,meta])=>`\n  <url><loc>${siteConfig.origin+meta.canonical}</loc><lastmod>${siteConfig.updatedAt}</lastmod></url>`).join('')+'\n</urlset>\n');
console.log('Prerendered',Object.keys(publicMetadata).length,'public/error pages;',indexable.length,'approved indexable URL(s).');
