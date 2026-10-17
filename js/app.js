/* Точка входа: маршруты, жизненный цикл экранов, состояния ?state=, события. */
(function (PM) {
  'use strict';
  const { html, setHTML, $, on } = PM.dom;
  const R = PM.router;
  const ROLE_BY_PREFIX = { s: 'student', t: 'teacher', a: 'admin' };
  const DEMO_USER = { student: 'alina', individual: 'nvet2', teacher: 'belova', admin: 'admin' };

  // Маршруты: #/<роль>/<экран>
  [
    ['/login', 'login'],
    ['/:r/home', 'home'], ['/:r/course', 'course'], ['/:r/module/:n', 'module'], ['/:r/book', 'book'],
    ['/:r/library', 'library'], ['/:r/library/item/:id', 'material'],
    ['/:r/chat', 'chatRooms'], ['/:r/personal', 'chatRooms'], ['/:r/chat/rooms', 'chatRooms'], ['/:r/chat/:room', 'chatRoom'],
    ['/s/homework', 'hwList'], ['/s/homework/:n', 'hwForm'],
    ['/:r/review', 'reviewQueue'], ['/:r/homework', 'reviewQueue'], ['/:r/review/:id', 'reviewItem'], ['/:r/student/:id', 'studentCard'],
    ['/:r/axon', 'axon'], ['/:r/axon/history', 'axonHistory'], ['/:r/axon/:id', 'axon'],
    ['/:r/settings', 'settings'],
    ['/a/people', 'people'], ['/a/people/:id', 'person'], ['/a/streams', 'streams'], ['/a/axon-quality', 'axq'], ['/a/axon-quality/:u/:c', 'axqConv'], ['/:r/materials', 'wave2'],
    ['/sys/:kind', 'sys'],
  ].forEach(([p, s]) => R.add(p, s));

  let current = null; // { route, cleanup }
  let seq = 0;

  function screenState(route) { return route.query.state || PM.demo.state(); }

  async function render() {
    const route = R.parse(location.hash);
    const my = ++seq;
    // роль из адреса: ссылкой можно поделиться (#/t/review откроет преподавателя)
    const pre = route.path.split('/')[1];
    if (ROLE_BY_PREFIX[pre]) {
      const role = ROLE_BY_PREFIX[pre];
      if (!PM.store.get('uid')) { location.replace('#/login?next=' + encodeURIComponent(route.full)); return; }
      const me = PM.store.me();
      if (me.role !== role) { PM.store.set('uid', DEMO_USER[role]); PM.demo.sync(); }
    } else if (route.screen !== 'login' && route.screen !== 'sys') {
      const me = PM.store.me();
      location.replace(me ? `#/${PM.shell.prefix(me.role)}/home` : '#/login'); return;
    }
    const screen = PM.screens[route.screen] || PM.screens.notFound;
    route.navKey = screen.nav ? screen.nav(route) : route.screen;
    route.tabbar = screen.tabbar !== undefined ? (typeof screen.tabbar === 'function' ? screen.tabbar(route) : screen.tabbar) : true;
    R.remember(route.full);

    if (current && current.cleanup) { try { current.cleanup(); } catch (e) { console.error(e); } }
    current = { route };
    PM.shell.renderNav(route);
    const view = PM.shell.view;
    const st = screenState(route);
    const ctx = { route, state: st, me: PM.store.me(), offline: st === 'offline' };

    fadeOut(view);
    setHTML(view, screen.skeleton ? screen.skeleton(ctx) : PM.ui.skeletonPage());
    fadeIn(view);
    if (st === 'loading') return; // демо: скелетон навсегда

    let data;
    try {
      if (st === 'error') { await new Promise((r) => setTimeout(r, 400)); throw new Error('Сервер не ответил. Проверьте связь и попробуйте ещё раз.'); }
      data = screen.load ? await screen.load(ctx) : null;
    } catch (e) {
      if (my !== seq) return;
      setHTML(view, html`${screen.header ? screen.header(ctx) : PM.ui.header({ title: screen.title || 'Ошибка', back: '#/' })}<div class="page">${PM.ui.errorBox(e.message || 'Ошибка')}</div>`);
      const off = on(view, 'click', '[data-act="retry"]', () => { off(); render(); });
      bindCommon(view);
      current.cleanup = off;
      return;
    }
    if (my !== seq) return; // пользователь уже ушёл на другой экран
    ctx.data = data;
    setHTML(view, screen.view(ctx));
    if (ctx.offline) PM.demo.offlineBar(view);
    bindCommon(view);
    current.cleanup = screen.mount ? screen.mount(view, ctx) : null;
    PM.shell.flushPushes();
    if (!route.query.keepFocus) view.focus({ preventScroll: true });
  }

  function bindCommon(view) {
    // «Назад» — туда, откуда пришли
    view.querySelectorAll('[data-act="back"]').forEach((b) => b.addEventListener('click', () => R.back(b.dataset.fallback)));
  }
  // Переходы только прозрачностью, без изменения размеров (F-CH-01); reduced motion — без анимации
  function fadeOut(v) { v.classList.remove('fade-in'); }
  function fadeIn(v) { if (!PM.dom.reducedMotion()) { void v.offsetWidth; v.classList.add('fade-in'); } }

  // Фоновые события: только счётчики и push, экран целиком не перерисовывается (F-HW-08)
  PM.api.on('counts', () => PM.shell.updateCounts());
  PM.api.on('push', ({ uid }) => { const me = PM.store.me(); if (me && me.id === uid) PM.shell.flushPushes(); });
  PM.api.on('reset', () => { sessionStorage.removeItem('promozg-proto-stack'); location.hash = '#/s/home'; render(); });

  window.addEventListener('hashchange', render);
  document.addEventListener('DOMContentLoaded', () => {
    PM.shell.build();
    PM.demo.build();
    if (!location.hash) location.replace(PM.store.get('uid') ? `#/${PM.shell.prefix(PM.store.me().role)}/home` : '#/login');
    render();
    // «живой» собеседник: раз в 50 с входящее сообщение (можно выключить в демо-панели)
    setInterval(() => { const me = PM.store.me(); if (me && PM.store.get('live') && document.visibilityState === 'visible') PM.api.simulateIncoming(me.id); }, 50000);
  });
  PM.app = { render, DEMO_USER };
})(window.PM);
