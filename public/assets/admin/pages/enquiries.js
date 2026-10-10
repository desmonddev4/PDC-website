PDC.page(async view => {
  const { el, note, empty, api, dl } = PDC;
  const r = await api('enquiries');

  view.replaceChildren(
    el('p', { className: 'dim' }, r.length + ' enquiries ',
      el('button', { className: 'btn g sm', textContent: 'Export CSV', onclick: () => dl('/admin/export.csv', 'enquiries.csv') })
    ),
    ...(r.length ? [] : [empty('No enquiries yet.')]),
    ...r.map(x => {
      const meta = Object.entries(x).filter(([k]) => !['id', 'at', 'type', 'status'].includes(k));
      return el('div', { className: 'glass ac' },
        el('div', { className: 'ac-top' },
          el('span', { className: 'tag', textContent: x.type }),
          el('span', { className: 'dim', textContent: x.at.slice(0, 16).replace('T', ' ') }),
          el('select', {
            onchange: e => api('enquiries/' + x.id, 'PUT', { status: e.target.value }).then(() => note('Status updated'))
          }, ['new', 'in review', 'replied', 'closed'].map(o => el('option', { textContent: o, selected: o === x.status })))
        ),
        el('dl', { className: 'kv' }, meta.flatMap(([k, v]) => [
          el('dt', { textContent: k }),
          el('dd', {}, k === 'cv' && /^[a-f0-9-]{36}$/.test(v) ?
            el('button', {
              className: 'btn g sm',
              textContent: 'Download CV',
              onclick: () => dl('/admin/cv/' + v, 'cv-' + String(x.full_name || 'applicant').replace(/[^\w.-]+/g, '_') + '.pdf')
            }) : String(v))
        ]))
      );
    })
  );
});
