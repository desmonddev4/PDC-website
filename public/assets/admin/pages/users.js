PDC.page(async view => {
  const { el, note, ask, empty, api } = PDC;
  const l = await api('users');

  const f = el('form', { className: 'glass on', style: 'margin-top:26px' },
    el('h3', { textContent: 'Create a user, or reset a password' }),
    el('p', { className: 'dim', style: 'margin:0', textContent: 'Use the same username to reset an existing password.' }),
    el('label', { textContent: 'Username' }, el('input', { name: 'user' })),
    el('label', { textContent: 'Role' }, el('select', { name: 'role' }, ['editor', 'admin'].map(x => el('option', { textContent: x })))),
    el('label', { textContent: 'Password (12+ characters)' }, el('input', { name: 'password', type: 'password', minLength: 12, autocomplete: 'new-password' })),
    el('div', { className: 'ar-act' }, el('button', { className: 'btn', textContent: 'Save' }))
  );

  f.onsubmit = async e => {
    e.preventDefault();
    try {
      await api('users', 'POST', Object.fromEntries(new FormData(f)));
      note('User saved');
      location.reload();
    } catch (x) {
      if (x.message !== '401') note('Check the username (3-30 letters, digits . _ -), the role, and a 12+ character password.', 1);
    }
  };

  view.replaceChildren(
    ...(l.length ? [] : [empty('No extra users yet. The owner account is set by the environment variables.')]),
    ...l.map(u => el('div', { className: 'glass ac ar' },
      el('div', {}, el('b', { textContent: u.user }), el('span', { className: 'tag', textContent: u.role, style: 'margin-left:10px' })),
      el('button', {
        className: 'btn g sm dg',
        textContent: 'Delete',
        onclick: async () => {
          if (!await ask('Delete user ' + u.user + '?')) return;
          await api('users/' + encodeURIComponent(u.user), 'DELETE');
          note('User deleted');
          location.reload();
        }
      })
    )),
    f
  );
});
