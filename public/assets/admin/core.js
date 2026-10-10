// Shared admin helpers. Page scripts call PDC.page(fn) to run behind the sign-in check.
(() => {
  const KEY = 'pdc_admin_auth';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  let AUTH = sessionStorage.getItem(KEY);

  const el = (t, a = {}, ...k) => {
    const e = Object.assign(document.createElement(t), a);
    k.flat().forEach(c => e.append(c));
    return e;
  };

  const note = (m, bad) => {
    const n = el('div', { className: 'toast' + (bad ? ' bad' : ''), textContent: m });
    n.setAttribute('role', bad ? 'alert' : 'status');
    document.body.append(n);
    setTimeout(() => n.remove(), 3500);
  };

  const ask = msg => new Promise(res => {
    const done = v => { m.remove(); res(v); };
    const m = el('div', { className: 'modal on', onclick: e => e.target === m && done(false) },
      el('div', { className: 'glass' },
        el('h3', { textContent: 'Please confirm' }),
        el('p', { textContent: msg }),
        el('div', { className: 'modal-act' },
          el('button', { className: 'btn g sm', textContent: 'Cancel', onclick: () => done(false) }),
          el('button', { className: 'btn sm', textContent: 'Delete', onclick: () => done(true) })
        )
      )
    );
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    document.body.append(m);
  });

  const empty = m => el('div', { className: 'glass ac' }, el('p', { textContent: m, style: 'margin:0' }));

  const setAuth = a => {
    AUTH = a;
    sessionStorage.setItem(KEY, a);
  };

  const signout = code => {
    AUTH = null;
    sessionStorage.removeItem(KEY);
    location.replace('/admin/login' + (code ? '?m=' + code : ''));
  };

  const raw = (p, o = {}) => fetch(p, {
    ...o,
    headers: { 'X-PDC-Admin': '1', ...(AUTH ? { Authorization: AUTH } : {}), ...o.headers }
  }).then(r => {
    if (r.status === 401) {
      signout('expired');
      throw new Error('401');
    }
    if (!r.ok) throw new Error(r.status);
    return r;
  });

  const api = (p, m = 'GET', b) => raw('/admin/api/' + p, {
    method: m,
    headers: { 'Content-Type': 'application/json' },
    body: b ? JSON.stringify(b) : undefined
  }).then(r => r.json());

  const dl = async (p, name) => {
    try {
      const u = URL.createObjectURL(await (await raw(p)).blob());
      const a = el('a', { href: u, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 10000);
    } catch (e) {
      if (e.message !== '401') note('Download failed', 1);
    }
  };

  const page = fn => document.addEventListener('DOMContentLoaded', async () => {
    const view = $('#view');
    if (!AUTH) return signout('');

    let me;
    try {
      me = await api('me');
    } catch (e) {
      if (e.message !== '401') view.textContent = 'Could not reach the server.';
      return;
    }

    if (me.role === 'editor') {
      if (document.body.dataset.owner) return location.replace('/admin/articles');
      $$('[data-owner]').forEach(n => n.remove());
      $$('.side-g').forEach(g => !$('a', g) && g.remove());
    }

    $('#who').textContent = me.user;
    $('#who').title = me.user + ' (' + me.role + ')';
    $('#avatar').textContent = me.user.charAt(0).toUpperCase();

    try {
      await fn(view, me);
    } catch (e) {
      if (e.message !== '401') view.textContent = 'Error: ' + e.message;
    }
  });

  if (localStorage.getItem('pdc_side') === 'min') document.documentElement.classList.add('side-min');

  document.addEventListener('DOMContentLoaded', () => {
    const out = $('#signout');
    if (out) out.onclick = () => signout('out');

    const side = $('#side');
    if (!side) return;
    const root = document.documentElement;
    const mobile = () => matchMedia('(max-width:900px)').matches;
    const set = o => {
      side.classList.toggle('open', o);
      $('#scrim').classList.toggle('on', o);
      $('#sidebtn').setAttribute('aria-expanded', o);
    };

    $('#sidebtn').onclick = () => set(!side.classList.contains('open'));
    $('#scrim').onclick = () => set(false);
    $('#collapse').onclick = () => {
      if (mobile()) return set(false);
      const min = root.classList.toggle('side-min');
      localStorage.setItem('pdc_side', min ? 'min' : '');
    };

    const acct = $('#acct');
    const menu = $('#acctmenu');
    const toggle = o => {
      menu.hidden = !o;
      acct.setAttribute('aria-expanded', o);
    };
    acct.onclick = e => {
      e.stopPropagation();
      toggle(menu.hidden);
    };
    document.addEventListener('click', e => !menu.contains(e.target) && toggle(false));
    document.addEventListener('keydown', e => e.key === 'Escape' && toggle(false));
  });

  window.PDC = { $, $$, el, note, ask, empty, api, raw, dl, page, setAuth, signout, hasAuth: () => !!AUTH };
})();
