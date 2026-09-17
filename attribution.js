/* Vitality Life Balance — atribución de origen de la visita.
   Guarda el PRIMER contacto (first-touch) en localStorage y lo adjunta a los
   permalinks del carrito de Shopify como attributes[...] → note_attributes del
   pedido. No usa identificadores personales ni cookies de terceros, por lo que
   no depende del consentimiento analítico (ver /legal#cookies). */
(function () {
  var KEY = 'vlb_attr';
  var TTL = 30 * 24 * 3600 * 1000;           // 30 días
  var MAXLEN = 80;
  var CART = 'tienda.vitalitylifebalance.com/cart/';
  var OWN = /(^|\.)vitalitylifebalance\.com$/i;
  var FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'landing', 'first_seen'];

  function clip(v) {
    return v == null ? '' : String(v).slice(0, MAXLEN);
  }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.first_seen) return null;
      if (Date.now() - Date.parse(data.first_seen) > TTL) return null;
      return data;
    } catch (e) { return null; }
  }

  function write(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  }

  function current() {
    var q, refDomain = '';
    try { q = new URL(location.href).searchParams; } catch (e) { q = null; }
    try {
      if (document.referrer) {
        var h = new URL(document.referrer).hostname;
        if (!OWN.test(h)) refDomain = h;
      }
    } catch (e) {}
    return {
      utm_source: clip(q && q.get('utm_source')),
      utm_medium: clip(q && q.get('utm_medium')),
      utm_campaign: clip(q && q.get('utm_campaign')),
      ref: clip(refDomain),
      landing: clip(location.pathname),
      first_seen: new Date().toISOString()
    };
  }

  /* First-touch: solo se escribe si no hay nada guardado o ha caducado.
     Excepción: si lo guardado no traía UTM y ahora llega uno, se completan
     los campos utm_* sin tocar landing/first_seen/ref originales. */
  var attr = read();
  var now = current();
  if (!attr) {
    attr = now;
    write(attr);
  } else if (!attr.utm_source && now.utm_source) {
    attr.utm_source = now.utm_source;
    attr.utm_medium = attr.utm_medium || now.utm_medium;
    attr.utm_campaign = attr.utm_campaign || now.utm_campaign;
    write(attr);
  }

  function decorate(url) {
    try {
      if (typeof url !== 'string' || url.indexOf(CART) === -1) return url;
      var u = new URL(url, location.href);
      for (var i = 0; i < FIELDS.length; i++) {
        var k = FIELDS[i], v = clip(attr[k]);
        if (v) u.searchParams.set('attributes[' + k + ']', v);
      }
      var src = attr.utm_source || attr.ref;
      if (src) u.searchParams.set('ref', clip(src));
      return u.toString();
    } catch (e) { return url; }
  }

  window.vlbCart = decorate;

  function rewriteLinks(root) {
    var links = (root || document).querySelectorAll('a[href*="' + CART + '"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i], href = a.getAttribute('href');
      if (href) a.setAttribute('href', decorate(href));
    }
  }

  /* Reescritura en el click (fase de captura) por si el href se generó después. */
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest && ev.target.closest('a[href*="' + CART + '"]');
    if (!a) return;
    a.setAttribute('href', decorate(a.getAttribute('href')));
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { rewriteLinks(); });
  } else {
    rewriteLinks();
  }
})();
