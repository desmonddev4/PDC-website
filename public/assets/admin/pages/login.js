(() => {
  const { $, el, setAuth, hasAuth } = PDC;
  const view = $('#view');

  // Only allow redirects back into the admin area.
  const params = new URLSearchParams(location.search);
  const next = (() => {
    const n = params.get('next') || '';
    return /^\/admin\/[\w\-\/]*$/.test(n) && !n.startsWith('/admin/login') ? n : '/admin/overview';
  })();
  if (hasAuth()) return location.replace(next);

  const MSG = {
    expired: 'Your session has ended. Sign in again to continue.',
    changed: 'Password changed. Sign in with your new password.',
    out: 'You have been signed out.'
  };
  const m = MSG[params.get('m')];
  if (params.has('m')) history.replaceState(null, '', location.pathname + (params.has('next') ? '?next=' + encodeURIComponent(next) : ''));

  // Remember the username only (never the password).
  const store = {
    get: () => { try { return localStorage.getItem('pdc_user') || ''; } catch { return ''; } },
    set: v => { try { v ? localStorage.setItem('pdc_user', v) : localStorage.removeItem('pdc_user'); } catch {} }
  };

  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.9 10.9 0 0 1 12 19C5 19 1 12 1 12a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.9 10.9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12A3 3 0 1 1 9.88 9.88"/><path d="M1 1l22 22"/></svg>';

  const err = el('div', { className: 'err', role: 'alert', id: 'login-err' });
  const showErr = text => { err.textContent = text; err.style.display = text ? 'block' : 'none'; };
  showErr(m || '');

  const user = el('input', { name: 'user', type: 'text', autocomplete: 'username', required: true, value: store.get(), placeholder: 'your.username' });
  user.setAttribute('autocapitalize', 'none');
  user.setAttribute('spellcheck', 'false');
  const pw = el('input', { name: 'pw', type: 'password', autocomplete: 'current-password', required: true, placeholder: 'Enter your password' });
  const caps = el('small', { className: 'hint', textContent: 'Caps Lock is on.' });
  caps.hidden = true;

  const eye = el('button', { className: 'pw-t', type: 'button' });
  eye.innerHTML = EYE;
  eye.setAttribute('aria-label', 'Show password');
  eye.setAttribute('aria-pressed', 'false');
  eye.onclick = () => {
    const show = pw.type === 'password';
    pw.type = show ? 'text' : 'password';
    eye.innerHTML = show ? EYE_OFF : EYE;
    eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    eye.setAttribute('aria-pressed', String(show));
    pw.focus();
  };
  const capsCheck = e => { caps.hidden = !(e.getModifierState && e.getModifierState('CapsLock')); };
  pw.addEventListener('keydown', capsCheck);
  pw.addEventListener('keyup', capsCheck);
  pw.addEventListener('blur', () => { caps.hidden = true; });

  const remember = el('input', { type: 'checkbox', name: 'remember', checked: !!user.value });
  const btn = el('button', { className: 'signin', type: 'submit' }, el('span', { className: 'lbl', textContent: 'Sign in' }), el('i', { className: 'ring' }));
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // Form column
  const f = el('form', { className: 'lg-form' },
    el('h2', { textContent: 'Sign in' }),
    el('p', { className: 'sub', textContent: 'Use your staff account to continue.' }),
    err,
    el('label', {}, el('span', { className: 'lb', textContent: 'Username' }), user),
    el('label', {}, el('span', { className: 'lb', textContent: 'Password' }), el('div', { className: 'pw' }, pw, eye), caps),
    el('label', { className: 'chk' }, remember, el('span', { textContent: 'Remember my username' })),
    btn,
    el('p', { className: 'lg-foot', textContent: 'Authorised staff only.' })
  );
  f.noValidate = false;
  [user, pw].forEach(i => { i.setAttribute('aria-describedby', 'login-err'); i.addEventListener('input', () => {
    user.removeAttribute('aria-invalid'); pw.removeAttribute('aria-invalid'); if (err.style.display === 'block') showErr('');
  }); });

  const fail = (text, field) => {
    showErr(text);
    btn.classList.remove('loading');
    btn.removeAttribute('aria-busy');
    btn.disabled = false;
    if (field === pw) pw.value = '';
    (field || pw).setAttribute('aria-invalid', 'true');
    (field || pw).focus();
    f.classList.remove('shake');
    void f.offsetWidth;
    f.classList.add('shake');
  };

  f.onsubmit = async e => {
    e.preventDefault();
    if (btn.classList.contains('loading')) return;
    const u = user.value.trim();
    if (!u || !pw.value) return fail('Enter your username and password.', u ? pw : user);

    showErr('');
    btn.classList.add('loading');
    btn.setAttribute('aria-busy', 'true');

    const a = 'Basic ' + btoa(String.fromCharCode(...new TextEncoder().encode(u + ':' + pw.value)));
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    try {
      // Keep the spinner visible long enough to read as feedback.
      const [r] = await Promise.all([
        fetch('/admin/api/me', { headers: { 'X-PDC-Admin': '1', Authorization: a }, signal: ctl.signal }),
        wait(900)
      ]);
      if (r.status === 401) return fail('Wrong username or password.', pw);
      if (r.status === 429) return fail('Too many attempts. Wait a few minutes, then try again.');
      if (!r.ok) return fail('Something went wrong on our side. Try again in a moment.');
      store.set(remember.checked ? u : '');
      setAuth(a);
      location.replace(next);
    } catch (x) {
      fail(x && x.name === 'AbortError' ? 'The server took too long to respond. Try again.' : 'Could not reach the server. Check your connection and try again.');
    } finally {
      clearTimeout(timer);
    }
  };

  // Page layout: brand panel + form panel
  const side = el('aside', { className: 'lg-side' },
    el('a', { className: 'lg-brand', href: '/' }, el('span', { className: 'chip' }, el('img', { src: '/assets/logo.webp', alt: '' })), 'PDC Admin'),
    el('div', { className: 'lg-pitch' },
      el('h1', { textContent: 'Welcome back to PDC Admin.' }),
      el('p', { textContent: 'Sign in to manage your site, your content and your team in one place.' })
    )
  );
  const page = el('div', { className: 'lg' }, side, el('main', { className: 'lg-main' }, f));

  view.replaceChildren(page);
  (user.value ? pw : user).focus();
})();