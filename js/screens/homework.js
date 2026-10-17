/* Домашки ученика: список и лист задания по частям с автосохранением. */
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
      const note = (r) => r.status === 'pending' ? `Отправлено ${fmt.day(r.item.sentAt)} · ждёт ${fmt.waitDays(r.item.sentAt)} дн.` : r.status === 'accepted' ? `Проверено ${fmt.day(r.item.reviewedAt)}` : r.status === 'revision' ? 'Есть комментарий преподавателя' : r.status === 'draft' ? `Черновик сохранён ${fmt.rel(r.draft.savedAt)}` : '4 части · можно заполнять по одной';
      return html`${ui.header({ title: 'Домашки', sub: `Принято ${acc} из 8` })}
      <div class="page"><div class="list">${rows.map((r) => r.locked
        ? html`<div class="li locked" aria-disabled="true"><span class="num">${icon('lock', 'sm')}</span><span class="grow"><b class="ttl">${r.module.title}</b><span class="sub">Откроется ${fmt.day(r.module.opensAt)}</span></span></div>`
        : html`<a class="li" href="#/s/homework/${r.module.n}"><span class="num">${r.module.n}</span><span class="grow"><b class="ttl">${r.module.title}</b><span class="sub">${note(r)}</span></span>${ui.pill(r.status)}${icon('right', 'sm chev')}</a>`)}</div></div>`;
    },
  };

  function statusTop(d) {
    const it = d.item;
    if (!it) return '';
    if (it.status === 'accepted') return html`<div class="card ok"><div class="row">${icon('check')}<b class="grow">Работа принята · ${fmt.day(it.reviewedAt)}</b></div><div class="t2 muted">Проверено: ${d.reviewer}</div>${it.comment ? html`<blockquote class="reply-q">${it.comment}</blockquote>` : ''}<div class="t2 muted">Если нужно что-то поправить, напишите преподавателю.</div></div>`;
    if (it.status === 'pending') return html`<div class="card"><div class="row">${icon('clock')}<b class="grow">Отправлено ${fmt.dayTime(it.sentAt)}, ждёт проверки</b>${ui.pill('pending')}</div><div class="t2 muted">Ответ преподавателя появится здесь, придёт уведомление.</div></div>`;
    if (it.status === 'revision') return html`<div class="card warn"><div class="row">${icon('edit')}<b class="grow">Нужна доработка</b><span class="t1 faint">${d.reviewer}, ${fmt.day(it.reviewedAt)}</span></div><blockquote class="reply-q">${it.comment}</blockquote><div class="t2 muted">Поправьте ответы и отправьте снова, прежний комментарий сохранится.</div></div>`;
    return '';
  }

  S.hwForm = {
    nav: () => 'homework', tabbar: false,
    skeleton: () => html`${ui.header({ title: 'Домашка', back: '#/s/homework' })}<div class="page narrow">${ui.skeletonList(4)}</div>`,
    load: (ctx) => PM.api.homework(ctx.me.id, +ctx.route.params.n),
    view: (ctx) => {
      const d = ctx.data; const it = d.item; const def = d.def;
      const readOnly = it && (it.status === 'accepted' || it.status === 'pending');
      const src = readOnly ? it.answers : { ...(it ? it.answers : {}), ...(d.draft ? d.draft.answers : {}) };
      const step = Math.min(d.draft && !readOnly ? d.draft.step || 0 : 0, def.questions.length - 1);
      const chk = readOnly ? it.checklist : (d.draft && d.draft.checklist) || (it && it.checklist) || def.checklist.map(() => false);
      const saved = d.draft && d.draft.savedAt;
      return html`${ui.header({ title: d.module.short + ' · домашка', sub: d.module.title, back: '#/s/homework' })}
      <div class="page narrow hw" data-ro="${readOnly ? 1 : 0}">
        ${statusTop(d)}
        <p class="t2 muted goal">${def.goal}</p>
        ${readOnly ? html`<div class="col gap4">${def.questions.map((q) => html`<section class="card"><h3>${q.title}</h3><p class="answer">${src[q.id] || '—'}</p></section>`)}</div>` : html`
        <div class="err-summary" role="alert" hidden></div>
        <nav class="stepper" aria-label="Части задания">${def.questions.map((q, i) => html`<button type="button" class="step ${i === step ? 'on' : ''} ${src[q.id] ? 'done' : ''}" data-step="${i}" aria-current="${i === step ? 'step' : 'false'}" aria-label="${q.title}">${i + 1}</button>`)}</nav>
        ${def.questions.map((q, i) => html`<section class="card qcard" data-q="${i}" ${i === step ? '' : 'hidden'}>
          <div class="caps">Часть ${i + 1} из ${def.questions.length}</div><h3>${q.title.replace(/^Часть \d+\. /, '')}</h3>
          <p class="t2 muted">${q.prompt}</p>
          <label class="field"><span>Ваш ответ</span><textarea class="textarea" data-answer="${q.id}" rows="6" placeholder="${q.placeholder}" aria-describedby="err-${q.id}">${src[q.id] || ''}</textarea><small class="helper err" id="err-${q.id}" hidden>Эта часть пустая</small></label>
          <div class="row" style="justify-content:space-between;margin-top:12px">
            <button class="btn ghost sm" data-step="${i - 1}" ${i === 0 ? 'disabled' : ''}>${icon('left', 'sm')}Назад</button>
            ${i < def.questions.length - 1 ? html`<button class="btn secondary sm" data-step="${i + 1}">Часть ${i + 2} ${icon('right', 'sm')}</button>` : html`<span></span>`}</div>
        </section>`)}
        <section class="card"><h3>Самопроверка перед отправкой</h3>${def.checklist.map((c, i) => html`<label class="check"><input type="checkbox" data-check="${i}" ${chk[i] ? 'checked' : ''}> ${c}</label>`)}</section>
        <section class="card file-row"><div class="row">${icon('clip')}<span class="grow t2" data-file-name>${it && it.file ? `${it.file.name} · ${fmt.size(it.file.size)}` : 'Файл не прикреплён (PDF или фото до 20 МБ)'}</span><button class="btn ghost sm" data-act="file">${it && it.file ? 'Заменить' : 'Прикрепить'}</button></div></section>`}
      </div>
      ${readOnly ? '' : html`<div class="sticky-bar"><div class="sticky-in">
        <span class="save-state t2" data-save aria-live="polite">${saved ? `Черновик сохранён · ${fmt.time(saved)}` : 'Черновик сохраняется автоматически'}</span>
        <span class="grow"></span><span class="t2 faint only-d" data-filled></span>
        <button class="btn primary" data-act="submit">Отправить на проверку</button></div>
        <p class="helper err submit-err" role="alert" hidden></p></div>`}`;
    },
    mount(root, ctx) {
      const d = ctx.data; const n = d.module.n; const def = d.def;
      if (root.querySelector('[data-ro="1"]')) return null;
      const offs = [];
      let step = +($('.step.on', root) || { dataset: { step: 0 } }).dataset.step;
      let file = d.item && d.item.file ? d.item.file : null;
      const answers = () => Object.fromEntries($$('[data-answer]', root).map((t) => [t.dataset.answer, t.value]));
      const checks = () => $$('[data-check]', root).map((c) => c.checked);
      const saveEl = $('[data-save]', root);
      const filled = () => { const a = answers(); const k = def.questions.filter((q) => (a[q.id] || '').trim()).length; $('[data-filled]', root).textContent = `Заполнено ${k} из ${def.questions.length}`; $$('.step', root).forEach((s, i) => s.classList.toggle('done', !!(a[def.questions[i].id] || '').trim())); return k; };
      filled();
      // автосохранение с задержкой; точечно обновляем только строку статуса — фокус и текст не трогаем
      let timer = 0, saving = false, again = false;
      const doSave = async () => {
        if (saving) { again = true; return; }
        saving = true; saveEl.textContent = 'Сохраняем…'; saveEl.classList.remove('err');
        try { const t = await PM.api.saveDraft(ctx.me.id, n, { answers: answers(), step, checklist: checks() }); saveEl.textContent = `Черновик сохранён · ${fmt.time(t)}`; }
        catch (e) { saveEl.classList.add('err'); setHTML(saveEl, html`Не сохранено. <button class="linkbtn" data-act="resave">Повторить</button>`); }
        saving = false; if (again) { again = false; doSave(); }
      };
      const schedule = () => { clearTimeout(timer); timer = setTimeout(doSave, 800); };
      offs.push(on(root, 'input', '[data-answer]', (e, t) => { filled(); schedule(); const err = $('#err-' + t.dataset.answer, root); if (t.value.trim()) { err.hidden = true; t.removeAttribute('aria-invalid'); } }));
      offs.push(on(root, 'change', '[data-check]', schedule));
      offs.push(on(root, 'click', '[data-act="resave"]', doSave));
      const go = (i) => {
        if (i < 0 || i >= def.questions.length) return;
        step = i;
        $$('[data-q]', root).forEach((s) => { s.hidden = +s.dataset.q !== i; });
        $$('.step', root).forEach((s) => { const on_ = +s.dataset.step === i; s.classList.toggle('on', on_); s.setAttribute('aria-current', on_ ? 'step' : 'false'); });
        const ta = $(`[data-q="${i}"] textarea`, root); ta.focus({ preventScroll: true });
        $(`[data-q="${i}"]`, root).scrollIntoView({ block: 'nearest' });
        schedule();
      };
      offs.push(on(root, 'click', '[data-step]', (e, b) => go(+b.dataset.step)));
      offs.push(on(root, 'click', '[data-act="file"]', () => { file = { name: `модуль-${n}-схема.pdf`, size: 840000 }; $('[data-file-name]', root).textContent = `${file.name} · ${fmt.size(file.size)} · будет отправлен с работой`; PM.shell.toast('Файл прикреплён (имитация)'); }));
      offs.push(on(root, 'click', '[data-act="submit"]', async (e, b) => {
        const a = answers(); const empty = def.questions.map((q, i) => [q, i]).filter(([q]) => !(a[q.id] || '').trim());
        const sum = $('.err-summary', root); const errP = $('.submit-err', root);
        errP.hidden = true;
        if (empty.length) {
          sum.hidden = false;
          setHTML(sum, html`<b>Не заполнено: ${empty.length} ${PM.dom.plural(empty.length, ['часть', 'части', 'частей'])}</b><span>${empty.map(([q, i]) => html`<button class="linkbtn" data-step="${i}">${q.title}</button>`)}</span>`);
          empty.forEach(([q]) => { $('#err-' + q.id, root).hidden = false; $(`[data-answer="${q.id}"]`, root).setAttribute('aria-invalid', 'true'); });
          go(empty[0][1]); return;
        }
        sum.hidden = true;
        b.disabled = true; b.textContent = 'Отправляем…';
        clearTimeout(timer);
        try {
          await PM.api.submitHomework(ctx.me.id, n, { answers: a, checklist: checks(), file });
          PM.shell.toast('Работа отправлена на проверку. Придёт уведомление, когда преподаватель ответит.');
          PM.app.render();
        } catch (err) {
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
