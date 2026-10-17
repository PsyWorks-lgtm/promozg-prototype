/* Домашки ученика: список и лист задания. Черновик сохраняется в кабинете кнопкой, локальная копия — страховка на устройстве. */
(function (PM) {
  'use strict';
  const { html, $, $$, on, fmt, setHTML } = PM.dom;
  const icon = PM.icon; const ui = PM.ui;
  const S = PM.screens;

  S.hwList = {
    nav: () => 'homework', title: 'Домашки',
    skeleton: () => html`${ui.header({ title: 'Домашки' })}<div class="page">${ui.skeletonList(8)}</div>`,
    load: (ctx) => PM.api.homeworkList(ctx.me.id),
    view: (ctx) => {
      const rows = ctx.data;
      const acc = rows.filter((r) => r.status === 'accepted').length;
      const note = (r) => r.status === 'pending' ? (r.item.sentAt ? `Отправлено ${fmt.day(r.item.sentAt)} · ждёт ${fmt.waitDays(r.item.sentAt)} дн.` : 'Ждёт проверки · дата сдачи неизвестна') : r.status === 'accepted' ? `Проверено ${fmt.day(r.item.reviewedAt)}${r.item.sentAt == null ? ' · дата сдачи неизвестна' : ''}` : r.status === 'revision' ? 'Есть комментарий преподавателя' : r.status === 'draft' ? `Черновик сохранён ${fmt.rel(r.draft.savedAt)}` : '4 части · можно заполнять по одной';
      return html`${ui.header({ title: 'Домашки', sub: `Принято ${acc} из 8` })}
      <div class="page"><div class="list">${rows.map((r) => r.unpublished
        ? html`<div class="li locked" aria-disabled="true"><span class="num">${icon('clock', 'sm')}</span><span class="grow"><b class="ttl">${r.module.title}</b><span class="sub">Материал пока не опубликован</span></span></div>`
        : html`<a class="li" href="#/s/homework/${r.module.n}"><span class="num">${r.module.n}</span><span class="grow"><b class="ttl">${r.module.title}</b><span class="sub">${note(r)}</span></span>${ui.pill(r.status)}${icon('right', 'sm chev')}</a>`)}</div></div>`;
    },
  };

  function statusTop(d) {
    const it = d.item;
    if (!it) return '';
    if (it.status === 'accepted') return html`<div class="card ok"><div class="row">${icon('check')}<b class="grow">Работа принята · ${fmt.day(it.reviewedAt)}</b></div><div class="t2 muted">Проверено: ${d.reviewer}</div>${it.comment ? html`<blockquote class="reply-q">${it.comment}</blockquote>` : ''}<div class="t2 muted">Если нужно что-то поправить, напишите преподавателю.</div></div>`;
    if (it.status === 'pending') return html`<div class="card"><div class="row">${icon('clock')}<b class="grow">${it.sentAt ? `Отправлено ${fmt.dayTime(it.sentAt)}, ждёт проверки` : 'Ждёт проверки · дата сдачи неизвестна'}</b>${ui.pill('pending')}</div><div class="t2 muted">Ответ преподавателя появится здесь, придёт уведомление.</div></div>`;
    if (it.status === 'revision') return html`<div class="card warn"><div class="row">${icon('edit')}<b class="grow">Нужна доработка</b><span class="t1 faint">${d.reviewer}, ${fmt.day(it.reviewedAt)}</span></div><blockquote class="reply-q">${it.comment}</blockquote><div class="t2 muted">Поправьте ответы и отправьте снова, прежний комментарий сохранится.</div></div>`;
    return '';
  }

  /* Локальная копия черновика на этом устройстве: страховка от потери текста, на сервер сама не уходит */
  const LKEY = 'promozg-proto-hw-local-v1';
  const local = {
    all() { try { return JSON.parse(localStorage.getItem(LKEY)) || {}; } catch (_) { return {}; } },
    get(uid, n) { return this.all()[uid + ':' + n] || null; },
    set(uid, n, v) { const a = this.all(); a[uid + ':' + n] = { ...v, savedAt: Date.now() }; try { localStorage.setItem(LKEY, JSON.stringify(a)); } catch (_) { /* пусто */ } },
    del(uid, n) { const a = this.all(); delete a[uid + ':' + n]; try { localStorage.setItem(LKEY, JSON.stringify(a)); } catch (_) { /* пусто */ } },
  };
  const PLAIN = { goal: '', plain: true, questions: [{ id: 'text', title: 'Ответ', prompt: '', placeholder: 'Напишите ответ по заданию модуля' }], checklist: [] };
  const savedLabel = (t) => `Черновик сохранён · ${Date.now() - t < 864e5 && new Date(t).getDate() === new Date().getDate() ? fmt.time(t) : fmt.dayTime(t)}`;
  const same = (a, b) => JSON.stringify(a || {}) === JSON.stringify(b || {});

  S.hwForm = {
    nav: () => 'homework', tabbar: false,
    skeleton: () => html`${ui.header({ title: 'Домашка', back: '#/s/homework' })}<div class="page narrow">${ui.skeletonList(4)}</div>`,
    load: (ctx) => PM.api.homework(ctx.me.id, +ctx.route.params.n),
    view: (ctx) => {
      const d = ctx.data; const it = d.item; const def = d.def || PLAIN; const n = d.module.n;
      const readOnly = it && (it.status === 'accepted' || it.status === 'pending');
      // данные сервера: сохранённый черновик или прошлая отправка; локальный черновик берём, только если он свежее
      const server = d.draft ? d.draft.answers : it ? it.answers : {};
      const serverAt = Math.max((d.draft && d.draft.savedAt) || 0, (it && (it.reviewedAt || it.sentAt)) || 0);
      const loc = readOnly ? null : local.get(ctx.me.id, n);
      const useLocal = !!(loc && loc.savedAt > serverAt && !same(loc.answers, server));
      if (loc && !useLocal && !readOnly) local.del(ctx.me.id, n);
      const src = readOnly ? it.answers : useLocal ? loc.answers : server;
      ctx.hw = { useLocal, def };
      const step = Math.min((useLocal ? loc.step : d.draft && d.draft.step) || 0, def.questions.length - 1);
      const chk = readOnly ? it.checklist || [] : (useLocal && loc.checklist) || (d.draft && d.draft.checklist) || (it && it.checklist) || def.checklist.map(() => false);
      const many = def.questions.length > 1;
      return html`${ui.header({ title: d.module.short + ' · домашка', sub: d.module.title, back: '#/s/homework' })}
      <div class="page narrow hw" data-ro="${readOnly ? 1 : 0}">
        ${statusTop(d)}
        ${def.goal ? html`<p class="t2 muted goal">${def.goal}</p>` : html`<p class="t2 muted goal">У этого модуля нет отдельного описания задания. Напишите ответ в поле ниже.</p>`}
        ${readOnly ? html`<div class="col gap4">${def.questions.map((q) => html`<section class="card"><h3>${q.title}</h3><p class="answer">${src[q.id] || '—'}</p></section>`)}</div>` : html`
        ${useLocal ? html`<div class="card accent row local-note" role="status">${icon('alert', 'sm')}<span class="grow t2">Подставлен текст из черновика на этом устройстве (${fmt.dayTime(loc.savedAt)}). Нажмите «Сохранить черновик», чтобы он сохранился в кабинете.</span><button class="btn ghost sm" data-act="drop-local">Вернуть сохранённый</button></div>` : ''}
        <div class="err-summary" role="alert" hidden></div>
        ${many ? html`<nav class="stepper" aria-label="Части задания">${def.questions.map((q, i) => html`<button type="button" class="step ${i === step ? 'on' : ''} ${src[q.id] ? 'done' : ''}" data-step="${i}" aria-current="${i === step ? 'step' : 'false'}" aria-label="${q.title}">${i + 1}</button>`)}</nav>` : ''}
        ${def.questions.map((q, i) => html`<section class="card qcard" data-q="${i}" ${i === step ? '' : 'hidden'}>
          ${many ? html`<div class="caps">Часть ${i + 1} из ${def.questions.length}</div><h3>${q.title.replace(/^Часть \d+\. /, '')}</h3>` : ''}
          ${q.prompt ? html`<p class="t2 muted">${q.prompt}</p>` : ''}
          <label class="field"><span>Ваш ответ</span><textarea class="textarea" data-answer="${q.id}" rows="${many ? 6 : 10}" placeholder="${q.placeholder}" aria-describedby="err-${q.id}">${src[q.id] || ''}</textarea><small class="helper err" id="err-${q.id}" hidden>${many ? 'Эта часть пустая' : 'Ответ пустой'}</small></label>
          ${many ? html`<div class="row" style="justify-content:space-between;margin-top:12px">
            <button class="btn ghost sm" data-step="${i - 1}" ${i === 0 ? 'disabled' : ''}>${icon('left', 'sm')}Назад</button>
            ${i < def.questions.length - 1 ? html`<button class="btn secondary sm" data-step="${i + 1}">Часть ${i + 2} ${icon('right', 'sm')}</button>` : html`<span></span>`}</div>` : ''}
        </section>`)}
        ${def.checklist.length ? html`<section class="card"><h3>Самопроверка перед отправкой</h3>${def.checklist.map((c, i) => html`<label class="check"><input type="checkbox" data-check="${i}" ${chk[i] ? 'checked' : ''}> ${c}</label>`)}</section>` : ''}
        <section class="card file-row"><div class="row">${icon('clip')}<span class="grow t2" data-file-name>${it && it.file ? `${it.file.name} · ${fmt.size(it.file.size)}` : 'Файл не прикреплён (PDF или фото до 20 МБ)'}</span><button class="btn ghost sm" data-act="file">${it && it.file ? 'Заменить' : 'Прикрепить'}</button></div></section>`}
      </div>
      ${readOnly ? '' : html`<div class="sticky-bar"><div class="sticky-in">
        <span class="save-state t2" data-save aria-live="polite">${useLocal ? 'Есть несохранённые изменения' : d.draft ? savedLabel(d.draft.savedAt) : 'Черновик не сохранён'}</span>
        <span class="grow"></span><span class="t2 faint only-d" data-filled></span>
        <button class="btn secondary" data-act="save">Сохранить черновик</button>
        <button class="btn primary" data-act="submit">Отправить на проверку</button></div>
        <p class="helper err submit-err" role="alert" hidden></p></div>`}`;
    },
    mount(root, ctx) {
      const d = ctx.data; const n = d.module.n; const def = ctx.hw.def; const uid = ctx.me.id;
      if (root.querySelector('[data-ro="1"]')) return null;
      const offs = [];
      let step = +($('.step.on', root) || { dataset: { step: 0 } }).dataset.step;
      let file = d.item && d.item.file ? d.item.file : null;
      const answers = () => Object.fromEntries($$('[data-answer]', root).map((t) => [t.dataset.answer, t.value]));
      const checks = () => $$('[data-check]', root).map((c) => c.checked);
      const saveEl = $('[data-save]', root);
      const filled = () => { const a = answers(); const k = def.questions.filter((q) => (a[q.id] || '').trim()).length; $('[data-filled]', root).textContent = def.questions.length > 1 ? `Заполнено ${k} из ${def.questions.length}` : ''; $$('.step', root).forEach((s, i) => s.classList.toggle('done', !!(a[def.questions[i].id] || '').trim())); return k; };
      filled();
      // при вводе — только локальная копия на устройстве; в кабинет черновик уходит кнопкой
      let timer = 0;
      const keepLocal = () => { clearTimeout(timer); saveEl.classList.remove('err'); saveEl.textContent = 'Есть несохранённые изменения'; timer = setTimeout(() => local.set(uid, n, { answers: answers(), step, checklist: checks() }), 400); };
      offs.push(on(root, 'input', '[data-answer]', (e, t) => { filled(); keepLocal(); const err = $('#err-' + t.dataset.answer, root); if (t.value.trim()) { err.hidden = true; t.removeAttribute('aria-invalid'); } }));
      offs.push(on(root, 'change', '[data-check]', keepLocal));
      const saveBtn = $('[data-act="save"]', root);
      const doSave = async () => {
        clearTimeout(timer); saveBtn.disabled = true; saveEl.textContent = 'Сохраняем…'; saveEl.classList.remove('err');
        try { const t = await PM.api.saveDraft(uid, n, { answers: answers(), step, checklist: checks() }); local.del(uid, n); saveEl.textContent = savedLabel(t); const ln = $('.local-note', root); if (ln) ln.remove(); }
        catch (e) { local.set(uid, n, { answers: answers(), step, checklist: checks() }); saveEl.classList.add('err'); setHTML(saveEl, html`Не сохранено: ${e.message} Текст остался на этом устройстве. <button class="linkbtn" data-act="save">Повторить</button>`); }
        saveBtn.disabled = false;
      };
      offs.push(on(root, 'click', '[data-act="save"]', doSave));
      offs.push(on(root, 'click', '[data-act="drop-local"]', () => { local.del(uid, n); PM.app.render(); }));
      const go = (i) => {
        if (i < 0 || i >= def.questions.length) return;
        step = i;
        $$('[data-q]', root).forEach((s) => { s.hidden = +s.dataset.q !== i; });
        $$('.step', root).forEach((s) => { const on_ = +s.dataset.step === i; s.classList.toggle('on', on_); s.setAttribute('aria-current', on_ ? 'step' : 'false'); });
        const ta = $(`[data-q="${i}"] textarea`, root); ta.focus({ preventScroll: true });
        $(`[data-q="${i}"]`, root).scrollIntoView({ block: 'nearest' });
      };
      offs.push(on(root, 'click', '[data-step]', (e, b) => go(+b.dataset.step)));
      offs.push(on(root, 'click', '[data-act="file"]', () => { file = { name: `модуль-${n}-схема.pdf`, size: 840000 }; $('[data-file-name]', root).textContent = `${file.name} · ${fmt.size(file.size)} · будет отправлен с работой`; PM.shell.toast('Файл прикреплён (имитация)'); }));
      offs.push(on(root, 'click', '[data-act="submit"]', async (e, b) => {
        const a = answers(); const empty = def.questions.map((q, i) => [q, i]).filter(([q]) => !(a[q.id] || '').trim());
        const sum = $('.err-summary', root); const errP = $('.submit-err', root);
        errP.hidden = true;
        if (empty.length) {
          sum.hidden = false;
          setHTML(sum, def.questions.length > 1 ? html`<b>Не заполнено: ${empty.length} ${PM.dom.plural(empty.length, ['часть', 'части', 'частей'])}</b><span>${empty.map(([q, i]) => html`<button class="linkbtn" data-step="${i}">${q.title}</button>`)}</span>` : html`<b>Ответ пустой — напишите его перед отправкой</b>`);
          empty.forEach(([q]) => { $('#err-' + q.id, root).hidden = false; $(`[data-answer="${q.id}"]`, root).setAttribute('aria-invalid', 'true'); });
          go(empty[0][1]); return;
        }
        sum.hidden = true;
        b.disabled = true; b.textContent = 'Отправляем…';
        clearTimeout(timer);
        try {
          await PM.api.submitHomework(uid, n, { answers: a, checklist: checks(), file });
          local.del(uid, n);
          PM.shell.toast('Работа отправлена на проверку. Придёт уведомление, когда преподаватель ответит.');
          PM.app.render();
        } catch (err) {
          local.set(uid, n, { answers: a, step, checklist: checks() });
          b.disabled = false; b.textContent = 'Отправить на проверку';
          errP.hidden = false; setHTML(errP, html`${err.message} <button class="linkbtn" data-act="submit-retry">Повторить</button>`);
          PM.shell.toast('Не отправлено', { kind: 'err', action: { label: 'Повторить', fn: () => b.click() } });
        }
      }));
      offs.push(on(root, 'click', '[data-act="submit-retry"]', () => $('[data-act="submit"]', root).click()));
      return () => { clearTimeout(timer); offs.forEach((f) => f()); };
    },
  };
})(window.PM);
