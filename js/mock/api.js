/* Mock-слой, похожий на API нового фронта. Всё хранится в localStorage этого браузера.
   Методы асинхронные и с задержкой, чтобы были видны состояния загрузки. */
(function (PM) {
  'use strict';
  const KEY = 'promozg-proto-db-v12';
  const listeners = {};
  let db = load();

  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.version === 12) return s; } catch (_) { /* пусто */ }
    return PM.seed();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (_) { /* переполнено — игнорируем в демо */ } }
  function reset() { db = PM.seed(); save(); emit('reset', {}); }

  function on(type, fn) { (listeners[type] = listeners[type] || []).push(fn); return () => { listeners[type] = listeners[type].filter((f) => f !== fn); }; }
  function emit(type, payload) { (listeners[type] || []).forEach((fn) => { try { fn(payload); } catch (e) { console.error(e); } }); }

  /* Флаги демо: сбой сети при сохранении, таймаут AXON */
  const flags = { netFail: false, axonTimeout: false, axonOff: false, slow: false };
  const wait = (ms) => new Promise((r) => setTimeout(r, flags.slow ? ms * 4 : ms));
  const lat = () => wait(180 + Math.random() * 260);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }

  const user = (id) => db.users.find((u) => u.id === id);
  const stream = (code) => db.streams.find((s) => s.code === code);
  const activeTeachers = (streamId) => db.users.filter((u) => u.role === 'teacher' && u.active && u.streams.includes(streamId));
  const hwStatus = (uid, n) => {
    const it = db.homework.find((h) => h.student === uid && h.module === n);
    if (it) return it.status;
    return db.drafts[uid] && db.drafts[uid][n] ? 'draft' : 'empty';
  };

  /* ---------- push (фейк): кладём в очередь получателя, оболочка покажет тост ---------- */
  function queuePush(uid, p) {
    const q = (db.pendingPush[uid] = db.pendingPush[uid] || []);
    const prev = q.find((x) => x.tag === p.tag && p.group && Date.now() - x.at < 10 * 60000);
    if (prev) {
      prev.items = (prev.items || [prev.item]).concat([p.item]);
      const n = prev.items.length;
      prev.title = `${n} ${PM.dom.plural(n, ['работа ждёт', 'работы ждут', 'работ ждут'])} проверки`;
      const names = prev.items.map((i) => i.name);
      prev.body = names.length > 2 ? `${names[0]}, ${names[1]} и ещё ${names.length - 2}` : names.join(', ');
      prev.url = '#/t/review?f=pending';
      prev.at = Date.now();
    } else q.push({ ...p, at: Date.now() });
    save();
    emit('push', { uid });
  }
  function takePushes(uid) { const q = db.pendingPush[uid] || []; db.pendingPush[uid] = []; save(); return q; }

  /* ---------- счётчики для навигации ---------- */
  function counts(uid) {
    const u = user(uid);
    const rooms = roomsFor(u);
    const isDirect = (r) => r.kind === 'direct' && u.role === 'teacher';
    const chat = rooms.filter((r) => !isDirect(r)).reduce((s, r) => s + unread(uid, r.id), 0);
    const personal = rooms.filter(isDirect).reduce((s, r) => s + unread(uid, r.id), 0);
    let review = 0, orphan = 0;
    if (u.role === 'teacher' || u.role === 'admin') {
      review = queueItems(u, 'pending').length;
      orphan = db.homework.filter((h) => h.status === 'pending' && !activeTeachers(user(h.student).streams[0]).length).length;
    }
    const hwUpdates = u.role === 'student' ? db.homework.filter((h) => h.student === uid && h.reviewedAt && !h.seen).length : 0;
    return { chat, review, orphan, hwUpdates, personal };
  }

  /* ---------- курс ---------- */
  async function modules(uid) {
    await lat();
    return db.modules.map((m) => ({ ...m, locked: m.opensAt && m.opensAt > Date.now(), hw: m.hasHomework ? hwStatus(uid, m.n) : 'none' }));
  }
  async function module(uid, n) {
    await lat();
    const m = db.modules.find((x) => x.n === n);
    if (!m) throw new ApiError(404, 'Модуль не найден');
    if (m.opensAt && m.opensAt > Date.now()) throw new ApiError(423, 'Модуль откроется ' + PM.dom.fmt.day(m.opensAt));
    return { ...m, hw: m.hasHomework ? hwStatus(uid, n) : 'none', sections: PM.content.moduleSections(n) };
  }
  async function book() { await lat(); return { title: 'АНП 2.0', chapters: PM.content.bookChapters(db.modules) }; }
  function reading(uid) { return db.reading[uid] || null; }
  function bookReading(uid) { return db.reading[uid + 'Book'] || null; }
  function saveReading(uid, pos) { db.reading[uid] = { ...pos, at: Date.now() }; save(); }
  function saveBookReading(uid, pos) { db.reading[uid + 'Book'] = { ...pos, at: Date.now() }; save(); }

  /* ---------- домашки ученика ---------- */
  async function homeworkList(uid) {
    await lat();
    return db.modules.map((m) => {
      const it = db.homework.find((h) => h.student === uid && h.module === m.n);
      const dr = db.drafts[uid] && db.drafts[uid][m.n];
      return { module: m, locked: m.opensAt && m.opensAt > Date.now(), hasTask: m.hasHomework, item: it ? clone(it) : null, draft: dr ? clone(dr) : null, status: m.hasHomework ? hwStatus(uid, m.n) : 'none' };
    });
  }
  async function homework(uid, n) {
    await lat();
    const m = db.modules.find((x) => x.n === n);
    const it = db.homework.find((h) => h.student === uid && h.module === n);
    if (it && it.reviewedAt && !it.seen) { it.seen = true; save(); emit('counts', {}); }
    return { module: m, def: db.homeworkDefs[n] || null, item: it ? clone(it) : null, draft: clone((db.drafts[uid] || {})[n] || null), reviewer: it && it.reviewer ? user(it.reviewer).name : null };
  }
  async function saveDraft(uid, n, draft) {
    await wait(250);
    if (flags.netFail) throw new ApiError(0, 'Нет связи с сервером');
    db.drafts[uid] = db.drafts[uid] || {};
    db.drafts[uid][n] = { ...draft, savedAt: Date.now() };
    save();
    return db.drafts[uid][n].savedAt;
  }
  async function submitHomework(uid, n, payload) {
    await wait(600);
    if (flags.netFail) throw new ApiError(0, 'Нет связи с сервером. Ответы сохранены в черновике, попробуйте ещё раз.');
    let it = db.homework.find((h) => h.student === uid && h.module === n);
    if (it && it.status === 'accepted') throw new ApiError(409, 'Работа уже принята, повторная отправка недоступна. Если нужно что-то поправить, напишите преподавателю.');
    if (it && it.status === 'pending') throw new ApiError(409, 'Работа уже на проверке.');
    const again = Boolean(it);
    if (!it) { it = { id: 'hw' + Date.now(), student: uid, module: n }; db.homework.push(it); }
    Object.assign(it, { status: 'pending', answers: payload.answers, checklist: payload.checklist, file: payload.file || null, sentAt: Date.now(), reviewedAt: null, reviewer: null, comment: it.comment || '', seen: true, prevComment: again ? it.comment : '' });
    if (db.drafts[uid]) delete db.drafts[uid][n];
    save();
    const st = user(uid).streams[0];
    const teachers = activeTeachers(st);
    const name = user(uid).name;
    const item = { name, module: n };
    if (teachers.length) teachers.forEach((t) => queuePush(t.id, { tag: 'homework-review', group: true, item, title: again ? 'Работа снова на проверке' : 'Новая работа на проверку', body: `${name}, модуль ${n}`, url: '#/t/review/' + it.id }));
    else db.users.filter((u) => u.role === 'admin').forEach((a) => queuePush(a.id, { tag: 'homework-orphan', item, title: 'Работа без проверяющего', body: `${name}, модуль ${n} — в потоке нет активного преподавателя`, url: '#/t/review/' + it.id }));
    emit('homework', { id: it.id });
    emit('counts', {});
    return clone(it);
  }

  /* ---------- проверка ---------- */
  function queueItems(u, f) {
    return db.homework.filter((h) => h.status === f).filter((h) => {
      // общая очередь по всем потокам (F-HW-03): преподаватель видит и работы потоков без проверяющего
      return u.role === 'admin' || u.role === 'teacher';
    });
  }
  async function reviewQueue(uid, f = 'pending') {
    await lat();
    const u = user(uid);
    const by = { pending: queueItems(u, 'pending'), revision: queueItems(u, 'revision'), accepted: queueItems(u, 'accepted') };
    const decorate = (h) => { const s = user(h.student); const st = s.streams[0]; return { ...clone(h), studentName: s.name, stream: stream(st).label, streamId: st, orphan: !activeTeachers(st).length, waitDays: PM.dom.fmt.waitDays(h.sentAt), reviewerName: h.reviewer ? user(h.reviewer).name : null }; };
    const list = by[f].map(decorate).sort((a, b) => f === 'pending' ? a.sentAt - b.sentAt : (b.reviewedAt || 0) - (a.reviewedAt || 0));
    return { list, counts: { pending: by.pending.length, revision: by.revision.length, accepted: by.accepted.length } };
  }
  async function reviewItem(id) {
    await lat();
    const h = db.homework.find((x) => x.id === id);
    if (!h) throw new ApiError(404, 'Работа не найдена');
    const s = user(h.student);
    const st = s.streams[0];
    const others = db.modules.map((m) => ({ n: m.n, status: m.hasHomework ? hwStatus(s.id, m.n) : 'none' }));
    const pendingIds = db.homework.filter((x) => x.status === 'pending').sort((a, b) => a.sentAt - b.sentAt).map((x) => x.id);
    return { item: clone(h), def: db.homeworkDefs[h.module], module: db.modules.find((m) => m.n === h.module), student: { id: s.id, name: s.name, stream: stream(st).label }, orphan: !activeTeachers(st).length, others, reviewerName: h.reviewer ? user(h.reviewer).name : null, queue: pendingIds };
  }
  async function decide(uid, id, decision, comment) {
    await wait(500);
    if (flags.netFail) throw new ApiError(0, 'Нет связи с сервером. Решение не сохранено, попробуйте ещё раз.');
    const h = db.homework.find((x) => x.id === id);
    if (decision === 'revision' && !comment.trim()) throw new ApiError(400, 'Чтобы вернуть работу, напишите комментарий: что доработать.');
    Object.assign(h, { status: decision, comment: comment.trim(), reviewer: uid, reviewedAt: Date.now(), seen: false });
    save();
    queuePush(h.student, { tag: 'homework-result-' + h.module, title: 'Работа проверена', body: `Модуль ${h.module}: ${decision === 'accepted' ? 'принято' : 'нужна доработка'}`, url: '#/s/homework/' + h.module });
    emit('homework', { id });
    emit('counts', {});
    return clone(h);
  }
  async function studentCard(sid) {
    await lat();
    const s = user(sid);
    const items = db.modules.map((m) => { const it = db.homework.find((h) => h.student === sid && h.module === m.n); return { module: m, status: m.hasHomework ? hwStatus(sid, m.n) : 'none', id: it ? it.id : null }; });
    return { student: { id: s.id, name: s.name, stream: stream(s.streams[0]).label }, items };
  }

  /* ---------- чат ---------- */
  /* Личная комната личного обучения: ученик, все активные преподаватели его потока и админ */
  function inDirect(u, r) {
    const st = user(r.members[0]);
    if (u.id === st.id) return !r.archived;
    if (r.archived) return u.role === 'admin';
    if (u.role === 'admin') return true;
    return u.role === 'teacher' && u.active && u.streams.some((s) => st.streams.includes(s));
  }
  function roomsFor(u) {
    return db.rooms.filter((r) => (r.kind === 'direct' ? inDirect(u, r) : u.role === 'admin' ? true : r.kind === 'staff' ? u.role === 'teacher' : r.streams.some((s) => u.streams.includes(s))));
  }
  /* Название комнаты зависит от того, кто смотрит: в личном чате — имя собеседника */
  function roomView(r, u) {
    if (r.kind !== 'direct') return { title: r.title, sub: '', group: r.kind === 'staff' ? 'staff' : 'stream' };
    const st = user(r.members[0]);
    if (u.id === st.id) return { title: 'Чат с преподавателями', sub: 'Личное обучение', group: 'direct', peer: 'Чат с преподавателями' };
    return { title: st.name, sub: 'Личное · ' + st.login + (r.archived ? ' · архив' : ''), group: 'direct', peer: st.name };
  }
  const num = (id) => Number(String(id).slice(1)) || 0;
  function unread(uid, roomId) {
    const last = ((db.reads[uid] || {})[roomId]) || 'm0';
    return db.messages.filter((m) => m.room === roomId && num(m.id) > num(last) && m.author !== uid).length;
  }
  async function chatRooms(uid) {
    await wait(120);
    const u = user(uid);
    return roomsFor(u).map((r) => {
      const msgs = db.messages.filter((m) => m.room === r.id);
      const last = msgs[msgs.length - 1];
      return { ...r, ...roomView(r, u), unread: unread(uid, r.id), last: last ? { text: last.file && !last.text ? last.file.name : last.text, author: user(last.author).name, at: last.at } : null, readOnly: (r.readOnlyFor || []).includes(u.role) };
    });
  }
  function decorateMsg(m) { const a = user(m.author); return { ...clone(m), authorName: a.name, authorRole: a.role }; }
  async function chatHistory(uid, roomId, beforeId, limit = 20) {
    await wait(beforeId ? 700 : 200);
    const all = db.messages.filter((m) => m.room === roomId);
    let end = all.length;
    if (beforeId) end = all.findIndex((m) => m.id === beforeId);
    // первая загрузка: хотим показать и непрочитанные, и немного контекста
    const lastRead = ((db.reads[uid] || {})[roomId]) || 'm0';
    let start = Math.max(0, end - limit);
    if (!beforeId) { const firstUnread = all.findIndex((m) => num(m.id) > num(lastRead) && m.author !== uid); if (firstUnread >= 0) start = Math.min(start, Math.max(0, firstUnread - 6)); }
    const pinId = db.pins[roomId];
    const pin = pinId ? db.messages.find((m) => m.id === pinId) : null;
    const room = db.rooms.find((x) => x.id === roomId); const u = user(uid);
    const members = room.kind === 'direct' ? db.users.filter((x) => x.role !== 'admin' && inDirect(x, room)).length + 1 : db.users.filter((x) => x.active && (room.kind === 'staff' ? x.role === 'teacher' : x.streams.some((s) => room.streams.includes(s)))).length;
    return { messages: all.slice(start, end).map(decorateMsg), hasMore: start > 0, lastRead, pin: pin ? decorateMsg(pin) : null, room: { ...room, ...roomView(room, u), members, readOnly: (room.readOnlyFor || []).includes(u.role) } };
  }
  async function chatSend(uid, roomId, text, replyTo, file) {
    await wait(220);
    if (flags.netFail) throw new ApiError(0, 'Сообщение не отправлено. Нет связи.');
    const m = { id: 'm' + (Math.max(...db.messages.map((x) => num(x.id))) + 1), room: roomId, author: uid, text, at: Date.now(), replyTo: replyTo || null, file: file || null, reactions: {} };
    db.messages.push(m);
    db.reads[uid] = db.reads[uid] || {}; db.reads[uid][roomId] = m.id;
    save();
    emit('chat', { room: roomId, message: decorateMsg(m) });
    return decorateMsg(m);
  }
  function chatMarkRead(uid, roomId, msgId) {
    db.reads[uid] = db.reads[uid] || {};
    if (num(msgId) > num(db.reads[uid][roomId] || 'm0')) { db.reads[uid][roomId] = msgId; save(); emit('counts', {}); }
  }
  function chatPin(roomId, msgId) { db.pins[roomId] = db.pins[roomId] === msgId ? null : msgId; save(); emit('pin', { room: roomId }); }
  function chatReact(uid, msgId, emoji) {
    const m = db.messages.find((x) => x.id === msgId); const arr = (m.reactions[emoji] = m.reactions[emoji] || []);
    const i = arr.indexOf(uid); if (i >= 0) arr.splice(i, 1); else arr.push(uid);
    if (!arr.length) delete m.reactions[emoji];
    save(); return clone(m.reactions);
  }
  function getMessage(id) { const m = db.messages.find((x) => x.id === id); return m ? decorateMsg(m) : null; }
  /* «Живой» собеседник: входящее сообщение в случайной доступной комнате */
  const LIVE = ['Спасибо, очень помогло!', 'А запись будет в библиотеке?', 'Коллеги, кто идёт на встречу в четверг?', 'Схема отправлена в домашку, жду проверки 🙂', 'Подскажите, где посмотреть расписание?'];
  function simulateIncoming(uid) {
    const u = user(uid); const rooms = roomsFor(u);
    const r = rooms[Math.floor(Math.random() * rooms.length)];
    const authors = db.users.filter((x) => x.id !== uid && x.active && x.role !== 'admin' && (r.kind === 'direct' ? inDirect(x, r) : r.kind === 'staff' ? x.role === 'teacher' : x.streams.some((s) => r.streams.includes(s))));
    const a = authors[Math.floor(Math.random() * authors.length)];
    if (!a) return;
    const m = { id: 'm' + (Math.max(...db.messages.map((x) => num(x.id))) + 1), room: r.id, author: a.id, text: LIVE[Math.floor(Math.random() * LIVE.length)], at: Date.now(), replyTo: null, file: null, reactions: {} };
    db.messages.push(m); save();
    emit('chat', { room: r.id, message: decorateMsg(m) });
    emit('counts', {});
  }


  /* ---------- события демо-панели ---------- */
  async function demoSubmit(count = 1) {
    const cands = [];
    db.users.filter((u) => u.role === 'student' && u.active && u.id !== 'alina').forEach((u) => db.modules.forEach((m) => {
      if (!(m.opensAt && m.opensAt > Date.now()) && !db.homework.find((h) => h.student === u.id && h.module === m.n)) cands.push([u.id, m.n]);
    }));
    const out = [];
    for (let i = 0; i < count && cands.length; i++) {
      const [uid, n] = cands.splice(Math.floor(Math.random() * Math.min(cands.length, 12)), 1)[0];
      const def = db.homeworkDefs[n];
      const answers = {}; def.questions.forEach((q) => { answers[q.id] = 'Ответ ученика (пример) на «' + q.title.replace(/^Часть \d+\. /, '') + '».'; });
      const saveNet = flags.netFail; flags.netFail = false;
      out.push(await submitHomework(uid, n, { answers, checklist: [true, true, true] }));
      flags.netFail = saveNet;
    }
    return out;
  }
  function demoIncoming(uid, roomId) {
    const u = user(uid); const rooms = roomsFor(u);
    const r = rooms.find((x) => x.id === roomId) || rooms[0];
    const authors = db.users.filter((x) => x.id !== uid && x.active && x.role !== 'admin' && (r.kind === 'direct' ? inDirect(x, r) : r.kind === 'staff' ? x.role === 'teacher' : x.streams.some((s) => r.streams.includes(s))));
    const a = authors[Math.floor(Math.random() * authors.length)];
    const m = { id: 'm' + (Math.max(...db.messages.map((x) => num(x.id))) + 1), room: r.id, author: a.id, text: LIVE[Math.floor(Math.random() * LIVE.length)], at: Date.now(), replyTo: null, file: null, reactions: {} };
    db.messages.push(m); save();
    emit('chat', { room: r.id, message: decorateMsg(m) });
    emit('counts', {});
    return { room: r, author: a.name, text: m.text };
  }

  /* ---------- AXON ---------- */
  async function axonList(uid) { await lat(); return (db.axon[uid] || []).map((c) => ({ id: c.id, title: c.title, at: c.at })).sort((a, b) => b.at - a.at); }
  async function axonConv(uid, cid) { await lat(); const c = (db.axon[uid] || []).find((x) => x.id === cid); if (!c) throw new ApiError(404, 'Разговор не найден'); return clone(c); }
  function axonMemory(uid) { return clone(db.axonMemory[uid] || []); }
  function axonNew(uid, firstText) {
    const c = { id: 'c' + Date.now(), title: firstText.slice(0, 48), at: Date.now(), messages: [] };
    (db.axon[uid] = db.axon[uid] || []).unshift(c); save(); return c.id;
  }
  function axonAddUser(uid, cid, text) {
    const c = db.axon[uid].find((x) => x.id === cid);
    c.messages.push({ role: 'user', text, at: Date.now() }); c.at = Date.now(); save();
  }
  /* Имитация стриминга: этапы → токены. signal.aborted — остановка пользователем. */
  async function axonAsk(uid, cid, text, { onStage, onToken, signal }) {
    if (flags.axonOff) throw new ApiError(503, 'AXON временно недоступен');
    const started = Date.now();
    onStage(0); await wait(700); if (signal.aborted) return null;
    onStage(1); await wait(1100); if (signal.aborted) return null;
    if (flags.axonTimeout) { await wait(900); flags.axonTimeout = false; emit('flags', {}); throw new ApiError(504, 'timeout'); }
    onStage(2); await wait(500);
    const answer = PM.content.axonAnswer(text);
    let out = '';
    const parts = answer.split(/(\s+)/);
    for (const p of parts) {
      if (signal.aborted) break;
      out += p; onToken(out);
      await wait(18 + Math.random() * 30);
    }
    const c = db.axon[uid].find((x) => x.id === cid);
    c.messages.push({ role: 'axon', text: out, at: Date.now(), ms: Date.now() - started, stopped: signal.aborted || undefined });
    save();
    return out;
  }

  /* ---------- библиотека ---------- */
  async function library() { await lat(); return { sections: db.librarySections.map((s) => ({ ...s, count: db.library.filter((m) => m.section === s.id).length })), items: clone(db.library) }; }
  async function libraryItem(id) { await lat(); const it = db.library.find((x) => x.id === id); if (!it) throw new ApiError(404, 'Материал не найден'); return { ...clone(it), sectionTitle: db.librarySections.find((s) => s.id === it.section).title }; }

  /* ---------- главная ---------- */
  async function home(uid) {
    await lat();
    const u = user(uid);
    const out = { user: clone(u), streams: u.streams.map((s) => stream(s).label), counts: counts(uid) };
    if (u.role === 'student') {
      out.reading = reading(uid);
      out.bookReading = bookReading(uid);
      out.hwItems = db.homework.filter((h) => h.student === uid).map(clone);
      out.drafts = clone(db.drafts[uid] || {});
      out.modules = db.modules.map((m) => ({ ...m, locked: m.opensAt && m.opensAt > Date.now(), hw: m.hasHomework ? hwStatus(uid, m.n) : 'none' }));
      out.lastAxon = (db.axon[uid] || []).slice().sort((a, b) => b.at - a.at)[0] || null;
      out.rooms = await chatRooms(uid);
    }
    if (u.role === 'teacher') {
      out.queue = (await reviewQueue(uid, 'pending'));
      out.notifications = db.notifications[uid] || 'off';
      out.rooms = await chatRooms(uid);
      out.students = db.users.filter((s) => s.role === 'student' && s.streams.some((x) => u.streams.includes(x))).map((s) => ({
        id: s.id, name: s.name, stream: stream(s.streams[0]).label,
        pending: db.homework.filter((h) => h.student === s.id && h.status === 'pending').length,
        accepted: db.homework.filter((h) => h.student === s.id && h.status === 'accepted').length,
      })).sort((a, b) => b.pending - a.pending);
    }
    return out;
  }

  /* ---------- уведомления ---------- */
  function notifState(uid) { return db.notifications[uid] || 'off'; }
  function setNotif(uid, v) { db.notifications[uid] = v; save(); emit('notif', { uid }); }

  PM.api = {
    on, emit, reset, flags, ApiError, user, counts, takePushes, queuePush,
    modules, module, book, reading, saveReading, bookReading, saveBookReading, stream,
    homeworkList, homework, saveDraft, submitHomework,
    reviewQueue, reviewItem, decide, studentCard,
    chatRooms, chatHistory, chatSend, chatMarkRead, chatPin, chatReact, getMessage, simulateIncoming,
    axonList, axonConv, axonMemory, axonNew, axonAddUser, axonAsk,
    library, libraryItem, home, notifState, setNotif, demoSubmit, demoIncoming,
    save, get db() { return db; },
  };
})(window.PM);
