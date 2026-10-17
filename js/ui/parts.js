/* Общие куски интерфейса. Возвращают безопасный HTML (dom.raw). */
(function (PM) {
  'use strict';
  const { html, fmt, plural, initials } = PM.dom;
  const icon = PM.icon;

  const HW = {
    accepted: ['accepted', 'Принято'], pending: ['pending', 'На проверке'], revision: ['revision', 'Нужна доработка'],
    draft: ['draft', 'Черновик'], empty: ['blank', 'Не начато'], none: ['none', 'Без задания'],
  };
  const pill = (status) => { const [c, l] = HW[status] || HW.empty; return html`<span class="pill ${c}">${l}</span>`; };
  const waitPill = (days) => {
    if (days == null) return html`<span class="pill blank">Дата сдачи неизвестна</span>`;
    const c = days > 7 ? 'revision' : days > 2 ? 'pending' : 'draft';
    return html`<span class="pill ${c}" title="Отправлено ${days} ${plural(days, ['день', 'дня', 'дней'])} назад">${days === 0 ? 'сегодня' : `ждёт ${days} дн.`}</span>`;
  };
  const avatar = (name, cls = '') => html`<span class="avatar ${cls}" aria-hidden="true">${initials(name)}</span>`;
  const badge = (n, kind = '', key = '') => html`<span class="badge ${kind}" data-count="${key}" ${n ? '' : 'hidden'}>${n > 99 ? '99+' : n}</span>`;

  /* Шапка экрана: заголовок, «назад», действия справа. На десктопе «назад» тоже есть для 2-го уровня. */
  function header({ title, sub = '', back = null, actions = '', menu = false, chips = '' }) {
    return html`<header class="topbar">
      ${back ? html`<button class="iconbtn" data-act="back" data-fallback="${back}" aria-label="Назад">${icon('left')}</button>` : ''}
      ${menu ? html`<button class="iconbtn only-m" data-act="open-menu" aria-label="Меню" aria-expanded="false" aria-controls="drawer">${icon('menu')}<i class="dot" data-count-dot hidden></i></button>` : ''}
      <div class="title"><h1>${title}</h1>${sub ? html`<span class="sub">${sub}</span>` : ''}</div>
      ${chips ? html`<div class="chips-h only-d">${chips}</div>` : ''}
      ${actions}
    </header>`;
  }
  const streamChips = (streams) => html`${streams.map((s) => html`<span class="tag">${s}</span>`)}<span class="tag">АНП 2.0</span>`;

  function skeletonList(n = 6) {
    return html`<div class="list" aria-busy="true" aria-label="Загрузка">${Array.from({ length: n }, () => html`<div class="li"><span class="sk sk-sq"></span><span class="grow col gap2"><span class="sk" style="width:42%;height:14px"></span><span class="sk" style="width:76%;height:12px"></span></span><span class="sk" style="width:84px;height:26px;border-radius:13px"></span></div>`)}</div>`;
  }
  function skeletonPage() {
    return html`<div class="page"><div class="col gap2" style="margin-bottom:20px"><span class="sk" style="width:30%;height:14px"></span><span class="sk" style="width:52%;height:28px"></span></div>${skeletonList(6)}</div>`;
  }
  function empty({ icon: ic = 'inbox', title, text = '', action = '' }) {
    return html`<div class="empty"><span class="empty-ic">${icon(ic)}</span><h2>${title}</h2>${text ? html`<p>${text}</p>` : ''}${action}</div>`;
  }
  function errorBox(msg, retryAct = 'retry') {
    return html`<div class="empty" role="alert"><span class="empty-ic err">${icon('alert')}</span><h2>Не удалось загрузить</h2><p>${msg}</p><button class="btn secondary" data-act="${retryAct}">${icon('refresh', 'sm')}Повторить</button></div>`;
  }
  /* Лёгкий markdown: **жирный**, списки «- », абзацы */
  function md(text) {
    const esc = PM.dom.esc;
    const blocks = String(text).split(/\n{2,}/);
    return PM.dom.raw(blocks.map((b) => {
      const lines = b.split('\n');
      const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
      if (lines.every((l) => /^- /.test(l))) return '<ul>' + lines.map((l) => '<li>' + inline(l.slice(2)) + '</li>').join('') + '</ul>';
      return '<p>' + lines.map(inline).join('<br>') + '</p>';
    }).join(''));
  }
  PM.ui = { pill, waitPill, avatar, badge, header, streamChips, skeletonList, skeletonPage, empty, errorBox, md, HW };
})(window.PM);
