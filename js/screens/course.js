/* Курс: книга + 8 модулей; читалка «бумага» для модуля и книги. */
(function (PM) {
  'use strict';
  const { html, $, $$, on, fmt } = PM.dom;
  const icon = PM.icon; const ui = PM.ui;
  const S = PM.screens;
  const P = () => PM.shell.prefix(PM.store.me().role);

  S.course = {
    title: 'Курс',
    load: (ctx) => PM.api.modules(ctx.me.id),
    view: (ctx) => {
      const p = P(); const br = PM.api.bookReading(ctx.me.id) || { ch: 1, progress: 0 };
      return html`${ui.header({ title: 'Курс', sub: 'АНП 2.0' })}
      <div class="page">
        <a class="card link-card book-card" href="#/${p}/book?ch=${br.ch}"><span class="book-cover" aria-hidden="true">${PM.pmMark(28)}<b>АНП 2.0</b></span>
          <span class="grow"><span class="caps">Книга курса</span><h3>АНП 2.0</h3><span class="t2 muted">Продолжить с главы ${br.ch} · ${Math.round(br.progress * 100)}% · на этом устройстве</span></span>${icon('right', 'sm')}</a>
        <div class="sec-h"><h2>Модули</h2><a href="#/${p}/library">Библиотека</a></div>
        <div class="list">${ctx.data.map((m) => m.unpublished
          ? html`<div class="li locked" aria-disabled="true"><span class="num">${icon('clock', 'sm')}</span><span class="grow"><b class="ttl">${m.title}</b><span class="sub">Материал пока не опубликован</span></span></div>`
          : html`<a class="li" href="#/${p}/module/${m.n}"><span class="num">${m.n}</span><span class="grow"><b class="ttl">${m.title}</b><span class="sub">${m.parts} ${PM.dom.plural(m.parts, ['часть', 'части', 'частей'])} · ≈ ${m.minutes} мин</span></span>${p === 's' && m.hw !== 'none' ? ui.pill(m.hw) : ''}${icon('right', 'sm chev')}</a>`)}</div>
      </div>`;
    },
  };

  /* ---------- читалка ---------- */
  const SIZES = [17, 18, 19, 21];
  function readerSettings() {
    const size = PM.store.get('readSize'); const dim = PM.store.get('darkReading');
    return html`<div class="pop" role="dialog" aria-label="Настройки чтения" hidden data-pop="aa">
      <div class="t2 muted">Размер текста</div>
      <div class="seg sm" role="group" aria-label="Размер текста">${SIZES.map((s) => html`<button class="${s === size ? 'on' : ''}" aria-pressed="${s === size}" data-size="${s}" style="font-size:${s - 3}px">Аа</button>`)}</div>
      <label class="switch-row"><span class="grow t2">Тёмное чтение (приглушённая бумага)</span><input type="checkbox" role="switch" data-dim ${dim ? 'checked' : ''}></label></div>`;
  }
  function blocks(bl) {
    return bl.map((b) => b.t === 'lead' ? html`<p class="lead">${b.text}</p>` : b.t === 'key' ? html`<p class="key">${b.text}</p>` : b.t === 'ul' ? html`<ul>${b.items.map((i) => html`<li>${i}</li>`)}</ul>` : html`<p>${b.text}</p>`);
  }
  function reader({ ctx, title, kicker, toc, activeId, sections, footer, backFallback, extraActions = '' }) {
    return html`<div class="reader ${PM.store.get('darkReading') ? 'dim' : ''}" style="--read-size:${PM.store.get('readSize')}px">
      <header class="topbar readbar">
        <button class="iconbtn" data-act="back" data-fallback="${backFallback}" aria-label="Назад">${icon('left')}</button>
        <div class="title"><h1>${title}</h1></div>
        ${extraActions}
        <button class="iconbtn" data-act="aa" aria-label="Настройки чтения" aria-expanded="false">${icon('type')}</button>
        <button class="iconbtn only-m" data-act="toc" aria-label="Содержание" aria-expanded="false">${icon('toc')}</button>
        ${readerSettings()}
      </header>
      <div class="progress"><i data-progress style="width:0%"></i></div>
      <div class="reader-body">
        <nav class="toc" aria-label="Содержание" data-toc>${toc}</nav>
        <article class="paper" lang="ru" data-paper tabindex="-1">
          ${kicker ? html`<div class="kicker">${kicker}</div>` : ''}
          ${sections.map((s, i) => html`${i === 0 && s.h1 ? html`<h1>${s.h1}</h1>` : ''}<section id="${s.id}" data-sec><h2>${s.title}</h2>${blocks(s.blocks)}</section>`)}
          ${footer}
        </article>
      </div>
    </div>`;
  }
  function mountReader(root, { onProgress, activeId }) {
    const offs = [];
    const scroller = $('.reader-body', root);
    const pop = $('[data-pop="aa"]', root);
    const tocBtn = $('[data-act="toc"]', root), aaBtn = $('[data-act="aa"]', root);
    offs.push(on(root, 'click', '[data-act="aa"]', () => { pop.hidden = !pop.hidden; aaBtn.setAttribute('aria-expanded', !pop.hidden); }));
    offs.push(on(root, 'click', '[data-act="toc"]', () => { const t = $('[data-toc]', root); t.classList.toggle('open'); tocBtn.setAttribute('aria-expanded', t.classList.contains('open')); }));
    offs.push(on(root, 'click', '[data-size]', (e, b) => { const s = +b.dataset.size; PM.store.set('readSize', s); $('.reader', root).style.setProperty('--read-size', s + 'px'); $$('[data-size]', root).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); }));
    offs.push(on(root, 'change', '[data-dim]', (e, i) => { PM.store.set('darkReading', i.checked); $('.reader', root).classList.toggle('dim', i.checked); }));
    offs.push(on(root, 'click', '[data-goto]', (e, a) => { e.preventDefault(); const t = document.getElementById(a.dataset.goto); if (t) { scroller.scrollTo({ top: t.offsetTop - 12, behavior: PM.dom.reducedMotion() ? 'auto' : 'smooth' }); } $('[data-toc]', root).classList.remove('open'); }));
    const key = (e) => { if (e.key === 'Escape') { pop.hidden = true; $('[data-toc]', root).classList.remove('open'); } };
    document.addEventListener('keydown', key); offs.push(() => document.removeEventListener('keydown', key));
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = scroller.scrollHeight - scroller.clientHeight;
        const p = max > 0 ? scroller.scrollTop / max : 1;
        $('[data-progress]', root).style.width = Math.round(p * 100) + '%';
        let cur = null; $$('[data-sec]', root).forEach((s) => { if (s.offsetTop - 80 <= scroller.scrollTop) cur = s.id; });
        $$('[data-goto]', root).forEach((a) => { const on_ = a.dataset.goto === cur; a.classList.toggle('on', on_); if (on_) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
        onProgress && onProgress(p, cur);
      });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true }); offs.push(() => scroller.removeEventListener('scroll', onScroll));
    if (activeId) { const t = document.getElementById(activeId); if (t) scroller.scrollTop = t.offsetTop - 12; }
    onScroll();
    return () => offs.forEach((f) => f());
  }

  S.module = {
    nav: () => 'course', tabbar: false, title: 'Модуль',
    skeleton: () => html`<div class="reader"><header class="topbar readbar"><span class="iconbtn"></span></header><div class="reader-body"><article class="paper">${PM.dom.raw(Array.from({ length: 8 }, (_, i) => `<span class="sk" style="display:block;height:16px;margin:14px 0;width:${90 - (i % 3) * 12}%"></span>`).join(''))}</article></div></div>`,
    load: (ctx) => PM.api.module(ctx.me.id, +ctx.route.params.n),
    view: (ctx) => {
      const m = ctx.data; const p = P(); const part = +(ctx.route.query.part || 1);
      const secs = m.sections.map((s, i) => ({ ...s, h1: i === 0 ? m.title : null }));
      const toc = html`<div class="caps toc-h">${m.short}</div>${secs.map((s) => html`<a href="#${s.id}" data-goto="${s.id}">${s.title}</a>`)}`;
      const nx = PM.api.db.modules.find((x) => x.n === m.n + 1); const next = nx && nx.published ? html`<a class="btn secondary" href="#/${p}/module/${m.n + 1}">Следующий модуль ${icon('right', 'sm')}</a>` : '';
      const footer = html`<div class="paper-end">${p === 's' && m.hw !== 'none' ? html`<div class="row wrap" style="gap:10px"><a class="btn primary" href="#/s/homework/${m.n}">Перейти к заданию модуля</a>${ui.pill(m.hw)}</div>` : ''}${next}<p class="t1 ink3">Текст-заглушка. В кабинете здесь будет текст модуля из книги.</p></div>`;
      return reader({ ctx, title: m.title, kicker: `${m.short} из 8 · ≈ ${m.minutes} мин`, toc, sections: secs, footer, backFallback: `#/${p}/course` });
    },
    mount(root, ctx) {
      const m = ctx.data; const part = +(ctx.route.query.part || 1);
      return mountReader(root, { activeId: part > 1 ? `s${part}` : null, onProgress: (pr, cur) => { if (ctx.me.role === 'student') PM.api.saveReading(ctx.me.id, { kind: 'module', n: m.n, part: cur ? +cur.slice(1) : 1, progress: pr }); } });
    },
  };

  S.book = {
    nav: () => 'course', tabbar: false,
    skeleton: S.module.skeleton,
    load: (ctx) => PM.api.book(+(ctx.route.query.ch || 1)),
    title: 'Книга',
    unpublishedBack: (ctx, p) => ({ href: `#/${p}/book?ch=0&toc=1`, label: 'К оглавлению' }),
    view: (ctx) => {
      const b = ctx.data; const ch = +(ctx.route.query.ch || 1); const p = P();
      const chapter = b.chapters[Math.min(ch, b.chapters.length - 1)];
      const toc = html`<div class="caps toc-h">Содержание</div>${b.chapters.map((c, i) => c.unpublished ? html`<span class="ch ink3">${c.title} · скоро</span>` : html`<a href="#/${p}/book?ch=${i}" class="${i === ch ? 'on ch' : 'ch'}" ${i === ch ? html`aria-current="page"` : ''}>${c.title}</a>${i === ch ? c.sections.map((s) => html`<a class="lvl2" href="#${s.id}" data-goto="${s.id}">${s.title}</a>`) : ''}`)}`;
      const nav = html`<div class="paper-end row wrap" style="gap:10px">${ch > 0 ? html`<a class="btn secondary" href="#/${p}/book?ch=${ch - 1}">${icon('left', 'sm')} Предыдущая глава</a>` : ''}${ch < b.chapters.length - 1 && !b.chapters[ch + 1].unpublished ? html`<a class="btn secondary" href="#/${p}/book?ch=${ch + 1}">Следующая глава ${icon('right', 'sm')}</a>` : ''}<p class="t1 ink3" style="width:100%">Текст-заглушка. Текста книги в прототипе нет.</p></div>`;
      const secs = chapter.sections.map((s, i) => ({ ...s, h1: i === 0 ? chapter.title : null }));
      return reader({ ctx, title: 'АНП 2.0', kicker: 'Книга курса · глава ' + ch, toc, sections: secs, footer: nav, backFallback: `#/${p}/course`,
        extraActions: html`<button class="iconbtn" data-act="pdf" aria-label="Скачать PDF">${icon('download')}</button>` });
    },
    mount(root, ctx) {
      const ch = +(ctx.route.query.ch || 1);
      const off = on(root, 'click', '[data-act="pdf"]', () => PM.shell.toast('В прототипе PDF не скачивается'));
      const offR = mountReader(root, { onProgress: (pr) => PM.api.saveBookReading(ctx.me.id, { ch, progress: pr }) });
      if (ctx.route.query.toc) { const t = root.querySelector('[data-act="toc"]'); if (t && t.offsetParent) t.click(); }
      return () => { off(); offR(); };
    },
  };

  /* Библиотека и просмотрщик — следующим заходом */
  S.library = { nav: () => 'library', view: () => html`${ui.header({ title: 'Библиотека' })}<div class="page">${ui.empty({ icon: 'library', title: 'Следующим заходом', text: '21 материал по разделам, встроенный просмотрщик и карточки внешних материалов «Откроется на promozg.online ↗».' })}</div>` };
  S.material = S.library;
})(window.PM);
