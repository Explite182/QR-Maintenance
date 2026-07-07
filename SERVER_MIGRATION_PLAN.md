# SiteWorks Server Migration Plan

This document is the working blueprint for moving SiteWorks from the current static GitHub Pages + Supabase prototype into a real hosted application with its own backend.

## Current State

SiteWorks currently runs as a static browser app from `index.html`, `app.js`, and `styles.css`.

The app uses Supabase for:

- Email/password login through Supabase Auth
- User profile records in `profiles`
- Shared facility data in structured tables
- Public QR report submissions
- File storage for photos and PDF manuals
- Edge Function email sending through `send-issue-report`
- A legacy `app_state` shared JSON fallback

The browser still owns some prototype behavior:

- Local backups
- Offline-ish local state
- UI rendering and business rules
- Some local file fallback when upload fails
- QR report page behavior

## Main Goal

Move backend responsibilities behind a SiteWorks-owned API so the frontend does not directly depend on Supabase.

The future shape should be:

```text
Browser / Mobile
  -> SiteWorks frontend
  -> SiteWorks API server
  -> Database, file storage, email provider, auth/session handling
```

Supabase can still be used underneath at first, but the browser should eventually talk only to the SiteWorks API.

## Backend Responsibilities

### Auth

Current frontend calls:

- Login with email/password
- Signup/create user from Admin
- Resolve display/login name to email
- Save user profile
- Delete user profile
- Restore saved session

Future API endpoints:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/users`
- `GET /api/users`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`

Server must enforce:

- Admin can create all users
- Manager can create users only for their assigned customer/location scope
- Last Admin cannot be deleted
- Users only see allowed customer/location data

### Core Facility Data

Current tables:

- `customers`
- `locations`
- `pm_templates`
- `assets`
- `work_orders`
- `service_requests`
- `pm_history`
- `asset_files`
- `profiles`
- `public_reports`
- `app_state` legacy fallback

Future API endpoints:

- `GET /api/customers`
- `POST /api/customers`
- `PATCH /api/customers/:id`
- `DELETE /api/customers/:id`
- `GET /api/locations`
- `POST /api/locations`
- `PATCH /api/locations/:id`
- `DELETE /api/locations/:id`
- `GET /api/templates`
- `POST /api/templates`
- `PATCH /api/templates/:id`
- `DELETE /api/templates/:id`
- `GET /api/assets`
- `POST /api/assets`
- `PATCH /api/assets/:id`
- `DELETE /api/assets/:id`
- `GET /api/work-orders`
- `POST /api/work-orders`
- `PATCH /api/work-orders/:id`
- `DELETE /api/work-orders/:id`
- `GET /api/service-requests`
- `POST /api/service-requests`
- `PATCH /api/service-requests/:id`
- `DELETE /api/service-requests/:id`
- `GET /api/pm-history`
- `POST /api/pm-history`

### Sync

Current app behavior:

- Performs a small timestamp check before loading full structured data
- Loads structured rows when remote data is newer
- Saves full structured rows after local changes
- Tracks sync health in Admin

Future API endpoints:

- `GET /api/sync/status`
- `GET /api/sync/changes?since=...`
- `POST /api/sync/batch`

Recommended next server behavior:

- Use `updated_at` consistently on every editable table
- Return only rows changed since the client's last sync
- Avoid returning large media payloads
- Keep files as URLs/storage keys, not base64
- Return deletion tombstones or a deleted-record feed

### File Uploads

Current storage:

- Supabase Storage bucket: `siteworks-files`
- Folders include equipment photos, equipment gallery, manuals, PM history, tickets, service requests, public reports, and panel logos

Future API endpoints:

- `POST /api/files`
- `GET /api/files/:id`
- `DELETE /api/files/:id`

Future file record fields:

- `id`
- `owner_type`
- `owner_id`
- `customer_id`
- `location_id`
- `kind`
- `name`
- `mime_type`
- `size`
- `storage_key`
- `public_url` or signed URL
- `created_by`
- `created_at`

Server rules:

- Resize/compress photos server-side where possible
- Reject oversized files cleanly
- Store originals only when needed
- Use private storage with signed URLs for customer data
- Never store base64 file data in database rows

Started in this repo:

- `POST /api/files` accepts multipart file uploads in `server/siteworks-server.js`
- The server validates file type before upload
- The server rejects uploads above `MAX_UPLOAD_BYTES`
- Approved files are stored in the configured Supabase Storage bucket
- The route returns file metadata with storage path and URL

Current upload status:

- Good enough for proving server-routed uploads
- Still needs production-grade image resizing/compression
- Still needs private storage or signed URL behavior before real customer data

### QR Public Reports

Current behavior:

- QR labels open a no-login report form
- Reports can include equipment/location context, note, optional contact, and photo
- Reports are imported into open tickets by Admin/Manager users

Future API endpoints:

- `GET /api/public/qr-context?...`
- `POST /api/public/reports`

Public report rules:

- No login required
- Rate limit submissions
- Validate QR context
- Allow photo upload, but resize/compress and scan file type
- Do not expose private customer data beyond the printed QR context

### Email

Current behavior:

- Supabase Edge Function `send-issue-report`
- Resend/Sender setup outside the frontend

Future API endpoints:

- `POST /api/email/ticket`
- `POST /api/email/service-request`
- `POST /api/email/assignment`

Server rules:

- Email API keys live only on the server
- Sender domain verification handled outside the app
- Generate PDFs server-side or accept a structured report payload and build PDF/email centrally

Started in this repo:

- `POST /api/email/ticket` is scaffolded in `server/siteworks-server.js`
- `POST /api/email/service-request` is scaffolded in `server/siteworks-server.js`
- `POST /api/email/assignment` is scaffolded in `server/siteworks-server.js`
- Resend configuration is stored in server environment variables
- Frontend email calls are routed through `siteworksApi.sendEmail(...)` so server mode can use these routes later

Current email status:

- Good enough to prove server-owned email sending
- Keeps the Resend API key out of browser files
- Server-side PDF attachment generation is started
- Ticket, service request, and assignment emails can include a generated PDF attachment
- Current PDF is a clean text summary and can be replaced with a richer renderer later

## Data Model Notes

### Customer

Owns locations, equipment, work orders, service requests, contacts, users, and files.

Important fields:

- `id`
- `name`
- contact fields
- notes
- `created_at`
- `updated_at`

### Location

Belongs to a customer.

Important fields:

- `id`
- `customer_id`
- `name`
- address/area metadata later
- `created_at`
- `updated_at`

### Asset / Equipment

Belongs to customer and location.

Important fields:

- `id`
- `equipment_id`
- `customer_id`
- `location_id`
- `template_id`
- `name`
- `frequency_days`
- `next_pm_date`
- `manufacturer`
- `model`
- `serial`
- `type`
- `criticality`
- `document_url`
- vendor/warranty/parts/notes
- electrical panel schedule data
- `created_at`
- `updated_at`

### Work Order / Open Ticket

Important fields:

- `id`
- `issue_number`
- `asset_id`
- `customer_id`
- `location_id`
- `title`
- `priority`
- `status`
- `source`
- `assigned_user_id`
- `notes`
- `due_at`
- `resolved_at`
- `created_at`
- `updated_at`

### Service Request

Important fields:

- `id`
- `service_request_number`
- `asset_id`
- `customer_id`
- `location_id`
- `title`
- `priority`
- `status`
- `requested_by`
- `preferred_date`
- `assigned_user_id`
- `converted_work_order_id`
- `photo file reference`
- `created_at`
- `updated_at`

### PM History

Important fields:

- `id`
- `pm_number`
- `asset_id`
- `technician`
- `result`
- `reading`
- `notes`
- `completed_checks`
- photo file references
- `completed_at`

## Security Requirements

Before real customer use, the server must enforce:

- User authentication on all private routes
- Role-based access for Admin, Manager, Technician, Customer
- Customer/location scoping on every query
- Private file storage for customer uploads
- Public QR report rate limiting
- Input validation
- Audit/activity log
- Server-side email key protection
- Backups and restore testing

## Migration Phases

### Phase A: Stabilize Current Supabase Prototype

- Keep current GitHub Pages frontend
- Keep Supabase as backend
- Keep reducing egress
- Keep files in storage, not database JSON
- Keep Sync Health visible

### Phase B: Backend API Shim

Create a lightweight server that initially forwards to Supabase.

Started in this repo:

- `server/siteworks-server.js`
- `server/.env.example`
- `server/README.md`

The browser calls:

- `/api/auth/login`
- `/api/assets`
- `/api/work-orders`
- `/api/files`

The server talks to Supabase behind the scenes.

This proves the API shape without migrating the database yet.

Current shim status:

- Health check route is available at `/api/health`
- Login route is available at `/api/auth/login`
- User/profile routes are scaffolded
- Public report routes are scaffolded
- Structured data batch routes are scaffolded
- File upload route is intentionally reserved for the production implementation

### Phase C: Move Business Rules Server-Side

Move these rules off the browser:

- User creation permissions
- Customer/location scoping
- Ticket numbering
- Service request numbering
- File upload validation
- Public QR report validation

Started in this repo:

- `server/siteworks-policies.js`
- `server/policy-smoke-test.js`

Current policy status:

- Admin, Manager, Facility Manager, Technician, and Customer roles are represented
- User creation role limits are represented
- Customer/location visibility rules are represented
- Equipment create/delete permissions are represented
- Ticket work permissions are represented
- Structured table read/write/delete guards are scaffolded in the server shim

### Phase D: Move Database Ownership

Options:

- Keep Supabase Postgres but access only through server
- Move to managed Postgres elsewhere
- Move to self-hosted Postgres

Recommended path: keep Postgres-style tables and avoid a big data model rewrite.

### Phase E: Production Hardening

- Backups
- Monitoring
- Error reporting
- Domain and SSL
- Email domain health
- Customer data export
- Admin audit logs

Started in this repo:

- `server/package.json` provides `npm start`, `npm run check`, and `npm test`
- `server/package.json` provides `npm run smoke` for API health verification
- `server/DEPLOYMENT.md` documents the first hosting path
- `server/deploy-smoke-test.js` checks `/api/health` before frontend cutover
- Server deployment env vars are listed in one place
- The recommended DNS shape is `sitesworks.info` for frontend and `api.sitesworks.info` for server

## Immediate Next Coding Step

The next code phase should be an API facade inside `app.js` with business-named methods:

- `apiLogin`
- `apiCreateUser`
- `apiLoadChangedData`
- `apiSaveBatch`
- `apiUploadFile`
- `apiSubmitPublicReport`
- `apiSendTicketEmail`

Those methods can still call `cloudApi` for now.

Later, when the backend server exists, those functions can call `/api/...` routes instead.

## Open Questions

- Will SiteWorks stay single-company, or will it become multi-company/multi-tenant?
- Should customer uploaded files be private with signed URLs?
- How long should public QR report links remain valid?
- Do customers need their own login portal, or only reporting?
- Should PM/ticket PDFs be generated in browser or server-side?
- What is the preferred server host: VPS, Cloudflare Workers, Render, Railway, Fly.io, Azure, or another provider?

## Recommended Direction

For the next real build, use:

- Static frontend for now
- Small Node/Express or serverless API
- Postgres-compatible database
- Object storage for files
- Server-owned email sending

This keeps SiteWorks simple while moving the fragile parts out of the browser.
