import express from 'express';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import nodemailer from 'nodemailer';
import { mountCms } from './cms.js';
import { check } from './users.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __d = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(__d, 'public');
const dataDir = process.env.DATA_DIR || path.join(__d, 'data');
const file = path.join(dataDir, 'enquiries.jsonl');
const SITE = (process.env.SITE_URL || 'https://gecpdc.com').replace(/\/$/, '');
const routes = JSON.parse(fs.readFileSync(path.join(__d, 'routes.json'), 'utf8'));

fs.mkdirSync(dataDir, { recursive: true });

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(compression());

app.use((q, s, n) => {
  s.set({
    'Content-Security-Policy': "default-src 'self';script-src 'self';style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;font-src https://fonts.gstatic.com;img-src 'self' data:;connect-src 'self';frame-ancestors 'none';base-uri 'self';form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(),microphone=(),geolocation=()'
  });
  if (process.env.NODE_ENV === 'production') {
    s.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  n();
});

app.use(express.json({ limit: '20kb' }));

const T = {
  project: 'Project submission',
  client: 'Client enquiry',
  investor: 'Investor enquiry',
  partner: 'Partner registration',
  career: 'Job application'
};

const esc = v => String(v).replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

const seo = (html, route) => {
  const canonical = esc(SITE + (route === '/' ? '' : route));
  const schema = route === '/' ? `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': SITE + '/#organization',
        name: 'PDC',
        url: SITE + '/',
        logo: SITE + '/assets/logo.webp',
        email: 'info@gecpdc.com',
        sameAs: ['https://share.google/5HElEzNocs8FmNRYO'],
        telephone: '+233554134121',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Kumasi',
          addressCountry: 'GH'
        },
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: '+233554134121',
          contactType: 'business inquiries',
          hoursAvailable: {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            opens: '00:00',
            closes: '23:59'
          }
        },
        description: 'Project development, feasibility and advisory, financial and capital structuring, and project management for infrastructure and investment projects.'
      },
      {
        '@type': 'WebSite',
        '@id': SITE + '/#website',
        url: SITE + '/',
        name: 'PDC',
        publisher: { '@id': SITE + '/#organization' }
      }
    ]
  }).replace(/</g, '\\u003c')}</script>` : '';

  return html.replace('</head>', `<link rel="canonical" href="${canonical}">\n<meta property="og:url" content="${canonical}">\n${schema}</head>`);
};

const mail = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: +process.env.SMTP_PORT || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
}) : null;

app.get('/healthz', (q, s) => s.json({ ok: true }));

app.post('/api/enquiry', rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
}), (q, s) => {
  const b = q.body || {};
  if (b.website) return s.json({ ok: true });

  if (!T[b.type]) return s.status(400).json({ error: 'invalid type' });

  const rec = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    type: b.type
  };

  for (const [k, v] of Object.entries(b)) {
    if (['type', 'website'].includes(k) || typeof v !== 'string') continue;
    rec[k.replace(/[^a-z0-9_]/gi, '').slice(0, 40)] = v.trim().slice(0, 4000);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rec.email || '') || !(rec.full_name || rec.organisation)) {
    return s.status(400).json({ error: 'invalid fields' });
  }

  try {
    fs.appendFileSync(file, JSON.stringify(rec) + '\n');
  } catch (e) {
    console.error('store', e.message);
    return s.status(500).json({ error: 'storage' });
  }

  if (mail && process.env.NOTIFY_TO) {
    mail.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: process.env.NOTIFY_TO,
      replyTo: rec.email,
      subject: `[PDC] ${T[b.type]}`,
      text: Object.entries(rec).map(([k, v]) => `${k}: ${v}`).join('\n')
    }).catch(e => console.error('mail', e.message));
  }

  if (mail && process.env.AUTOREPLY === 'true') {
    mail.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: rec.email,
      subject: 'We have received your ' + T[b.type].toLowerCase(),
      text: 'Thank you for contacting PDC (GEC Project Development Company Ltd.).\n\nWe have received your ' + T[b.type].toLowerCase() + ' and will respond as soon as possible. This is an automated message. Please do not email sensitive documents in reply.\n\nFrom Opportunity to Execution.'
    }).catch(e => console.error('autoreply', e.message));
  }

  s.json({ ok: true });
});

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false
});

const auth = [
  authLimit,
  (q, s, n) => {
    const u = check(q.headers.authorization, dataDir);
    if (u) {
      q.admin = u;
      return n();
    }
    if (q.get('x-pdc-admin') !== '1') s.set('WWW-Authenticate', 'Basic realm="PDC admin"');
    s.status(401).send('Authentication required');
  }
];

const all = () => fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)).reverse() : [];

app.get('/admin/export.csv', auth, (q, s) => {
  if (q.admin.role === 'editor') return s.status(403).end();
  const rs = all();
  const cols = [...new Set(rs.flatMap(Object.keys))];
  const c = v => '"' + String(v ?? '').replace(/^[=+\-@]/, "'$&").replace(/"/g, '""') + '"';
  s.type('text/csv')
    .set('Content-Disposition', 'attachment; filename=enquiries.csv')
    .send([cols.map(c).join(','), ...rs.map(r => cols.map(k => c(r[k])).join(','))].join('\n'));
});

const cms = mountCms(app, { auth, pub, dataDir, esc, all, T, seo });

app.get('/robots.txt', (q, s) => s.type('text/plain').send(
  `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${SITE}/sitemap.xml\n`
));

app.get('/sitemap.xml', (q, s) => s.type('application/xml').send(
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...new Set([...Object.keys(routes), ...cms.urls()])].map(r => `<url><loc>${SITE}${r === '/' ? '' : r}</loc></url>`).join('')}</urlset>`
));

app.use('/assets', express.static(path.join(pub, 'assets'), {
  maxAge: '7d',
  // CSS and JS change between deploys, so browsers must revalidate them.
  setHeaders: (s, f) => /\.(css|js)$/.test(f) && s.setHeader('Cache-Control', 'no-cache')
}));

for (const [r, f] of Object.entries(routes)) {
  app.get(r, (q, s) => s.type('html').send(seo(cms.fill(fs.readFileSync(path.join(pub, f), 'utf8')), q.path)));
}

app.use((q, s) => s.status(404).sendFile(path.join(pub, '404.html')));

app.use((e, q, s, n) => {
  console.error(e);
  s.status(500).send('Server error');
});

const server = app.listen(process.env.PORT || 3000, () => console.log('PDC site on :' + (process.env.PORT || 3000)));

// Longer than Render's proxy idle timeout, to avoid 502s on reused connections.
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10000).unref();
});
