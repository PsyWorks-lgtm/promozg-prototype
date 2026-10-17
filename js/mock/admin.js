/* Mock-слой админки: люди, потоки, «Качество AXON». Данные вымышленные, тексты — заглушки. */
(function (PM) {
  'use strict';
  const A = PM.api; const DAY = 864e5;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const lat = () => wait(250 + Math.random() * 350);
  const db = () => A.db;
  const x = () => { const d = db(); d.adm = d.adm || { flags: {}, sessions: {}, created: 0 }; return d.adm; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const ROLE = { student: 'Ученик', teacher: 'Преподаватель', admin: 'Админ' };
  const WORDS = ['kedr', 'luna', 'sosna', 'veter', 'mayak', 'reka', 'zvezda', 'kamen', 'klen', 'oblako'];
  const genPass = () => WORDS[Math.floor(Math.random() * 10)] + '-' + (10 + Math.floor(Math.random() * 89)) + '-' + WORDS[Math.floor(Math.random() * 10)];
  const streamLabels = (u) => u.streams.map((s) => A.stream(s).label);
  const sessions = (u) => (x().sessions[u.id] != null ? x().sessions[u.id] : (u.active ? 1 + (u.login.length % 3) : 0));
  const STALE = 14 * DAY;

  function personView(u) {
    const hw = db().homework.filter((h) => h.student === u.id);
    const dm = db().rooms.find((r) => r.kind === 'direct' && r.members[0] === u.id && !r.archived);
    return { ...clone(u), roleLabel: ROLE[u.role], streamLabels: streamLabels(u), sessions: sessions(u), stale: u.role === 'student' && u.active && Date.now() - u.lastSeen > STALE,
      hw: { accepted: hw.filter((h) => h.status === 'accepted').length, pending: hw.filter((h) => h.status === 'pending').length },
      dm: dm ? { id: dm.id } : null };
  }
  async function people(q = {}) {
    await lat();
    let list = db().users.slice();
    const s = (q.q || '').trim().toLowerCase();
    if (s) list = list.filter((u) => u.name.toLowerCase().includes(s) || u.login.toLowerCase().includes(s));
    if (q.role) list = list.filter((u) => u.role === q.role);
    if (q.stream) list = list.filter((u) => u.streams.includes(q.stream));
    if (q.status === 'active') list = list.filter((u) => u.active); else if (q.status === 'closed') list = list.filter((u) => !u.active);
    if (q.stale) list = list.filter((u) => personView(u).stale);
    const order = { admin: 0, teacher: 1, student: 2 };
    return list.sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name, 'ru')).map(personView);
  }
  async function person(id) { await lat(); const u = A.user(id); if (!u) throw new A.ApiError(404, 'Человек не найден'); return personView(u); }
  function loginTaken(login, except) { return db().users.some((u) => u.login === login && u.id !== except); }
  async function createPerson({ name, login, role, stream }) {
    await wait(400);
    const fe = {};
    if (!name) fe.name = 'Введите имя и фамилию.';
    if (!login) fe.login = 'Введите логин.';
    else if (!/^[a-z0-9._-]{3,}$/.test(login)) fe.login = 'Логин: латиница, цифры, точка, дефис, от 3 символов.';
    else if (loginTaken(login)) fe.login = `Логин «${login}» уже занят. Добавьте букву или цифру.`;
    if (Object.keys(fe).length) { const e = new A.ApiError(400, 'Проверьте отмеченные поля.'); e.fields = fe; throw e; }
    const id = 'new' + (++x().created) + Date.now().toString(36);
    const u = { id, login, name, role, streams: role === 'admin' || !stream ? [] : [stream], active: true, lastSeen: 0 };
    db().users.push(u); x().sessions[id] = 0;
    if (role === 'student' && A.stream(stream) && A.stream(stream).individual) db().rooms.push({ id: 'dm-' + id, title: '', kind: 'direct', streams: [], members: [id] });
    A.save(); A.emit('counts', {});
    return { person: personView(u), password: genPass() };
  }
  async function resetPassword(id) { await wait(450); if (A.flags.netFail) throw new A.ApiError(0, 'Нет связи с сервером. Пароль не изменён.'); x().sessions[id] = 0; A.save(); return genPass(); }
  async function changeLogin(id, newLogin, oldRepeat) {
    await wait(400); const u = A.user(id);
    if (oldRepeat !== u.login) throw new A.ApiError(400, 'Старый логин введён неверно.');
    if (!/^[a-z0-9._-]{3,}$/.test(newLogin)) throw new A.ApiError(400, 'Логин: латиница, цифры, точка, дефис, от 3 символов.');
    if (loginTaken(newLogin, id)) throw new A.ApiError(409, `Логин «${newLogin}» уже занят.`);
    u.login = newLogin; x().sessions[id] = 0; A.save(); return personView(u);
  }
  async function setActive(id, active) { await wait(350); const u = A.user(id); u.active = active; if (!active) x().sessions[id] = 0; A.save(); A.emit('counts', {}); return personView(u); }

  /* ---------- потоки ---------- */
  async function streams() {
    await lat();
    return db().streams.filter((s) => !s.hidden).map((s) => {
      const students = db().users.filter((u) => u.role === 'student' && u.streams.includes(s.code));
      const teachers = db().users.filter((u) => u.role === 'teacher' && u.streams.includes(s.code));
      const orphan = db().homework.filter((h) => h.status === 'pending' && students.some((u) => u.id === h.student)).length;
      const personal = s.individual ? students.map((u) => { const r = db().rooms.find((rr) => rr.kind === 'direct' && rr.members[0] === u.id && !rr.archived); return { id: u.id, name: u.name, login: u.login, active: u.active, room: r ? r.id : null }; }) : [];
      return { ...clone(s), students: students.filter((u) => u.active).length, closedStudents: students.filter((u) => !u.active).length,
        teachers: teachers.map((t) => ({ id: t.id, name: t.name, active: t.active })), noActive: !teachers.some((t) => t.active), pending: orphan, personal };
    });
  }
  const allTeachers = () => db().users.filter((u) => u.role === 'teacher').map((t) => ({ id: t.id, name: t.name, active: t.active }));
  async function assignTeacher(code, tid) { await wait(300); const t = A.user(tid); if (!t.streams.includes(code)) t.streams.push(code); A.save(); A.emit('counts', {}); }
  async function unassignTeacher(code, tid) { await wait(300); const t = A.user(tid); t.streams = t.streams.filter((s) => s !== code); A.save(); A.emit('counts', {}); }
  /* Перевод ученика: чат сменится, работы и прогресс сохранятся, проверяют преподаватели нового потока */
  async function transfer(sid, code) {
    await wait(400); if (A.flags.netFail) throw new A.ApiError(0, 'Нет связи с сервером. Ученик остался в прежнем потоке.');
    const u = A.user(sid); u.streams = [code];
    db().rooms.filter((r) => r.kind === 'direct' && r.members[0] === sid).forEach((r) => { r.archived = !A.stream(code).individual; });
    if (A.stream(code).individual && !db().rooms.some((r) => r.kind === 'direct' && r.members[0] === sid)) db().rooms.push({ id: 'dm-' + sid, title: '', kind: 'direct', streams: [], members: [sid] });
    A.save(); A.emit('counts', {}); return personView(u);
  }
  const streamOptions = () => db().streams.filter((s) => !s.hidden).map((s) => ({ code: s.code, label: s.label, individual: !!s.individual, teachers: db().users.filter((t) => t.role === 'teacher' && t.active && t.streams.includes(s.code)).map((t) => t.name) }));

  /* ---------- «Качество AXON»: детерминированный генератор ---------- */
  const TOP = ['План повторения модуля', 'С чего начать задание', 'Термин из главы', 'Как вести конспект', 'Вопросы к встрече', 'Разбор учебного примера', 'Схема из модуля', 'Подготовка к проверке', 'Непонятный абзац', 'Как сформулировать вывод'];
  let AX = null;
  function hashRnd(seed) { let r = seed % 2147483647 || 7; return () => { r = (r * 16807) % 2147483647; return (r - 1) / 2147483646; }; }
  function axData() {
    if (AX) return AX;
    const NOW = Date.now();
    const plan = [['irina', 138], ['alina', 30], ['oleg', 24], ['ksenia', 41], ['nvet1', 9], ['nvet2', 17], ['maxim', 4], ['pavel', 6], ['darya', 3], ['timur', 12], ['belova', 8], ['kim', 5], ['lebedev', 3]];
    const convs = [];
    plan.forEach(([uid, n], pi) => {
      const rnd = hashRnd(1000 + pi * 97);
      for (let i = 0; i < n; i++) {
        const at = NOW - Math.round((i * (60 / n) + rnd() * 0.8) * DAY) - 3600e3 * (pi + 1);
        const pairs = uid === 'irina' && i === 1 ? 110 : 1 + Math.floor(rnd() * 5);
        const outcomes = []; const ms = [];
        for (let k = 0; k < pairs; k++) {
          const v = rnd();
          outcomes.push(v < 0.03 ? 'cut' : v < 0.05 ? 'timeout' : v < 0.06 ? 'empty' : 'ok');
          ms.push(Math.round(4000 + rnd() * rnd() * 30000));
        }
        convs.push({ id: `${uid}~${i + 1}`, uid, title: TOP[(i + pi) % TOP.length] + (i >= TOP.length ? ` (${Math.floor(i / TOP.length) + 1})` : ''), at, pairs, outcomes, ms });
      }
    });
    AX = { convs, NOW };
    return AX;
  }
  const outcomeOf = (c) => (c.outcomes.some((o) => o !== 'ok') ? c.outcomes.filter((o) => o !== 'ok') : []);
  const badOf = (cid) => Object.values(x().flags[cid] || {}).filter((f) => f.bad).length;
  function convRow(c) {
    const u = A.user(c.uid);
    return { id: c.id, uid: c.uid, name: u.name, login: u.login, stream: u.streams.length ? A.stream(u.streams[0]).label : 'Преподаватель', title: c.title, at: c.at + c.pairs * 120000, messages: c.pairs * 2, problems: [...new Set(outcomeOf(c))], bad: badOf(c.id) };
  }
  async function axonQuality(q = {}) {
    await wait(700 + Math.random() * 400);
    const { convs } = axData();
    const since = Date.now() - (Number(q.p) || 7) * DAY;
    const inPeriod = convs.filter((c) => c.at >= since);
    const ans = inPeriod.flatMap((c) => c.ms.map((m, i) => ({ m, o: c.outcomes[i] })));
    const sorted = ans.map((a) => a.m).sort((a, b) => a - b);
    const metrics = {
      answers: ans.length, avg: sorted.length ? sorted.reduce((s, v) => s + v, 0) / sorted.length / 1000 : 0,
      p95: sorted.length ? sorted[Math.floor(sorted.length * 0.95)] / 1000 : 0,
      cut: ans.filter((a) => a.o === 'cut').length, empty: ans.filter((a) => a.o === 'empty').length, timeout: ans.filter((a) => a.o === 'timeout').length,
      dialogs: inPeriod.length, people: new Set(inPeriod.map((c) => c.uid)).size,
    };
    let list = inPeriod;
    if (q.u) list = list.filter((c) => c.uid === q.u);
    if (q.bad) list = list.filter((c) => badOf(c.id));
    if (q.err) list = list.filter((c) => outcomeOf(c).length);
    const ppl = [...new Set(convs.map((c) => c.uid))].map((uid) => ({ id: uid, name: A.user(uid).name, login: A.user(uid).login, count: convs.filter((c) => c.uid === uid).length }));
    return { metrics, people: ppl, list: list.sort((a, b) => b.at - a.at).map(convRow) };
  }
  function msgsOf(c) {
    const out = [];
    for (let k = 0; k < c.pairs; k++) {
      const t = c.at + k * 120000;
      out.push({ i: k * 2, role: 'user', text: k === 0 ? `Вопрос (пример): ${c.title.toLowerCase()}?` : `Уточняющий вопрос ${k + 1} (пример).`, at: t });
      const o = c.outcomes[k];
      out.push({ i: k * 2 + 1, role: 'axon', at: t + c.ms[k], ms: c.ms[k], outcome: o,
        text: o === 'empty' ? '' : o === 'timeout' ? '' : o === 'cut' ? 'Ответ-заглушка прототипа. Начало ответа: первый шаг —' : 'Ответ-заглушка прототипа. Коротко:\n\n- первый шаг;\n- второй шаг;\n- что проверить после.' });
    }
    return out;
  }
  async function axonDialog(cid, before, limit = 50) {
    await wait(before == null ? 600 : 700);
    const c = axData().convs.find((v) => v.id === cid);
    if (!c) throw new A.ApiError(404, 'Диалог не найден');
    const all = msgsOf(c); const end = before == null ? all.length : before; const start = Math.max(0, end - limit);
    const flags = clone(x().flags[cid] || {});
    return { conv: convRow(c), start, total: all.length, messages: all.slice(start, end).map((m) => ({ ...m, flag: flags[m.i] || null })) };
  }
  async function axonFlag(cid, i, patch) {
    await wait(250);
    const f = (x().flags[cid] = x().flags[cid] || {});
    f[i] = { ...(f[i] || { bad: false, note: '' }), ...patch, at: Date.now() };
    if (!f[i].bad && !f[i].note) delete f[i];
    A.save(); return clone(f[i] || null);
  }

  /* ---------- сводка ---------- */
  async function summary() {
    await lat();
    const d = db(); const c = A.counts('admin');
    const pend = d.homework.filter((h) => h.status === 'pending');
    const oldest = pend.length ? Math.max(...pend.map((h) => PM.dom.fmt.waitDays(h.sentAt))) : 0;
    const noTeacher = d.streams.filter((s) => !s.hidden && !d.users.some((u) => u.role === 'teacher' && u.active && u.streams.includes(s.code)));
    const stale = d.users.filter((u) => u.role === 'student' && u.active && Date.now() - u.lastSeen > STALE);
    const ax = axData().convs.filter((v) => v.at >= Date.now() - 7 * DAY);
    const outs = ax.flatMap((v) => v.outcomes);
    return { review: c.review, oldest, orphan: c.orphan, noTeacher: noTeacher.map((s) => s.label), chat: c.chat, stale: stale.length,
      axon: { answers: outs.length, cut: outs.filter((o) => o === 'cut').length, timeout: outs.filter((o) => o === 'timeout').length },
      people: { students: d.users.filter((u) => u.role === 'student' && u.active).length, teachers: d.users.filter((u) => u.role === 'teacher' && u.active).length, closed: d.users.filter((u) => !u.active).length } };
  }

  A.admin = { people, person, createPerson, resetPassword, changeLogin, setActive, streams, allTeachers, assignTeacher, unassignTeacher, transfer, streamOptions, axonQuality, axonDialog, axonFlag, summary, ROLE };
})(window.PM);
