/* Демо-панель: только для показа, в продукт не входит. Сворачивается. */
(function (PM) {
  'use strict';
  const { html, setHTML, $, $$, on } = PM.dom;
  const icon = PM.icon;
  let el;
  const STATES = [['normal', 'Обычное'], ['empty', 'Пусто'], ['loading', 'Загрузка'], ['error', 'Ошибка'], ['offline', 'Нет связи']];
  const ROLES = [['student', 'Ученик'], ['individual', 'Ученик (личное обучение)'], ['teacher', 'Преподаватель'], ['admin', 'Админ']];
  const THEMES = [['auto', 'Как на телефоне'], ['light', 'Светлая'], ['dark', 'Тёмная']];
  const NOTIF = [['default', 'Не спрашивали'], ['on', 'Включены'], ['denied', 'Заблокированы'], ['ios', 'iPhone без «Домой»']];

  function state() { return PM.store.get('demoState') || 'normal'; }

  function build() {
    el = document.createElement('aside');
    el.className = 'demo';
    el.setAttribute('aria-label', 'Демо-панель прототипа');
    document.body.appendChild(el);
    draw();
    on(el, 'click', '[data-demo]', (e, b) => act(b.dataset.demo, b.dataset.v));
    on(el, 'change', 'input[data-demo-flag]', (e, i) => { PM.api.flags[i.dataset.demoFlag] = i.checked; });
    on(el, 'change', 'input[data-demo-live]', (e, i) => PM.store.set('live', i.checked));
    PM.api.on('flags', draw);
  }
  function seg(name, list, cur) {
    return html`<div class="seg sm" role="group" aria-label="${name}">${list.map(([v, l]) => html`<button type="button" class="${v === cur ? 'on' : ''}" aria-pressed="${v === cur}" data-demo="${name}" data-v="${v}">${l}</button>`)}</div>`;
  }
  function draw() {
    const open = PM.store.get('demoOpen');
    const me = PM.store.me();
    el.classList.toggle('open', !!open);
    if (!open) { setHTML(el, html`<button class="demo-fab" data-demo="toggle" aria-expanded="false">${icon('settings', 'sm')} Демо</button>`); return; }
    const notif = me ? PM.api.notifState(me.id) : 'default';
    setHTML(el, html`
      <div class="demo-h"><b>Демо-панель</b><span class="faint t1">не часть продукта</span><button class="iconbtn" data-demo="toggle" aria-expanded="true" aria-label="Свернуть демо-панель">${icon('x', 'sm')}</button></div>
      <div class="demo-sec"><span class="demo-l">Роль</span>${seg('role', ROLES, me ? (me.id === PM.app.DEMO_USER.individual ? 'individual' : me.role) : '')}</div>
      <div class="demo-sec"><span class="demo-l">Тема</span>${seg('theme', THEMES, PM.store.get('theme'))}</div>
      <div class="demo-sec"><span class="demo-l">Состояние экрана <small class="faint">или ?state=</small></span>${seg('state', STATES, state())}</div>
      <div class="demo-sec"><span class="demo-l">События</span><div class="demo-btns">
        <button class="btn secondary sm" data-demo="ev-chat">${icon('chat', 'sm')}Новое сообщение в чате</button>
        <button class="btn secondary sm" data-demo="ev-submit">${icon('hw', 'sm')}Ученик сдал работу</button>
        <button class="btn secondary sm" data-demo="ev-submit3">${icon('inbox', 'sm')}Пришли 3 работы</button>
        <button class="btn secondary sm" data-demo="ev-axon">${PM.axonMark(16)}Обрыв связи Axon</button></div></div>
      <div class="demo-sec"><span class="demo-l">Push на этом устройстве (${me ? me.name : '—'})</span>${seg('notif', NOTIF, notif)}</div>
      <div class="demo-sec demo-flags">
        <label><input type="checkbox" data-demo-flag="netFail" ${PM.api.flags.netFail ? 'checked' : ''}> Сбой сохранения и отправки</label>
        <label><input type="checkbox" data-demo-flag="axonOff" ${PM.api.flags.axonOff ? 'checked' : ''}> AXON недоступен</label>
        <label><input type="checkbox" data-demo-live ${PM.store.get('live') ? 'checked' : ''}> Входящие сообщения раз в 50 с</label></div>
      <div class="demo-sec row" style="gap:8px"><button class="btn ghost sm" data-demo="logout">${icon('logout', 'sm')}Экран входа</button><button class="btn ghost sm" data-demo="reset">${icon('refresh', 'sm')}Сбросить демо</button></div>`);
  }
  async function act(kind, v) {
    const me = PM.store.me();
    switch (kind) {
      case 'toggle': PM.store.set('demoOpen', !PM.store.get('demoOpen')); draw(); break;
      case 'role': { PM.store.set('uid', PM.app.DEMO_USER[v]); draw(); const h = `#/${PM.shell.prefix(PM.store.me().role)}/home`; if (location.hash === h) PM.app.render(); else location.hash = h; break; }
      case 'theme': PM.store.set('theme', v); draw(); break;
      case 'state': {
        PM.store.set('demoState', v); draw();
        const h = location.hash.replace(/([?&])state=[^&]*&?/, '$1').replace(/[?&]$/, '');
        if (h !== location.hash) location.hash = h; else PM.app.render();
        break;
      }
      case 'notif': if (me) { PM.api.setNotif(me.id, v); draw(); PM.shell.toast('Состояние push: ' + NOTIF.find((n) => n[0] === v)[1]); } break;
      case 'ev-chat': {
        const room = (location.hash.match(/\/chat\/([^/?]+)/) || [])[1];
        const r = PM.api.demoIncoming(me.id, room && room !== 'rooms' ? room : null);
        if (!room) PM.shell.toast(html`<b>${r.author}</b> в «${r.room.title}»: ${r.text}`, { action: { label: 'Открыть', fn: () => { location.hash = `#/${PM.shell.prefix(me.role)}/chat/${r.room.id}`; } } });
        break;
      }
      case 'ev-submit': case 'ev-submit3': {
        const n = kind === 'ev-submit' ? 1 : 3;
        const done = await PM.api.demoSubmit(n);
        if (me.role === 'student') PM.shell.toast(`Имитация: ${n === 1 ? 'работа отправлена' : n + ' работы отправлены'} другими учениками. Переключитесь на роль «Преподаватель», чтобы увидеть push.`);
        else if (!done.length) PM.shell.toast('Все доступные работы уже отправлены. Нажмите «Сбросить демо».');
        PM.api.emit('demo-review-refresh', {});
        break;
      }
      case 'ev-axon': PM.api.flags.axonTimeout = true; PM.api.emit('axon-drop', {}); PM.shell.toast('Следующий или текущий ответ AXON оборвётся'); break;
      case 'logout': PM.store.set('uid', null); location.hash = '#/login'; draw(); break;
      case 'reset': if (await PM.shell.confirm({ title: 'Сбросить демо?', text: 'Все изменения в этом браузере (отправленные работы, сообщения, решения) вернутся к исходным данным.', ok: 'Сбросить', danger: true })) { localStorage.clear(); PM.store.reset(); PM.api.reset(); draw(); } break;
    }
  }
  function offlineBar(view) {
    const h = view.querySelector('.topbar');
    const bar = document.createElement('div');
    bar.className = 'offline-bar'; bar.setAttribute('role', 'status');
    setHTML(bar, html`${icon('alert', 'sm')}<span>Нет сети. Показаны сохранённые данные, новое появится, когда связь вернётся.</span>`);
    if (h) h.after(bar); else view.prepend(bar);
  }
  PM.demo = { build, draw, state, offlineBar, sync: draw };
})(window.PM);
