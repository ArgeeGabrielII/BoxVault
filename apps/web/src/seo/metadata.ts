import config from './siteConfig.json';
export type PageMeta = { title: string; description: string; canonical: string; indexable: boolean; analytics: boolean };
const page = (title: string, description: string, canonical: string, indexable = false, analytics = false): PageMeta => ({ title: title + ' | BoxVault', description, canonical, indexable, analytics });
export const publicMetadata: Record<string, PageMeta> = {
 '/': page('Find what you stored. Make room for living.', 'Explore a calmer way to organize storage containers, inventory and family sharing. Try the BoxVault UI preview and compare Free, Single User and Family plans.', '/', true, true),
 '/login': page('Demo login', 'Choose a demo username and a blank password to explore the BoxVault customer, family, admin or System Support previews.', '/login'),
 '/privacy': page('Privacy notice', 'How this BoxVault UI preview handles browser preferences, optional analytics and fictional demo data.', '/privacy', config.legal.reviewed, true),
 '/terms': page('Terms of use', 'The terms and limitations of the BoxVault UI preview, mock subscriptions and browser-based demonstration tools.', '/terms', config.legal.reviewed, true),
 '/thank-you': page('Thank you', 'Your BoxVault demo form flow is complete. No real message, account, subscription or payment has been created.', '/thank-you'),
 '/404': page('Page not found', 'This page is not part of the BoxVault preview. Return to the website or open a demo workspace.', '/404'),
};
const customerPages: Record<string, [string, string]> = {
 overview: ['Your workspace', 'A fictional overview of storage boxes, inventory and locations in the BoxVault customer preview.'],
 boxes: ['My boxes', 'Browse fictional storage containers and their sample details in the BoxVault UI preview.'],
 inventory: ['Inventory', 'Search the fictional inventory in your BoxVault demo workspace.'],
 locations: ['Locations', 'Browse sample storage locations in the BoxVault UI preview.'],
 labels: ['QR labels', 'Explore the planned BoxVault label workflow using fictional records.'],
 family: ['Family sharing', 'Preview explicit sharing and membership concepts for the BoxVault Family plan.'],
 plans: ['Plans & credits', 'Compare Free User, Single User and Family User pricing with monthly fees and annual savings.'],
 settings: ['Workspace settings', 'Adjust appearance and learn about the BoxVault demo workspace.'],
};
const adminPages: Record<string, [string, string]> = {
 overview: ['Admin overview', 'Preview fictional subscription metrics and safe operational metadata.'],
 accounts: ['Admin accounts', 'A sample account-status and subscription-metadata interface for BoxVault operators.'],
 payments: ['Payment review preview', 'Explore synthetic top-up reviews and demo confirmation controls. No real payment is processed.'],
 credits: ['Admin plans & credits', 'Review the current mock plan catalog and fictional credit issuance records.'],
 activity: ['Admin activity', 'Browse fictional operator activity without customer inventory content.'],
 settings: ['Admin settings', 'Appearance preferences and intended operating boundaries for the BoxVault admin preview.'],
};
const supportPages: Record<string, [string, string]> = {
 overview: ['System Support', 'A separate support workspace for fictional cases and redacted diagnostic context.'],
 cases: ['Support case queue', 'Explore sample support case triage and escalation without changing real accounts.'],
 accounts: ['Support account lookup', 'A read-only sample support-ID and account-status lookup interface.'],
 diagnostics: ['Support diagnostics', 'Simulated service health and redacted diagnostic codes for the BoxVault support preview.'],
 activity: ['Support activity', 'Session-only fictional support case changes and safe operational context.'],
};
export function resolveRoute(pathname: string, hash: string) {
 const cleanPath = pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
 const hashPath = hash.split('?')[0];
 if (hashPath.startsWith('#/')) return hashPath.slice(1).replace(/\/$/, '') || '/';
 return cleanPath;
}
export function metadataFor(route: string): PageMeta {
 if (publicMetadata[route]) return publicMetadata[route];
 if (route === '/sitemap') return page('Role sitemap', 'Explore screen maps and planned access boundaries for every BoxVault customer, platform and developer role.', '/login');
 const [, area, section = 'overview'] = route.split('/');
 const mapping = area === 'app' ? customerPages : area === 'admin' ? adminPages : area === 'support' ? supportPages : undefined;
 if (mapping?.[section]) return page(...mapping[section], '/login');
 return publicMetadata['/404'];
}
export function routeExists(route: string) { return !!publicMetadata[route] || route === '/sitemap' || (/^\/(app|admin|support)(?:\/[a-z-]+)?$/.test(route) && metadataFor(route) !== publicMetadata['/404']); }
export function applyMetadata(meta: PageMeta) {
 document.title = meta.title;
 const set = (selector: string, attribute: string, key: string, value: string) => { let element = document.head.querySelector<HTMLMetaElement>(selector); if (!element) { element = document.createElement('meta'); element.setAttribute(attribute, key); document.head.append(element); } element.content = value; };
 set('meta[name="description"]', 'name', 'description', meta.description);
 set('meta[name="robots"]', 'name', 'robots', meta.indexable ? 'index, follow' : 'noindex, nofollow');
 for (const [key, value] of Object.entries({ 'og:title': meta.title, 'og:description': meta.description, 'og:type': 'website', 'og:url': config.origin + meta.canonical, 'og:image': config.origin + '/social/boxvault-og.png', 'og:image:width': '1200', 'og:image:height': '630', 'og:image:alt': 'BoxVault — Find what you stored. Make room for living.' })) set('meta[property="' + key + '"]', 'property', key, value);
 set('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
 let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]'); if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); } canonical.href = config.origin + meta.canonical;
}
export { config as siteConfig };
