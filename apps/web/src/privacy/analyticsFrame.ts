import config from '../seo/siteConfig.json';
// Dedicated, empty same-origin frame: the Google tag never sees form DOM,
// private hash routes or user-provided fields in the parent document.
const id = config.analytics.measurementId;
const allowedPages = new Set(['/', '/privacy', '/terms']);
const allowedEvents = new Set(['page_view', 'landing_cta_click', 'demo_form_complete']);
if (window.parent !== window && config.analytics.enabled && /^G-[A-Z0-9]+$/.test(id)) {
 const analyticsWindow = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
 analyticsWindow.dataLayer = [];
 const gtag = function(..._args: unknown[]) { analyticsWindow.dataLayer!.push(arguments); };
 analyticsWindow.gtag = gtag;
 gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
 gtag('set', 'ads_data_redaction', true);
 gtag('js', new Date());
 gtag('consent', 'update', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
 gtag('config', id, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, page_location: config.origin + '/', page_referrer: '' });
 const script = document.createElement('script'); script.async = true; script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id); script.referrerPolicy = 'no-referrer'; document.head.append(script);
 addEventListener('message', event => { const data = event.data; if (event.source !== parent || event.origin !== location.origin || data?.type !== 'boxvault-analytics' || !allowedEvents.has(data.name) || !allowedPages.has(data.path)) return; gtag('event', data.name, { page_location: config.origin + data.path, page_title: data.path === '/' ? 'BoxVault public landing' : data.path === '/privacy' ? 'BoxVault privacy notice' : 'BoxVault terms', page_referrer: '' }); });
}
