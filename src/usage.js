const CONSENT_KEY = 'montafolha-usage-consent-v1';
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';
const CODES = new Set(['runtime_exception', 'unhandled_rejection', 'image_decode_failed', 'pdf_generation_failed', 'storage_unavailable', 'example_load_failed']);
const sent = [];
let choice = (() => { try { const value = localStorage.getItem(CONSENT_KEY); return value === 'accepted' || value === 'rejected' ? value : null; } catch { return null; } })();
let script;
let scriptLoaded = false;

function clearAnalyticsCookies() {
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.trim().split('=')[0];
    if (name !== '_ga' && !name.startsWith('_ga_')) continue;
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    if (location.hostname === 'montafolha.com.br' || location.hostname.endsWith('.montafolha.com.br')) {
      document.cookie = `${name}=; Max-Age=0; Path=/; Domain=montafolha.com.br; SameSite=Lax`;
    }
  }
}

function gtag(...args) { window.dataLayer.push(args); }

function disable() {
  if (MEASUREMENT_ID) window[`ga-disable-${MEASUREMENT_ID}`] = true;
  if (window.dataLayer) gtag('consent', 'update', { analytics_storage: 'denied' });
  script?.remove(); script = undefined; scriptLoaded = false;
  clearAnalyticsCookies();
}

function enable() {
  if (!MEASUREMENT_ID || !/^G-[A-Z0-9]+$/.test(MEASUREMENT_ID)) return;
  window[`ga-disable-${MEASUREMENT_ID}`] = false;
  window.dataLayer ||= [];
  window.gtag = gtag;
  gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  gtag('js', new Date());
  gtag('consent', 'update', { analytics_storage: 'granted' });
  gtag('config', MEASUREMENT_ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, cookie_expires: 2592000 });
  script = document.createElement('script'); script.async = true; script.referrerPolicy = 'no-referrer';
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  script.onload = () => { scriptLoaded = choice === 'accepted'; if (scriptLoaded) pageView(); };
  document.head.appendChild(script);
}

export function getChoice() { return choice; }

export function setChoice(next) {
  if (!['accepted', 'rejected'].includes(next)) return false;
  try { localStorage.setItem(CONSENT_KEY, next); } catch { return false; }
  if (choice === next) return true;
  choice = next;
  if (next === 'accepted') enable(); else disable();
  window.dispatchEvent(new Event('usage-choice-changed'));
  return true;
}

export function pageView() {
  if (choice !== 'accepted' || !scriptLoaded) return;
  const path = location.hash === '#/apoiar' ? '/apoiar' : location.hash === '#/privacidade' ? '/privacidade' : '/';
  const title = path === '/apoiar' ? 'Apoiar' : path === '/privacidade' ? 'Privacidade' : 'MontaFolha';
  gtag('event', 'page_view', { page_title: title, page_path: path, page_location: `${location.origin}${path}` });
}

export function reportError(code) {
  if (choice !== 'accepted' || !CODES.has(code) || !navigator.onLine) return;
  const now = Date.now();
  while (sent.length && sent[0] < now - 3600000) sent.shift();
  if (sent.length >= 4) return;
  sent.push(now);
  void fetch('/api/diagnostics/errors', {
    method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ area: code.startsWith('runtime') || code === 'unhandled_rejection' ? 'runtime' : code === 'storage_unavailable' ? 'storage' : code.startsWith('image') || code.startsWith('example') ? 'image' : 'pdf', code, count: 1 }),
  }).catch(() => {});
}

window.addEventListener('error', () => reportError('runtime_exception'));
window.addEventListener('unhandledrejection', () => reportError('unhandled_rejection'));
window.addEventListener('storage', event => {
  if (event.key !== CONSENT_KEY) return;
  const next = event.newValue;
  choice = next === 'accepted' || next === 'rejected' ? next : null;
  disable();
  if (choice === 'accepted') enable();
  window.dispatchEvent(new Event('usage-choice-changed'));
});
if (choice === 'accepted') enable();
