/* Фейковые данные прототипа. Все имена, тексты и цифры вымышленные.
   Генерация детерминированная (фиксированный seed), чтобы демо выглядело одинаково. */
(function (PM) {
  'use strict';
  const D = (s) => new Date(s).getTime();
  const DAY = 864e5;

  function seed() {
    const NOW = Date.now();
    const ago = (min) => NOW - min * 60000;
    let r = 7; const rnd = () => { r = (r * 16807) % 2147483647; return (r - 1) / 2147483646; };
    const pick = (a) => a[Math.floor(rnd() * a.length)];

    /* Потоки — как таблица streams на сервере. Экран всегда показывает label, код не выводится. */
    const streams = [
      { code: 'st1', label: 'Поток 1', course_title: 'АНП 2.0' },
      { code: 'st2', label: 'Поток 2', course_title: 'АНП 2.0' },
      { code: 'st3', label: 'Личное обучение', course_title: 'АНП 2.0', individual: true },
      { code: 'st4', label: 'Поток 4', course_title: 'АНП 2.0', hidden: true },
    ];
    const [S1, S2, S3] = streams.map((s) => s.code);
    const U = (id, login, name, role, st, extra = {}) => ({ id, login, name, role, streams: st, active: true, lastSeen: ago(60 * 5), ...extra });
    const users = [
      U('alina', 'a.frolova', 'Алина Фролова', 'student', [S2], { lastSeen: ago(2) }),
      U('irina', 'i.smirnova', 'Инна Смирнова', 'student', [S2], { lastSeen: ago(50) }),
      U('oleg', 'o.panov', 'Олег Панов', 'student', [S2], { lastSeen: ago(60 * 9) }),
      U('nvet1', 'o.vetrova', 'Ольга Ветрова', 'student', [S1], { lastSeen: ago(60 * 24 * 2) }),
      U('nvet2', 'olga.v', 'Ольга Ветрова', 'student', [S3], { lastSeen: ago(60 * 24 * 1) }),
      U('maxim', 'm.gurov', 'Максим Гуров', 'student', [S1], { lastSeen: ago(60 * 24 * 19) }),
      U('ksenia', 'k.demina', 'Ксения Дёмина', 'student', [S2], { lastSeen: ago(60 * 3) }),
      U('pavel', 'p.ershov', 'Павел Ершов', 'student', [S3], { lastSeen: ago(60 * 24 * 16) }),
      U('darya', 'd.lukina', 'Дарья Лукина', 'student', [S1], { lastSeen: ago(60 * 24 * 23) }),
      U('timur', 't.akopov', 'Тимур Акопов', 'student', [S3], { lastSeen: ago(60 * 30) }),
      U('vera', 'v.ryabova', 'Вера Рябова', 'student', [S2], { active: false, lastSeen: ago(60 * 24 * 95) }),
      U('belova', 'n.belova', 'Нина Белова', 'teacher', [S2, S3], { lastSeen: ago(10) }),
      U('kim', 'g.kim', 'Глеб Ким', 'teacher', [S2, S3], { lastSeen: ago(60 * 24 * 2) }),
      U('sokolova', 'e.sokolova', 'Елена Соколова', 'teacher', [S3], { lastSeen: ago(60 * 24 * 5) }),
      U('lebedev', 'd.lebedev', 'Денис Лебедев', 'teacher', [S2], { lastSeen: ago(60 * 24 * 1) }),
      U('orlova', 'a.orlova', 'Анна Орлова', 'teacher', [S3], { lastSeen: ago(60 * 24 * 8) }),
      U('zaitsev', 'i.zaitsev', 'Игорь Зайцев', 'teacher', [S1], { active: false, lastSeen: ago(60 * 24 * 150) }),
      U('admin', 'admin', 'Админ ProMozg', 'admin', [], { lastSeen: ago(1) }),
    ];
    const studentsOf = (st) => users.filter((u) => u.role === 'student' && u.streams.includes(st));

    /* Модули — единый каталог для книги, курса и домашек. 7 и 8 закрыты до 12.11. */
    const opens = D('2026-11-12T10:00:00');
    const modules = Array.from({ length: 8 }, (_, i) => ({
      n: i + 1, title: `Модуль ${i + 1} · Тема модуля ${i + 1}`, short: `Модуль ${i + 1}`,
      parts: 4, minutes: 18 + ((i * 7) % 15), opensAt: i >= 6 ? opens : null, hasHomework: true,
    }));

    /* Задания: 4 части-заглушки на модуль */
    const homeworkDefs = {};
    modules.forEach((m) => {
      homeworkDefs[m.n] = {
        goal: 'Цель задания — текст-заглушка. Здесь коротко сказано, что проверяет работа и в каком виде её сдавать.',
        questions: [
          { id: 'q1', title: 'Часть 1. Опишите ситуацию', prompt: 'Текст-заглушка: опишите один случай из практики или учебный пример, без выводов.', placeholder: 'Опишите ситуацию своими словами' },
          { id: 'q2', title: 'Часть 2. Разберите по шагам', prompt: 'Текст-заглушка: разложите случай на шаги по схеме из модуля.', placeholder: 'Шаг 1… Шаг 2…' },
          { id: 'q3', title: 'Часть 3. Что вы попробуете', prompt: 'Текст-заглушка: какой приём вы выберете и почему.', placeholder: 'Выбранный приём и причина' },
          { id: 'q4', title: 'Часть 4. Короткий вывод', prompt: 'Текст-заглушка: 3–5 предложений о том, что стало понятнее.', placeholder: 'Короткий вывод' },
        ],
        checklist: ['Ответы опираются на материал модуля', 'Есть конкретный пример', 'Вывод сформулирован коротко'],
      };
    });

    /* Домашки: 35 работ от 8 учеников; 4 ждут проверки (одна из Потока 1 без проверяющего), 2 на доработке, 29 приняты */
    const hw = [];
    let hid = 100;
    const answers = () => ({ q1: 'Ответ ученика (пример). Ситуация описана подробно, с примером из практики: что произошло, кто участвовал, что было заметно.', q2: 'Шаг 1 — наблюдение. Шаг 2 — гипотеза. Шаг 3 — проверка на следующей встрече.', q3: 'Выбран приём из модуля: он короткий, его легко повторить, и результат видно сразу.', q4: 'Стало понятнее, как отличать описание от механизма и что проверять после встречи.' });
    const add = (student, n, status, sentAt, extra = {}) => hw.push({ id: 'hw' + (hid++), student, module: n, status, answers: answers(), checklist: [true, true, status === 'accepted'], file: null, sentAt, reviewedAt: null, reviewer: null, comment: '', versions: 1, ...extra });
    const acc = (s, n, daysAgo, reviewer) => add(s, n, 'accepted', NOW - daysAgo * DAY, { reviewedAt: NOW - (daysAgo - 2) * DAY, reviewer, seen: true, comment: 'Хорошая работа: пример конкретный, шаги логичные. Можно двигаться дальше.' });
    acc('alina', 1, 30, 'belova');
    [['irina', [1, 2, 3, 4, 5]], ['oleg', [1, 2, 3, 4]], ['ksenia', [1, 2, 3, 4, 5, 6]], ['nvet1', [1, 2, 3]], ['nvet2', [1, 2, 3, 4]], ['timur', [1, 2, 3]], ['maxim', [1, 2, 3]]]
      .forEach(([s, ns]) => ns.forEach((n) => acc(s, n, 160 - n * 12 + s.length, s === 'nvet1' || s === 'maxim' ? 'zaitsev' : pick(['belova', 'kim', 'sokolova', 'lebedev']))));
    while (hw.filter((h) => h.status === 'accepted').length > 29) hw.pop();
    add('oleg', 5, 'revision', NOW - 27 * DAY, { reviewedAt: NOW - 25 * DAY, reviewer: 'kim', seen: true, comment: 'В части 2 не хватает шагов: опишите, что именно вы проверите на следующей встрече.' });
    add('timur', 4, 'revision', NOW - 18 * DAY, { reviewedAt: NOW - 16 * DAY, reviewer: 'orlova', seen: true, comment: 'Вывод слишком общий. Добавьте один конкретный пример.' });
    add('darya', 4, 'pending', NOW - 12 * DAY, { file: { name: 'схема-случая.pdf', size: 412000 } });   // Поток 1 — без проверяющего
    add('pavel', 5, 'pending', NOW - 9 * DAY);
    add('irina', 6, 'pending', NOW - 4 * DAY);
    add('alina', 2, 'pending', NOW - 2 * DAY - 3 * 3600e3, { file: { name: 'конспект-модуля-2.pdf', size: 1240000 } });

    /* Чат */
    const rooms = [
      { id: 'r-common', title: 'Поток 1 + 2 · общий', streams: [S1, S2], kind: 'stream' },
      { id: 'r-s2', title: 'Поток 2 · общий', streams: [S2], kind: 'stream' },
      { id: 'r-staff', title: 'Преподаватели', streams: [], kind: 'staff' },
    ];
    const messages = [];
    let mid = 1;
    const M = (room, author, text, at, extra = {}) => { const m = { id: 'm' + (mid++), room, author, text, at, replyTo: null, file: null, reactions: {}, ...extra }; messages.push(m); return m; };
    const PHR = [
      'Добрый вечер! Вопросы по модулю удобнее задавать здесь, чтобы ответ видели все.', 'Спасибо! А запись встречи появится в библиотеке?', 'Да, обычно в течение суток, раздел «Записи сессий».',
      'Кто уже начал задание по модулю? Как поняли вторую часть?', 'Расписано по шагам, как в примере. Получилось четыре шага.', 'У меня тоже четыре, но третий спорный 🙂',
      'Шагов может быть и три, и пять — важна логика, а не число.', 'Можно прикрепить к работе фото схемы?', 'Да, файл до 20 МБ: PDF или фото.', 'Спасибо за встречу сегодня, было полезно.',
      'Присоединяюсь!', 'Где найти конспект прошлой встречи?', 'В библиотеке, «Материалы студента».', 'На следующей неделе встреча в четверг, время то же.', 'Принято 👍',
      'Будет ли запись?', 'Будет.', 'Вопрос по книге: схему в главе 3 читать вместе со следующей страницей?', 'Да, это одна схема на двух страницах.', 'Теперь понятно, спасибо.',
    ];
    const roomAuthors = (room) => { const base = room.kind === 'staff' ? users.filter((u) => u.role === 'teacher' && u.active) : users.filter((u) => u.role !== 'admin' && u.active && u.streams.some((s) => room.streams.includes(s))); return base.filter((u) => u.id !== 'alina'); };
    const sizes = { 'r-common': 300, 'r-s2': 80, 'r-staff': 25 };
    rooms.forEach((room) => {
      const n = sizes[room.id]; const authors = roomAuthors(room).concat(room.kind === 'staff' ? [] : [users[0]]);
      let t = NOW - 60 * DAY;
      const step = (60 * DAY - 3 * 3600e3) / n;
      let imgs = 0, files = 0, voices = 0, replies = 0;
      for (let k = 0; k < n; k++) {
        t += step * (0.6 + rnd() * 0.8);
        const a = pick(authors).id;
        const extra = {};
        if (room.id === 'r-common') {
          if (k % 47 === 11 && imgs < 6) { extra.file = { kind: 'image', name: `фото-${++imgs}.jpg`, size: 800000 + imgs * 120000, w: 4, h: 3 }; }
          else if (k % 61 === 17 && files < 4) { extra.file = { kind: 'pdf', name: `материал-${++files}.pdf`, size: 300000 + files * 210000 }; }
          else if (k % 83 === 29 && voices < 3) { extra.file = { kind: 'voice', name: 'голосовое', dur: 20 + voices * 11 }; voices++; }
          if (k % 19 === 5 && replies < 15 && messages.length > 3) { extra.replyTo = messages[messages.length - 2].id; replies++; }
          if (k % 13 === 4) extra.reactions = { '👍': ['irina', 'oleg'].slice(0, 1 + (k % 2)) };
        }
        M(room.id, a, extra.file && extra.file.kind === 'voice' ? '' : PHR[k % PHR.length], Math.min(t, NOW - 5 * 60000), extra);
      }
    });
    // последние сообщения общей комнаты — сегодня
    const common = messages.filter((m) => m.room === 'r-common');
    const tail = common.slice(-12);
    tail.forEach((m, i) => { m.at = ago(12 * 6 - i * 6); m.author = pick(['irina', 'oleg', 'belova', 'ksenia', 'nvet1', 'lebedev']); });
    tail[tail.length - 1].text = 'Коллеги, вопросы по заданию соберу завтра одним сообщением и закреплю.'; tail[tail.length - 1].author = 'belova';
    // Личное обучение: у каждого ученика личная комната — он, все преподаватели личного обучения и админ. Переписки начинаются пустыми.
    ['nvet2', 'pavel', 'timur'].forEach((st) => rooms.push({ id: 'dm-' + st, title: '', kind: 'direct', streams: [], members: [st] }));
    const pins = { 'r-common': common[common.length - 40].id, 'r-s2': messages.filter((m) => m.room === 'r-s2').slice(-10)[0].id };
    messages.find((m) => m.id === pins['r-common']).text = 'Домашние задания отправляем через раздел «Домашки», не в чат. Файл до 20 МБ.';
    messages.find((m) => m.id === pins['r-common']).author = 'belova';
    const lastOf = (room, k) => { const arr = messages.filter((m) => m.room === room); return arr[Math.max(0, arr.length - 1 - k)].id; };
    const reads = {
      alina: { 'r-common': lastOf('r-common', 12), 'r-s2': lastOf('r-s2', 2) },
      belova: { 'r-common': lastOf('r-common', 3), 'r-s2': lastOf('r-s2', 0), 'r-staff': lastOf('r-staff', 2) },
      admin: { 'r-common': lastOf('r-common', 5), 'r-s2': lastOf('r-s2', 3), 'r-staff': lastOf('r-staff', 2) },
    };

    /* AXON: у героя 30 разговоров, один длинный */
    const TOP = ['План повторения модуля', 'С чего начать задание', 'Термин из главы 2', 'Как вести конспект', 'Вопросы к встрече', 'Разбор примера из книги', 'Схема из модуля 3', 'Подготовка к проверке'];
    const convs = [];
    for (let i = 0; i < 30; i++) {
      const at = NOW - (i < 2 ? i * 5 * 3600e3 + 3600e3 : i * 1.7 * DAY);
      const msgs = [];
      const len = i === 3 ? 110 : 1 + (i % 3);
      for (let k = 0; k < len; k++) {
        msgs.push({ role: 'user', text: k === 0 ? `Вопрос (пример): ${TOP[i % TOP.length].toLowerCase()}?` : 'Уточняющий вопрос (пример).', at: at + k * 120000 });
        msgs.push({ role: 'axon', text: 'Ответ-заглушка прототипа. Коротко:\n\n- первый шаг;\n- второй шаг;\n- что проверить после.\n\nС какого шага начнём?', at: at + k * 120000 + 9000, ms: 6000 + Math.round(rnd() * 9000) });
      }
      convs.push({ id: 'c' + (i + 1), title: TOP[i % TOP.length] + (i >= TOP.length ? ` (${Math.floor(i / TOP.length) + 1})` : ''), at, messages: msgs });
    }
    const axon = { alina: convs, belova: [] };
    const axonMemory = { alina: [
      { id: 'mem1', text: 'Учится в Потоке 2, удобнее заниматься вечером', source: 'auto' },
      { id: 'mem2', text: 'Предпочитает короткие ответы со списком шагов', source: 'manual' },
    ] };

    /* Библиотека: 21 материал. Свои — во встроенном просмотрщике, внешние — карточкой ↗ */
    const library = [];
    const L = (section, title, kind, meta, external = false) => library.push({ id: String(library.length + 1), section, title, kind, ...meta, external, at: NOW - (40 - library.length) * DAY });
    for (let i = 1; i <= 4; i++) L('demo', `Демо-сессия ${i}. Разбор случая (пример)`, 'video', { minutes: 35 + i * 6 });
    for (let i = 1; i <= 6; i++) L('lectures', `Лекция ${i}. Название лекции`, 'video', { minutes: 52 + i * 3 });
    for (let i = 1; i <= 5; i++) L('sessions', `Запись сессии ${i}. Ответы на вопросы`, 'video', { minutes: 70 + i * 4 });
    for (let i = 1; i <= 4; i++) L('student', `Памятка ${i}. Название материала`, 'pdf', { size: 300000 + i * 90000, pages: 4 + i });
    L('student', 'Рабочая тетрадь к курсу', 'link', {}, true);
    L('student', 'Глоссарий терминов', 'link', {}, true);
    const librarySections = [
      { id: 'demo', title: 'Демо-сессии' }, { id: 'lectures', title: 'Лекции' }, { id: 'sessions', title: 'Записи сессий' },
      { id: 'student', title: 'Материалы студента' }, { id: 'reading', title: 'Литература' },
    ];

    return {
      version: 12, streams, users, modules, homeworkDefs, homework: hw, rooms, messages, pins, reads,
      axon, axonMemory, library, librarySections,
      drafts: { alina: { 3: { answers: { q1: 'Черновик: ситуация из практики, начало описания…', q2: 'Шаг 1 — ' }, step: 1, savedAt: NOW - DAY, checklist: [true, false, false] } } },
      reading: { alina: { kind: 'module', n: 3, part: 2, progress: 0.4 }, alinaBook: { ch: 4, progress: 0.31 } },
      notifications: { belova: 'default', kim: 'on', alina: 'on', admin: 'on' },
      pendingPush: {},
      _studentsOf: null,
    };
  }
  PM.seed = seed;
})(window.PM);
