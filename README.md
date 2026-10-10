# PDC website (production package)

Static multi-page site plus a small Node/Express server that stores enquiries, e-mails them, and serves a protected admin view.

## Run
    npm install
    ADMIN_PASS=your-long-password npm start      # http://localhost:3000

Copy `.env.example` to `.env` (or set the variables on your host).

## Pages
Home, About, What We Do, 4 service pages, Sectors, Pipeline, Insights, Partners, Careers, Contact (4 forms), Privacy, Terms, 404. Clean URLs are mapped in `routes.json`; `/sitemap.xml` and `/robots.txt` are generated from it using `SITE_URL`.

## Enquiries
Forms post to `POST /api/enquiry` (validated, rate-limited, honeypot). Records are appended to `DATA_DIR/enquiries.jsonl`. View them at `/admin` (HTTP Basic auth with `ADMIN_USER` / `ADMIN_PASS`; locked if `ADMIN_PASS` is empty) and export at `/admin/export.csv`. Set `SMTP_*`, `MAIL_FROM` and `NOTIFY_TO` to also e-mail every enquiry.

## Deploy
`docker build -t pdc-site .`, run with a persistent volume on `/data`, behind HTTPS (Render, Railway, Fly.io, or a VPS with Caddy/nginx). HSTS is sent when `NODE_ENV=production`. Back up `/data`.

## Before launch
- Replace placeholder email, phone and address (search `pdc-ghana.com` and `+233 00`) and the sample pipeline rows.
- Have counsel approve `public/privacy.html` and `public/terms.html`.
- Set `SITE_URL` to the real domain; confirm the legal name after ORC clearance.
- Page copy lives in `public/*.html` (no CMS in this package).

## Uploads, news, search and statistics
- **Images:** in `/admin`, Articles, News and Team have an image upload (PNG, JPG or WebP, max 8 MB, checked by file signature, resized to 1600 px wide, converted to WebP and stripped of EXIF metadata). Files are stored in `DATA_DIR/uploads` and served from `/uploads/`.
- **CV upload:** the Careers form accepts an optional PDF (max 4 MB, checked by file signature, rate-limited). Files are stored privately in `DATA_DIR/cv` and are only downloadable from the admin Enquiries tab.
- **News and events:** `/news` and `/news/<slug>`, managed in the admin News tab (type, date, location, image).
- **Search:** `/search` searches pages, articles, news, sectors, published projects, roles and leadership.
- **Statistics:** the admin Analytics tab shows page views for the last 30 days and the top pages. Counting is cookie-free and stores no IP address or user agent; known bots are skipped. Data is in `DATA_DIR/analytics.json`.
- Back up all of `DATA_DIR` (content, enquiries, uploads, CVs, statistics).

## Accounts, roles and password reset
- **Owner:** the `ADMIN_USER` / `ADMIN_PASS` environment login. It always works and is your recovery route: if every other password is lost, sign in as owner and reset them. To change the owner password, change `ADMIN_PASS` and restart.
- **Admin and Editor users:** the owner or an admin creates them in `/admin` > Users. Creating a user with an existing username resets that password. Passwords must be 12+ characters and are stored hashed (scrypt) in `DATA_DIR/users.json`.
- **Roles:** editors can manage articles, news, projects, jobs and team and change their own password. Only owner and admins can see enquiries, CVs, statistics, settings and users, or export CSV.
- **Login protection:** repeated failed sign-ins from one address are blocked for 15 minutes.
- **Acknowledgement emails:** set `AUTOREPLY=true` (with the SMTP variables) to email a fixed thank-you message to everyone who submits a form. It never repeats what they typed.
- This uses browser Basic authentication, so always serve over HTTPS. Signing out means closing the browser.
