/* Оболочка: боковое меню (компьютер), нижняя панель (телефон), тосты, push, модалки.
   Строится один раз. Фоновые события обновляют только счётчики, экран не перерисовывается. */
(function (PM) {
  'use strict';
  const { html, setHTML, $, $$, on, esc } = PM.dom;
  const icon = PM.icon;

  const NAV = {
    s: [['home', 'home', 'Главная'], ['course', 'book', 'Курс'], ['chat', 'chat', 'Чат', 'chat'], ['homework', 'hw', 'Домашки', 'hw'], ['axon', 'axon', 'AXON'], ['library', 'library', 'Библиотека', null, 'side']],
    t: [['home', 'home', 'Главная'], ['review', 'inbox', 'Проверка', 'review'], ['chat', 'chat', 'Чат', 'chat'], ['course', 'book', 'Курс'], ['axon', 'axon', 'AXON'], ['personal', 'users', 'Личные ученики', 'personal', 'side'], ['library', 'library', 'Библиотека', null, 'side']],
    a: [['home', 'grid', 'Сводка'], ['people', 'users', 'Люди'], ['homework', 'inbox', 'Домашки', 'review'], ['chat', 'chat', 'Чаты', 'chat'], ['axon-quality', 'axon', 'Качество AXON'], ['streams', 'layers', 'Потоки', null, 'side'], ['materials', 'folder', 'Материалы', null, 'side']],
  };
  const ROLE_LABEL = { student: 'Ученик', teacher: 'Преподаватель', admin: 'Админ' };
  const prefix = (role) => ({ student: 's', teacher: 't', admin: 'a' }[role]);

  let root, view, toastBox, pushBox;

  function build() {
    root = document.getElementById('app');
    setHTML(root, html`
      <a class="skip" href="#view" data-act="skip">Перейти к содержимому</a>
      <div class="shell">
        <aside class="side only-d" aria-label="Разделы"></aside>
        <div class="main-col"><main id="view" tabindex="-1"></main></div>
      </div>
      <nav class="tabbar only-m" aria-label="Разделы"></nav>
      <div class="toasts" role="status" aria-live="polite"></div>
      <div class="pushes" aria-live="polite"></div>
      <div id="modal-root"></div>`);
    view = $('#view'); toastBox = $('.toasts', root); pushBox = $('.pushes', root);
    on(root, 'click', '[data-act="skip"]', (e) => { e.preventDefault(); view.focus(); });
    on(root, 'click', '[data-push]', (e, el) => { const url = el.dataset.push; el.remove(); location.hash = url; });
    on(root, 'click', '[data-act="close-push"]', (e, el) => { e.stopPropagation(); el.closest('.push').remove(); });
  }

  function renderNav(route) {
    const me = PM.store.me();
    const side = $('.side', root), tab = $('.tabbar', root);
    const isLogin = !me || route.screen === 'login' || route.screen.startsWith('sys');
    root.classList.toggle('no-shell', isLogin);
    if (isLogin) return;
    const p = prefix(me.role);
    const individual = me.role === 'student' && me.streams.some((c) => (PM.api.stream(c) || {}).individual);
    const items = NAV[p].map((it) => (individual && it[0] === 'chat' ? ['chat', 'chat', 'Чат с преподавателями', 'chat'] : it));
    // у админа на телефоне всё, что не влезло в 4 вкладки, уходит в «Ещё»
    const moreMode = p === 'a';
    const tabsBase = items.filter((it) => it[4] !== 'side');
    const tabs = moreMode ? tabsBase.slice(0, 4).concat([['more', 'menu', 'Ещё']]) : tabsBase.slice(0, 5);
    const tabKeys = tabs.map((t) => t[0]);
    const link = (it, cls) => {
      const [key, ic, label, count] = it;
      const active = route.navKey === key || (cls === 'tab-a' && key === 'more' && !tabKeys.includes(route.navKey));
      return html`<a class="${cls} ${active ? 'active' : ''}" href="#/${p}/${key}" ${active ? html`aria-current="page"` : ''}>
        ${ic === 'axon' ? PM.axonMark(20) : icon(ic)}<span class="lbl">${label}</span>${count ? PM.ui.badge(0, count === 'review' ? '' : 'quiet', count) : ''}</a>`;
    };
    const streams = me.streams.map((s) => PM.api.stream(s).label);
    setHTML(side, html`
      <div class="brand">${PM.pmMark(32)}<div>ProMozg<small>Кабинет курса</small></div></div>
      <nav class="nav">${items.map((it) => link(it, 'nav-a'))}</nav>
      <a class="me" href="#/${p}/settings" aria-label="Профиль и настройки">${PM.ui.avatar(me.name)}<span class="grow"><b>${me.name}</b><small>${ROLE_LABEL[me.role]}${streams.length ? ' · ' + streams.join(', ') : ''}</small></span>${icon('settings', 'sm')}</a>`);
    setHTML(tab, html`${tabs.map((it) => link(it, 'tab-a'))}`);
    tab.hidden = route.tabbar === false;
    root.classList.toggle('tabbar-hidden', route.tabbar === false);
    updateCounts();
  }

  function updateCounts() {
    const me = PM.store.me(); if (!me) return;
    const c = PM.api.counts(me.id);
    const vals = { chat: c.chat, review: c.review, hw: c.hwUpdates, personal: c.personal };
    $$('[data-count]').forEach((el) => {
      const k = el.dataset.count; if (!(k in vals)) return;
      const v = vals[k]; el.textContent = v > 99 ? '99+' : v; el.hidden = !v;
    });
    // кружок у «назад/меню» на мобиле не используем: счётчики на вкладках
    document.title = (c.review && me.role !== 'student' ? `(${c.review}) ` : '') + 'ProMozg · Кабинет';
  }

  function toast(text, { kind = '', action = null, timeout = 4200 } = {}) {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    setHTML(el, html`<span class="grow">${text}</span>${action ? html`<button class="btn ghost sm" data-toast-act>${action.label}</button>` : ''}`);
    if (action) el.querySelector('[data-toast-act]').addEventListener('click', () => { el.remove(); action.fn(); });
    toastBox.appendChild(el);
    setTimeout(() => el.remove(), timeout);
    return el;
  }

  /* Push-симулятор: карточка системного уведомления. Повторный tag заменяет прежнюю карточку. */
  function showPush(p) {
    const old = p.tag ? pushBox.querySelector(`[data-tag="${CSS.escape(p.tag)}"]`) : null;
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'push'; el.dataset.push = p.url || '#/'; el.dataset.tag = p.tag || '';
    el.setAttribute('role', 'button'); el.tabIndex = 0;
    setHTML(el, html`<span class="push-ic">${PM.pmMark(36)}</span><span class="grow"><span class="row"><b class="t2 grow">ProMozg</b><small>сейчас</small></span><b class="t2 push-title">${p.title}</b><span class="t2">${p.body}</span><small class="push-hint">Имитация push · нажмите, чтобы открыть</small></span><button class="iconbtn" data-act="close-push" aria-label="Скрыть уведомление">${icon('x', 'sm')}</button>`);
    pushBox.prepend(el);
    setTimeout(() => el.remove(), 12000);
  }
  function flushPushes() { const me = PM.store.me(); if (!me) return; PM.api.takePushes(me.id).forEach(showPush); }

  /* Модалка с ловушкой фокуса, Esc закрывает и возвращает фокус */
  function confirm({ title, text, ok = 'Подтвердить', danger = false, cancel = 'Отмена' }) {
    return new Promise((resolve) => {
      const opener = document.activeElement;
      const host = $('#modal-root');
      setHTML(host, html`<div class="overlay" data-act="m-cancel"></div>
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-title" aria-describedby="m-text">
          <h2 id="m-title">${title}</h2><p id="m-text" class="muted">${text}</p>
          <div class="row" style="justify-content:flex-end;gap:8px;margin-top:20px">
            <button class="btn secondary" data-act="m-cancel">${cancel}</button>
            <button class="btn ${danger ? 'danger' : 'primary'}" data-act="m-ok">${ok}</button></div></div>`);
      const modal = $('.modal', host);
      const close = (v) => { setHTML(host, ''); document.removeEventListener('keydown', key); if (opener && opener.focus) opener.focus(); resolve(v); };
      const key = (e) => {
        if (e.key === 'Escape') close(false);
        if (e.key === 'Tab') { const f = $$('button', modal); const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
      };
      document.addEventListener('keydown', key);
      host.onclick = (e) => { const a = e.target.closest('[data-act]'); if (!a) return; if (a.dataset.act === 'm-ok') close(true); if (a.dataset.act === 'm-cancel') close(false); };
      $('[data-act="m-ok"]', host).focus();
    });
  }

  PM.shell = { NAV, build, renderNav, updateCounts, toast, showPush, flushPushes, confirm, prefix, get view() { return view; } };
})(window.PM);
