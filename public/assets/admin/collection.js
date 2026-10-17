// Shared list + multi-step form editor used by the articles, news, projects, jobs and team pages.
(() => {
  const { el, note, ask, empty, api, raw } = PDC;
  let S;

  // Field names grouped into steps. Fields not listed here fall into the last step.
  const STEPS = {
    articles: [['Basics', ['title', 'category', 'summary']], ['Content', ['body']], ['Publish', ['image', 'published']]],
    news: [['Basics', ['title', 'kind', 'date', 'location']], ['Content', ['summary', 'body']], ['Publish', ['image', 'published']]],
    projects: [['Basics', ['name', 'sector', 'stage', 'status']], ['Details', ['location', 'investment', 'summary', 'description']], ['Publish', ['image', 'published']]],
    jobs: [['Role', ['title', 'division']], ['Details', ['location', 'type', 'description']], ['Publish', ['published']]],
    team: [['Person', ['name', 'role', 'order']], ['Profile', ['bio', 'photo']], ['Publish', ['published']]]
  };
  const NOUN = { articles: 'article', news: 'news item', projects: 'project', jobs: 'job', team: 'team member' };

  function imageField(k, l, val) {
    const hid = el('input', { type: 'hidden', name: k, value: val || '' });
    const prev = el('img', { className: 'thumb', alt: '', hidden: !val });
    if (val) prev.src = val;
    const clear = el('button', {
      type: 'button',
      className: 'btn g sm dg',
      textContent: 'Remove image',
      hidden: !val,
      onclick: () => {
        hid.value = '';
        prev.hidden = clear.hidden = true;
      }
    });
    const id = 'f_' + k;
    const fi = el('input', {
      type: 'file',
      id,
      className: 'fp-input',
      accept: 'image/png,image/jpeg,image/webp',
      onchange: async e => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          const r = await raw('/admin/api/upload', { method: 'POST', headers: { 'Content-Type': f.type }, body: f });
          hid.value = (await r.json()).url;
          prev.src = hid.value;
          prev.hidden = clear.hidden = false;
          note('Image uploaded');
        } catch (x) {
          if (x.message !== '401') note('Upload failed (PNG, JPG or WebP, max 8 MB)', 1);
        }
        fi.value = '';
      }
    });

    return el('div', { className: 'filepick' },
      el('span', { className: 'fp-l', textContent: l }),
      hid,
      fi,
      el('label', { className: 'fp-drop', htmlFor: id },
        el('b', { textContent: 'Choose an image' }),
        el('span', { textContent: 'PNG, JPG or WebP, max 8 MB' })
      ),
      prev,
      clear
    );
  }

  PDC.collection = async (view, c) => {
    S = S || await api('schema');
    const items = await api(c);
    const F = S[c];
    const noun = NOUN[c] || 'item';
    const form = el('form', { className: 'glass on', noValidate: true, hidden: true });
    const list = el('div', { className: 'record-grid' });
    let cur = null;
    let step = 0;

    const field = ([k, t, l, o], it) => {
      if (t === 'image') return imageField(k, l, it && it[k]);

      const i = t === 'area' ?
        el('textarea', { rows: k === 'body' ? 9 : 3 }) :
        t === 'sel' ?
          el('select', {}, o.map(x => el('option', { textContent: x }))) :
          el('input', { type: t === 'check' ? 'checkbox' : t === 'number' ? 'number' : t === 'date' ? 'date' : 'text' });

      i.name = k;
      if (k === F[0][0]) i.required = true;
      if (t === 'check') {
        i.checked = !!(it && it[k]);
        return el('label', { className: 'chk' }, i, l);
      }
      if (it) i.value = it[k] ?? '';
      return el('label', { textContent: l }, i);
    };

    const fill = it => {
      cur = it;
      const groups = (STEPS[c] || [['Details', F.map(f => f[0])]]).map(([n, ks]) => [n, ks.slice()]);
      const known = groups.flatMap(g => g[1]);
      F.forEach(([k]) => known.includes(k) || groups[groups.length - 1][1].push(k));

      const panels = groups.map(([, ks]) => el('fieldset', { className: 'step' },
        ...ks.map(k => field(F.find(f => f[0] === k), it))
      ));
      const dots = groups.map(([n], i) => el('li', {
        onclick: () => (it || i < step) && go(i)
      }, el('span', { textContent: i + 1 }), n));
      const last = groups.length - 1;
      const back = el('button', { type: 'button', className: 'btn g back', textContent: 'Back', onclick: () => go(step - 1) });
      const next = el('button', { type: 'button', className: 'btn next', textContent: 'Next', onclick: () => advance() });
      const send = el('button', { type: 'submit', className: 'btn send', textContent: it ? 'Save changes' : 'Save' });

      const go = k => {
        step = k;
        panels.forEach((p, j) => p.hidden = j !== k);
        dots.forEach((d, j) => {
          d.classList.toggle('on', j === k);
          d.classList.toggle('done', j < k);
          d.classList.toggle('go', !!it || j < k);
        });
        back.hidden = k === 0;
        next.hidden = k === last;
        send.hidden = k !== last;
      };
      const bad = ps => ps.flatMap(p => [...p.querySelectorAll('input,select,textarea')]).find(x => !x.checkValidity());
      const advance = () => {
        const b = bad([panels[step]]);
        if (b) return b.reportValidity();
        go(step + 1);
      };

      form._check = () => {
        const b = bad(panels);
        if (!b) return true;
        go(panels.findIndex(p => p.contains(b)));
        b.reportValidity();
        return false;
      };
      form._next = () => step < last ? (advance(), false) : true;

      form.replaceChildren(
        el('h3', { textContent: (it ? 'Edit ' : 'New ') + noun }),
        el('ol', { className: 'steps' }, dots),
        ...panels,
        el('div', { className: 'stepnav' },
          back,
          el('span', { style: 'flex:1' }),
          el('button', { type: 'button', className: 'btn g', textContent: 'Cancel', onclick: () => close() }),
          next,
          send
        )
      );
      go(0);
    };

    const open = it => {
      fill(it);
      form.hidden = false;
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const close = () => {
      form.hidden = true;
      cur = null;
    };

    const row = it => el('div', { className: 'glass ac ar record-card' },
      el('div', {},
        el('b', { textContent: it[F[0][0]] }),
        ...(it.published ? [] : [el('span', { className: 'tag draft', textContent: 'Draft' })]),
        ...(it.date ? [el('div', { className: 'dim', textContent: it.date })] : [])
      ),
      el('div', { className: 'ar-act' },
        el('button', { className: 'btn g sm', textContent: 'Edit', onclick: () => open(it) }),
        el('button', {
          className: 'btn g sm dg',
          textContent: 'Delete',
          onclick: async () => {
            if (!await ask('Delete this ' + noun + '? This cannot be undone.')) return;
            await api(c + '/' + it.id, 'DELETE');
            note('Deleted');
            if (cur && cur.id === it.id) close();
            reload();
          }
        })
      )
    );

    const count = el('p', { className: 'dim' });
    const reload = async () => {
      const rows = await api(c);
      count.textContent = rows.length + ' ' + (rows.length === 1 ? noun : noun + 's');
      list.replaceChildren(...(rows.length ? rows.map(row) : [empty('Nothing here yet.')]));
    };

    form.onsubmit = async e => {
      e.preventDefault();
      if (!form._next() || !form._check()) return;
      const o = { id: cur && cur.id };
      F.forEach(([k, t]) => {
        const i = form.elements[k];
        o[k] = t === 'check' ? i.checked : i.value;
      });
      try {
        await api(c, 'POST', o);
        note('Saved');
        close();
        reload();
      } catch (x) {
        if (x.message !== '401') note('Could not save. Check the required fields.', 1);
      }
    };

    await reload();
    view.replaceChildren(
      el('div', { className: 'tb' }, count, el('button', { className: 'btn', textContent: '+ New ' + noun, onclick: () => open(null) })),
      form,
      list
    );
  };
})();
