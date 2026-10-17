/* Проверка: очередь (сначала самые старые), экран работы, карточка ученика. */
(function (PM) {
  'use strict';
  const { html, $, $$, on, fmt, setHTML, plural } = PM.dom;
  const icon = PM.icon; const ui = PM.ui;
  const S = PM.screens;
  const P = () => PM.shell.prefix(PM.store.me().role);
  const F = [['pending', 'На проверке'], ['revision', 'На доработке'], ['accepted', 'Принятые']];

  function rows(list, p) {
    return html`<div class="list qlist">${list.map((h) => html`<a class="li qrow" href="#/${p}/review/${h.id}">
      ${ui.avatar(h.studentName)}
      <span class="grow"><b class="ttl">${h.studentName}</b><span class="sub">Модуль ${h.module} · ${h.stream}${h.orphan ? html` · <span class="warn-t">нет преподавателя</span>` : ''}</span></span>
      <span class="q-meta">${h.status === 'pending' ? ui.waitPill(h.waitDays) : ui.pill(h.status)}<small class="faint only-d">${h.status === 'pending' ? 'отправлено ' + fmt.day(h.sentAt) : (h.reviewerName ? h.reviewerName.split(' ')[0] + ', ' : '') + fmt.day(h.reviewedAt)}</small></span>${icon('right', 'sm chev')}</a>`)}</div>`;
  }

  S.reviewQueue = {
    nav: (r) => (r.path.startsWith('/a/') ? 'homework' : 'review'), title: 'Проверка',
    rows,
    skeleton: () => html`${ui.header({ title: 'Проверка заданий' })}<div class="page">${ui.skeletonList(7)}</div>`,
    load: (ctx) => PM.api.reviewQueue(ctx.me.id, ctx.route.query.f || 'pending'),
    view: (ctx) => {
      const d = ctx.data; const f = ctx.route.query.f || 'pending'; const p = P();
      const list = ctx.state === 'empty' ? [] : d.list;
      const over = d.list.filter((h) => h.status === 'pending' && h.waitDays > 7).length;
      const showBanner = ctx.me.role === 'teacher' && PM.api.notifState(ctx.me.id) !== 'on' && !sessionStorage.getItem('pushLater');
      const st = PM.api.notifState(ctx.me.id);
      return html`${ui.header({ title: ctx.me.role === 'admin' ? 'Домашки · все потоки' : 'Проверка заданий', sub: `${d.counts.pending} ${plural(d.counts.pending, ['работа ждёт', 'работы ждут', 'работ ждут'])} проверки` })}
      <div class="page">
        ${showBanner ? html`<div data-banner style="margin-bottom:16px">${S.notif.block(st === 'denied' || st === 'ios' ? st : 'default', true)}</div>` : ''}
        <div class="seg q-seg" role="tablist" aria-label="Фильтр работ">${F.map(([v, l]) => html`<a role="tab" class="${v === f ? 'on' : ''}" aria-selected="${v === f}" href="#/${p}/review?f=${v}">${l}<span class="cnt">${d.counts[v]}</span></a>`)}</div>
        ${f === 'pending' && list.length ? html`<p class="t2 muted q-hint">Сначала самые старые.${over ? html` <b class="crit-t">${over} ${plural(over, ['работа ждёт', 'работы ждут', 'работ ждут'])} больше недели.</b>` : ''}</p>` : ''}
        ${list.length ? rows(list, p) : ui.empty({ icon: 'check', title: f === 'pending' ? 'Все работы проверены' : 'Здесь пока пусто', text: f === 'pending' ? 'Придёт уведомление, когда ученик отправит новую работу.' : '' })}
      </div>`;
    },
    mount(root, ctx) {
      const offs = [S.notif.bind(root, () => { const b = $('[data-banner]', root); if (b) b.remove(); })];
      // новые работы во время просмотра: не перерисовываем список, а предлагаем обновить
      offs.push(PM.api.on('homework', () => {
        if ($('[data-fresh]', root)) return;
        const bar = document.createElement('button'); bar.className = 'fresh-bar'; bar.dataset.fresh = '1';
        setHTML(bar, html`${icon('refresh', 'sm')} Пришли новые работы — показать`);
        bar.addEventListener('click', () => PM.app.render());
        const seg = $('.q-seg', root); seg.after(bar);
      }));
      return () => offs.forEach((f) => f());
    },
  };

  S.reviewItem = {
    nav: (r) => (r.path.startsWith('/a/') ? 'homework' : 'review'), tabbar: false,
    skeleton: () => html`${ui.header({ title: 'Работа', back: '#/' })}<div class="page narrow">${ui.skeletonList(4)}</div>`,
    load: (ctx) => PM.api.reviewItem(ctx.route.params.id),
    view: (ctx) => {
      const d = ctx.data; const h = d.item; const p = P();
      const done = h.status === 'accepted';
      const pos = d.queue.indexOf(h.id);
      return html`${ui.header({ title: `${d.student.name} · модуль ${h.module}`, sub: `${d.student.stream} · отправлено ${fmt.dayTime(h.sentAt)}`, back: `#/${p}/review` })}
      <div class="page review-grid">
        <div class="col gap4">
          ${h.status === 'pending' ? html`<div class="row wrap" style="gap:8px">${ui.waitPill(fmt.waitDays(h.sentAt))}${pos >= 0 ? html`<span class="t2 faint">${pos + 1} из ${d.queue.length} в очереди</span>` : ''}${d.orphan ? html`<span class="pill revision">в потоке нет активного преподавателя</span>` : ''}</div>` : ''}
          ${done ? html`<div class="card ok"><div class="row">${icon('check')}<b class="grow">Работа принята · ${fmt.day(h.reviewedAt)}</b></div><div class="t2 muted">Проверено: ${d.reviewerName}. Принятую работу ученик не отправит заново, решение можно только посмотреть.</div>${h.comment ? html`<blockquote class="reply-q">${h.comment}</blockquote>` : ''}</div>` : ''}
          ${h.status === 'revision' ? html`<div class="card warn"><b>Возвращено на доработку · ${fmt.day(h.reviewedAt)}</b><blockquote class="reply-q">${h.comment}</blockquote><div class="t2 muted">Ждём новую версию от ученика.</div></div>` : ''}
          ${h.prevComment ? html`<div class="card"><div class="caps">Прошлый комментарий</div><p class="t2">${h.prevComment}</p></div>` : ''}
          <p class="t2 muted">${d.def.goal}</p>
          ${d.def.questions.map((q) => html`<section class="card"><div class="caps">${q.title.split('.')[0]}</div><h3>${q.title.replace(/^Часть \d+\. /, '')}</h3><p class="answer">${(h.answers || {})[q.id] || '—'}</p></section>`)}
          <section class="card"><h3>Самопроверка ученика</h3>${d.def.checklist.map((c, i) => html`<div class="check ro">${icon((h.checklist || [])[i] ? 'check' : 'x', 'sm')} ${c}</div>`)}</section>
          ${h.file ? html`<section class="card file-row"><div class="row">${icon('file')}<span class="grow t2">${h.file.name} · ${fmt.size(h.file.size)}</span><button class="btn ghost sm" data-act="open-file">Открыть</button></div></section>` : ''}
        </div>
        <aside class="col gap4 review-side">
          <a class="card link-card" href="#/${p}/student/${d.student.id}"><div class="row">${ui.avatar(d.student.name)}<div class="grow"><b>${d.student.name}</b><div class="t2 muted">${d.student.stream}</div></div>${icon('right', 'sm')}</div>
            <div class="mod-dots" aria-label="Статусы модулей">${d.others.map((o) => html`<span class="md st-${o.status} ${o.n === h.module ? 'cur' : ''}" title="Модуль ${o.n}: ${ui.HW[o.status][1]}">${o.n}</span>`)}</div></a>
          ${h.status === 'pending' ? html`<section class="card decide" data-decide>
            <h3>Решение</h3>
            <label class="field"><span>Комментарий ученику</span><textarea class="textarea" rows="5" data-comment aria-describedby="c-help c-err" placeholder="Что получилось, что доработать"></textarea>
              <small class="helper" id="c-help">Для «Принять» — по желанию. Для «Вернуть на доработку» — обязательно.</small><small class="helper err" id="c-err" hidden>Напишите, что доработать</small></label>
            <div class="decide-btns"><button class="btn primary" data-decide-btn="accepted">${icon('check', 'sm')}Принять</button><button class="btn secondary" data-decide-btn="revision">Вернуть на доработку</button></div>
            <p class="helper err" data-dec-err role="alert" hidden></p>
          </section>` : ''}
        </aside>
      </div>`;
    },
    mount(root, ctx) {
      const d = ctx.data; const p = P(); const offs = [];
      offs.push(on(root, 'click', '[data-act="open-file"]', () => PM.shell.toast('В прототипе файл не открывается')));
      offs.push(on(root, 'input', '[data-comment]', (e, t) => { if (t.value.trim()) { $('#c-err', root).hidden = true; t.removeAttribute('aria-invalid'); } }));
      offs.push(on(root, 'click', '[data-decide-btn]', async (e, b) => {
        const dec = b.dataset.decideBtn; const ta = $('[data-comment]', root); const c = ta.value;
        const errP = $('[data-dec-err]', root); errP.hidden = true;
        if (dec === 'revision' && !c.trim()) { $('#c-err', root).hidden = false; ta.setAttribute('aria-invalid', 'true'); ta.focus(); return; }
        const btns = $$('[data-decide-btn]', root); btns.forEach((x) => { x.disabled = true; }); const lbl = b.innerHTML; b.textContent = 'Сохраняем…';
        try {
          await PM.api.decide(ctx.me.id, d.item.id, dec, c);
          const next = d.queue.filter((id) => id !== d.item.id)[0];
          setHTML($('[data-decide]', root), html`<div class="col gap2"><div class="row">${icon('check')}<b>${dec === 'accepted' ? 'Работа принята' : 'Возвращено на доработку'}</b></div><p class="t2 muted">Ученику придёт уведомление.</p>
            ${next ? html`<a class="btn primary" href="#/${p}/review/${next}">Следующая работа ${icon('right', 'sm')}</a>` : html`<p class="t2">Очередь пуста 🎉</p>`}<a class="btn ghost" href="#/${p}/review">К очереди</a></div>`);
          PM.shell.toast(dec === 'accepted' ? 'Принято. Ученик получит уведомление.' : 'Возвращено с комментарием.');
        } catch (ex) { btns.forEach((x) => { x.disabled = false; }); b.innerHTML = lbl; errP.hidden = false; errP.textContent = ex.message; }
      }));
      return () => offs.forEach((f) => f());
    },
  };

  S.studentCard = {
    nav: () => 'review',
    load: (ctx) => PM.api.studentCard(ctx.route.params.id),
    view: (ctx) => {
      const d = ctx.data; const p = P(); const acc = d.items.filter((i) => i.status === 'accepted').length;
      return html`${ui.header({ title: d.student.name, sub: d.student.stream, back: `#/${p}/review` })}
      <div class="page narrow"><div class="card row" style="gap:14px">${ui.avatar(d.student.name, 'lg')}<div class="grow"><b class="t4">${d.student.name}</b><div class="t2 muted">${d.student.stream} · принято ${acc} из 8</div></div></div>
      <h2 class="sec-title">Домашки</h2>
      <div class="list">${d.items.map((i) => i.id ? html`<a class="li" href="#/${p}/review/${i.id}"><span class="num">${i.module.n}</span><span class="grow"><b class="ttl">${i.module.title}</b></span>${ui.pill(i.status)}${icon('right', 'sm chev')}</a>` : html`<div class="li"><span class="num">${i.module.n}</span><span class="grow"><b class="ttl">${i.module.title}</b></span>${ui.pill(i.status)}</div>`)}</div></div>`;
    },
  };

  /* AXON — следующим заходом (экран и состояния уже описаны в карте) */
  S.axon = { nav: () => 'axon', view: () => html`${ui.header({ title: 'AXON' })}<div class="page">${ui.empty({ icon: 'axon', title: 'Личный AXON — следующим заходом', text: 'Состояния «думает / пишет ответ», «ответ не пришёл — Повторить», история и память.' })}</div>` };
  S.axonHistory = S.axon;
})(window.PM);
