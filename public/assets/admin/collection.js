// Shared list + form editor used by the articles, news, projects, jobs and team pages.
(() => {
  const { el, note, ask, empty, api, raw } = PDC;
  let S;

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
    const form = el('form', { className: 'glass on' });
    const list = el('div');
    let cur = null;

    const fill = it => {
      cur = it;
      form.replaceChildren(
        el('h3', { textContent: it ? 'Edit' : 'New' }),
        ...F.map(([k, t, l, o]) => {
          if (t === 'image') return imageField(k, l, it && it[k]);

          const i = t === 'area' ?
            el('textarea', { rows: k === 'body' ? 12 : 4 }) :
            t === 'sel' ?
              el('select', {}, o.map(x => el('option', { textContent: x }))) :
              el('input', { type: t === 'check' ? 'checkbox' : t === 'number' ? 'number' : t === 'date' ? 'date' : 'text' });

          i.name = k;
          if (t === 'check') {
            i.checked = !!(it && it[k]);
            return el('label', { className: 'chk' }, i, l);
          }
          if (it) i.value = it[k] ?? '';
          return el('label', { textContent: l }, i);
        }),
        el('div', { className: 'ar-act' },
          el('button', { className: 'btn', textContent: 'Save', type: 'submit' }),
          ...(it ? [el('button', { className: 'btn g', type: 'button', textContent: 'Cancel', onclick: () => fill(null) })] : [])
        )
      );
    };

    const reload = async () => {
      const rows = await api(c);
      list.replaceChildren(...(rows.length ? rows.map(row) : [empty('Nothing here yet.')]));
    };

    const row = it => el('div', { className: 'glass ac ar' },
      el('div', {},
        el('b', { textContent: it[F[0][0]] }),
        ...(it.published ? [] : [el('span', { className: 'tag draft', textContent: 'Draft' })]),
        ...(it.date ? [el('div', { className: 'dim', textContent: it.date })] : [])
      ),
      el('div', { className: 'ar-act' },
        el('button', { className: 'btn g sm', textContent: 'Edit', onclick: () => { fill(it); scrollTo(0, 0); } }),
        el('button', {
          className: 'btn g sm dg',
          textContent: 'Delete',
          onclick: async () => {
            if (!await ask('Delete this item? This cannot be undone.')) return;
            await api(c + '/' + it.id, 'DELETE');
            note('Deleted');
            if (cur && cur.id === it.id) fill(null);
            reload();
          }
        })
      )
    );

    form.onsubmit = async e => {
      e.preventDefault();
      const o = { id: cur && cur.id };
      F.forEach(([k, t]) => {
        const i = form.elements[k];
        o[k] = t === 'check' ? i.checked : i.value;
      });
      try {
        await api(c, 'POST', o);
        note('Saved');
        fill(null);
        reload();
      } catch (x) {
        if (x.message !== '401') note('Could not save. Check the required fields.', 1);
      }
    };

    fill(null);
    list.replaceChildren(...(items.length ? items.map(row) : [empty('Nothing here yet.')]));
    view.replaceChildren(form, list);
  };
})();
