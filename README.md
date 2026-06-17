# QR Preventative Maintenance Prototype

This is a static browser prototype for proving a QR-code preventative maintenance workflow.

## Run It

Open `index.html` in a browser.

## Basic Flow

1. Log in.
2. Add or select a customer.
3. Add one or more locations for that customer.
4. Add equipment under the correct customer and location.
5. Create or select a maintenance template for the equipment checklist.
6. Admin/Manager users can add, edit, and delete users from **Admin & Settings**.
7. New users can request access from the login page.
8. Admin/Manager users can review access requests from **Admin & Settings** and use them to create users.
9. Admin/Manager users can review the **Activity Log** in **Admin & Settings**.
10. Use the customer and location filters to switch views.
11. Use the Equipment Register search, filters, sorting, and pagination for large equipment lists.
12. Select equipment from the table or left shortlist, or use the table **Edit** button to open editing directly.
13. Review or manually edit the QR code, top equipment thumbnail, next maintenance date, equipment name, customer, location, maintenance template, frequency, photo, details, checklist, issues, and history.
14. Complete the maintenance checklist with a technician name, optional reading, notes, result, and photo.
15. Failed or attention-needed maintenance automatically creates open issues.
16. Use **Print Filtered Labels** to print labels for the current register results.
17. Use **Print Report QRs** to print customer/member issue-report QR labels for equipment and areas.
18. Use **Export Register CSV** for a filtered equipment register export.
19. Use **Export CSV** to export the selected equipment's maintenance history.
20. Use **Export Data** to download a full JSON data backup.
21. Use **Export Complete Backup** to download a fuller backup with a manifest showing equipment, photo, manual, issue, activity log, public report, and history counts.
22. Use **Import Data** or **Restore Latest** to recover app data.

## QR Scanning From a Phone

For phone scanning, the QR code must point to an address the phone can reach.

If the app is running locally on this computer, use the computer's network address, not `127.0.0.1`. In this environment the likely local Wi-Fi URL is:

`http://10.0.0.12:8766/index.html`

Open **Admin & Settings**, then **Backups & QR**, set **QR scan URL** to that address, and save it. Then reprint or rescan the QR code.

The QR code includes a small asset snapshot so a fresh phone browser can open the scanned asset even if it does not already have the computer's browser data. Reprint labels after changing the QR scan URL or after this QR update.

For the local prototype, maintenance completed on the phone is saved in the phone browser only. A production version needs a shared database so phone and computer updates stay synced.

Use **Print Report QRs** to print customer/member report labels. These open a simple no-login report form with photo, note, and optional contact fields. In this browser prototype, submitted reports save in the phone/browser that submits them. In production, these should post to the shared database so your team sees them immediately.

## Supabase Public Report Sync

The public QR report form is wired to Supabase for first shared-data testing.

1. Open Supabase.
2. Go to **SQL Editor**.
3. Paste and run the contents of `supabase-schema.sql`.
4. Upload `index.html`, `app.js`, `styles.css`, `README.md`, and `supabase-schema.sql` to GitHub.
5. Reprint **Print Report QRs** from the hosted app.

After the table exists, reports submitted from a phone are saved to Supabase. Admin/Manager users can then open the app on a PC and the reports will import into **Open Issues**.

When opening from a scanned QR code, the app automatically enters Customer access for the scanned asset. Regular non-QR visits still require login. Current QR links use normal URL query parameters, which work more reliably on iPhone/Safari than hash-only links.

If an old QR still opens the login screen, reprint/regenerate the QR from the updated app so the link starts like `index.html?qr=1&a=...`.

Your phone must be on the same Wi-Fi network, and Windows Firewall may need to allow Python or the local server on port `8766`.

## First Admin Setup

Fresh browsers no longer include preset login accounts. On first use, create the first Admin account from the login screen. After that, the Admin user can add Manager, Technician, and Customer users from **Admin & Settings**.

## What It Proves

- Equipment registry
- Customer records
- Customer-specific locations
- Local prototype login screen
- Login page access request form
- User creation with Admin, Manager, Technician, and Customer roles
- Customer users can be assigned to one customer account
- User editing and deletion with current-user and last-admin safeguards
- Admin/Manager review of pending access requests
- Admin, manager, technician, and customer role behavior
- Customer users can only see equipment and issues for their assigned customer
- Customer role hides Admin & Settings
- Public customer/member QR report form for quick photo and note submissions
- Report QR labels for equipment and location/area issue reporting
- Activity log for setup, equipment, maintenance, issue, backup, import, and restore actions
- Custom maintenance checklist templates
- Equipment detail records with photo, type, criticality, manufacturer, model, serial, install date, manual link, and notes
- Uploaded PDF manual storage for each equipment record, with manual links kept as an option
- Existing equipment editing for name, customer, location, maintenance template, frequency, photo, and details
- Existing equipment photo replacement updates immediately when a new photo is selected
- Multiple extra equipment photos can be added below the primary equipment photo
- Extra equipment photos show as thumbnail buttons inside Edit Equipment, directly above the add-more-photos upload field
- Equipment photos open in a full-screen viewer when clicked
- Uploaded equipment photos are resized before browser storage to help them save reliably
- Extra equipment photos are compressed smaller and show upload status after selection
- Uploaded PDF manuals are limited to about 4 MB for the browser prototype; use manual links for larger manuals
- Scalable equipment register table
- Cleaner maintenance overview dashboard with quick filter cards
- Search across equipment, customer, location, type, criticality, model, serial, manual link, and notes
- Status/template filters, sorting, pagination, and filtered CSV exports
- QR-linked asset records
- Preventative maintenance schedule status
- More visual status badges for maintenance status, open issues, criticality, and manuals
- Manual next maintenance date override
- Mobile-friendly maintenance checklist
- Equipment page prioritizes the maintenance checklist before deeper equipment details
- Equipment photos and photo evidence on maintenance history
- Top-of-equipment photo thumbnail for quick visual identification
- Automatic issue creation from failed maintenance
- Issue status tracking
- Maintenance history
- Basic reporting/export
- Full data backup export/import
- Complete backup export with a built-in manifest
- Rolling in-browser auto backups
- Printable QR labels

## Data Backups

The app now keeps rolling automatic data snapshots in browser storage every time the app saves. These snapshots cover customers, locations, templates, equipment, maintenance history, issues, and role state.

Recommended visible backup folder, editable by Admin users in **Admin & Settings > Backups & QR**:

`C:\Users\expli\Documents\QR Maintenance Backups\Data Backups`

Use **Export Data** regularly to download a portable `.json` backup file. Use **Import Data** to restore one of those files later.

Use **Export Complete Backup** when you want the safest single-file backup. It includes the same restorable app data, plus a manifest that lists customer, location, equipment, user, activity log, issue, history, uploaded photo, and uploaded PDF manual counts.

When a user clicks **Log Out**, the app automatically downloads a dated logout backup file named like `qr-maintenance-logout-backup-YYYYMMDD-HHMMSS.json`.

Use **Restore Latest** to restore the newest automatic in-browser snapshot. This is useful for quick recovery inside the same browser.

Browser security does not allow this static prototype to silently write backup files to your computer on every change. For production, the correct version is a hosted database with scheduled server backups.

## Important Prototype Note

The app stores data in the browser with `localStorage`. The login screen is for prototype flow only and stores local passwords in browser data. For real customer use, this should become a hosted web app with a database, real password hashing, server-side sessions, customer separation, durable file uploads, and durable QR labels.

The QR labels point to the current page URL. If opened as a local file, the QR code points to a `file://` URL that works only on the same machine. To scan labels from phones or other devices, host the app on a reachable web address first.
