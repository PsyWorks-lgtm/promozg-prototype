/* Вход, системные состояния, настройки, заглушки второй волны. */
(function (PM) {
  'use strict';
  const { html, $, on, fmt } = PM.dom;
  const icon = PM.icon;
  const S = (PM.screens = PM.screens || {});
  const P = () => PM.shell.prefix(PM.store.me().role);

  S.login = {
    title: 'Вход',
    skeleton: () => '',
    view: (ctx) => html`<div class="auth">
      <form class="auth-card" novalidate>
        ${PM.pmMark(56)}
        <h1 class="page-h">Кабинет ProMozg</h1>
        <p class="muted">Логин и пароль выдаёт куратор курса.</p>
        <div class="err-summary" role="alert" hidden></div>
        <label class="field"><span>Логин</span><input class="input" name="login" autocomplete="username" aria-describedby="e-login" value=""><small id="e-login" class="helper err" hidden>Введите логин</small></label>
        <label class="field"><span>Пароль</span><span class="input-wrap"><input class="input" name="password" type="password" autocomplete="current-password" aria-describedby="e-pass"><button type="button" class="iconbtn eye" data-act="eye" aria-label="Показать пароль">${icon('eye', 'sm')}</button></span><small id="e-pass" class="helper err" hidden>Введите пароль</small></label>
        <fieldset class="field"><legend class="t2 muted">Войти в демо как</legend>${PM.dom.raw(['student:Ученик', 'teacher:Преподаватель', 'admin:Админ'].map((x, i) => { const [v, l] = x.split(':'); return `<label class="radio"><input type="radio" name="role" value="${v}" ${i === 0 ? 'checked' : ''}> ${l}</label>`; }).join(''))}</fieldset>
        <button class="btn primary block" type="submit">Войти</button>
        <p class="t2 muted">Не помните пароль? <a href="#" data-act="forgot">Напишите куратору</a> — он выдаст новый.</p>
        <p class="t1 faint">Прототип: подойдут любые логин и пароль, кроме «wrong».</p>
      </form></div>`,
    mount(root, ctx) {
      const form = $('form', root);
      on(root, 'click', '[data-act="eye"]', (e, b) => { const i = form.password; const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль'); PM.dom.setHTML(b, icon(show ? 'eyeOff' : 'eye', 'sm')); });
      on(root, 'click', '[data-act="forgot"]', (e) => { e.preventDefault(); PM.shell.toast('В продукте откроется чат с куратором или его контакт.'); });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const l = form.login.value.trim(), p = form.password.value;
        $('#e-login', root).hidden = !!l; $('#e-pass', root).hidden = !!p;
        form.login.setAttribute('aria-invalid', !l); form.password.setAttribute('aria-invalid', !p);
        const sum = $('.err-summary', root);
        if (!l || !p) { (l ? form.password : form.login).focus(); return; }
        const btn = $('button[type=submit]', form); btn.disabled = true; btn.textContent = 'Входим…';
        await new Promise((r) => setTimeout(r, 500));
        if (l === 'wrong') { btn.disabled = false; btn.textContent = 'Войти'; sum.hidden = false; sum.textContent = 'Логин или пароль не подошли. Проверьте раскладку и Caps Lock.'; form.password.focus(); return; }
        const role = form.role.value;
        PM.store.set('uid', PM.app.DEMO_USER[role]); PM.demo.draw();
        const next = ctx.route.query.next;
        location.hash = next && next.startsWith('#/' + PM.shell.prefix(role)) ? next : `#/${PM.shell.prefix(role)}/home`;
      });
      setTimeout(() => form.login.focus(), 50);
    },
  };

  S.sys = {
    skeleton: () => '',
    view: (ctx) => {
      const k = ctx.route.params.kind;
      const M = {
        offline: ['alert', 'Нет сети', 'Покажем новое, когда связь вернётся. Прочитанное раньше открывается из памяти телефона.'],
        update: ['refresh', 'Доступна новая версия', 'Обновление займёт пару секунд, черновики сохранятся.'],
        session: ['lock', 'Сессия истекла', 'Войдите снова — черновики и история на месте.'],
        404: ['search', 'Такой страницы нет', 'Возможно, ссылка устарела.'],
      }[k] || ['search', 'Такой страницы нет', ''];
      return html`<div class="auth"><div class="auth-card center">${PM.ui.empty({ icon: M[0], title: M[1], text: M[2], action: k === 'session' ? html`<a class="btn primary" href="#/login">Войти снова</a>` : k === 'update' ? html`<button class="btn primary" onclick="location.reload()">Обновить</button>` : html`<a class="btn primary" href="#/">На главную</a>` })}</div></div>`;
    },
  };
  S.notFound = { view: () => html`${PM.ui.header({ title: 'Не найдено', back: '#/' })}<div class="page">${PM.ui.empty({ icon: 'search', title: 'Такой страницы нет', text: 'Возможно, ссылка устарела.', action: html`<a class="btn primary" href="#/">На главную</a>` })}</div>` };
  S.wave2 = {
    nav: (r) => r.path.split('/')[2],
    view: (ctx) => html`${PM.ui.header({ title: { people: 'Люди и доступы', 'axon-quality': 'Качество AXON', materials: 'Материалы' }[ctx.route.path.split('/')[2]] || 'Скоро' })}<div class="page">${PM.ui.empty({ icon: 'clock', title: 'Во второй волне прототипа', text: 'Экран описан в карте (раздел 2.3) и появится в следующей версии. Уже готовы «Сводка», «Люди», «Потоки», «Домашки», «Чаты» и «Качество AXON».' })}</div>`,
  };

  /* Профиль и настройки: тема и уведомления (C-02, T-06) */
  function notifBlock(stateVal, compact = false) {
    const ios = stateVal === 'ios';
    if (stateVal === 'on') return html`<div class="card ok"><div class="row">${icon('check')}<div class="grow"><b>Уведомления включены на этом устройстве</b><div class="t2 muted">Придут сразу, как ученик отправит работу или ответят в чате.</div></div></div>
      <div class="row wrap" style="gap:8px;margin-top:12px"><button class="btn secondary sm" data-act="push-test">Отправить пробное</button><button class="btn ghost sm" data-act="push-off">Выключить</button></div></div>`;
    if (stateVal === 'denied') return html`<div class="card warn"><b>Уведомления заблокированы в браузере</b><ol class="t2 muted steps"><li>Нажмите на значок замка ${icon('lock', 'sm')} слева от адреса сайта</li><li>Откройте «Уведомления» и выберите «Разрешить»</li><li>Вернитесь сюда и нажмите «Проверить снова»</li></ol><button class="btn secondary sm" data-act="push-recheck">Проверить снова</button></div>`;
    if (ios) return html`<div class="card"><b>На iPhone уведомления работают только из приложения на экране «Домой»</b><ol class="t2 muted steps"><li>Откройте кабинет в Safari</li><li>Нажмите «Поделиться» ${icon('share', 'sm')}</li><li>Выберите «На экран Домой» и откройте ProMozg оттуда</li></ol></div>`;
    return html`<div class="card accent"><div class="row" style="align-items:flex-start">${icon('bell')}<div class="grow"><b>Включите уведомления, чтобы узнавать о новых домашках</b><div class="t2 muted">Счётчик в меню виден всегда, а push придёт сразу, как ученик отправит работу.</div>
      <div class="row wrap" style="gap:8px;margin-top:10px"><button class="btn secondary sm" data-act="push-on">Включить</button>${compact ? html`<button class="btn ghost sm" data-act="push-later">Позже</button>` : ''}</div></div></div></div>`;
  }
  function bindNotif(root, onChange) {
    const me = PM.store.me();
    return on(root, 'click', '[data-act^="push-"]', async (e, b) => {
      const a = b.dataset.act;
      if (a === 'push-on') { b.disabled = true; b.textContent = 'Спрашиваем разрешение…'; await new Promise((r) => setTimeout(r, 700)); PM.api.setNotif(me.id, 'on'); PM.shell.toast('Уведомления включены на этом устройстве'); }
      if (a === 'push-off') PM.api.setNotif(me.id, 'default');
      if (a === 'push-later') { sessionStorage.setItem('pushLater', '1'); }
      if (a === 'push-recheck') PM.shell.toast('Разрешение пока не выдано. Демо-панель → Push → «Включены».');
      if (a === 'push-test') PM.shell.showPush({ title: 'Проверка связи', body: 'Уведомления работают на этом устройстве', url: location.hash, tag: 'test' });
      PM.demo.draw(); onChange();
    });
  }
  S.notif = { block: notifBlock, bind: bindNotif };

  S.settings = {
    nav: () => 'settings',
    title: 'Профиль',
    load: async () => { await new Promise((r) => setTimeout(r, 250)); return null; },
    view: (ctx) => {
      const me = ctx.me; const st = me.streams.map((s) => PM.api.stream(s).label).join(', ');
      const theme = PM.store.get('theme');
      return html`${PM.ui.header({ title: 'Профиль и настройки', back: `#/${P()}/home` })}
      <div class="page narrow">
        <div class="card row" style="gap:14px">${PM.ui.avatar(me.name, 'lg')}<div class="grow"><b class="t4">${me.name}</b><div class="t2 muted">Логин ${me.login} · ${{ student: 'ученик', teacher: 'преподаватель', admin: 'админ' }[me.role]}${st ? ' · ' + st : ''}</div></div></div>
        <h2 class="sec-title">Оформление</h2>
        <div class="seg" role="group" aria-label="Тема">${[['auto', 'Как на телефоне'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([v, l]) => html`<button class="${theme === v ? 'on' : ''}" aria-pressed="${theme === v}" data-theme="${v}">${l}</button>`)}</div>
        <h2 class="sec-title">Уведомления</h2><div data-notif>${notifBlock(PM.api.notifState(me.id))}</div>
        <h2 class="sec-title">Что присылать</h2>
        <div class="list">${(me.role === 'student' ? ['Ответ преподавателя по домашке', 'Новые сообщения в чате', 'Ответы на мои сообщения'] : ['Новые работы на проверку', 'Новые сообщения в чате', 'Утренняя сводка очереди (10:00 по вашему времени)']).map((t, i) => html`<label class="li switch-row"><span class="grow">${t}</span><input type="checkbox" role="switch" ${i < 2 ? 'checked' : ''}></label>`)}</div>
        <p class="t2 faint" style="margin-top:8px">${me.role === 'teacher' ? 'Счётчик «ждут проверки» в меню виден всегда, даже без уведомлений.' : 'Напоминания приходят с 10:00 до 20:00.'}</p>
        <button class="btn danger-outline" data-act="logout" style="margin-top:24px">${icon('logout', 'sm')}Выйти</button>
      </div>`;
    },
    mount(root, ctx) {
      const offs = [];
      offs.push(on(root, 'click', '[data-theme]', (e, b) => { PM.store.set('theme', b.dataset.theme); root.querySelectorAll('[data-theme]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); PM.demo.draw(); }));
      offs.push(bindNotif(root, () => { PM.dom.setHTML($('[data-notif]', root), notifBlock(PM.api.notifState(ctx.me.id))); }));
      offs.push(on(root, 'click', '[data-act="logout"]', async () => { if (await PM.shell.confirm({ title: 'Выйти из кабинета?', text: 'На этом устройстве перестанут приходить уведомления. Черновики сохранятся.', ok: 'Выйти', danger: true })) { PM.store.set('uid', null); location.hash = '#/login'; } }));
      return () => offs.forEach((f) => f());
    },
  };
})(window.PM);
