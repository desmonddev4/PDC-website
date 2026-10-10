(() => {
  const H = {
    'Content-Type': 'application/json',
    'X-PDC-Admin': '1'
  };

  const api = (p, m = 'GET', b) => fetch('/admin/api/' + p, {
    method: m,
    headers: H,
    body: b ? JSON.stringify(b) : undefined
  }).then(r => {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  });

  const el = (t, a = {}, ...k) => {
    const e = Object.assign(document.createElement(t), a);
    k.flat().forEach(c => e.append(c));
    return e;
  };

  const app = document.getElementById('app');
  const ALL = ['enquiries', 'articles', 'news', 'projects', 'jobs', 'team', 'analytics', 'settings', 'users', 'account'];
  let S, ME;

  async function show(t) {
    ME = ME || await api('me');
    const tabs = ME.role === 'editor' ? ['articles', 'news', 'projects', 'jobs', 'team', 'account'] : ALL;
    const box = el('div', { textContent: 'Loading...' });
    app.replaceChildren(
      el('h1', { textContent: 'PDC Admin' }),
      el('nav', {}, tabs.map(x => el('button', {
        textContent: x,
        className: x === t ? 'on' : '',
        onclick: () => show(x)
      }))),
      box
    );

    try {
      S = S || await api('schema');
      const b = el('div');
      if (t === 'enquiries') await enq(b);
      else if (t === 'analytics') await ana(b);
      else if (t === 'users') await usr(b);
      else if (t === 'account') await acc(b);
      else if (t === 'settings') await set(b);
      else await col(b, t);
      box.replaceWith(b);
    } catch (e) {
      box.textContent = 'Error: ' + e.message;
    }
  }

  async function enq(b) {
    const r = await api('enquiries');
    b.append(
      el('p', { textContent: r.length + ' enquiries. ' },
        el('a', { href: '/admin/export.csv', textContent: 'Export CSV' })
      )
    );

    r.forEach(x => {
      const d = el('div', { className: 'card' },
        el('b', { textContent: x.type + ' | ' + x.at.slice(0, 16).replace('T', ' ') + ' ' }),
        el('select', {
          onchange: e => api('enquiries/' + x.id, 'PUT', { status: e.target.value })
        }, ['new', 'in review', 'replied', 'closed'].map(o => el('option', {
          textContent: o,
          selected: o === x.status
        })))
      );

      Object.entries(x).filter(([k]) => !['id', 'at', 'type', 'status'].includes(k)).forEach(([k, v]) => {
        d.append(
          k === 'cv' && /^[a-f0-9-]{36}$/.test(v) ?
            el('a', { href: '/admin/cv/' + v, textContent: 'Download CV' }) :
            el('div', { textContent: k + ': ' + v })
        );
      });

      b.append(d);
    });
  }

  async function col(b, c) {
    const items = await api(c);
    const F = S[c];
    const form = el('form', { className: 'card' });
    let cur = null;

    const fill = it => {
      cur = it;
      form.replaceChildren(
        el('h3', { textContent: it ? 'Edit' : 'New' }),
        ...F.map(([k, t, l, o]) => {
          const i = t === 'area' ?
            el('textarea', { rows: k === 'body' ? 12 : 4 }) :
            t === 'sel' ?
              el('select', {}, o.map(x => el('option', { textContent: x }))) :
              el('input', {
                type: t === 'check' ? 'checkbox' :
                      t === 'number' ? 'number' :
                      t === 'date' ? 'date' :
                      t === 'image' ? 'hidden' : 'text'
              });

          i.name = k;
          if (t === 'check') i.checked = !!(it && it[k]);
          else if (it) i.value = it[k] ?? '';

          const st = el('small', { textContent: (it && it[k]) || '' });

          return el('label', {}, l + ' ', i, ...(t === 'image' ? [
            el('input', {
              type: 'file',
              accept: 'image/png,image/jpeg,image/webp',
              onchange: async e => {
                const f = e.target.files[0];
                if (!f) return;
                const r = await fetch('/admin/api/upload', {
                  method: 'POST',
                  headers: { 'Content-Type': f.type, 'X-PDC-Admin': '1' },
                  body: f
                });
                if (!r.ok) {
                  alert('Upload failed (PNG, JPG or WebP, max 8 MB)');
                  return;
                }
                i.value = (await r.json()).url;
                st.textContent = 'Uploaded: ' + i.value;
              }
            }),
            st
          ] : []));
        }),
        el('button', { textContent: 'Save', type: 'submit' })
      );
    };

    form.onsubmit = async e => {
      e.preventDefault();
      const o = { id: cur && cur.id };
      F.forEach(([k, t]) => {
        const i = form.elements[k];
        o[k] = t === 'check' ? i.checked : i.value;
      });
      await api(c, 'POST', o);
      show(c);
    };

    fill(null);
    b.append(form);

    items.forEach(it => b.append(
      el('div', { className: 'card' },
        el('b', { textContent: it[F[0][0]] + (it.published ? '' : ' (draft)') + ' ' }),
        el('button', { textContent: 'Edit', onclick: () => { fill(it); scrollTo(0, 0); } }),
        el('button', { textContent: 'Delete', onclick: async () => {
          if (confirm('Delete this item?')) {
            await api(c + '/' + it.id, 'DELETE');
            show(c);
          }
        } })
      )
    ));
  }

  async function set(b) {
    const s = await api('settings');
    const f = el('form', { className: 'card' });

    ['email', 'phone', 'address'].forEach(k => f.append(
      el('label', { textContent: k + ' ' },
        Object.assign(el('input'), { name: k, value: s[k] })
      )
    ));

    f.append(el('button', { textContent: 'Save' }));

    f.onsubmit = async e => {
      e.preventDefault();
      await api('settings', 'PUT', Object.fromEntries(new FormData(f)));
      show('settings');
    };

    b.append(f);
  }

  async function ana(b) {
    const a = await api('analytics');
    const days = Object.entries(a.daily);

    b.append(
      el('p', { textContent: 'Page views, last ' + days.length + ' days: ' + days.reduce((s, [, n]) => s + n, 0) + ' (cookie-free, no personal data)' }),
      el('h3', { textContent: 'Top pages' }),
      ...a.top.map(([p, n]) => el('div', { textContent: n + '   ' + p })),
      el('h3', { textContent: 'Per day' }),
      ...days.reverse().map(([d, n]) => el('div', { textContent: d + '   ' + n }))
    );
  }

  async function usr(b) {
    const l = await api('users');

    b.append(
      el('h3', { textContent: 'Users' }),
      ...l.map(u => el('div', { className: 'card' },
        el('b', { textContent: u.user + ' (' + u.role + ') ' }),
        el('button', { textContent: 'Delete', onclick: async () => {
          if (confirm('Delete ' + u.user + '?')) {
            await api('users/' + encodeURIComponent(u.user), 'DELETE');
            show('users');
          }
        } })
      ))
    );

    const f = el('form', { className: 'card' },
      el('h3', { textContent: 'Create a user, or reset a password (same username)' }),
      el('label', { textContent: 'Username ' }, el('input', { name: 'user' })),
      el('label', { textContent: 'Role ' }, el('select', { name: 'role' },
        ['editor', 'admin'].map(x => el('option', { textContent: x }))
      )),
      el('label', { textContent: 'Password (12+ characters) ' }, el('input', { name: 'password', type: 'password', minLength: 12 })),
      el('button', { textContent: 'Save' })
    );

    f.onsubmit = async e => {
      e.preventDefault();
      try {
        await api('users', 'POST', Object.fromEntries(new FormData(f)));
        show('users');
      } catch (x) {
        alert('Check the username (3-30 letters, digits . _ -), role, and a 12+ character password.');
      }
    };

    b.append(f);
  }

  async function acc(b) {
    const f = el('form', { className: 'card' },
      el('p', { textContent: 'Signed in as ' + ME.user + ' (' + ME.role + ')' }),
      el('label', { textContent: 'New password (12+ characters) ' }, el('input', { name: 'password', type: 'password', minLength: 12 })),
      el('button', { textContent: 'Change password' })
    );

    f.onsubmit = async e => {
      e.preventDefault();
      try {
        await api('me/password', 'PUT', Object.fromEntries(new FormData(f)));
        alert('Password changed. Sign in again with the new password.');
        location.reload();
      } catch (x) {
        alert(ME.role === 'owner' ? 'The owner password is set by the ADMIN_PASS environment variable.' : 'Could not change the password.');
      }
    };

    b.append(f);
  }

  api('me').then(m => show(m.role === 'editor' ? 'articles' : 'enquiries'));
})();
