/* Админка: сводка, люди и доступы, потоки, «Качество AXON». Вторая волна прототипа. */
(function (PM) {
  'use strict';
  const { html, $, $$, on, fmt, plural, setHTML } = PM.dom;
  const icon = PM.icon; const ui = PM.ui; const S = PM.screens; const R = PM.router;
  const AD = () => PM.api.admin;
  const seen = (t) => (!t ? 'входа ещё не было' : Date.now() - t < 864e5 ? 'сегодня, ' + fmt.time(t) : fmt.short(t) + (Date.now() - t > 14 * 864e5 ? ` · ${fmt.waitDays(t)} дн. назад` : ''));
  const sec = (v) => v.toFixed(1).replace('.', ',') + ' с';

  /* Заменить адрес без перерисовки экрана (фильтры) и сохранить его для «Назад» */
  function setQuery(base, q) {
    const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v)).toString();
    const full = base + (qs ? '?' + qs : '');
    R.forget(location.hash); history.replaceState(null, '', full); R.remember(full);
  }

  /* Модалка с формой. submit(form) → Promise; ошибка остаётся в модалке, модалка не закрывается (A-03) */
  function modal({ title, body, ok = 'Готово', danger = false, cancel = 'Отмена', submit, locked = false }) {
    return new Promise((resolve) => {
      const opener = document.activeElement; const host = $('#modal-root');
      setHTML(host, html`<div class="overlay" ${locked ? '' : html`data-m="x"`}></div>
        <form class="modal sheet" role="dialog" aria-modal="true" aria-labelledby="m-title" novalidate>
          <h2 id="m-title">${title}</h2><div class="col gap4 m-body">${body}</div>
          <div class="err-summary" role="alert" data-m-err hidden></div>
          <div class="row m-acts">${cancel ? html`<button type="button" class="btn secondary" data-m="x">${cancel}</button>` : ''}${ok ? html`<button type="submit" class="btn ${danger ? 'danger' : 'primary'}">${ok}</button>` : ''}</div></form>`);
      const f = $('form', host);
      const close = (v) => { setHTML(host, ''); document.removeEventListener('keydown', key); if (opener && opener.focus) opener.focus(); resolve(v); };
      const key = (e) => {
        if (e.key === 'Escape' && !locked) close(null);
        if (e.key === 'Tab') { const fs = $$('button,input,select,textarea', f).filter((el) => !el.disabled); const i = fs.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); fs[fs.length - 1].focus(); } else if (!e.shiftKey && i === fs.length - 1) { e.preventDefault(); fs[0].focus(); } }
      };
      document.addEventListener('keydown', key);
      host.onclick = (e) => { const a = e.target.closest('[data-m="x"]'); if (a) close(null); const c = e.target.closest('[data-copy]'); if (c) { navigator.clipboard && navigator.clipboard.writeText(c.dataset.copy).catch(() => {}); PM.shell.toast('Скопировано'); } };
      f.addEventListener('submit', async (e) => {
        e.preventDefault(); if (!submit) { close(true); return; }
        const btn = $('button[type=submit]', f); const err = $('[data-m-err]', f); btn.disabled = true; err.hidden = true;
        $$('[aria-invalid]', f).forEach((i) => i.removeAttribute('aria-invalid')); $$('.helper.err', f).forEach((h) => { h.hidden = true; });
        try { close(await submit(f) || true); } catch (ex) {
          err.hidden = false; err.textContent = ex.message; btn.disabled = false;
          if (ex.fields) {
            let first = null;
            Object.entries(ex.fields).forEach(([n, msg]) => { const i = f.elements[n]; const h = $('#e-' + n, f); if (!i) return; i.setAttribute('aria-invalid', 'true'); if (h) { h.textContent = msg; h.hidden = false; } if (!first) first = i; });
            if (first) first.focus();
          }
        }
      });
      setTimeout(() => { const first = $('input,select', f) || $('button[type=submit]', f); if (first) first.focus(); }, 30);
    });
  }
  const showPassword = (name, login, pass) => modal({ title: 'Новый пароль', ok: 'Готово', cancel: '', locked: true, body: html`<p class="t2 muted">Логин и пароль для: <b>${name}</b>. Пароль показываем один раз, после закрытия окна его не будет видно. Окно закрывается только кнопкой «Готово».</p>
    <div class="pw-box"><span class="grow"><small class="faint">Логин</small><b>${login}</b></span></div>
    <div class="pw-box"><span class="grow"><small class="faint">Пароль</small><b data-pw>${pass}</b></span><button type="button" class="btn secondary sm" data-copy="${pass}">${icon('copy', 'sm')}Скопировать</button></div>` });

  /* Действия с аккаунтом — общие для меню «⋯» и карточки */
  async function act(kind, p, after) {
    if (kind === 'reset') {
      const pass = await modal({ title: 'Новый пароль?', ok: 'Выдать новый пароль', body: html`<p class="muted">${p.name} (${p.login}). Логин останется прежним. Человек выйдет со всех устройств, новый пароль покажем один раз.</p>`, submit: () => AD().resetPassword(p.id) });
      if (pass) { await showPassword(p.name, p.login, pass); after && after(); }
    }
    if (kind === 'transfer') {
      const opts = AD().streamOptions().filter((o) => !p.streams.includes(o.code));
      const r = await modal({ title: 'Перевести в другой поток', ok: 'Перевести', body: html`<p class="t2 muted">${p.name} (${p.login}) · сейчас: ${p.streamLabels.join(', ') || 'без потока'}</p>
        <label class="field"><span>Новый поток</span><select class="input" name="to">${opts.map((o) => html`<option value="${o.code}">${o.label}${o.teachers.length ? '' : ' — нет активного преподавателя'}</option>`)}</select><small class="helper err" id="e-to" hidden></small></label>
        <ul class="t2 muted conseq"><li>Чат сменится: ученик попадёт в чат нового потока, прежний чат станет недоступен.</li><li>Домашки, прогресс по модулям, история AXON сохранятся.</li><li>Работы будут проверять преподаватели нового потока.</li><li>Если новый поток — «Личное обучение», откроется «Чат с преподавателями».</li></ul>`,
        submit: (f) => AD().transfer(p.id, f.to.value) });
      if (r) { PM.shell.toast(`Переведено: ${r.streamLabels.join(', ')}`); after && after(); }
    }
    if (kind === 'close') {
      const r = await modal({ title: 'Закрыть доступ?', ok: 'Закрыть доступ', danger: true, body: html`<p class="muted">${p.name} (${p.login}): вход станет невозможен, открытые сессии завершатся. Домашки, переписка и история AXON сохранятся, доступ можно вернуть.</p>${p.role === 'teacher' ? html`<p class="t2 warn-t">Если это единственный преподаватель потока, работы учеников останутся без проверяющего.</p>` : ''}`, submit: () => AD().setActive(p.id, false) });
      if (r) { PM.shell.toast('Доступ закрыт. Данные сохранены'); after && after(); }
    }
    if (kind === 'open') {
      const r = await modal({ title: 'Вернуть доступ?', ok: 'Вернуть доступ', body: html`<p class="muted">${p.name}: вход снова будет работать с прежним логином «${p.login}». Если пароль забыт, выдайте новый отдельно.</p>`, submit: () => AD().setActive(p.id, true) });
      if (r) { PM.shell.toast('Доступ возвращён'); after && after(); }
    }
  }
  const menuItems = (p) => html`<button role="menuitem" tabindex="-1" data-pact="open-card">Открыть карточку</button><button role="menuitem" tabindex="-1" data-pact="reset">Новый пароль</button>${p.active ? html`<button role="menuitem" tabindex="-1" class="danger-t" data-pact="close">Закрыть доступ</button>` : html`<button role="menuitem" tabindex="-1" data-pact="open">Вернуть доступ</button>`}`;

  /* ---------- A-01 Сводка ---------- */
  function adminHome(ctx) {
    const d = ctx.data;
    const card = (href, v, l, cls = '', sub = '') => html`<a class="stat ${cls}" href="${href}"><span class="v">${v}</span><span class="l">${l}</span>${sub ? html`<small class="faint">${sub}</small>` : ''}</a>`;
    return html`${ui.header({ title: 'Сводка' })}
    <div class="page">
      <div class="hello"><span class="t2 faint">${fmt.weekday()}</span><h2 class="page-h">Что требует внимания</h2></div>
      ${d.noTeacher.length ? html`<a class="card warn row attn" href="#/a/streams">${icon('alert')}<span class="grow"><b>В потоке нет активного преподавателя: ${d.noTeacher.join(', ')}</b><span class="t2 muted d-block">Работы учеников этого потока никто не проверяет. Назначьте преподавателя.</span></span>${icon('right', 'sm')}</a>` : ''}
      <div class="stats adm-stats">
        ${card('#/a/homework', d.review, plural(d.review, ['работа ждёт проверки', 'работы ждут проверки', 'работ ждут проверки']), d.oldest > 7 ? 'warn' : '', d.review ? `самая старая — ${d.oldest} дн.` : 'всё проверено')}
        ${card('#/a/homework', d.orphan, plural(d.orphan, ['работа без проверяющего', 'работы без проверяющего', 'работ без проверяющего']), d.orphan ? 'warn' : '', d.noTeacher.length ? d.noTeacher.join(', ') : '')}
        ${card('#/a/chat', d.chat, 'непрочитанных в чатах', '', 'по всем комнатам')}
        ${card('#/a/axon-quality', d.axon.answers, 'ответов AXON за 7 дн.', d.axon.cut + d.axon.timeout ? 'warn' : '', `${d.axon.cut} ${plural(d.axon.cut, ['обрыв', 'обрыва', 'обрывов'])} · ${d.axon.timeout} ${plural(d.axon.timeout, ['таймаут', 'таймаута', 'таймаутов'])} · пример`)}
        ${card('#/a/people?stale=1', d.stale, plural(d.stale, ['ученик давно не заходил', 'ученика давно не заходили', 'учеников давно не заходили']), d.stale ? 'warn' : '', 'больше 14 дней')}
        ${card('#/a/people', d.people.students + d.people.teachers, 'активных аккаунтов', '', `${d.people.students} учеников · ${d.people.teachers} преподавателей · закрыто ${d.people.closed}`)}
      </div>
      <div class="row wrap adm-quick"><a class="btn primary" href="#/a/people?new=1">${icon('plus', 'sm')}Добавить человека</a><a class="btn secondary" href="#/a/streams">${icon('layers', 'sm')}Потоки и преподаватели</a></div>
    </div>`;
  }
  const baseHome = S.home;
  S.home = { ...baseHome,
    load: (ctx) => (ctx.me.role === 'admin' ? AD().summary() : baseHome.load(ctx)),
    view: (ctx) => (ctx.me.role === 'admin' ? adminHome(ctx) : baseHome.view(ctx)),
    mount: (root, ctx) => (ctx.me.role === 'admin' ? null : baseHome.mount(root, ctx)) };

  /* ---------- A-02 Люди ---------- */
  const ROLES = [['', 'Все'], ['student', 'Ученики'], ['teacher', 'Преподаватели'], ['admin', 'Админ']];
  function peopleRows(list) {
    if (!list.length) return ui.empty({ icon: 'search', title: 'Никого не нашли', text: 'Проверьте написание или сбросьте фильтры.', action: html`<button class="btn secondary" data-act="clear">Сбросить фильтры</button>` });
    return html`<table class="tbl"><thead><tr><th>Человек</th><th>Логин</th><th>Роль</th><th>Поток</th><th>Последний вход</th><th><span class="sr">Действия</span></th></tr></thead><tbody>
      ${list.map((p) => html`<tr class="${p.active ? '' : 'closed'}" data-id="${p.id}">
        <td class="t-main"><a class="row p-link" href="#/a/people/${p.id}">${ui.avatar(p.name)}<span class="grow"><b class="ttl">${p.name}</b>${p.active ? '' : html`<span class="pill blank">Доступ закрыт</span>`}${p.stale ? html`<span class="pill pending">давно не заходит · ${fmt.waitDays(p.lastSeen)} дн.</span>` : ''}</span></a></td>
        <td data-l="Логин"><code>${p.login}</code></td><td data-l="Роль">${p.roleLabel}</td><td data-l="Поток">${p.streamLabels.join(', ') || '—'}</td><td data-l="Вход">${seen(p.lastSeen)}</td>
        <td class="t-act"><div class="menu-wrap"><button class="iconbtn" data-act="menu" aria-haspopup="menu" aria-expanded="false" aria-label="Действия: ${p.name}, ${p.login}">${icon('more', 'sm')}</button></div></td></tr>`)}</tbody></table>`;
  }
  S.people = {
    nav: () => 'people', title: 'Люди',
    skeleton: () => html`${ui.header({ title: 'Люди и доступы' })}<div class="page">${ui.skeletonList(8)}</div>`,
    load: () => AD().people({}),
    view: (ctx) => {
      const q = ctx.route.query; const streams = PM.api.db.streams.filter((s) => !s.hidden);
      return html`${ui.header({ title: 'Люди и доступы', actions: html`<button class="btn primary sm" data-act="new">${icon('plus', 'sm')}<span class="only-d">Добавить человека</span><span class="only-m">Добавить</span></button>` })}
      <div class="page">
        <div class="filters">
          <label class="search-f">${icon('search', 'sm')}<input class="input" type="search" name="q" value="${q.q || ''}" placeholder="Имя или логин" aria-label="Поиск по имени или логину" autocomplete="off"></label>
          <div class="seg" role="group" aria-label="Роль">${ROLES.map(([v, l]) => html`<button type="button" data-role="${v}" class="${(q.role || '') === v ? 'on' : ''}" aria-pressed="${(q.role || '') === v}">${l}</button>`)}</div>
          <select class="input sel" name="stream" aria-label="Поток"><option value="">Все потоки</option>${streams.map((s) => html`<option value="${s.code}" ${q.stream === s.code ? 'selected' : ''}>${s.label}</option>`)}</select>
          <select class="input sel" name="status" aria-label="Доступ"><option value="">Активные и закрытые</option><option value="active" ${q.status === 'active' ? 'selected' : ''}>Только активные</option><option value="closed" ${q.status === 'closed' ? 'selected' : ''}>Только закрытые</option></select>
          ${q.stale ? html`<button class="chip on" data-act="unstale">Давно не заходили ✕</button>` : ''}
        </div>
        <p class="t2 faint" data-count aria-live="polite"></p>
        <div data-rows></div>
      </div>`;
    },
    mount(root, ctx) {
      const all = ctx.data; const offs = [];
      const q = { ...ctx.route.query }; delete q.new;
      const draw = () => {
        const s = (q.q || '').trim().toLowerCase();
        const list = all.filter((p) => (!s || p.name.toLowerCase().includes(s) || p.login.toLowerCase().includes(s)) && (!q.role || p.role === q.role) && (!q.stream || p.streams.includes(q.stream)) && (!q.status || (q.status === 'active' ? p.active : !p.active)) && (!q.stale || p.stale));
        setHTML($('[data-rows]', root), peopleRows(list));
        $('[data-count]', root).textContent = `${list.length} из ${all.length}`;
        setQuery('#/a/people', q);
      };
      draw();
      const reload = () => PM.app.render();
      offs.push(on(root, 'input', 'input[name=q]', (e, i) => { q.q = i.value; draw(); }));
      offs.push(on(root, 'change', 'select', (e, s) => { q[s.name] = s.value; draw(); }));
      offs.push(on(root, 'click', '[data-role]', (e, b) => { q.role = b.dataset.role; $$('[data-role]', root).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); draw(); }));
      offs.push(on(root, 'click', '[data-act="clear"]', () => { Object.keys(q).forEach((k) => delete q[k]); $('input[name=q]', root).value = ''; $$('select', root).forEach((s) => { s.value = ''; }); $$('[data-role]', root).forEach((x) => x.classList.toggle('on', !x.dataset.role)); draw(); }));
      offs.push(on(root, 'click', '[data-act="unstale"]', (e, b) => { delete q.stale; b.remove(); draw(); }));
      const closeMenus = () => $$('.menu-pop', root).forEach((m) => { m.previousElementSibling.setAttribute('aria-expanded', 'false'); m.remove(); });
      offs.push(on(root, 'click', '[data-act="menu"]', (e, b) => {
        e.stopPropagation(); const open = b.getAttribute('aria-expanded') === 'true'; closeMenus(); if (open) return;
        const p = all.find((x) => x.id === b.closest('tr').dataset.id);
        const m = document.createElement('div'); m.className = 'menu-pop'; m.setAttribute('role', 'menu'); setHTML(m, menuItems(p));
        b.after(m); b.setAttribute('aria-expanded', 'true'); m.querySelector('button').focus();
      }));
      offs.push(on(root, 'click', '[data-pact]', (e, b) => {
        const p = all.find((x) => x.id === b.closest('tr').dataset.id); const k = b.dataset.pact; closeMenus();
        if (k === 'open-card') location.hash = '#/a/people/' + p.id; else act(k, p, reload);
      }));
      const outside = (e) => { if (!e.target.closest('.menu-wrap')) closeMenus(); };
      const esc = (e) => {
        const m = $('.menu-pop', root); if (!m) return;
        const btn = m.previousElementSibling; const items = $$('[role=menuitem]', m); const i = items.indexOf(document.activeElement);
        if (e.key === 'Escape') { closeMenus(); btn.focus(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
        else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
        else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
        else if (e.key === 'Tab') closeMenus();
      };
      document.addEventListener('click', outside); document.addEventListener('keydown', esc);
      offs.push(() => { document.removeEventListener('click', outside); document.removeEventListener('keydown', esc); });
      const create = async () => {
        const streams = PM.api.db.streams.filter((s) => !s.hidden);
        const r = await modal({ title: 'Добавить человека', ok: 'Создать и показать пароль', body: html`
          <label class="field"><span>Имя и фамилия</span><input class="input" name="name" autocomplete="off" aria-describedby="e-name"><small class="helper err" id="e-name" hidden></small></label>
          <label class="field"><span>Логин</span><input class="input" name="login" autocomplete="off" spellcheck="false" placeholder="i.familiya" aria-describedby="e-login h-login"><small class="helper err" id="e-login" hidden></small><small class="helper" id="h-login">Латиница. Если имя совпадает с кем-то, логин их различит.</small></label>
          <label class="field"><span>Роль</span><select class="input" name="role"><option value="student">Ученик</option><option value="teacher">Преподаватель</option><option value="admin">Админ</option></select></label>
          <label class="field"><span>Поток</span><select class="input" name="stream">${streams.map((s) => html`<option value="${s.code}">${s.label}</option>`)}</select><small class="helper">Ученику «Личного обучения» сразу откроется «Чат с преподавателями».</small></label>`,
          submit: (f) => AD().createPerson({ name: f.name.value.trim(), login: f.login.value.trim().toLowerCase(), role: f.role.value, stream: f.stream.value }) });
        if (r) { await showPassword(r.person.name, r.person.login, r.password); location.hash = '#/a/people/' + r.person.id; }
      };
      offs.push(on(root, 'click', '[data-act="new"]', create));
      if (ctx.route.query.new) setTimeout(create, 50);
      return () => offs.forEach((f) => f());
    },
  };

  /* ---------- A-03 Человек ---------- */
  S.person = {
    nav: () => 'people', title: 'Человек',
    skeleton: () => html`${ui.header({ title: 'Человек', back: '#/a/people' })}<div class="page narrow">${ui.skeletonList(3)}</div>`,
    load: (ctx) => AD().person(ctx.route.params.id),
    view: (ctx) => {
      const p = ctx.data;
      const row = (k, v) => html`<div class="kv"><span class="faint">${k}</span><span>${v}</span></div>`;
      const action = (k, title, hint, cls = 'secondary') => html`<div class="act-row"><div class="grow"><b>${title}</b><p class="t2 muted">${hint}</p></div><button class="btn ${cls} sm" data-pact="${k}">${title}</button></div>`;
      return html`${ui.header({ title: p.name, sub: p.login, back: '#/a/people' })}
      <div class="page narrow col gap4">
        <section class="card"><div class="row">${ui.avatar(p.name, 'lg')}<div class="grow"><h3>${p.name}</h3><div class="t2 muted">${p.roleLabel}${p.streamLabels.length ? ' · ' + p.streamLabels.join(', ') : ''}</div></div>${p.active ? html`<span class="pill accepted">Доступ открыт</span>` : html`<span class="pill blank">Доступ закрыт</span>`}</div>
          ${row('Логин', html`<code>${p.login}</code>`)}${row('Последний вход', seen(p.lastSeen))}${row('Сессии', p.sessions ? `${p.sessions} ${plural(p.sessions, ['устройство', 'устройства', 'устройств'])}` : 'нет активных')}
          ${p.role === 'student' ? row('Домашки', `принято ${p.hw.accepted} из 8${p.hw.pending ? ` · ${p.hw.pending} на проверке` : ''}`) : ''}
          ${p.dm ? row('Личный чат', html`<a class="link hit" href="#/a/chat/${p.dm.id}">Чат с преподавателями →</a>`) : ''}
          ${p.role === 'student' ? row('Поток', html`<span class="row wrap gap2"><span>${p.streamLabels.join(', ') || 'не назначен'}</span><button class="btn secondary sm" data-pact="transfer">Перевести</button></span>`) : p.role === 'teacher' ? row('Потоки', html`<a class="link hit" href="#/a/streams">${p.streamLabels.join(', ') || 'не назначен'} · назначить в «Потоках»</a>`) : ''}</section>
        <section class="card"><h3>Доступ</h3>
          ${action('reset', 'Новый пароль', 'Логин останется прежним, все устройства выйдут из кабинета. Новый пароль покажем один раз.')}
          ${p.active ? action('close', 'Закрыть доступ', 'Человек не сможет войти. Данные сохранятся, доступ можно вернуть.', 'danger-outline') : action('open', 'Вернуть доступ', 'Человек снова сможет войти со своим логином.')}
        </section>
      </div>`;
    },
    mount(root, ctx) { return on(root, 'click', '[data-pact]', (e, b) => act(b.dataset.pact, ctx.data, () => PM.app.render())); },
  };

  /* ---------- Потоки и преподаватели ---------- */
  S.streams = {
    nav: () => 'streams', title: 'Потоки',
    skeleton: () => html`${ui.header({ title: 'Потоки и преподаватели' })}<div class="page">${ui.skeletonList(4)}</div>`,
    load: async () => ({ streams: await AD().streams(), teachers: AD().allTeachers() }),
    view: (ctx) => {
      const { streams, teachers } = ctx.data;
      const opts = (exclude, sel = '') => teachers.filter((t) => t.active && !exclude.includes(t.id)).map((t) => html`<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${t.name}</option>`);
      return html`${ui.header({ title: 'Потоки и преподаватели' })}
      <div class="page col gap4">
        <p class="t2 muted">Работы ученика проверяют активные преподаватели его потока. Если активного нет, работы попадают в «без проверяющего».</p>
        ${streams.map((s) => html`<section class="card stream-card ${s.noActive ? 'warn' : ''}" data-stream="${s.code}">
          <div class="row wrap"><h3 class="grow">${s.label}${s.hidden ? html` <span class="pill blank">скрыт</span>` : ''}${s.individual ? html` <span class="pill draft">личная комната у каждого ученика</span>` : ''}</h3>
            <span class="t2 muted">${s.students} ${plural(s.students, ['ученик', 'ученика', 'учеников'])}${s.closedStudents ? ` · закрыто ${s.closedStudents}` : ''}${s.pending ? ` · ${s.pending} ${plural(s.pending, ['работа ждёт', 'работы ждут', 'работ ждут'])}` : ''}</span></div>
          ${s.noActive && !s.hidden ? html`<p class="t2 warn-t" role="status">${icon('alert', 'sm')} В потоке нет активного преподавателя — работы учеников никто не проверяет.</p>` : ''}
          <div class="caps">Преподаватели потока</div>
          <div class="chips">${s.teachers.length ? s.teachers.map((t) => html`<span class="chip t-chip ${t.active ? '' : 'off'}">${t.name}${t.active ? '' : ' · доступ закрыт'}<button class="x" data-unassign="${t.id}" data-name="${t.name}" data-last="${t.active && s.teachers.filter((x) => x.active).length === 1 ? '1' : ''}" aria-label="Убрать ${t.name} из потока ${s.label}">${icon('x', 'sm')}</button></span>`) : html`<span class="t2 faint">никого</span>`}</div>
          <form class="row wrap assign" data-assign><select class="input sel" name="t" aria-label="Преподаватель для потока ${s.label}"><option value="">Выберите преподавателя…</option>${opts(s.teachers.filter((t) => t.active).map((t) => t.id))}</select><button class="btn secondary sm">Назначить</button></form>
          ${s.individual ? html`<div class="caps">Ученики · в личной комнате все преподаватели потока и админ</div><div class="list">${s.personal.map((p) => html`<div class="li"><span class="grow"><b class="ttl">${p.name}</b><span class="sub">${p.login}${p.active ? '' : ' · доступ закрыт'}</span></span>
            ${p.room ? html`<a class="btn secondary sm" href="#/a/chat/${p.room}" aria-label="Написать в личную комнату: ${p.name}">${icon('chat', 'sm')}Написать</a>` : ''}</div>`)}</div>` : ''}
        </section>`)}
      </div>`;
    },
    mount(root) {
      const offs = []; const re = () => PM.app.render();
      offs.push(on(root, 'submit', '[data-assign]', async (e, f) => { e.preventDefault(); if (!f.t.value) { f.t.focus(); return; } const code = f.closest('[data-stream]').dataset.stream; await AD().assignTeacher(code, f.t.value); PM.shell.toast('Преподаватель назначен'); re(); }));
      offs.push(on(root, 'click', '[data-unassign]', async (e, b) => {
        const card = b.closest('[data-stream]'); const name = b.dataset.name; const last = b.dataset.last === '1';
        const ok = await PM.shell.confirm({ title: 'Убрать из потока?', text: `${name}: работы и чат этого потока станут недоступны. Аккаунт и прошлые проверки сохранятся.${last ? ' Это последний активный преподаватель: работы этого потока останутся без проверяющего.' : ''}`, ok: 'Убрать', danger: true });
        if (ok) { await AD().unassignTeacher(card.dataset.stream, b.dataset.unassign); re(); }
      }));
      return () => offs.forEach((f) => f());
    },
  };

  /* ---------- «Ещё» (нижняя панель админа на телефоне) ---------- */
  S.more = {
    nav: () => 'more', title: 'Ещё',
    view: () => {
      const keys = ['home', 'people', 'homework', 'chat'];
      const items = PM.shell.NAV.a.filter((it) => !keys.includes(it[0]));
      return html`${ui.header({ title: 'Ещё' })}<div class="page narrow"><nav class="list" aria-label="Другие разделы">
        ${items.map(([k, ic, l]) => html`<a class="li" href="#/a/${k}">${ic === 'axon' ? PM.axonMark(20) : icon(ic)}<span class="grow ttl">${l}</span>${icon('right', 'sm chev')}</a>`)}
        <a class="li" href="#/a/settings">${icon('settings')}<span class="grow ttl">Профиль и настройки</span>${icon('right', 'sm chev')}</a></nav></div>`;
    },
  };

  /* ---------- A-06/A-07 Качество AXON ---------- */
  const OUT = { ok: ['accepted', 'Ответ получен'], cut: ['pending', 'Оборвался'], timeout: ['revision', 'Таймаут'], empty: ['revision', 'Пустой ответ'] };
  const outPill = (o) => html`<span class="pill ${OUT[o][0]}">${OUT[o][1]}</span>`;
  function axList(d) {
    const m = d.metrics;
    const met = html`<div class="stats ax-stats">
      <div class="stat"><span class="v">${m.answers}</span><span class="l">ответов · ${m.dialogs} ${plural(m.dialogs, ['диалог', 'диалога', 'диалогов'])}</span></div>
      <div class="stat"><span class="v">${sec(m.avg)}</span><span class="l">среднее время · p95 ${sec(m.p95)}</span></div>
      <div class="stat ${m.cut ? 'warn' : ''}"><span class="v">${m.cut}</span><span class="l">обрывов</span></div>
      <div class="stat ${m.timeout + m.empty ? 'warn' : ''}"><span class="v">${m.timeout + m.empty}</span><span class="l">таймаутов ${m.timeout} · пустых ${m.empty}</span></div></div>
      <p class="t1 faint">Все цифры — пример для прототипа.</p>`;
    const rows = d.list.length ? html`<div class="list">${d.list.slice(0, 60).map((c) => html`<a class="li" href="#/a/axon-quality/${c.uid}/${encodeURIComponent(c.id)}">${ui.avatar(c.name)}<span class="grow"><b class="ttl">${c.title}</b><span class="sub">${c.name} · ${c.login} · ${c.messages} сообщ.</span></span>
        <span class="q-meta"><small class="faint">${fmt.short(c.at)}</small><span class="row gap2">${c.problems.map(outPill)}${c.bad ? html`<span class="pill revision">${icon('alert', 'sm')}плохой ответ</span>` : ''}</span></span></a>`)}</div>${d.list.length > 60 ? html`<p class="t2 faint">Показаны 60 последних из ${d.list.length}. Уточните фильтр.</p>` : ''}`
      : ui.empty({ icon: 'search', title: 'Под фильтр ничего не попало', text: 'Расширьте период или снимите отметки.' });
    return html`${met}<div class="sec-h"><h2>Диалоги</h2><span class="t2 faint">${d.list.length}</span></div>${rows}`;
  }
  S.axq = {
    nav: () => 'axon-quality', title: 'Качество AXON',
    load: () => AD().axonQuality({ p: 7 }).then((d) => d.people),
    view: (ctx) => {
      const q = ctx.route.query; const p = q.p || '7';
      return html`${ui.header({ title: 'Качество AXON' })}
      <div class="page">
        <div class="filters">
          <select class="input sel" name="u" aria-label="Человек"><option value="">Все люди</option>${ctx.data.map((u) => html`<option value="${u.id}" ${q.u === u.id ? 'selected' : ''}>${u.name} · ${u.login} · ${u.count} ${plural(u.count, ['чат', 'чата', 'чатов'])}</option>`)}</select>
          <div class="seg" role="group" aria-label="Период">${[['7', '7 дн.'], ['14', '14 дн.'], ['30', '30 дн.'], ['90', '90 дн.']].map(([v, l]) => html`<button type="button" data-p="${v}" class="${p === v ? 'on' : ''}" aria-pressed="${p === v}">${l}</button>`)}</div>
          <label class="check"><input type="checkbox" name="bad" ${q.bad ? 'checked' : ''}> Отмеченные плохие</label>
          <label class="check"><input type="checkbox" name="err" ${q.err ? 'checked' : ''}> С ошибками</label>
        </div>
        <div data-res aria-live="polite">${ui.skeletonList(6)}</div>
      </div>`;
    },
    mount(root, ctx) {
      const q = { p: '7', ...ctx.route.query }; let seq = 0; const offs = [];
      const load = async () => {
        const my = ++seq; setHTML($('[data-res]', root), ui.skeletonList(6)); setQuery('#/a/axon-quality', q);
        try { const d = await AD().axonQuality(q); if (my === seq && root.isConnected) setHTML($('[data-res]', root), axList(d)); } catch (e) { setHTML($('[data-res]', root), ui.errorBox(e.message)); }
      };
      load();
      offs.push(on(root, 'change', 'select[name=u]', (e, s) => { q.u = s.value; load(); }));
      offs.push(on(root, 'change', 'input[type=checkbox]', (e, i) => { q[i.name] = i.checked ? '1' : ''; load(); }));
      offs.push(on(root, 'click', '[data-p]', (e, b) => { q.p = b.dataset.p; $$('[data-p]', root).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); load(); }));
      offs.push(on(root, 'click', '[data-act="retry"]', load));
      return () => { seq++; offs.forEach((f) => f()); };
    },
  };

  /* ---------- A-08 Диалог AXON (просмотр админом) ---------- */
  function axMsg(m, first) {
    if (m.role === 'user') return html`<div class="ax-m user" data-i="${m.i}"><div class="ax-h"><b>${first}</b><time class="faint">${fmt.dayTime(m.at)}</time></div><div class="bubble"><div class="txt">${m.text}</div></div></div>`;
    const f = m.flag || {};
    return html`<div class="ax-m axon ${f.bad ? 'bad' : ''}" data-i="${m.i}">
      <div class="ax-h">${PM.axonMark(18)}<b>AXON</b><time class="faint">${fmt.time(m.at)} · за ${sec(m.ms / 1000)}</time>${outPill(m.outcome)}</div>
      <div class="bubble">${m.text ? ui.md(m.text) : html`<p class="faint">${m.outcome === 'timeout' ? 'Ответ не пришёл за 60 с.' : 'Модель вернула пустой ответ.'}</p>`}</div>
      <div class="ax-tools row wrap"><button class="btn ${f.bad ? 'danger-outline' : 'ghost'} sm" data-bad aria-pressed="${!!f.bad}">${icon('alert', 'sm')}${f.bad ? 'Отмечен как плохой · снять' : 'Отметить плохой ответ'}</button>
        ${f.note ? html`<span class="t2 note-t">Заметка: ${f.note}</span>` : ''}<button class="btn ghost sm" data-note>${icon('edit', 'sm')}${f.note ? 'Изменить заметку' : 'Заметка'}</button></div>
      <form class="note-f" data-note-f hidden><textarea class="textarea" name="note" rows="2" placeholder="Что не так с ответом: неточность, не по курсу, слишком длинно…" aria-label="Заметка к ответу">${f.note || ''}</textarea><div class="row gap2"><button class="btn primary sm">Сохранить</button><button type="button" class="btn ghost sm" data-note-x>Отмена</button></div></form>
    </div>`;
  }
  S.axqConv = {
    nav: () => 'axon-quality', title: 'Диалог AXON',
    skeleton: () => html`${ui.header({ title: 'Диалог AXON', back: '#/a/axon-quality' })}<div class="page narrow">${ui.skeletonList(5)}</div>`,
    load: (ctx) => AD().axonDialog(ctx.route.params.c),
    view: (ctx) => {
      const d = ctx.data; const c = d.conv; const first = c.name.split(' ')[0];
      return html`${ui.header({ title: c.title, sub: `${c.name} · ${c.login} · ${fmt.day(c.at)} · ${c.messages} сообщ.`, back: `#/a/axon-quality?u=${c.uid}` })}
      <div class="page narrow ax-page">
        <p class="t2 faint ax-note">Просмотр для админа: ученик эту страницу не видит, отметки и заметки видны только в админке.</p>
        <div class="ax-top" data-top>${d.start > 0 ? html`<button class="linkbtn" data-more>Показать более ранние (${d.start})</button>` : html`<span class="t2 faint">Это начало диалога · ${fmt.day(c.at)}</span>`}</div>
        <div class="ax-feed" data-feed>${d.messages.map((m) => axMsg(m, first))}</div>
      </div>`;
    },
    mount(root, ctx) {
      const d = ctx.data; const cid = d.conv.id; const first = d.conv.name.split(' ')[0];
      let start = d.start; let loading = false; const offs = [];
      const msgs = new Map(d.messages.map((m) => [m.i, m]));
      if (start > 0) requestAnimationFrame(() => { const se = document.scrollingElement; se.scrollTop = se.scrollHeight; });
      const top = $('[data-top]', root);
      async function more() {
        if (loading || start <= 0) return; loading = true;
        setHTML(top, html`<span class="spinner" aria-hidden="true"></span><span class="t2 faint">Загружаю более ранние…</span>`);
        try {
          const r = await AD().axonDialog(cid, start); const se = document.scrollingElement; const h0 = se.scrollHeight;
          r.messages.forEach((m) => msgs.set(m.i, m));
          $('[data-feed]', root).insertAdjacentHTML('afterbegin', String(html`${r.messages.map((m) => axMsg(m, first))}`));
          se.scrollTop += se.scrollHeight - h0; start = r.start;
          setHTML(top, start > 0 ? html`<button class="linkbtn" data-more>Показать более ранние (${start})</button>` : html`<span class="t2 faint">Это начало диалога · ${fmt.day(d.conv.at)}</span>`);
        } catch (e) { setHTML(top, html`<span class="t2 err">Не загрузилось.</span> <button class="linkbtn" data-more>Повторить</button>`); }
        loading = false;
      }
      offs.push(on(root, 'click', '[data-more]', more));
      const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => { if (es[0].isIntersecting) more(); }) : null;
      if (io) { setTimeout(() => io.observe(top), 600); offs.push(() => io.disconnect()); }
      const redraw = (i) => { const el = $(`.ax-m[data-i="${i}"]`, root); const t = document.createElement('div'); t.innerHTML = String(axMsg(msgs.get(i), first)); el.replaceWith(t.firstElementChild); };
      offs.push(on(root, 'click', '[data-bad]', async (e, b) => {
        const i = Number(b.closest('.ax-m').dataset.i); const m = msgs.get(i); const bad = !(m.flag && m.flag.bad);
        m.flag = await AD().axonFlag(cid, i, { bad }); redraw(i);
        PM.shell.toast(bad ? 'Ответ отмечен как плохой. Добавьте заметку, что не так' : 'Отметка снята');
        if (bad) { const el = $(`.ax-m[data-i="${i}"]`, root); $('[data-note-f]', el).hidden = false; $('textarea', el).focus(); }
      }));
      offs.push(on(root, 'click', '[data-note]', (e, b) => { const f = $('[data-note-f]', b.closest('.ax-m')); f.hidden = false; $('textarea', f).focus(); }));
      offs.push(on(root, 'click', '[data-note-x]', (e, b) => { b.closest('form').hidden = true; }));
      offs.push(on(root, 'submit', '[data-note-f]', async (e, f) => {
        e.preventDefault(); const i = Number(f.closest('.ax-m').dataset.i);
        msgs.get(i).flag = await AD().axonFlag(cid, i, { note: f.note.value.trim() }); redraw(i); PM.shell.toast('Заметка сохранена');
      }));
      return () => offs.forEach((fn) => fn());
    },
  };
})(window.PM);
