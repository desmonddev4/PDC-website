PDC.page(async view => {
  const { el, note, api } = PDC;
  const s = await api('settings');
  const f = el('form', { className: 'glass on' });

  ['email', 'phone', 'address'].forEach(k => f.append(
    el('label', { textContent: k, style: 'text-transform:capitalize' }, Object.assign(el('input'), { name: k, value: s[k] }))
  ));
  f.append(el('div', { className: 'ar-act' }, el('button', { className: 'btn', textContent: 'Save' })));

  f.onsubmit = async e => {
    e.preventDefault();
    try {
      await api('settings', 'PUT', Object.fromEntries(new FormData(f)));
      note('Settings saved');
    } catch (x) {
      if (x.message !== '401') note('Could not save settings', 1);
    }
  };

  view.replaceChildren(f);
});
