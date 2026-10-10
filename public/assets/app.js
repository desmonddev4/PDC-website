(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const nav = $('#nav');
  const bar = $('#bar');
  const rm = matchMedia('(prefers-reduced-motion:reduce)').matches;

  addEventListener('scroll', () => {
    const h = document.documentElement;
    bar.style.width = (scrollY / Math.max(1, h.scrollHeight - innerHeight) * 100) + '%';
    nav.classList.toggle('s', scrollY > 40);
  }, { passive: true });

  $('#menu').onclick = () => {
    const l = $('#links');
    l.classList.toggle('on');
    $('#menu').setAttribute('aria-expanded', l.classList.contains('on'));
  };

  const p = location.pathname.replace(/\/$/, '') || '/';
  $$('.links > a, .dd > a').forEach(a => {
    const h = a.getAttribute('href');
    if (h === p || (h !== '/' && p.startsWith(h + '/'))) a.classList.add('on');
  });

  $('#yr').textContent = new Date().getFullYear();

  const io = new IntersectionObserver(e => e.forEach(x => {
    if (x.isIntersecting) {
      x.target.classList.add('v');
      io.unobserve(x.target);
    }
  }), { threshold: .12 });

  $$('.r').forEach(e => io.observe(e));

  const co = new IntersectionObserver(e => e.forEach(x => {
    if (x.isIntersecting) {
      const el = x.target;
      const n = +el.dataset.n;
      let c = 0;
      const k = setInterval(() => {
        el.textContent = ++c;
        if (c >= n) clearInterval(k);
      }, 900 / n);
      co.unobserve(el);
    }
  }), { threshold: .6 });

  if (!rm) $$('[data-n]').forEach(e => {
    e.textContent = '0';
    co.observe(e);
  });

  const gs = $$('.gate');
  if (gs.length) {
    let i = 0;
    const set = n => {
      gs.forEach(g => g.classList.remove('on'));
      gs[n].classList.add('on');
      i = n;
    };
    const t = rm ? 0 : setInterval(() => set((i + 1) % gs.length), 2600);
    gs.forEach((g, n) => g.onclick = () => {
      set(n);
      clearInterval(t);
    });
  }

  const tb = $$('#tabs button');
  const fm = $$('#enquire form');
  const T = ['project', 'client', 'investor', 'partner'];

  if (tb.length) {
    const tab = i => {
      tb.forEach((b, j) => b.classList.toggle('on', i === j));
      fm.forEach((f, j) => f.classList.toggle('on', i === j));
    };
    const fromHash = () => {
      const k = T.indexOf(location.hash.slice(1));
      if (k > -1) tab(k);
    };
    tb.forEach((b, i) => b.onclick = () => tab(i));
    fromHash();
    addEventListener('hashchange', fromHash);
  }

  $$('.filepick').forEach(w => {
    const i = $('input', w);
    const drop = $('.fp-drop', w);
    const chip = $('.fp-file', w);
    const err = $('.fp-err', w);
    const show = () => {
      const f = i.files[0];
      drop.hidden = !!f;
      chip.hidden = !f;
      if (f) $('.fp-name', w).textContent = f.name + ' (' + (f.size / 1048576).toFixed(1) + ' MB)';
    };
    const pick = () => {
      const f = i.files[0];
      err.hidden = true;
      if (f && (f.size > 4e6 || f.type !== 'application/pdf')) {
        i.value = '';
        err.textContent = 'The CV must be a PDF under 4 MB.';
        err.hidden = false;
      }
      show();
    };
    i.addEventListener('change', pick);
    $('.fp-x', w).onclick = () => {
      i.value = '';
      err.hidden = true;
      show();
      i.focus();
    };
    ['dragenter', 'dragover'].forEach(n => drop.addEventListener(n, e => {
      e.preventDefault();
      drop.classList.add('over');
    }));
    ['dragleave', 'drop'].forEach(n => drop.addEventListener(n, e => {
      e.preventDefault();
      drop.classList.remove('over');
    }));
    drop.addEventListener('drop', e => {
      if (e.dataTransfer.files.length) {
        i.files = e.dataTransfer.files;
        pick();
      }
    });
    w.closest('form').addEventListener('reset', () => setTimeout(() => {
      err.hidden = true;
      show();
    }));
  });

  $$('form[data-steps]').forEach(f => {
    const ps = $$('.step', f);
    const dots = $$('.steps li', f);
    const last = ps.length - 1;
    let n = 0;
    const go = k => {
      n = k;
      ps.forEach((p, j) => p.hidden = j !== k);
      dots.forEach((d, j) => {
        d.classList.toggle('on', j === k);
        d.classList.toggle('done', j < k);
      });
      $('.back', f).hidden = k === 0;
      $('.next', f).hidden = k === last;
      $('.send', f).hidden = k !== last;
    };
    const next = () => {
      if ($$('input,select,textarea', ps[n]).every(x => x.reportValidity())) go(n + 1);
    };
    $('.next', f).onclick = next;
    $('.back', f).onclick = () => go(n - 1);
    f.addEventListener('submit', e => {
      if (n < last) {
        e.preventDefault();
        e.stopImmediatePropagation();
        next();
      }
    });
    f.addEventListener('reset', () => setTimeout(() => go(0)));
  });

  fm.forEach(f => f.addEventListener('submit', async e => {
    e.preventDefault();
    const ok = $('.ok', f);
    const er = $('.err', f);
    const b = $('.send', f) || $('button.btn', f);
    ok.style.display = er.style.display = 'none';
    b.disabled = true;

    try {
      const fd = new FormData(f);
      const o = Object.fromEntries(fd);
      const file = fd.get('cv_file');
      delete o.cv_file;

      if (file && file.size) {
        if (file.size > 4e6 || file.type !== 'application/pdf') throw 'cv';
        const r0 = await fetch('/api/cv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/pdf' },
          body: file
        });
        if (!r0.ok) throw 'cv';
        o.cv = (await r0.json()).id;
      }

      const r = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(o)
      });

      if (!r.ok) throw 0;
      ok.style.display = 'block';
      f.reset();
    } catch (x) {
      er.textContent = x === 'cv' ? 'The CV must be a PDF under 4 MB.' : 'Something went wrong. Please try again or email us directly.';
      er.style.display = 'block';
    }
    b.disabled = false;
  }));
})();
