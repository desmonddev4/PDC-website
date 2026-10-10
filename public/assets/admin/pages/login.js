(() => {
  const { $, el, setAuth, hasAuth } = PDC;
  const view = $('#view');
  if (hasAuth()) return location.replace('/admin/overview');

  const MSG = {
    expired: 'Your session has ended. Please sign in again.',
    changed: 'Password changed. Sign in with the new password.',
    out: 'You have been signed out.'
  };
  const m = MSG[new URLSearchParams(location.search).get('m')];

  const err = el('div', { className: 'err', role: 'alert', textContent: m || '' });
  if (m) err.style.display = 'block';
  const btn = el('button', { className: 'btn', textContent: 'Sign in' });

  const f = el('form', { className: 'glass on login' },
    el('a', { className: 'brand', href: '/' }, el('span', { className: 'chip' }, el('img', { src: '/assets/logo.webp', alt: '' })), 'PDC Admin'),
    el('h2', { textContent: 'Sign in' }),
    el('p', { textContent: 'Authorised staff only.', style: 'margin:0' }),
    el('label', { textContent: 'Username' }, el('input', { name: 'user', autocomplete: 'username', required: true })),
    el('label', { textContent: 'Password' }, el('input', { name: 'pw', type: 'password', autocomplete: 'current-password', required: true })),
    err,
    btn
  );

  f.onsubmit = async e => {
    e.preventDefault();
    err.style.display = 'none';
    btn.disabled = true;
    const a = 'Basic ' + btoa(String.fromCharCode(...new TextEncoder().encode(f.elements.user.value + ':' + f.elements.pw.value)));
    try {
      const r = await fetch('/admin/api/me', { headers: { 'X-PDC-Admin': '1', Authorization: a } });
      if (r.status === 401) throw 'Wrong username or password.';
      if (r.status === 429) throw 'Too many attempts. Please wait a few minutes and try again.';
      if (!r.ok) throw 'Something went wrong. Please try again.';
      setAuth(a);
      location.replace('/admin/overview');
    } catch (x) {
      err.textContent = typeof x === 'string' ? x : 'Could not reach the server.';
      err.style.display = 'block';
      btn.disabled = false;
    }
  };

  view.replaceChildren(f);
  f.elements.user.focus();
})();
