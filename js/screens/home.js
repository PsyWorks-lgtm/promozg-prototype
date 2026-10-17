/* Главные экраны ролей. */
(function (PM) {
  'use strict';
  const { html, $, on, fmt, plural } = PM.dom;
  const icon = PM.icon; const ui = PM.ui;
  const S = PM.screens;

  function studentHome(ctx) {
    const d = ctx.data; const me = d.user;
    const r = d.reading || { n: 1, part: 1, progress: 0 };
    const mod = d.modules.find((m) => m.n === r.n);
    const hwRows = d.modules.filter((m) => !m.locked).map((m) => ({ m, st: m.hw })).filter((x) => x.st !== 'empty').slice(0, 3);
    const room = (d.rooms || []).slice().sort((a, b) => b.unread - a.unread)[0];
    const individual = me.role === 'student' && me.streams.some((c) => PM.api.stream(c).individual);
    const empty = ctx.state === 'empty';
    return html`${ui.header({ title: 'Главная', chips: ui.streamChips(d.streams) })}
    <div class="page home">
      <div class="hello"><span class="t2 faint">${fmt.weekday()}</span><h2 class="page-h">${fmt.greeting()}, ${me.name.split(' ')[0]}</h2></div>
      <div class="home-grid">
        <div class="col gap4">
          ${empty ? html`<section class="card hero"><h3>Начните с модуля 1</h3><p class="t2 muted">Модуль открывается на светлой «бумаге», к нему есть задание.</p><a class="btn primary" href="#/s/module/1">Открыть модуль 1</a></section>` : html`
          <section class="card hero" aria-labelledby="h-cont"><div class="caps">Продолжить</div>
            <h3 id="h-cont">${mod.title}</h3><div class="t2 muted">Часть ${r.part} из ${mod.parts} · ${Math.round(r.progress * 100)}%</div>
            <div class="progress-line" aria-hidden="true"><i style="width:${Math.round(r.progress * 100)}%"></i></div>
            <a class="btn primary" href="#/s/module/${r.n}?part=${r.part}">Продолжить чтение</a></section>`}
          <section class="card axon-card" aria-labelledby="h-axon"><div class="row">${PM.axonMark(28)}<div class="grow"><h3 id="h-axon">AXON</h3><div class="t2 muted">Личный помощник по курсу</div></div><a class="iconbtn" href="#/s/axon" aria-label="История разговоров">${icon('clock', 'sm')}</a></div>
            <form class="composer" data-act="ask"><input class="grow" name="q" aria-label="Спросить AXON" placeholder="Спросить AXON…" autocomplete="off"><button class="send" aria-label="Отправить">${icon('up', 'sm')}</button></form>
            <div class="chips">${PM.content.axonSuggestions.map((s) => html`<a class="chip" href="#/s/axon?q=${encodeURIComponent(s)}">${s}</a>`)}</div>
            ${d.lastAxon ? html`<a class="row cont-link" href="#/s/axon/${d.lastAxon.id}"><span class="t2 faint">Продолжить:</span><span class="t2 grow ellipsis">${d.lastAxon.title}</span><span class="t1 faint">${fmt.short(d.lastAxon.at)}</span>${icon('right', 'sm')}</a>` : ''}</section>
        </div>
        <div class="col gap4">
          <section class="card"><div class="row card-h"><h3 class="grow">Домашки</h3><a class="t2 link" href="#/s/homework">Все 8</a></div>
            ${hwRows.length ? html`<div class="col">${hwRows.map(({ m, st }) => html`<a class="mini-row" href="#/s/homework/${m.n}"><span class="grow"><b class="t2">${m.short}</b><small class="faint">${st === 'draft' ? 'черновик сохранён' : st === 'pending' ? 'ждёт проверки' : st === 'accepted' ? 'проверено' : 'есть комментарий'}</small></span>${ui.pill(st)}</a>`)}</div>` : html`<p class="t2 muted">Пока ничего не отправлено.</p>`}</section>
          ${room ? html`<a class="card link-card" href="#/s/chat/${room.id}"><div class="row">${individual ? ui.avatar(room.title) : html`<span class="ic-box">${icon('chat', 'sm')}</span>`}<div class="grow"><h3>${individual ? 'Мой преподаватель' : room.title}</h3><div class="t2 muted ellipsis">${room.last ? `${room.last.author}: ${room.last.text}` : 'Здесь ваша переписка с преподавателем'}</div></div>${room.unread ? html`<span class="badge neutral">${room.unread}</span>` : ''}</div></a>` : ''}
          <a class="card link-card" href="#/s/book?ch=${(d.bookReading || {}).ch || 1}"><div class="row"><span class="book-cover sm" aria-hidden="true">${PM.pmMark(20)}<b>АНП 2.0</b></span><div class="grow"><div class="caps">Книга курса</div><h3>АНП 2.0</h3><div class="t2 muted">Глава ${(d.bookReading || {}).ch || 1} · ${Math.round(((d.bookReading || {}).progress || 0) * 100)}%</div></div>${icon('right', 'sm')}</div></a>
        </div>
      </div>
    </div>`;
  }

  function teacherHome(ctx) {
    const d = ctx.data; const q = d.queue; const me = d.user;
    const oldest = q.list[0];
    const showBanner = d.notifications !== 'on' && !sessionStorage.getItem('pushLater');
    const notifKind = d.notifications === 'denied' ? 'denied' : d.notifications === 'ios' ? 'ios' : 'default';
    return html`${ui.header({ title: 'Главная', chips: ui.streamChips(d.streams) })}
    <div class="page home">
      <div class="hello"><span class="t2 faint">${fmt.weekday()}</span><h2 class="page-h">${fmt.greeting()}, ${me.name.split(' ')[0]}</h2></div>
      ${showBanner ? html`<div data-banner>${S.notif.block(notifKind, true)}</div>` : ''}
      <div class="home-grid">
        <div class="col gap4">
          <section class="card hero" aria-labelledby="h-q">
            ${q.counts.pending ? html`<div class="row" style="align-items:flex-start"><div class="grow"><div class="caps">Проверка заданий</div>
              <div class="row big-num"><b id="h-q">${q.counts.pending}</b><span class="t2 muted">${plural(q.counts.pending, ['работа ждёт', 'работы ждут', 'работ ждут'])}<br>проверки</span></div></div>${ui.waitPill(oldest.waitDays)}</div>
              <p class="t2 muted">Сначала самые старые. Среднее время проверки в курсе ≈ 3 дня.</p>
              <a class="btn primary" href="#/t/review/${oldest.id}">Начать с самой старой</a>` : html`<div class="caps">Проверка заданий</div><h3 id="h-q">Всё проверено ✓</h3><p class="t2 muted">Придёт уведомление, когда ученик отправит работу.</p>`}
          </section>
          ${q.list.length ? html`<section><div class="sec-h"><h2>Очередь</h2><a href="#/t/review">Открыть очередь</a></div>${S.reviewQueue.rows(q.list.slice(0, 4), 't')}</section>` : ''}
        </div>
        <div class="col gap4">
          <section><div class="sec-h"><h2>Ученики</h2></div><div class="list">${d.students.slice(0, 6).map((s) => html`<a class="li" href="#/t/student/${s.id}">${ui.avatar(s.name)}<span class="grow"><b class="ttl">${s.name}</b><span class="sub">${s.stream} · <span class="faint">принято ${s.accepted} из 8</span></span></span>${s.pending ? html`<span class="pill act">${s.pending} на проверке</span>` : ''}${icon('right', 'sm chev')}</a>`)}</div></section>
          ${(d.rooms || []).filter((r) => r.unread).slice(0, 2).map((r) => html`<a class="card link-card" href="#/t/chat/${r.id}"><div class="row"><span class="ic-box">${icon('chat', 'sm')}</span><div class="grow"><h3>${r.title}</h3><div class="t2 muted ellipsis">${r.last ? `${r.last.author}: ${r.last.text}` : ''}</div></div><span class="badge neutral">${r.unread}</span></div></a>`)}
        </div>
      </div>
    </div>`;
  }

  function adminHome(ctx) {
    const d = ctx.data; const c = d.counts;
    return html`${ui.header({ title: 'Сводка' })}
    <div class="page">
      <div class="stats">
        <a class="stat" href="#/a/homework"><span class="v">${c.review}</span><span class="l">${plural(c.review, ['работа ждёт', 'работы ждут', 'работ ждут'])} проверки</span></a>
        <a class="stat warn" href="#/a/homework"><span class="v">${c.orphan}</span><span class="l">без проверяющего (в потоке нет активного преподавателя)</span></a>
        <a class="stat" href="#/a/chat"><span class="v">${c.chat}</span><span class="l">непрочитанных в чатах</span></a>
      </div>
      <p class="t2 faint" style="margin-top:16px">Остальные разделы админки («Люди», «Качество AXON», «Материалы») — во второй волне прототипа.</p>
    </div>`;
  }

  S.home = {
    title: 'Главная',
    load: (ctx) => PM.api.home(ctx.me.id),
    view: (ctx) => (ctx.me.role === 'student' ? studentHome(ctx) : ctx.me.role === 'teacher' ? teacherHome(ctx) : adminHome(ctx)),
    mount(root, ctx) {
      const offs = [];
      offs.push(on(root, 'submit', '[data-act="ask"]', (e, f) => { e.preventDefault(); const q = f.q.value.trim(); if (q) location.hash = '#/s/axon?q=' + encodeURIComponent(q); }));
      if (S.notif) offs.push(S.notif.bind(root, () => { const b = $('[data-banner]', root); if (b) b.remove(); }));
      return () => offs.forEach((f) => f());
    },
  };
})(window.PM);
