PDC.page(async (view, me) => {
  const { el, note, api, signout } = PDC;
  const f = el('form', { className: 'glass on' },
    el('p', { style: 'margin:0', textContent: 'Signed in as ' + me.user + ' (' + me.role + ')' }),
    el('label', { textContent: 'New password (12+ characters)' }, el('input', { name: 'password', type: 'password', minLength: 12, autocomplete: 'new-password' })),
    el('div', { className: 'ar-act' }, el('button', { className: 'btn', textContent: 'Change password' }))
  );

  f.onsubmit = async e => {
    e.preventDefault();
    try {
      await api('me/password', 'PUT', Object.fromEntries(new FormData(f)));
      signout('changed');
    } catch (x) {
      if (x.message !== '401') note(me.role === 'owner' ? 'The owner password is set by the ADMIN_PASS environment variable.' : 'Could not change the password.', 1);
    }
  };

  view.replaceChildren(f);
});
