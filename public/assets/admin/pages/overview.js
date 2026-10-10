PDC.page(async (view, me) => {
  const { el, note, api } = PDC;
  const editor = me.role === 'editor';

  const SVG = {
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    news: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    job: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.5-4M4 5v4h4M4 13a8 8 0 0 0 14.5 4M20 19v-4h-4"/>'
  };

  const icon = (n, cls) => {
    const s = el('span', { className: cls || 'ico-t' });
    s.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + SVG[n] + '</svg>';
    return s;
  };

  const pc = (a, b) => b ? Math.round(a / b * 100) : 0;
  const s = n => n === 1 ? '' : 's';

  const card = (href, ico, label, value, sub, pct) => el('a', { className: 'stat-card', href },
    el('div', { className: 'sc-top' }, icon(ico), el('span', { className: 'sc-l', textContent: label })),
    el('div', { className: 'sc-v', textContent: value }),
    el('div', { className: 'sc-s', textContent: sub }),
    ...(pct == null ? [] : [el('div', { className: 'sc-bar' },
      el('span', { className: 'bt' }, el('i', { style: 'width:' + pct + '%' })),
      el('b', { textContent: pct + '%' })
    )])
  );

  const holder = el('div');
  const stamp = el('span');
  const spin = icon('refresh', 'spin');
  const btn = el('button', { className: 'btn g', type: 'button' }, spin, 'Refresh');

  view.replaceChildren(
    el('div', { className: 'upd' }, el('div', { className: 'upd-l' }, el('i', { className: 'dot' }), stamp), btn),
    holder
  );

  const draw = o => {
    const e = o.enquiries;
    const drafts = ['articles', 'news', 'projects', 'jobs', 'team'].reduce((n, k) => n + o[k].total - o[k].live, 0);
    const wait = editor ? drafts : e.new;
    const href = editor ? '/admin/articles' : '/admin/enquiries';
    const text = editor ?
      [drafts + ' draft' + s(drafts) + ' not published', 'Review your drafts and publish them when ready.'] :
      [e.new + ' new enquir' + (e.new === 1 ? 'y' : 'ies') + ' to review', 'Open the inbox to read and respond.'];

    const banner = wait ?
      el('a', { className: 'banner warn', href }, icon('bell', 'ban-i'), el('div', {}, el('b', { textContent: text[0] }), el('span', { textContent: text[1] }))) :
      el('div', { className: 'banner' }, icon('check', 'ban-i'), el('div', {}, el('b', { textContent: "You're all caught up" }), el('span', { textContent: 'Nothing is waiting for review.' })));

    holder.replaceChildren(
      banner,
      el('div', { className: 'stat-grid' },
        ...(editor ? [] : [
          card('/admin/enquiries', 'mail', 'New enquiries', e.new, 'of ' + e.total + ' received', pc(e.total - e.new, e.total)),
          card('/admin/enquiries', 'people', 'Job applications', e.applications, 'of ' + e.total + ' enquiries', pc(e.applications, e.total)),
          card('/admin/analytics', 'chart', 'Page views', o.views, 'last 30 days, cookie-free')
        ]),
        card('/admin/articles', 'doc', 'Articles published', o.articles.live, 'of ' + o.articles.total + ' article' + s(o.articles.total), pc(o.articles.live, o.articles.total)),
        card('/admin/news', 'news', 'News and events', o.news.live, 'of ' + o.news.total + ' item' + s(o.news.total), pc(o.news.live, o.news.total)),
        card('/admin/projects', 'folder', 'Projects live', o.projects.live, 'of ' + o.projects.total + ' project' + s(o.projects.total), pc(o.projects.live, o.projects.total)),
        card('/admin/jobs', 'job', 'Open roles', o.jobs.live, 'of ' + o.jobs.total + ' role' + s(o.jobs.total), pc(o.jobs.live, o.jobs.total)),
        card('/admin/team', 'people', 'Team profiles', o.team.live, 'of ' + o.team.total + ' profile' + s(o.team.total), pc(o.team.live, o.team.total))
      )
    );
  };

  const load = async () => {
    btn.disabled = true;
    spin.classList.add('on');
    try {
      draw(await api('overview'));
      stamp.textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (x) {
      if (x.message !== '401') note('Could not refresh', 1);
    }
    spin.classList.remove('on');
    btn.disabled = false;
  };

  btn.onclick = load;
  await load();
});
