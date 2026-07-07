# SiteWorks Server Shim

This folder is the first backend step for moving SiteWorks away from direct browser-to-Supabase calls.

The current live app still runs from GitHub Pages and still uses Supabase directly because `SITEWORKS_API_BASE_URL` is blank in `app.js`.

When a real server is ready, set that value to the hosted API address, for example:

```js
const SITEWORKS_API_BASE_URL = "https://api.sitesworks.info";
```

or, if the frontend and backend are hosted together:

```js
const SITEWORKS_API_BASE_URL = "/api";
```

## What This Server Does

`siteworks-server.js` is a lightweight Node starter server.

It provides route shapes for:

- Login
- User lookup and profile management
- Public QR reports
- Shared app state
- Structured data tables
- File uploads
- Health checks

It also includes `siteworks-policies.js`, which is the first home for server-side role and customer/location rules.

At first, these routes forward to Supabase. Later, the same route names can talk to a different database, storage provider, or email system without changing the frontend again.

## Local Test

From this folder:

```powershell
npm run check
npm test
```

Then start the server:

```powershell
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_ANON_KEY="your-publishable-anon-key"
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
$env:ALLOWED_ORIGIN="http://localhost:8787"
$env:ALLOW_DEV_AUTH_HEADERS="false"
$env:MAX_UPLOAD_BYTES="10485760"
$env:RESEND_API_KEY="your-resend-api-key"
$env:ISSUE_EMAIL_FROM="SiteWorks <service@sitesworks.info>"
$env:ISSUE_EMAIL_REPLY_TO="your-email@example.com"
npm start
```

Then open:

```text
http://localhost:8787/api/health
```

To quickly check the policy layer:

```powershell
node policy-smoke-test.js
```

To quickly check server PDF generation:

```powershell
node pdf-smoke-test.js
```

To check a running local or hosted server:

```powershell
npm run smoke
```

or:

```powershell
npm run smoke -- https://api.sitesworks.info
```

## Important

Do not expose the Supabase service role key in `index.html`, `app.js`, GitHub Pages, or any browser file.

The service role key belongs only on a private server.

Private routes now read the signed-in Supabase session from the browser's `Authorization: Bearer ...` header. The old development shortcut headers are disabled unless `ALLOW_DEV_AUTH_HEADERS=true` is set on purpose for local testing.

## File Uploads

`POST /api/files` now accepts multipart uploads and forwards approved files to Supabase Storage.

Current allowed upload types:

- JPEG
- PNG
- WebP
- GIF
- HEIC/HEIF
- PDF

The default upload limit is 10 MB. Change it with `MAX_UPLOAD_BYTES`.

The route returns file metadata with a storage path and public URL. A final production server should move customer files to private storage or signed URLs.

## Email Routes

The server now owns the first version of the SiteWorks email routes:

- `POST /api/email/ticket`
- `POST /api/email/service-request`
- `POST /api/email/assignment`

These routes validate the recipient, build a SiteWorks email body, and send through Resend using `RESEND_API_KEY`.

The frontend still uses the Supabase Edge Function while `SITEWORKS_API_BASE_URL` is blank. When the frontend is pointed at this server, the existing Send PDF Email buttons will call these server routes.

The server attaches a generated PDF summary to each ticket, service request, or assignment email.

Current limitation: the PDF is a clean text-based server PDF. A richer production PDF can replace this builder later without changing the route names.

## Deployment

See `DEPLOYMENT.md` for the production hosting checklist.
