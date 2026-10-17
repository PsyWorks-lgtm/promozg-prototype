/* Чат: список комнат + лента. Стабильная раскладка: шапка → закреп → лента → поле ввода. */
(function (PM) {
  'use strict';
  const { html, $, $$, on, fmt, setHTML, esc } = PM.dom;
  const icon = PM.icon; const ui = PM.ui;
  const S = PM.screens;
  const P = () => PM.shell.prefix(PM.store.me().role);
  const EMO = ['👍', '❤️', '🙏', '😊'];
  const GROUPS = [['direct', 'Личное'], ['stream', 'Чаты потоков'], ['staff', 'Команда']];

  function roomList(rooms, activeId, me) {
    const p = P();
    const label = (g) => (me.role === 'student' ? (g === 'direct' ? 'Личный чат' : 'Чаты потока') : GROUPS.find((x) => x[0] === g)[1]);
    const order = me.role === 'teacher' ? ['stream', 'direct', 'staff'] : ['stream', 'staff', 'direct'];
    return html`<nav class="rooms" aria-label="Чаты">${order.map((g) => { const rs = rooms.filter((r) => r.group === g); return rs.length ? html`<div class="caps rooms-h">${label(g)}</div>${rs.map((r) => html`
      <a class="room ${r.id === activeId ? 'on' : ''}" href="#/${p}/chat/${r.id}" ${r.id === activeId ? html`aria-current="page"` : ''}>
        ${r.group === 'direct' ? ui.avatar(r.peer || r.title) : html`<span class="ic-box">${icon(r.group === 'staff' ? 'users' : 'chat', 'sm')}</span>`}
        <span class="grow"><span class="row"><b class="ttl grow ellipsis">${r.title}</b>${r.group === 'direct' && me.role !== 'student' ? html`<span class="tag sm">Личное</span>` : ''}${r.last ? html`<small class="faint">${fmt.short(r.last.at)}</small>` : ''}</span>
        <span class="row"><span class="sub grow ellipsis">${r.last ? `${r.last.author.split(' ')[0]}: ${r.last.text}` : r.group === 'direct' ? 'Переписка пока пустая' : 'Сообщений пока нет'}</span>${r.unread ? html`<span class="badge neutral" data-room-unread="${r.id}">${r.unread}</span>` : ''}</span></span></a>`)}` : ''; })}</nav>`;
  }

  S.chatRooms = {
    nav: (r) => (r.path.endsWith('/personal') ? 'personal' : 'chat'), title: 'Чат',
    skeleton: () => html`${ui.header({ title: 'Чат' })}<div class="page">${ui.skeletonList(5)}</div>`,
    load: async (ctx) => {
      const rooms = await PM.api.chatRooms(ctx.me.id);
      const individual = ctx.me.role === 'student' && rooms.some((r) => r.group === 'direct');
      return { rooms, individual };
    },
    view: (ctx) => {
      const { rooms } = ctx.data; const personal = ctx.route.path.endsWith('/personal');
      const list = personal ? rooms.filter((r) => r.group === 'direct') : rooms;
      return html`${ui.header({ title: personal ? 'Личные ученики' : 'Чат' })}
      <div class="chat-layout"><aside class="rooms-pane">${list.length ? roomList(list, null, ctx.me) : ui.empty({ icon: 'users', title: 'Личных учеников пока нет' })}</aside>
      <section class="chat-pane only-d">${ui.empty({ icon: 'chat', title: 'Выберите чат', text: 'Слева — чаты потоков и личные переписки. Непрочитанные отмечены числом.' })}</section></div>`;
    },
    mount(root, ctx) {
      // ученик личного обучения сразу попадает в диалог с преподавателем; на десктопе — открываем первый чат
      const d = ctx.data;
      if (d.individual) { PM.router.forget(ctx.route.full); location.replace(`#/s/chat/${d.rooms.find((r) => r.group === 'direct').id}`); return null; }
      if (matchMedia('(min-width: 900px)').matches && !ctx.route.path.endsWith('/personal') && d.rooms.length) {
        const r = d.rooms.slice().sort((a, b) => b.unread - a.unread)[0];
        PM.router.forget(ctx.route.full);
        location.replace(`#/${P()}/chat/${r.id}`);
      }
      return null;
    },
  };

  function msgHTML(m, me, prev, opts) {
    const mine = m.author === me.id;
    const groupStart = !prev || prev.author !== m.author || m.at - prev.at > 10 * 60000 || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
    const day = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
    const rq = m.replyTo ? PM.api.getMessage(m.replyTo) : null;
    const role = m.authorRole === 'teacher' ? html`<span class="role-tag">преподаватель</span>` : m.authorRole === 'admin' ? html`<span class="role-tag admin">Админ</span>` : '';
    const reacts = Object.entries(m.reactions || {});
    return html`${day ? html`<div class="day-sep" role="separator"><span>${fmt.day(m.at)}</span></div>` : ''}
      ${opts.unreadBefore === m.id ? html`<div class="unread-sep" data-unread-sep role="separator"><span>Новые сообщения</span></div>` : ''}
      <div class="msg ${mine ? 'mine' : ''} ${groupStart ? 'gs' : ''}" data-id="${m.id}">
        ${!mine ? (groupStart ? ui.avatar(m.authorName, 'sm') : html`<span class="avatar-sp"></span>`) : ''}
        <div class="bubble-wrap">
          ${groupStart && !mine ? html`<div class="msg-h"><b>${m.authorName}</b>${role}</div>` : ''}
          <div class="bubble">
            ${rq ? html`<a class="reply-q" href="#" data-jump="${rq.id}"><b>${rq.authorName}</b><span class="ellipsis">${rq.text || (rq.file && rq.file.name)}</span></a>` : ''}
            ${m.file ? html`<span class="file-chip">${icon('file', 'sm')}<span class="grow ellipsis">${m.file.name}</span><small>${fmt.size(m.file.size)}</small></span>` : ''}
            ${m.text ? html`<div class="txt">${m.text}</div>` : ''}
            <time class="tm" datetime="${new Date(m.at).toISOString()}">${fmt.time(m.at)}</time>
          </div>
          ${reacts.length ? html`<div class="reacts">${reacts.map(([e, u]) => html`${mine ? html`<span class="react ro" aria-label="${e} ${u.length}">${e} ${u.length}</span>` : html`<button class="react ${u.includes(me.id) ? 'on' : ''}" data-react="${e}" aria-pressed="${u.includes(me.id)}" aria-label="${e} ${u.length}">${e} ${u.length}</button>`}`)}</div>` : ''}
        </div>
        <div class="msg-acts" role="group" aria-label="Действия с сообщением">
          <button class="iconbtn sm" data-act="reply" aria-label="Ответить">${icon('reply', 'sm')}</button>
          ${mine ? '' : html`<button class="iconbtn sm" data-act="react-menu" aria-label="Реакция">${icon('smile', 'sm')}</button>`}
          ${opts.canPin ? html`<button class="iconbtn sm" data-act="pin" aria-label="Закрепить">${icon('pin', 'sm')}</button>` : ''}
        </div>
      </div>`;
  }
  function pinHTML(pin) {
    return pin ? html`<button class="pinbar" data-jump="${pin.id}">${icon('pin', 'sm')}<span class="grow ellipsis"><b>Закреплено:</b> ${pin.text}</span>${icon('right', 'sm')}</button>` : '';
  }

  S.chatRoom = {
    nav: (r) => (r.params.room.startsWith('dm-') && PM.store.me() && PM.store.me().role === 'teacher' ? 'personal' : 'chat'),
    // у ученика личного обучения этот чат — раздел «Чат с преподавателями» в нижнем меню, поэтому меню остаётся видно
    tabbar: (r) => { const me = PM.store.me(); return matchMedia('(min-width: 900px)').matches || !!(me && me.role === 'student' && r.params.room.startsWith('dm-')); },
    skeleton: () => html`<div class="chat-layout"><aside class="rooms-pane only-d">${ui.skeletonList(4)}</aside><section class="chat-pane">${ui.header({ title: 'Чат', back: '#/' })}<div class="feed">${ui.skeletonList(5)}</div></section></div>`,
    load: async (ctx) => {
      const [rooms, h] = await Promise.all([PM.api.chatRooms(ctx.me.id), PM.api.chatHistory(ctx.me.id, ctx.route.params.room)]);
      return { rooms, ...h };
    },
    view: (ctx) => {
      const d = ctx.data; const me = ctx.me; const r = d.room;
      const individual = me.role === 'student' && r.group === 'direct';
      const canPin = me.role !== 'student';
      const firstUnread = d.messages.find((m) => Number(m.id.slice(1)) > Number(String(d.lastRead).slice(1)) && m.author !== me.id);
      const opts = { canPin, unreadBefore: firstUnread ? firstUnread.id : null };
      const sub = r.group === 'direct' ? (individual ? 'Личное обучение' : r.sub + ` · ${r.members} ${PM.dom.plural(r.members, ['участник', 'участника', 'участников'])}`) : `${r.members} ${PM.dom.plural(r.members, ['участник', 'участника', 'участников'])}`;
      const empty = !d.messages.length || ctx.state === 'empty';
      return html`<div class="chat-layout">
        ${individual ? '' : html`<aside class="rooms-pane only-d">${roomList(d.rooms, r.id, me)}</aside>`}
        <section class="chat-pane" aria-label="${r.title}">
          ${ui.header({ title: r.title, sub: individual ? 'Преподаватели личного обучения и админ' : sub, back: individual ? '#/s/home' : `#/${P()}/chat/rooms` })}
          <div data-pin>${pinHTML(d.pin)}</div>
          <div class="feed" data-feed role="log" aria-live="polite" aria-relevant="additions" tabindex="0" aria-label="Сообщения">
            <div class="feed-top" data-top>${d.hasMore ? html`<span class="t2 faint" data-more-label>Прокрутите вверх, чтобы загрузить раньше</span>` : html`<span class="t2 faint">Начало переписки</span>`}</div>
            <div data-list>${empty ? html`<div class="empty sm">${ui.empty({ icon: 'chat', title: r.group === 'direct' ? 'Переписка пока пустая' : 'Сообщений пока нет', text: r.group === 'direct' ? (me.role === 'student' ? 'Здесь ваша переписка с преподавателем. Напишите, если появился вопрос по модулю или домашке' : 'Напишите ученику первым — сообщение придёт с уведомлением.') : 'Напишите первым.' })}</div>` : d.messages.map((m, i) => msgHTML(m, me, d.messages[i - 1], opts))}</div>
          </div>
          <button class="fab-down" data-act="down" hidden aria-label="К новым сообщениям">${icon('down', 'sm')}<span class="badge" data-new hidden></span></button>
          ${r.readOnly ? html`<div class="composer-ro t2 muted">Писать в этот чат может только преподаватель</div>` : html`
          <form class="chat-composer" data-composer>
            <div class="reply-prev" data-reply hidden></div>
            <div class="file-prev" data-filep hidden></div>
            <div class="row composer-row">
              <button type="button" class="iconbtn" data-act="attach" aria-label="Прикрепить файл">${icon('clip')}</button>
              <textarea rows="1" name="text" class="grow" placeholder="${me.role === 'admin' ? 'Сообщение от имени админа' : 'Сообщение'}" aria-label="Сообщение"></textarea>
              <button class="send" type="submit" aria-label="Отправить">${icon('up', 'sm')}</button>
            </div>
            <small class="helper err" data-send-err hidden></small>
          </form>`}
        </section></div>`;
    },
    mount(root, ctx) {
      const me = ctx.me; const roomId = ctx.route.params.room; const d = ctx.data;
      const feed = $('[data-feed]', root), list = $('[data-list]', root);
      const fab = $('[data-act="down"]', root), newB = $('[data-new]', root);
      const canPin = me.role !== 'student';
      const sepEl0 = $('[data-unread-sep]', root); const unreadId = sepEl0 ? sepEl0.nextElementSibling.dataset.id : null;
      let messages = d.messages.slice(); let hasMore = d.hasMore; let loading = false; let replyTo = null; let file = null; let newCount = 0;
      const offs = [];
      const atBottom = () => feed.scrollHeight - feed.scrollTop - feed.clientHeight < 60;
      const markRead = () => { if (messages.length) PM.api.chatMarkRead(me.id, roomId, messages[messages.length - 1].id); newCount = 0; newB.hidden = true; };
      // стартовая позиция: к разделителю «Новые» или в самый низ
      const sep = $('[data-unread-sep]', root);
      if (sep) feed.scrollTop = sep.offsetTop - feed.offsetTop - 40; else feed.scrollTop = feed.scrollHeight;
      if (atBottom()) markRead();

      const onScroll = () => {
        fab.hidden = atBottom();
        if (atBottom()) markRead();
        if (feed.scrollTop < 80 && hasMore && !loading) loadMore();
      };
      feed.addEventListener('scroll', onScroll, { passive: true }); offs.push(() => feed.removeEventListener('scroll', onScroll));
      onScroll();

      async function loadMore() {
        loading = true; const top = $('[data-top]', root);
        setHTML(top, html`<span class="spinner" aria-hidden="true"></span><span class="t2 faint">Загружаем ранние сообщения…</span>`);
        try {
          const h = await PM.api.chatHistory(me.id, roomId, messages[0].id);
          const before = feed.scrollHeight;
          messages = h.messages.concat(messages); hasMore = h.hasMore;
          setHTML(list, html`${messages.map((m, i) => msgHTML(m, me, messages[i - 1], { canPin, unreadBefore: unreadId }))}`);
          feed.scrollTop += feed.scrollHeight - before; // позиция чтения не прыгает
          setHTML(top, hasMore ? html`<span class="t2 faint">Прокрутите вверх, чтобы загрузить раньше</span>` : html`<span class="t2 faint">Начало переписки</span>`);
        } catch (e) { setHTML(top, html`<span class="t2 err">Не загрузилось.</span> <button class="linkbtn" data-act="more">Повторить</button>`); }
        loading = false;
      }
      offs.push(on(root, 'click', '[data-act="more"]', loadMore));
      offs.push(on(root, 'click', '[data-act="down"]', () => { feed.scrollTo({ top: feed.scrollHeight, behavior: PM.dom.reducedMotion() ? 'auto' : 'smooth' }); }));
      offs.push(on(root, 'click', '[data-jump]', (e, a) => { e.preventDefault(); const t = $(`.msg[data-id="${a.dataset.jump}"]`, root); if (t) { t.scrollIntoView({ block: 'center' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1400); } else PM.shell.toast('Сообщение раньше загруженной истории — прокрутите вверх'); }));

      const append = (m) => {
        const stick = atBottom() || m.author === me.id;
        const emptyEl = $('.empty', list); if (emptyEl) setHTML(list, '');
        const prev = messages[messages.length - 1]; messages.push(m);
        list.insertAdjacentHTML('beforeend', String(msgHTML(m, me, prev, { canPin, unreadBefore: null })));
        if (stick) { feed.scrollTop = feed.scrollHeight; markRead(); } else { newCount++; newB.textContent = newCount; newB.hidden = false; fab.hidden = false; }
      };
      offs.push(PM.api.on('chat', ({ room, message }) => { if (room === roomId && !messages.find((x) => x.id === message.id)) append(message); else updateRoomBadges(); }));
      offs.push(PM.api.on('pin', ({ room }) => { if (room === roomId) PM.api.chatHistory(me.id, roomId).then((h) => setHTML($('[data-pin]', root), pinHTML(h.pin))); }));
      function updateRoomBadges() { PM.api.chatRooms(me.id).then((rs) => { const pane = $('.rooms-pane', root); if (pane) setHTML(pane, roomList(rs, roomId, me)); }); }

      // действия с сообщением
      offs.push(on(root, 'click', '[data-act="reply"]', (e, b) => {
        const id = b.closest('.msg').dataset.id; const m = messages.find((x) => x.id === id); replyTo = id;
        const rp = $('[data-reply]', root); rp.hidden = false;
        setHTML(rp, html`${icon('reply', 'sm')}<span class="grow ellipsis"><b>${m.authorName}</b> ${m.text}</span><button type="button" class="iconbtn sm" data-act="reply-x" aria-label="Отменить ответ">${icon('x', 'sm')}</button>`);
        $('textarea', root).focus();
      }));
      offs.push(on(root, 'click', '[data-act="reply-x"]', () => { replyTo = null; $('[data-reply]', root).hidden = true; }));
      offs.push(on(root, 'click', '[data-act="pin"]', (e, b) => { PM.api.chatPin(roomId, b.closest('.msg').dataset.id); PM.shell.toast('Закреп обновлён'); }));
      offs.push(on(root, 'click', '[data-act="react-menu"]', (e, b) => {
        const msg = b.closest('.msg'); const old = $('.emo-pop', root); if (old) old.remove();
        const pop = document.createElement('div'); pop.className = 'emo-pop'; pop.setAttribute('role', 'menu');
        setHTML(pop, html`${EMO.map((x) => html`<button role="menuitem" data-react="${x}">${x}</button>`)}`);
        msg.querySelector('.bubble-wrap').appendChild(pop); pop.querySelector('button').focus();
      }));
      offs.push(on(root, 'click', '[data-react]', (e, b) => {
        const msg = b.closest('.msg'); const id = msg.dataset.id;
        const reacts = PM.api.chatReact(me.id, id, b.dataset.react);
        const m = messages.find((x) => x.id === id); m.reactions = reacts;
        const i = messages.indexOf(m);
        const tmp = document.createElement('div'); tmp.innerHTML = String(msgHTML(m, me, messages[i - 1], { canPin, unreadBefore: null }));
        msg.replaceWith(tmp.querySelector('.msg'));
      }));

      // поле ввода
      const form = $('[data-composer]', root);
      if (form) {
        const ta = form.text;
        const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; };
        ta.addEventListener('input', grow);
        ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(min-width: 900px)').matches) { e.preventDefault(); form.requestSubmit(); } });
        offs.push(on(root, 'click', '[data-act="attach"]', () => {
          file = { name: 'конспект-встречи.pdf', size: 1240000 }; const fp = $('[data-filep]', root); fp.hidden = false;
          setHTML(fp, html`${icon('file', 'sm')}<span class="grow ellipsis">${file.name} · ${fmt.size(file.size)}</span><button type="button" class="iconbtn sm" data-act="file-x" aria-label="Убрать файл">${icon('x', 'sm')}</button>`);
        }));
        offs.push(on(root, 'click', '[data-act="file-x"]', () => { file = null; $('[data-filep]', root).hidden = true; }));
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const text = ta.value.trim(); if (!text && !file) return;
          const err = $('[data-send-err]', root); err.hidden = true;
          const btn = $('.send', form); btn.disabled = true;
          try {
            await PM.api.chatSend(me.id, roomId, text, replyTo, file);
            ta.value = ''; grow(); replyTo = null; file = null; $('[data-reply]', root).hidden = true; $('[data-filep]', root).hidden = true;
          } catch (ex) { err.hidden = false; err.textContent = ex.message + ' Текст сохранён в поле — попробуйте ещё раз.'; }
          btn.disabled = false; ta.focus();
        });
      }
      return () => offs.forEach((f) => f());
    },
  };
})(window.PM);
