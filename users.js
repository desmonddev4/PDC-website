import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const hash = (pw, salt = crypto.randomBytes(16).toString('hex')) => 
  salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');

const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

const sha = v => crypto.createHash('sha256').update(v).digest('hex');

export const store = dir => {
  const f = path.join(dir, 'users.json');
  return {
    load: () => {
      try {
        return JSON.parse(fs.readFileSync(f, 'utf8'));
      } catch {
        return [];
      }
    },
    save: u => {
      fs.writeFileSync(f + '.tmp', JSON.stringify(u, null, 1), { mode: 0o600 });
      fs.renameSync(f + '.tmp', f);
    }
  };
};

export function check(header, dir) {
  const [u, ...p] = Buffer.from((header || '').slice(6), 'base64').toString().split(':');
  const pw = p.join(':');
  const env = process.env.ADMIN_PASS;

  if (env && u === (process.env.ADMIN_USER || 'admin')) {
    return same(sha(pw), sha(env)) ? { user: u, role: 'owner' } : null;
  }

  const x = store(dir).load().find(r => r.user === u);
  return x && same(hash(pw, x.hash.split(':')[0]), x.hash) ? { user: u, role: x.role } : null;
}
