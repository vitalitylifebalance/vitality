/* Vitality Life Balance — gestor de consentimiento de cookies (RGPD / ePrivacy).
   GA4 en Consent Mode v2 avanzado (sin cookies hasta aceptar); Clarity SOLO tras consentimiento. */
(function () {
  var KEY = 'vlb_consent';
  var GA_ID = 'G-DZL9017H4F';
  var CLARITY_ID = 'wugidtdmbx';
  var lang = (document.documentElement.lang || 'es').slice(0, 2).toLowerCase();

  var T = {
    es: { msg: 'Usamos cookies analíticas (Google Analytics y Clarity) para entender cómo se usa la web y mejorarla. Sin aceptar, no se instala ninguna.', ok: 'Aceptar', no: 'Rechazar', more: 'Más información', legal: '/legal#cookies' },
    en: { msg: 'We use analytics cookies (Google Analytics and Clarity) to understand how the site is used and improve it. Nothing is installed unless you accept.', ok: 'Accept', no: 'Decline', more: 'More info', legal: '/en/legal#cookies' },
    fr: { msg: 'Nous utilisons des cookies analytiques (Google Analytics et Clarity) pour comprendre l’usage du site et l’améliorer. Rien n’est installé sans votre accord.', ok: 'Accepter', no: 'Refuser', more: 'Plus d’infos', legal: '/fr/legal#cookies' },
    de: { msg: 'Wir verwenden Analyse-Cookies (Google Analytics und Clarity), um die Nutzung der Website zu verstehen und sie zu verbessern. Ohne Zustimmung wird nichts installiert.', ok: 'Akzeptieren', no: 'Ablehnen', more: 'Mehr Infos', legal: '/de/legal#cookies' },
    pt: { msg: 'Usamos cookies analíticos (Google Analytics e Clarity) para perceber como o site é usado e melhorá-lo. Nada é instalado sem aceitares.', ok: 'Aceitar', no: 'Recusar', more: 'Mais info', legal: '/pt/legal#cookies' }
  };
  var t = T[lang] || T.es;

  /* Consent Mode v2 avanzado: gtag se carga SIEMPRE con todo denegado (sin
     cookies, solo pings anónimos), así GA4 ve todas las páginas etiquetadas.
     Al aceptar se actualiza a granted y se carga Clarity (que sí usa cookies). */
  function loadGtag(isGranted) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    gtag('consent', 'default', {
      analytics_storage: isGranted ? 'granted' : 'denied',
      ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'
    });
    gtag('js', new Date());
    gtag('config', GA_ID, { linker: { domains: ['vitalitylifebalance.com', 'tienda.vitalitylifebalance.com', 'account.vitalitylifebalance.com'] } });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    wireEcommerceEvents();
  }

  function grantAnalytics() {
    gtag('consent', 'update', { analytics_storage: 'granted' });
    loadClarity();
  }

  function loadClarity() {
    (function (c, l, a, r, i, tt, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      tt = l.createElement(r); tt.async = 1; tt.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(tt, y);
    })(window, document, 'clarity', 'script', CLARITY_ID);
  }

  /* Eventos de ecommerce GA4 (auditoría Coto P0: view_item / begin_checkout).
     El purchase lo emite el pixel del checkout de Shopify; el enlace entre
     dominios lo hace el linker de la config. */
  var PRODUCT_PAGES = {
    'vipassanna-product': { id: '58264756191576', name: 'Vipassanna', price: 199.00 },
    'sabana-product': { id: '58264757272920', name: 'Sábana Grounding', price: 99.99 },
    'almohadas-product': { id: '58264758387032', name: 'Almohadas Grounding', price: 50.00 },
    'esterilla-product': { id: '58264759730520', name: 'Esterilla Grounding', price: 160.00 },
    'mantas-product': { id: '58264760877400', name: 'Mantas Grounding', price: 100.00 }
  };
  function wireEcommerceEvents() {
    if (window.__vlbEcomWired) return;
    window.__vlbEcomWired = true;
    var path = location.pathname.replace(/\.html$/, '').split('/').pop();
    var prod = PRODUCT_PAGES[path];
    if (prod) {
      gtag('event', 'view_item', { currency: 'EUR', value: prod.price,
        items: [{ item_id: prod.id, item_name: prod.name, price: prod.price }] });
    }
    document.addEventListener('click', function (ev) {
      var el = ev.target && ev.target.closest && ev.target.closest('a,button');
      if (!el) return;
      var target = el.getAttribute('href') || el.getAttribute('onclick') || '';
      if (target.indexOf('google.com/preferences/source') !== -1) {
        gtag('event', 'preferred_source_click', { page_path: location.pathname });
        return;
      }
      var m = target.match(/tienda\.vitalitylifebalance\.com\/cart\/([0-9:,]+)/);
      if (!m) return;
      var items = m[1].split(',').map(function (pair) {
        var p = pair.split(':');
        return { item_id: p[0], quantity: parseInt(p[1] || '1', 10) };
      });
      gtag('event', 'begin_checkout', { currency: 'EUR', items: items });
    }, true);
  }

  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) {}
  // El default ya sale granted si aceptó antes: un 'update' posterior llegaría tarde al page_view.
  loadGtag(stored === 'granted');
  if (stored === 'granted') { loadClarity(); return; }
  if (stored === 'denied') { return; }

  function showBanner() {
    if (document.getElementById('vlbConsent')) return;
    var b = document.createElement('div');
    b.id = 'vlbConsent';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-live', 'polite');
    b.style.cssText = 'position:fixed;left:50%;bottom:1rem;transform:translateX(-50%);z-index:2147483000;width:min(680px,calc(100vw - 2rem));background:rgba(8,14,22,0.96);backdrop-filter:blur(18px);border:1px solid rgba(0,188,212,0.3);border-radius:14px;padding:1rem 1.2rem;box-shadow:0 12px 48px rgba(0,0,0,0.55),0 0 40px rgba(0,188,212,0.08);font-family:Inter,system-ui,sans-serif;color:#E0EAF0;font-size:0.82rem;line-height:1.55;';
    b.innerHTML =
      '<div style="display:flex;flex-wrap:wrap;gap:0.8rem;align-items:center;justify-content:space-between">' +
      '<div style="flex:1 1 300px">🍪 ' + t.msg + ' <a href="' + t.legal + '" style="color:#4FC3F7;text-decoration:underline">' + t.more + '</a></div>' +
      '<div style="display:flex;gap:0.5rem;flex-shrink:0">' +
      '<button id="vlbCNo" style="padding:0.55rem 1.1rem;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:transparent;color:#B2C8D8;font-size:0.8rem;cursor:pointer;font-family:inherit">' + t.no + '</button>' +
      '<button id="vlbCOk" style="padding:0.55rem 1.3rem;border-radius:8px;border:none;background:linear-gradient(135deg,#00BCD4,#0077B6);color:#04121a;font-weight:700;font-size:0.8rem;cursor:pointer;font-family:inherit">' + t.ok + '</button>' +
      '</div></div>';
    document.body.appendChild(b);
    document.getElementById('vlbCOk').addEventListener('click', function () {
      try { localStorage.setItem(KEY, 'granted'); } catch (e) {}
      b.remove();
      grantAnalytics();
    });
    document.getElementById('vlbCNo').addEventListener('click', function () {
      try { localStorage.setItem(KEY, 'denied'); } catch (e) {}
      b.remove();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showBanner);
  } else {
    showBanner();
  }
})();
