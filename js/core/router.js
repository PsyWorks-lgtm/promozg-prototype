/* Hash-роутер: прямая ссылка и F5 открывают тот же экран. */
(function (PM) {
  'use strict';
  const routes = [];
  /* add('/hw/:n', 'hwForm') */
  function add(path, screen) {
    const keys = [];
    const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ re, keys, screen, path });
  }
  function parse(hash) {
    const h = (hash || location.hash || '#/home').replace(/^#/, '') || '/home';
    const [p, qs] = h.split('?');
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    for (const r of routes) {
      const m = p.match(r.re);
      if (m) { const params = {}; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); return { screen: r.screen, params, query, path: p, full: '#' + h }; }
    }
    return { screen: 'notFound', params: {}, query, path: p, full: '#' + h };
  }
  /* Стек для «Назад туда, откуда пришли» */
  const STACK = 'promozg-proto-stack';
  const stack = () => { try { return JSON.parse(sessionStorage.getItem(STACK) || '[]'); } catch (_) { return []; } };
  function remember(full) {
    const st = stack();
    if (st[st.length - 1] === full) return;
    if (st[st.length - 2] === full) st.pop(); else st.push(full);
    sessionStorage.setItem(STACK, JSON.stringify(st.slice(-30)));
  }
  function back(fallback) {
    const st = stack();
    if (st.length > 1) { st.pop(); const prev = st[st.length - 1]; sessionStorage.setItem(STACK, JSON.stringify(st)); location.hash = prev; }
    else location.hash = fallback || '#/home';
  }
  const go = (h) => { if (location.hash === h) PM.app.render(); else location.hash = h; };
  PM.router = { add, parse, remember, back, go, stack };
})(window.PM);
