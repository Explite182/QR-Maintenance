# SiteWorks Server Deployment Checklist

This server is not used by the live GitHub Pages frontend until `SITEWORKS_API_BASE_URL` in `app.js` is pointed at the hosted API.

## Recommended First Hosting Shape

Use a small Node-capable host first:

- VPS
- Render
- Railway
- Fly.io
- Azure App Service
- Any host that can run `node siteworks-server.js`

Keep GitHub Pages for the frontend until the server is stable.

## Required Runtime

- Node.js 20 or newer
- HTTPS endpoint
- Private environment variables

## Required Environment Variables

```text
PORT=8787
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-publishable-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=siteworks-files
MAX_UPLOAD_BYTES=10485760
RESEND_API_KEY=your-resend-api-key
ISSUE_EMAIL_FROM=SiteWorks <service@sitesworks.info>
ISSUE_EMAIL_REPLY_TO=your-email@example.com
ALLOWED_ORIGIN=https://sitesworks.info
```

Do not put real secret values in GitHub Pages, `index.html`, `app.js`, or any public file.

## Start Command

```text
npm start
```

or:

```text
node siteworks-server.js
```

## Local Verification

From the `server` folder:

```powershell
npm run check
npm test
npm start
```

Then open:

```text
http://localhost:8787/api/health
```

The health response should show:

- `ok: true`
- `supabaseConfigured: true`
- `serviceRoleConfigured: true`
- `emailConfigured: true`
- `policyLayer: "enabled"`

## Deployment Verification

After hosting the server, check:

```text
https://your-api-host/api/health
```

Then update `SITEWORKS_API_BASE_URL` in `app.js` only after the health check is clean.

Suggested future value:

```js
const SITEWORKS_API_BASE_URL = "https://api.sitesworks.info";
```

## DNS Shape

Recommended:

- `sitesworks.info` points to GitHub Pages frontend
- `api.sitesworks.info` points to the Node server

## Before Switching the Frontend

Confirm these work on the hosted server:

- Login route
- Public report route
- File upload route
- Email route
- PDF smoke test locally before deploy
- Supabase service role is private and not visible in browser files

## Production Hardening Still Needed

- Real session validation from `Authorization` headers
- Rate limiting public QR reports
- Private file storage or signed URLs
- Richer PDF layout
- Logging and monitoring
- Scheduled database backups
- Admin audit log enforcement
- Customer/location scoped database queries
