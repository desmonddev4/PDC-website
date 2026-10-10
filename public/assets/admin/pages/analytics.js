PDC.page(async view => {
  const { el, api } = PDC;
  const a = await api('analytics');
  const days = Object.entries(a.daily);
  const total = days.reduce((s, [, n]) => s + n, 0);

  const rows = list => {
    const max = Math.max(1, ...list.map(([, n]) => n));
    return list.map(([k, n]) => el('div', { className: 'brow' },
      el('span', { textContent: k }),
      el('span', { className: 'bt' }, el('i', { style: 'width:' + (n / max * 100) + '%' })),
      el('b', { textContent: n })
    ));
  };

  view.replaceChildren(
    el('div', { className: 'glass ac' },
      el('div', { className: 'stat', textContent: total }),
      el('p', { className: 'dim', style: 'margin:6px 0 0', textContent: 'Page views in the last ' + days.length + ' days (cookie-free, no personal data)' })
    ),
    el('div', { className: 'glass ac' }, el('h3', { textContent: 'Top pages' }), ...rows(a.top)),
    el('div', { className: 'glass ac' }, el('h3', { textContent: 'Per day' }), ...rows(days.reverse()))
  );
});
