import rateLimit from 'express-rate-limit';
import sharp from 'sharp';
import { hash, store } from './users.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';

const slug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const SECT = [
  ["Infrastructure", "Transport, water, social and economic infrastructure that unlocks growth, structured for public and private capital.", ["Transport corridors, ports and hubs", "Water, sanitation and utilities", "Public-private partnership structuring"]],
  ["Energy", "Generation, storage and transmission projects prepared to the standard lenders and DFIs expect.", ["Renewable generation and storage", "Grid and distribution upgrades", "Energy efficiency and captive power"]],
  ["Mining and minerals", "Mineral and mining-related projects taken through feasibility, regulatory coordination and financing readiness.", ["Resource-to-project feasibility", "Processing and beneficiation", "Licensing and regulatory coordination"]],
  ["Agriculture and agro-processing", "Productive farming and value-addition projects with clear offtake, logistics and financing structures.", ["Processing and storage facilities", "Outgrower and aggregation models", "Irrigation and agri-logistics"]],
  ["Logistics and mobility", "Freight, warehousing and mobility systems that cut cost and connect production to markets.", ["Warehousing and distribution hubs", "Corridor and port-linked logistics", "Urban and regional mobility"]],
  ["Technology and digital infrastructure", "Digital platforms and infrastructure, plus the data and project systems that make delivery visible.", ["Data centres and connectivity", "Enterprise and project systems", "Digital platforms for public services"]],
  ["Urban development", "Housing, mixed-use and city-service projects planned for long-term operation and bankability.", ["Housing and mixed-use development", "City services and utilities", "Master planning and land structuring"]],
  ["Circular economy and environment", "Waste, recycling and environmental systems that turn liabilities into financeable assets.", ["Waste-to-value and recycling", "Environmental and social compliance", "Resource-efficiency projects"]]
];

const PIL = ["Project Development", "Infrastructure & Industrial Development", "Capital & Investment", "Technology", "Sector Intelligence", "PDC Institutional Story"];
const GATES = ["Gate 0 Opportunity", "Gate 1 Concept", "Gate 2 Feasibility", "Gate 3 Investment", "Gate 4 Execution", "Gate 5 Operations"];
const DIV = ["Executive Office", "Project Development", "Technical", "Finance & Commercial", "Legal, Regulatory & Risk", "Project Management", "Investment & Partnerships", "Digital & Data", "Corporate Services"];

const FIELDS = {
  articles: [
    ["title", "text", "Title"],
    ["category", "sel", "Category", PIL],
    ["summary", "area", "Summary"],
    ["body", "area", "Body (blank line between paragraphs, start a line with ## for a heading)"],
    ["image", "image", "Cover image (optional)"],
    ["published", "check", "Published"]
  ],
  news: [
    ["title", "text", "Title"],
    ["kind", "sel", "Type", ["News", "Event"]],
    ["date", "date", "Date"],
    ["location", "text", "Location (events)"],
    ["summary", "area", "Summary"],
    ["body", "area", "Body (blank line between paragraphs, ## for a heading)"],
    ["image", "image", "Image (optional)"],
    ["published", "check", "Published"]
  ],
  projects: [
    ["name", "text", "Project name"],
    ["sector", "sel", "Sector", SECT.map(s => s[0])],
    ["stage", "sel", "Stage", GATES],
    ["status", "text", "Status (e.g. In study)"],
    ["location", "text", "Location"],
    ["summary", "area", "Summary"],
    ["description", "area", "Full description"],
    ["investment", "text", "Investment amount (optional)"],
    ["image", "image", "Project image (optional)"],
    ["published", "check", "Published"]
  ],
  jobs: [
    ["title", "text", "Job title"],
    ["division", "sel", "Division", DIV],
    ["location", "text", "Location"],
    ["type", "text", "Type (e.g. Full-time)"],
    ["description", "area", "Description"],
    ["published", "check", "Published"]
  ],
  team: [
    ["name", "text", "Name"],
    ["role", "text", "Role"],
    ["bio", "area", "Biography"],
    ["order", "number", "Display order"],
    ["photo", "image", "Photo (optional)"],
    ["published", "check", "Published (get the person's consent first)"]
  ]
};

const SEED = {
  settings: {
    email: "info@pdc-ghana.com",
    phone: "+233 00 000 0000",
    address: "Accra, Ghana"
  },
  status: {},
  news: [],
  articles: [
    {
      id: "a1",
      slug: "how-a-project-moves-from-concept-to-execution",
      date: "2026-10-05",
      title: "How a project moves from concept to execution",
      category: "Project Development",
      summary: "A plain-language walk through the six PDC development gates.",
      published: true,
      body: "Most projects fail not because the idea is poor but because it moves forward without being tested at the right moments. PDC uses six decision gates so that every project is challenged before more time and money are committed.\n\n## Gates 0 to 2\nWe first ask whether an opportunity deserves investigation, then whether it is credible, then whether it is technically, commercially and legally viable.\n\n## Gates 3 to 5\nOnly viable projects are structured and financed. Before execution begins we confirm that implementation conditions are met, and before handover we confirm the asset can operate sustainably."
    },
    {
      id: "a2",
      slug: "what-lenders-and-dfis-look-for",
      date: "2026-10-05",
      title: "What lenders and DFIs look for in an investment-ready project",
      category: "Capital & Investment",
      summary: "Investment readiness means answering a financier's hardest questions before they are asked.",
      published: true,
      body: "Investment readiness means a project can answer a financier's hardest questions before they are asked.\n\n## The core questions\nIs demand real and revenue evidenced? Are the technical solution and costs credible? Are permits and land secured? Is risk allocation clear, and who is accountable for each risk?\n\n## The documents that answer them\nA feasibility study, a financial model, a clear capital structure, a risk register and an organised data room put those answers in one place."
    },
    {
      id: "a3",
      slug: "why-a-development-company-is-not-a-consultancy",
      date: "2026-10-05",
      title: "Why a development company is not a consultancy",
      category: "PDC Institutional Story",
      summary: "A consultancy advises and leaves. A development company stays accountable.",
      published: true,
      body: "A consultancy advises and leaves. A project development company stays accountable for moving a project to a financed, operating asset.\n\n## Continuity\nThe same institution carries the project from concept validation through structuring, financing and execution management.\n\n## Governance\nEvery stage has entry requirements, a decision gate, an approval authority and exit criteria, so decisions are documented and defensible."
    },
    {
      id: "a4",
      slug: "infrastructure-that-unlocks-productive-capacity",
      date: "2026-10-05",
      title: "Infrastructure that unlocks productive capacity",
      category: "Infrastructure & Industrial Development",
      summary: "Transport corridors, utilities and industrial infrastructure are the foundation on which productive sectors are built.",
      published: true,
      body: "Infrastructure is not an end in itself. It is the foundation on which agriculture, manufacturing, mining and services operate. Without reliable transport corridors, water systems, power grids and logistics hubs, even the best projects struggle to reach their potential.\n\n## The missing link\nMany African projects are technically viable but commercially constrained by infrastructure gaps. A processing plant cannot operate without reliable power. A farm cannot export without access to ports and cold chain logistics. An industrial zone cannot attract tenants without utilities and connectivity.\n\n## How PDC approaches infrastructure\nWe integrate infrastructure planning into project development from the earliest stages. Whether it is securing land for a corridor, structuring a public-private partnership, or coordinating with utilities for power and water, we treat infrastructure as a critical project component, not an afterthought."
    },
    {
      id: "a5",
      slug: "digital-systems-and-project-technologies",
      date: "2026-10-05",
      title: "Digital systems and project technologies",
      category: "Technology",
      summary: "Data systems, analytics and digital tools are essential for transparent, defensible project decisions.",
      published: true,
      body: "Serious projects generate serious data. Financial models, technical studies, risk registers, procurement trackers and progress reports all produce information that must be organised, accessible and defensible. Without the right digital systems, projects become opaque, decisions become undocumented and accountability becomes impossible.\n\n## What digital systems enable\nData rooms that answer lender questions. Analytics that track progress and flag risks. Project management systems that document every decision. Procurement platforms that ensure transparency. These are not luxuries—they are requirements for working with institutional capital.\n\n## PDC's approach\nWe build digital infrastructure alongside physical infrastructure. Every PDC project is supported by systems that make data visible, decisions documented and progress measurable. This is how we earn the trust of governments, DFIs, banks and investors."
    },
    {
      id: "a6",
      slug: "sector-intelligence-mining-energy-and-agriculture",
      date: "2026-10-05",
      title: "Sector intelligence: mining, energy and agriculture",
      category: "Sector Intelligence",
      summary: "Understanding sector-specific cycles, risks and opportunities is critical to project success.",
      published: true,
      body: "Every sector has its own logic. Mining requires understanding resource geology, commodity cycles and permitting regimes. Energy demands knowledge of grid infrastructure, power purchase agreements and regulatory frameworks. Agriculture depends on offtake agreements, storage infrastructure and logistics.\n\n## Why sector expertise matters\nA project that is technically sound can fail because it does not understand sector-specific risks. A mining project that ignores community dynamics faces delays. An energy project that misreads grid constraints cannot secure power purchase agreements. An agricultural project without proper offtake contracts cannot access financing.\n\n## PDC's sector approach\nWe work across infrastructure, energy, mining, agriculture, logistics, technology, urban development and circular economy. In each sector, we apply sector-specific knowledge to the same disciplined development framework. This is how we move projects from opportunity to execution in the sectors that build productive capacity."
    }
  ],
  projects: [
    {
      id: "p1",
      date: "2026-10-05",
      name: "Agro-processing hub (sample)",
      sector: "Agriculture and agro-processing",
      stage: "Gate 1 Concept",
      status: "Validating",
      location: "Ghana",
      summary: "Sample entry. Edit or delete before publishing.",
      description: "This is a sample project entry. When you have real projects, add full descriptions, investment amounts and images here.",
      investment: "$25M",
      published: false
    }
  ],
  jobs: ["Head of Project Development", "Head of Investment & Partnerships", "Head of Finance / Commercial", "Head of Technical & Engineering"].map((t, i) => ({
    id: "j" + i,
    date: "2026-10-05",
    title: t,
    division: ["Project Development", "Investment & Partnerships", "Finance & Commercial", "Technical"][i],
    location: "Accra, Ghana",
    type: "Full-time",
    description: "Role description to be provided.",
    published: false
  })),
  team: [
    {
      id: "t1",
      date: "2026-10-05",
      name: "Kwaku Adu-Agyemang",
      role: "Executive Chairman, Giants Empire Corporation",
      bio: "Kwaku Adu-Agyemang is the Executive Chairman of Giants Empire Corporation and provides strategic oversight to PDC. He brings extensive experience in corporate development, investment and institutional building across multiple sectors. His leadership focuses on creating institutions that can execute complex projects with the discipline required by serious capital providers.",
      order: 1,
      published: true
    },
    {
      id: "t2",
      date: "2026-10-05",
      name: "Nana Akwasi Owusu-Ansah",
      role: "Managing Director, GEC Project Development Company Ltd.",
      bio: "Nana Akwasi Owusu-Ansah is the Managing Director of PDC, responsible for the company's operational build-out and market engagement. He leads the execution of the PDC Institutional Establishment mandate, overseeing the development of systems, legal foundation, brand, operating architecture and commercial engine. His background spans project development, financial structuring and multi-stakeholder coordination.",
      order: 2,
      published: true
    }
  ]
};

export function mountCms(app, { auth, pub, dataDir, esc, all, T }) {
  const f = path.join(dataDir, 'content.json');

  app.use((q, s, n) => {
    if (q.method === 'GET' && !/\.|^\/(admin|api|healthz)/.test(q.path) && !/bot|crawl|spider|slurp|preview|monitor/i.test(q.get('user-agent') || '')) {
      s.on('finish', () => {
        if (s.statusCode === 200) {
          const day = new Date().toISOString().slice(0, 10);
          const p = q.path.replace(/(.)\/$/, '$1');
          A[day] = A[day] || {};
          A[day][p] = (A[day][p] || 0) + 1;
          dirty = 1;
        }
      });
    }
    n();
  });

  const load = () => {
    try {
      return { ...structuredClone(SEED), ...JSON.parse(fs.readFileSync(f, 'utf8')) };
    } catch {
      return structuredClone(SEED);
    }
  };

  const save = d => {
    fs.writeFileSync(f + '.tmp', JSON.stringify(d, null, 1));
    fs.renameSync(f + '.tmp', f);
  };

  const raw = fs.readFileSync(path.join(pub, 'about.html'), 'utf8');
  const [head, rest] = raw.split('<main id="main">');
  const [mainHtml, tail] = rest.split('</main>');
  const cta = (mainHtml.match(/<section id="cta".*?<\/section>/s) || [''])[0];

  const page = (t, d, b) => head
    .replace(/<title>.*?<\/title>/, () => `<title>${esc(t)}</title>`)
    .replace(/(name="description" content=")[^"]*/, (m, a) => a + esc(d))
    .replace(/(property="og:title" content=")[^"]*/, (m, a) => a + esc(t))
    .replace(/(property="og:description" content=")[^"]*/, (m, a) => a + esc(d))
    + '<main id="main">' + b + cta + '</main>' + tail;

  const live = a => a.filter(x => x.published);
  const W = x => `<section><div class="wrap">${x}</div></section>`;
  const para = t => String(t || '').split(/\n{2,}/).map(p => p.startsWith('## ') ? `<h3>${esc(p.slice(3))}</h3>` : `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const empty = m => `<div class="glass card r"><p>${m}</p></div>`;

  const R = (p, fn) => app.get(p, (q, s) => {
    const r = fn(q, load());
    if (!r) return s.status(404).sendFile(path.join(pub, '404.html'));
    s.type('html').send(page(...r));
  });

  const sector = n => SECT.find(x => slug(x[0]) === n);

  R('/insights', (q, d) => {
    const a = live(d.articles).sort((x, y) => y.date.localeCompare(x.date));
    return [
      'Insights | PDC',
      'Analysis on project development, investment readiness and sector intelligence.',
      W(`<h1 class="r">Insights</h1><p class="sub r">Perspectives on how projects are developed, structured and financed.</p><div class="cards">${a.map(x => `<a class="glass card r" href="/insights/${esc(x.slug)}">${x.image ? `<img class="cover" src="${esc(x.image)}" alt="" loading="lazy">` : ''}<p style="color:var(--gold);font-weight:600;margin-bottom:6px">${esc(x.category)}</p><h3>${esc(x.title)}</h3><p>${esc(x.summary)}</p><p style="font-size:.82rem">${esc(x.date)}</p></a>`).join('') || empty('New insights are coming soon.')}</div>`)
    ];
  });

  R('/insights/:s', (q, d) => {
    const x = live(d.articles).find(a => a.slug === q.params.s);
    return x && [
      x.title + ' | PDC',
      x.summary,
      W(`<div class="legal"><p><a href="/insights" style="color:var(--gold)">Insights</a> &nbsp;/&nbsp; ${esc(x.category)}</p><h1 class="r">${esc(x.title)}</h1><p style="font-size:.85rem">${esc(x.date)}</p>${x.image ? `<img class="cover" src="${esc(x.image)}" alt="">` : ''}${para(x.body)}<div class="cta"><a class="btn g" href="/insights">All insights</a></div></div>`)
    ];
  });

  R('/news', (q, d) => {
    const a = live(d.news).sort((x, y) => y.date.localeCompare(x.date));
    return [
      'News and Events | PDC',
      'Company news and upcoming events.',
      W(`<h1 class="r">News and events</h1><p class="sub r">Announcements, milestones and events from PDC.</p><div class="cards">${a.map(x => `<a class="glass card r" href="/news/${esc(x.slug)}">${x.image ? `<img class="cover" src="${esc(x.image)}" alt="" loading="lazy">` : ''}<p style="color:var(--gold);font-weight:600;margin-bottom:6px">${esc(x.kind)} | ${esc(x.date)}${x.location ? ' | ' + esc(x.location) : ''}</p><h3>${esc(x.title)}</h3><p>${esc(x.summary)}</p></a>`).join('') || empty('No news yet. Check back soon.')}</div>`)
    ];
  });

  R('/news/:s', (q, d) => {
    const x = live(d.news).find(a => a.slug === q.params.s);
    return x && [
      x.title + ' | PDC',
      x.summary,
      W(`<div class="legal"><p><a href="/news" style="color:var(--gold)">News and events</a> &nbsp;/&nbsp; ${esc(x.kind)}</p><h1 class="r">${esc(x.title)}</h1><p style="font-size:.85rem">${esc(x.date)}${x.location ? ' | ' + esc(x.location) : ''}</p>${x.image ? `<img class="cover" src="${esc(x.image)}" alt="">` : ''}${para(x.body)}<div class="cta"><a class="btn g" href="/news">All news</a></div></div>`)
    ];
  });

  const strip = h => h.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ');

  let statics = null;
  const stat = () => statics || (statics = Object.entries(JSON.parse(fs.readFileSync(path.join(pub, '..', 'routes.json'), 'utf8')))
    .filter(([r]) => !['/privacy', '/terms', '/careers', '/pipeline', '/insights', '/contact'].includes(r))
    .map(([r, f]) => {
      const h = fs.readFileSync(path.join(pub, f), 'utf8');
      return {
        u: r,
        t: ((h.match(/<title>(.*?)<\/title>/) || [])[1] || r).replace(/ \| PDC$/, ''),
        x: strip((h.match(/<main[\s\S]*<\/main>/) || [''])[0])
      };
    }));

  R('/search', (q, d) => {
    const term = String(q.query.q || '').trim().slice(0, 80);
    const ws = term.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    const docs = [
      ...stat(),
      ...live(d.articles).map(a => ({ u: '/insights/' + a.slug, t: a.title, x: a.summary + ' ' + a.body })),
      ...live(d.news).map(a => ({ u: '/news/' + a.slug, t: a.title, x: a.summary + ' ' + a.body })),
      ...SECT.map(x => ({ u: '/sectors/' + slug(x[0]), t: x[0], x: x[1] + ' ' + x[2].join(' ') })),
      ...live(d.projects).map(p => ({ u: '/pipeline/' + p.id, t: p.name, x: p.summary + ' ' + p.sector + ' ' + p.location + (p.description ? ' ' + p.description : '') })),
      ...live(d.jobs).map(j => ({ u: '/careers', t: j.title, x: j.description + ' ' + j.division })),
      ...live(d.team).map(p => ({ u: '/leadership', t: p.name, x: p.role + ' ' + p.bio }))
    ];
    const hits = ws.length ? docs.map(o => {
      const t = o.t.toLowerCase(), x = o.x.toLowerCase();
      let sc = 0;
      for (const w of ws) {
        if (!(t.includes(w) || x.includes(w))) {
          sc = 0;
          break;
        }
        sc += (t.includes(w) ? 5 : 0) + Math.min(5, x.split(w).length - 1);
      }
      return { ...o, sc };
    }).filter(o => o.sc).sort((a, b) => b.sc - a.sc).slice(0, 20) : [];
    return [
      'Search | PDC',
      'Search the PDC website.',
      W(`<h1 class="r">Search</h1><form class="glass on searchf" method="get" action="/search"><label>What are you looking for?<input name="q" value="${esc(term)}" maxlength="80" autofocus></label><button class="btn">Search</button></form>${hits.map(o => {
        const i = Math.max(0, o.x.toLowerCase().indexOf(ws[0]) - 60);
        return `<a class="glass card r" href="${esc(o.u)}" style="display:block;margin-bottom:14px"><h3>${esc(o.t)}</h3><p style="margin:0">${esc(o.x.slice(i, i + 170))}</p></a>`;
      }).join('') || (ws.length ? empty('No results. Try different words, or <a href="/contact" style="color:var(--gold)">contact us</a>.') : '')}`)
    ];
  });

  R('/pipeline', (q, d) => {
    const p = live(d.projects);
    return [
      'Projects and Pipeline | PDC',
      'Opportunities moving through the PDC development gates.',
      W(`<h1 class="r">Projects and pipeline</h1><p class="sub r">Opportunities moving through our six development gates.</p>${p.length ? `<div class="glass pipe r"><table><tr><th>Project</th><th>Sector</th><th>Location</th><th>Stage</th><th>Status</th></tr>${p.map(x => `<tr><td><a href="/pipeline/${esc(x.id)}" style="color:var(--gold)"><b>${esc(x.name)}</b></a><br><span style="color:var(--mut)">${esc(x.summary)}</span></td><td>${esc(x.sector)}</td><td>${esc(x.location)}</td><td>${esc(x.stage)}</td><td><span class="tag">${esc(x.status)}</span></td></tr>`).join('')}</table></div>` : empty('Our first projects will be published here. To submit one, <a href="/contact" style="color:var(--gold)">contact us</a>.')}`)
    ];
  });

  R('/pipeline/:id', (q, d) => {
    const x = live(d.projects).find(p => p.id === q.params.id);
    return x && [
      x.name + ' | PDC',
      x.summary,
      W(`<p><a href="/pipeline" style="color:var(--gold)">Projects and Pipeline</a></p><h1 class="r">${esc(x.name)}</h1><p class="sub r">${esc(x.summary)}</p>${x.image ? `<img class="cover" src="${esc(x.image)}" alt="" style="margin:24px 0">` : ''}${x.description ? `<div class="glass card r" style="margin:24px 0"><h3>About this project</h3>${para(x.description)}</div>` : ''}<div class="split" style="margin-top:30px"><div class="glass card r"><h3>Project details</h3><p><b>Sector:</b> ${esc(x.sector)}</p><p><b>Location:</b> ${esc(x.location)}</p><p><b>Stage:</b> ${esc(x.stage)}</p><p><b>Status:</b> <span class="tag">${esc(x.status)}</span></p>${x.investment ? `<p><b>Investment:</b> ${esc(x.investment)}</p>` : ''}</div><div class="glass card r" style="--d:.1s"><h3>Development gate</h3><p>This project is at ${esc(x.stage)}. Each gate represents a decision point where we assess whether the project deserves to proceed to the next stage of development.</p><a class="btn g" href="/methodology" style="margin-top:12px;display:inline-block">Learn about our framework</a></div></div><div class="cta r"><a class="btn" href="/contact">Discuss this project</a></div>`)
    ];
  });

  R('/leadership', (q, d) => {
    const t = live(d.team).sort((a, b) => a.order - b.order);
    return [
      'Leadership | PDC',
      'The people leading PDC.',
      W(`<h1 class="r">Leadership</h1><p class="sub r">The people accountable for building PDC as an institution.</p><div class="cards">${t.map(x => `<div class="glass card r">${x.photo ? `<img class="av" src="${esc(x.photo)}" alt="${esc(x.name)}">` : `<div class="av">${esc(x.name.split(/\s+/).map(w => w[0]).slice(0, 2).join(''))}</div>`}<h3>${esc(x.name)}</h3><p style="color:var(--gold);font-weight:600">${esc(x.role)}</p>${x.bio ? para(x.bio) : ''}</div>`).join('') || empty('Leadership profiles are coming soon.')}</div>`)
    ];
  });

  R('/careers', (q, d) => {
    const j = live(d.jobs);
    return [
      'Careers | PDC',
      'Join the divisions building PDC.',
      W(`<h1 class="r">Careers</h1><p class="sub r">We are building divisions across project development, engineering, finance, legal, investment and digital.</p><div class="cards" style="grid-template-columns:1fr">${j.map(x => `<details class="glass card r"><summary>${esc(x.title)}</summary><p style="margin-top:12px;color:var(--gold)">${esc(x.division)} &nbsp;|&nbsp; ${esc(x.location)} &nbsp;|&nbsp; ${esc(x.type)}</p>${para(x.description)}</details>`).join('') || empty('No open roles right now. Send us your profile below and we will keep it on file.')}</div><h2 style="margin-top:60px" class="r">Apply or introduce yourself</h2><div id="enquire"><form class="glass on" data-steps style="max-width:640px"><input type="hidden" name="type" value="career"><input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><ol class="steps"><li class="on"><span>1</span>Your details</li><li><span>2</span>Role and CV</li><li><span>3</span>About you</li></ol><fieldset class="step"><label>Full name<input name="full_name" required autocomplete="name"></label><label>Email<input type="email" name="email" required autocomplete="email"></label><label>LinkedIn or portfolio link (optional)<input name="link" autocomplete="url"></label></fieldset><fieldset class="step" hidden><label>Role of interest<input name="role"></label><div class="filepick"><span class="fp-l">CV (PDF, optional, max 4 MB)</span><input class="fp-input" id="cv_file" type="file" name="cv_file" accept="application/pdf"><label class="fp-drop" for="cv_file"><b>Choose a PDF</b><span>or drag it here</span></label><div class="fp-file" hidden><span class="fp-name"></span><button type="button" class="fp-x" aria-label="Remove file">&times;</button></div><div class="fp-err" role="alert" hidden></div></div></fieldset><fieldset class="step" hidden><label>Tell us about yourself (optional)<textarea name="message" rows="5"></textarea></label></fieldset><div class="stepnav"><button type="button" class="btn g back" hidden>Back</button><button type="button" class="btn next">Next</button><button class="btn send" hidden>Send application</button></div><div class="err" role="alert">Something went wrong. Please try again or email us directly.</div><div class="ok" role="status">Thank you. We have received your details.</div></form></div>`)
    ];
  });

  R('/sectors/:s', (q, d) => {
    const x = sector(q.params.s);
    return x && [
      x[0] + ' | PDC',
      x[1],
      W(`<p><a href="/sectors" style="color:var(--gold)">Sectors</a></p><h1 class="r">${esc(x[0])}</h1><p class="sub r">${esc(x[1])}</p><div class="split" style="margin-top:30px"><div class="glass card r"><h3>Where we work</h3><ul class="ck">${x[2].map(i => `<li>${esc(i)}</li>`).join('')}</ul></div><div class="glass card r"><h3>Pipeline in this sector</h3>${live(d.projects).filter(p => p.sector === x[0]).map(p => `<p><b>${esc(p.name)}</b> (${esc(p.stage)})</p>`).join('') || '<p>No published projects yet.</p>'}</div></div><div class="cta r"><a class="btn" href="/contact">Submit a ${esc(x[0].toLowerCase())} project</a></div>`)
    ];
  });

  const UP = path.join(dataDir, 'uploads');
  const CV = path.join(dataDir, 'cv');
  fs.mkdirSync(UP, { recursive: true });
  fs.mkdirSync(CV, { recursive: true });

  const sig = (b, t) => !Buffer.isBuffer(b) ? null : t === 'pdf' ? (b.slice(0, 5).toString() === '%PDF-' ? 'pdf' : null) : b.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png' : (b[0] === 0xFF && b[1] === 0xD8) ? 'jpg' : (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') ? 'webp' : null;

  app.get('/uploads/:f', (q, s) => /^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(q.params.f) ? s.set('Cache-Control', 'public,max-age=86400').sendFile(path.join(UP, q.params.f), e => e && !s.headersSent && s.status(404).end()) : s.status(404).end());

  app.post('/api/cv', rateLimit({ windowMs: 10 * 60 * 1000, limit: 5 }), express.raw({ type: 'application/pdf', limit: '4mb' }), (q, s) => {
    if (sig(q.body, 'pdf') !== 'pdf') return s.status(400).json({ error: 'pdf only' });
    const id = crypto.randomUUID();
    fs.writeFileSync(path.join(CV, id + '.pdf'), q.body);
    s.json({ id });
  });

  const AF = path.join(dataDir, 'analytics.json');
  let A = {}, dirty = 0;
  try {
    A = JSON.parse(fs.readFileSync(AF, 'utf8'));
  } catch {}

  const flush = () => {
    if (!dirty) return;
    for (const k of Object.keys(A).sort().slice(0, -400)) delete A[k];
    fs.writeFileSync(AF, JSON.stringify(A));
    dirty = 0;
  };
  setInterval(flush, 30000).unref();
  process.on('SIGTERM', flush);

  const adm = express.Router();

  const AD = path.join(pub, '..', 'admin');
  const ICON = {
    enquiries: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    articles: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    news: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5"/>',
    overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    projects: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    jobs: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    analytics: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    users: '<path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    account: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.5a6.5 6.5 0 0 1 11 0"/>'
  };
  // [id, label, ownerOnly, description]
  const GROUPS = [
    ['Workspace', [['overview', 'Overview', 0, 'Monitor enquiries, applications, content and website traffic at a glance.']]],
    ['Inbox', [['enquiries', 'Enquiries', 1, 'Review project submissions, client, investor and partner enquiries, and job applications.']]],
    ['Content', [
      ['articles', 'Articles', 0, 'Write and publish insights that appear on the Insights page.'],
      ['news', 'News and events', 0, 'Announce company news and upcoming events.'],
      ['projects', 'Projects', 0, 'Manage the opportunities shown in the public pipeline.'],
      ['jobs', 'Jobs', 0, 'Publish open roles on the Careers page.'],
      ['team', 'Team', 0, 'Maintain the leadership and team profiles.']
    ]],
    ['Site', [
      ['analytics', 'Analytics', 1, 'Cookie-free page views for the last 30 days.'],
      ['settings', 'Settings', 1, 'Contact details used across the website.'],
      ['users', 'Users', 1, 'Create editors and admins, or reset a password.'],
      ['account', 'Account', 0, 'Your sign-in details.']
    ]]
  ];
  const PG = Object.fromEntries(GROUPS.flatMap(([, l]) => l).map(([n, t, o, d]) => [n, { t, o, d }]));
  const svg = n => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
  const nav = cur => GROUPS.map(([g, l]) => `<div class="side-g"><span class="side-h">${g}</span>${l.map(([n, t, o]) => `<a href="/admin/${n}" title="${esc(t)}"${n === cur ? ' class="on" aria-current="page"' : ''}${o ? ' data-owner' : ''}>${svg(n)}<span>${esc(t)}</span></a>`).join('')}</div>`).join('');
  const tpl = f => fs.readFileSync(path.join(AD, f), 'utf8');
  const send = (s, h) => s.set('Cache-Control', 'no-store').type('html').send(h);

  adm.get('/', (q, s) => s.redirect('/admin/overview'));
  adm.get('/login', (q, s) => send(s, tpl('login.html')));
  adm.get('/:p', (q, s, n) => {
    const k = q.params.p;
    if (!Object.hasOwn(PG, k)) return n();
    const v = { title: esc(PG[k].t), desc: esc(PG[k].d), nav: nav(k), owner: PG[k].o ? ' data-owner="1"' : '', content: tpl('pages/' + k + '.html') };
    send(s, tpl('layout.html').replace(/\{\{(\w+)\}\}/g, (m, x) => v[x] ?? m));
  });
  adm.use((q, s, n) => /^\/(api|cv)(\/|$)/.test(q.path) ? n() : s.status(404).sendFile(path.join(pub, '404.html')));

  adm.use(auth);
  adm.use((q, s, n) => q.admin && q.admin.role === 'editor' && /^\/(api\/(enquiries|settings|analytics|users)|cv\/)/.test(q.path) ? s.status(403).json({ error: 'forbidden' }) : n());
  adm.use((q, s, n) => q.method !== 'GET' && q.get('x-pdc-admin') !== '1' ? s.status(403).end() : n());

  adm.get('/api/schema', (q, s) => s.json(FIELDS));

  adm.post('/api/upload', express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '8mb' }), async (q, s) => {
    if (!sig(q.body, 'image')) return s.status(400).json({ error: 'png, jpg or webp only' });
    try {
      const out = await sharp(q.body, { limitInputPixels: 40e6 }).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      const id = crypto.randomUUID() + '.webp';
      fs.writeFileSync(path.join(UP, id), out);
      s.json({ url: '/uploads/' + id });
    } catch {
      s.status(400).json({ error: 'unreadable image' });
    }
  });

  adm.get('/cv/:id', (q, s) => /^[a-f0-9-]{36}$/.test(q.params.id) ? s.download(path.join(CV, q.params.id + '.pdf'), 'cv.pdf', e => e && !s.headersSent && s.status(404).end()) : s.status(404).end());

  adm.get('/api/analytics', (q, s) => {
    const days = Object.keys(A).sort().slice(-30), top = {}, daily = {};
    for (const d of days) {
      daily[d] = 0;
      for (const [p, n] of Object.entries(A[d])) {
        daily[d] += n;
        top[p] = (top[p] || 0) + n;
      }
    }
    s.json({ daily, top: Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 15) });
  });

  const U = store(dataDir);
  const OWNER = () => process.env.ADMIN_USER || 'admin';

  adm.get('/api/overview', (q, s) => {
    const d = load(), ed = q.admin.role === 'editor';
    const cnt = c => ({ total: d[c].length, live: d[c].filter(x => x.published).length });
    const out = { articles: cnt('articles'), news: cnt('news'), projects: cnt('projects'), jobs: cnt('jobs'), team: cnt('team') };
    if (!ed) {
      const rs = all(), st = r => d.status[r.id] || 'new';
      out.enquiries = { total: rs.length, new: rs.filter(r => st(r) === 'new').length, applications: rs.filter(r => r.type === 'career').length };
      out.views = Object.keys(A).sort().slice(-30).reduce((n, k) => n + Object.values(A[k]).reduce((a, b) => a + b, 0), 0);
    }
    s.json(out);
  });

  adm.get('/api/me', (q, s) => s.json(q.admin));
  adm.get('/api/users', (q, s) => s.json(U.load().map(({ user, role }) => ({ user, role }))));
  adm.post('/api/users', (q, s) => {
    const { user, role, password } = q.body || {};
    if (!/^[a-z0-9._-]{3,30}$/.test(user || '') || !['admin', 'editor'].includes(role) || String(password || '').length < 12 || user === OWNER()) return s.status(400).json({ error: 'invalid' });
    const l = U.load(), i = l.findIndex(x => x.user === user), rec = { user, role, hash: hash(password) };
    if (i > -1) l[i] = rec; else l.push(rec);
    U.save(l);
    s.json({ ok: 1 });
  });
  adm.delete('/api/users/:u', (q, s) => { U.save(U.load().filter(x => x.user !== q.params.u)); s.json({ ok: 1 }); });
  adm.put('/api/me/password', (q, s) => {
    const l = U.load(), x = l.find(r => r.user === q.admin.user), pw = String((q.body || {}).password || '');
    if (!x || pw.length < 12) return s.status(400).json({ error: 'invalid' });
    x.hash = hash(pw);
    U.save(l);
    s.json({ ok: 1 });
  });

  adm.get('/api/settings', (q, s) => s.json(load().settings));
  adm.put('/api/settings', (q, s) => {
    const d = load();
    for (const k of ['email', 'phone', 'address']) if (typeof q.body[k] === 'string') d.settings[k] = q.body[k].slice(0, 200);
    save(d);
    s.json(d.settings);
  });

  adm.get('/api/enquiries', (q, s) => {
    const d = load();
    s.json(all().map(r => ({ ...r, status: d.status[r.id] || 'new' })));
  });
  adm.put('/api/enquiries/:id', (q, s) => {
    const d = load();
    d.status[q.params.id] = String(q.body.status).slice(0, 20);
    save(d);
    s.json({ ok: 1 });
  });

  adm.get('/api/:c', (q, s) => FIELDS[q.params.c] ? s.json(load()[q.params.c]) : s.status(404).end());

  adm.post('/api/:c', (q, s) => {
    const c = q.params.c, F = FIELDS[c];
    if (!F) return s.status(404).end();
    const d = load(), b = q.body || {}, it = {};
    for (const [k, t] of F) {
      const v = b[k];
      it[k] = t === 'check' ? !!v : t === 'number' ? +v || 0 : t === 'image' ? (/^\/uploads\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(v || '') ? v : '') : String(v ?? '').slice(0, t === 'area' ? 20000 : t === 'date' ? 10 : 300);
    }
    if (!it[F[0][0]].trim()) return s.status(400).json({ error: 'required' });
    const i = d[c].findIndex(x => x.id === b.id);
    if (i > -1) d[c][i] = { ...d[c][i], ...it };
    else {
      const n = { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), ...it };
      if (c === 'articles' || c === 'news') {
        let sl = slug(it.title) || 'article', k = sl, n2 = 1;
        while (d[c].some(a => a.slug === k)) k = sl + '-' + (++n2);
        n.slug = k;
      }
      d[c].unshift(n);
    }
    save(d);
    s.json({ ok: 1 });
  });

  adm.delete('/api/:c/:id', (q, s) => {
    const c = q.params.c;
    if (!FIELDS[c]) return s.status(404).end();
    const d = load();
    d[c] = d[c].filter(x => x.id !== q.params.id);
    save(d);
    s.json({ ok: 1 });
  });

  app.use('/admin', adm);

  return {
    fill: h => {
      const st = load().settings;
      return h.replace(/\{\{(email|phone|address)\}\}/g, (m, k) => esc(st[k]));
    },
    urls: () => {
      const d = load();
      return [
        '/leadership',
        '/news',
        ...live(d.news).map(a => '/news/' + a.slug),
        ...SECT.map(x => '/sectors/' + slug(x[0])),
        ...live(d.articles).map(a => '/insights/' + a.slug),
        ...live(d.projects).map(p => '/pipeline/' + p.id)
      ];
    }
  };
}
