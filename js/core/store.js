/* Сессия демо и настройки устройства (тема, чтение). */
(function (PM) {
  'use strict';
  const KEY = 'promozg-proto-session-v1';
  const defaults = { uid: 'alina', theme: 'auto', readSize: 18, darkReading: false, demoOpen: true, live: true, iosNoPwa: false };
  let s = { ...defaults };
  try { s = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (_) { /* пусто */ }
  const subs = [];
  const store = {
    get: (k) => s[k],
    set(k, v) { s[k] = v; localStorage.setItem(KEY, JSON.stringify(s)); subs.forEach((f) => f(k, v)); },
    on(f) { subs.push(f); },
    reset() { s = { ...defaults }; localStorage.setItem(KEY, JSON.stringify(s)); },
    me: () => (s.uid ? PM.api.user(s.uid) : null),
  };

  /* Тема: «как на телефоне» по умолчанию. Классы те же, что у нового фронта. */
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const t = s.theme;
    const dark = t === 'dark' || (t === 'auto' && mq.matches);
    const root = document.documentElement;
    root.classList.toggle('theme-dark-active', dark);
    root.classList.toggle('theme-light-active', !dark);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0A0A0B' : '#FAF7F2');
  }
  mq.addEventListener('change', () => { if (s.theme === 'auto') applyTheme(); });
  store.on((k) => { if (k === 'theme') applyTheme(); });
  applyTheme();
  PM.store = store; PM.applyTheme = applyTheme;
})(window.PM);
