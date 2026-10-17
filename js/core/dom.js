/* Мини-утилиты DOM. Без фреймворков. */
(function (PM) {
  'use strict';
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);

  /* raw() помечает уже безопасный HTML */
  class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
  const raw = (s) => new Raw(s);

  /* html`...` — экранирует подстановки, массивы склеивает */
  function html(strings, ...vals) {
    let out = '';
    strings.forEach((s, i) => {
      out += s;
      if (i < vals.length) out += piece(vals[i]);
    });
    return raw(out);
  }
  function piece(v) {
    if (v == null || v === false) return '';
    if (v instanceof Raw) return v.s;
    if (Array.isArray(v)) return v.map(piece).join('');
    return esc(v);
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* Делегирование: on(root, 'click', '[data-act]', fn) */
  function on(root, type, selector, fn, opts) {
    const h = (e) => {
      const t = e.target.closest(selector);
      if (t && root.contains(t)) fn(e, t);
    };
    root.addEventListener(type, h, opts);
    return () => root.removeEventListener(type, h, opts);
  }

  function setHTML(el, h) { el.innerHTML = piece(h); return el; }
  function frag(h) { const t = document.createElement('template'); t.innerHTML = piece(h); return t.content; }

  /* Даты */
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = {
    time: (t) => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); },
    day: (t) => { const d = new Date(t); return d.getDate() + ' ' + MONTHS[d.getMonth()]; },
    dayTime: (t) => fmt.day(t) + ', ' + fmt.time(t),
    rel: (t) => {
      const d = new Date(t), now = new Date();
      const days = Math.floor((startOf(now) - startOf(d)) / 864e5);
      if (days === 0) return 'сегодня';
      if (days === 1) return 'вчера';
      return fmt.day(t);
    },
    short: (t) => {
      const d = new Date(t), now = new Date();
      const days = Math.floor((startOf(now) - startOf(d)) / 864e5);
      if (days === 0) return fmt.time(t);
      if (days === 1) return 'вчера';
      if (days < 7) return ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][d.getDay()];
      return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3);
    },
    waitDays: (t) => Math.max(0, Math.floor((Date.now() - t) / 864e5)),
    size: (b) => b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' МБ' : Math.round(b / 1024) + ' КБ',
    weekday: () => { const d = new Date(); return ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'][d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; },
    greeting: () => { const h = new Date().getHours(); return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'; },
  };
  function startOf(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }

  /* Склонение без рода: plural(5, ['работа','работы','работ']) */
  function plural(n, f) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return f[2];
    if (b > 1 && b < 5) return f[1];
    if (b === 1) return f[0];
    return f[2];
  }

  const initials = (name) => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  PM.dom = { esc, raw, html, $, $$, on, setHTML, frag, fmt, plural, initials, reducedMotion };
})(window.PM = window.PM || {});
