const http = require("http");
const { randomUUID } = require("crypto");
const policies = require("./siteworks-policies");

const PORT = Number(process.env.PORT || 8787);
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "siteworks-files";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const ALLOW_DEV_AUTH_HEADERS = process.env.ALLOW_DEV_AUTH_HEADERS === "true";
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024);
const SIGNED_URL_EXPIRES_SECONDS = Number(process.env.SIGNED_URL_EXPIRES_SECONDS || 60 * 10);
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const ISSUE_EMAIL_FROM = process.env.ISSUE_EMAIL_FROM || "SiteWorks <onboarding@resend.dev>";
const ISSUE_EMAIL_REPLY_TO = process.env.ISSUE_EMAIL_REPLY_TO || "";
const ALLOWED_UPLOAD_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf"
]);

const STRUCTURED_TABLES = new Set([
  "customers",
  "locations",
  "pm_templates",
  "assets",
  "work_orders",
  "service_requests",
  "pm_history",
  "asset_files"
]);

function getBearerToken(request) {
  const authorization = String(request.headers.authorization || "").trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function getDevHeaderActor(request) {
  if (!ALLOW_DEV_AUTH_HEADERS || !request.headers["x-siteworks-user-role"]) return null;
  return policies.normalizeUser({
    id: request.headers["x-siteworks-user-id"] || "",
    email: request.headers["x-siteworks-user-email"] || "",
    name: request.headers["x-siteworks-user-name"] || "Development user",
    role: request.headers["x-siteworks-user-role"] || "Customer",
    customerId: request.headers["x-siteworks-customer-id"] || "",
    locationId: request.headers["x-siteworks-location-id"] || ""
  });
}

async function loadSupabaseAuthUser(token) {
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const upstream = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`
    }
  });
  if (!upstream.ok) return null;
  return upstream.json().catch(() => null);
}

async function loadProfileForAuthUser(userId) {
  if (!userId || !SUPABASE_SERVICE_ROLE_KEY) return null;
  const upstream = await supabaseFetch(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
    {},
    true
  );
  if (!upstream.ok) return null;
  const rows = await upstream.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getRequestActor(request) {
  const devActor = getDevHeaderActor(request);
  if (devActor) return devActor;

  const token = getBearerToken(request);
  const authUser = await loadSupabaseAuthUser(token);
  const userId = authUser?.id || authUser?.user?.id || "";
  const profile = await loadProfileForAuthUser(userId);
  const metadata = authUser?.user_metadata || authUser?.user?.user_metadata || {};

  if (authUser || profile) {
    return policies.normalizeUser({
      id: profile?.id || userId,
      email: profile?.email || authUser?.email || authUser?.user?.email || "",
      name: profile?.name || profile?.display_name || metadata.name || metadata.display_name || "",
      role: profile?.role || "Customer",
      customer_id: profile?.customer_id || "",
      location_id: profile?.location_id || ""
    });
  }

  return policies.normalizeUser({ role: "Customer" });
}

function sendJson(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    ...extraHeaders
  });
  response.end(JSON.stringify(body));
  return true;
}

function sendError(response, status, message, detail = "") {
  return sendJson(response, status, { error: message, detail });
}

function getRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8 * 1024 * 1024) {
        request.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    request.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function getRawRequestBody(request, maxBytes = MAX_UPLOAD_BYTES + 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        request.destroy();
        reject(new Error("Upload is too large."));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function parseContentDisposition(value = "") {
  return value.split(";").reduce((result, part) => {
    const [rawKey, ...rawValue] = part.trim().split("=");
    const key = rawKey.toLowerCase();
    if (!rawValue.length) return result;
    result[key] = rawValue.join("=").replace(/^"|"$/g, "");
    return result;
  }, {});
}

function parseMultipartFormData(request, body) {
  const contentType = request.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundary) {
    const error = new Error("Upload must use multipart form data.");
    error.status = 400;
    throw error;
  }

  const boundaryText = `--${boundary}`;
  const parts = body.toString("binary").split(boundaryText).slice(1, -1);
  const fields = {};
  const files = [];

  for (const part of parts) {
    const trimmedPart = part.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const headerEnd = trimmedPart.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const rawHeaders = trimmedPart.slice(0, headerEnd);
    const content = trimmedPart.slice(headerEnd + 4);
    const headers = rawHeaders.split("\r\n").reduce((result, line) => {
      const [name, ...value] = line.split(":");
      if (name && value.length) result[name.trim().toLowerCase()] = value.join(":").trim();
      return result;
    }, {});
    const disposition = parseContentDisposition(headers["content-disposition"]);
    const fieldName = disposition.name || "";
    const fileName = disposition.filename || "";
    const contentBuffer = Buffer.from(content, "binary");
    if (fileName) {
      files.push({
        fieldName,
        name: fileName,
        type: headers["content-type"] || "application/octet-stream",
        size: contentBuffer.length,
        buffer: contentBuffer
      });
    } else if (fieldName) {
      fields[fieldName] = contentBuffer.toString("utf8");
    }
  }

  return { fields, files };
}

function slugifyStoragePath(value = "file") {
  return String(value || "file")
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/[^a-z0-9._-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("/") || "file";
}

function buildStoragePath(file, folder = "uploads") {
  const cleanFolder = slugifyStoragePath(folder || "uploads");
  const cleanName = slugifyStoragePath(file.name || "file");
  const dateFolder = new Date().toISOString().slice(0, 10);
  return `${cleanFolder}/${dateFolder}/${randomUUID()}-${cleanName}`;
}

function normalizeStoragePath(value = "") {
  return String(value || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\.\./g, "")
    .split("/")
    .filter(Boolean)
    .join("/");
}

function normalizeSignedUrlExpires(value) {
  const seconds = Number(value || SIGNED_URL_EXPIRES_SECONDS);
  if (!Number.isFinite(seconds)) return SIGNED_URL_EXPIRES_SECONDS;
  return Math.max(60, Math.min(Math.round(seconds), 60 * 60));
}

function validateUpload(file) {
  if (!file) {
    const error = new Error("No file was uploaded.");
    error.status = 400;
    throw error;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const error = new Error(`File is too large. Maximum size is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
    error.status = 413;
    throw error;
  }
  if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
    const error = new Error("This file type is not allowed. Upload an image or PDF.");
    error.status = 415;
    throw error;
  }
}

function isEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeIssueReport(input = {}, defaults = {}) {
  const issueNumber = input.issueNumber || input.ticketNumber || input.serviceRequestNumber || input.id || "not-recorded";
  return {
    id: String(input.id || issueNumber),
    issueNumber: String(issueNumber),
    reportTitle: String(input.reportTitle || defaults.reportTitle || "Issue Report"),
    numberLabel: String(input.numberLabel || defaults.numberLabel || "Issue Number"),
    footerLabel: String(input.footerLabel || defaults.footerLabel || "SiteWorks Form"),
    title: String(input.title || defaults.title || "Open issue"),
    customer: String(input.customer || input.customerName || "Unknown customer"),
    customerId: String(input.customerId || input.customer_id || ""),
    location: String(input.location || input.locationName || "Unknown location"),
    locationId: String(input.locationId || input.location_id || ""),
    equipment: String(input.equipment || input.equipmentName || input.area || "Area report"),
    status: String(input.status || "Open"),
    priority: String(input.priority || "Medium"),
    assignedTo: String(input.assignedTo || "Unassigned"),
    source: String(input.source || "SiteWorks"),
    dueAt: String(input.dueAt || "Not set"),
    createdAt: String(input.createdAt || "Not recorded"),
    updatedAt: String(input.updatedAt || "Not recorded"),
    resolvedAt: String(input.resolvedAt || ""),
    notes: String(input.notes || "No notes provided.")
  };
}

function buildEmailSubject(issue) {
  return `SiteWorks ${issue.reportTitle}: ${issue.issueNumber} - ${issue.equipment}`;
}

function buildEmailText(issue) {
  return [
    `${issue.reportTitle}: ${issue.title}`,
    "",
    `${issue.numberLabel}: ${issue.issueNumber}`,
    `Customer: ${issue.customer}`,
    `Location: ${issue.location}`,
    `Equipment/Area: ${issue.equipment}`,
    `Status: ${issue.status}`,
    `Priority: ${issue.priority}`,
    `Assigned to: ${issue.assignedTo}`,
    `Due: ${issue.dueAt}`,
    `Created: ${issue.createdAt}`,
    `Updated: ${issue.updatedAt}`,
    "",
    "Notes:",
    issue.notes,
    "",
    issue.footerLabel
  ].join("\n");
}

function buildEmailHtml(issue) {
  const rows = [
    ["Number", issue.issueNumber],
    ["Customer", issue.customer],
    ["Location", issue.location],
    ["Equipment/Area", issue.equipment],
    ["Status", issue.status],
    ["Priority", issue.priority],
    ["Assigned to", issue.assignedTo],
    ["Due", issue.dueAt],
    ["Created", issue.createdAt],
    ["Updated", issue.updatedAt]
  ];
  return `
    <div style="font-family:Arial,sans-serif;color:#1f2933;line-height:1.45;">
      <h2 style="margin:0 0 4px;">${escapeHtml(issue.reportTitle)}</h2>
      <p style="margin:0 0 18px;font-weight:700;">${escapeHtml(issue.title)}</p>
      <table style="border-collapse:collapse;width:100%;max-width:680px;">
        ${rows.map(([label, value]) => `
          <tr>
            <td style="border:1px solid #dbe5e1;padding:8px;font-weight:700;background:#f8fafc;">${escapeHtml(label)}</td>
            <td style="border:1px solid #dbe5e1;padding:8px;">${escapeHtml(value)}</td>
          </tr>
        `).join("")}
      </table>
      <h3 style="margin:20px 0 8px;">Notes</h3>
      <div style="white-space:pre-wrap;border:1px solid #dbe5e1;border-radius:8px;padding:12px;background:#f8fafc;">${escapeHtml(issue.notes)}</div>
      <p style="margin-top:18px;color:#64748b;">${escapeHtml(issue.footerLabel)}</p>
    </div>
  `;
}

function pdfText(value) {
  return String(value ?? "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function safePdfFilename(value) {
  return String(value || "report")
    .trim()
    .replace(/[^a-z0-9._-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "report";
}

function wrapPdfLine(value, maxLength = 88) {
  const words = String(value || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function buildIssuePdfLines(issue) {
  const rows = [
    `${issue.reportTitle}: ${issue.title}`,
    "",
    `${issue.numberLabel}: ${issue.issueNumber}`,
    `Customer: ${issue.customer}`,
    `Location: ${issue.location}`,
    `Equipment/Area: ${issue.equipment}`,
    `Status: ${issue.status}`,
    `Priority: ${issue.priority}`,
    `Assigned to: ${issue.assignedTo}`,
    `Due: ${issue.dueAt}`,
    `Created: ${issue.createdAt}`,
    `Updated: ${issue.updatedAt}`,
    issue.resolvedAt ? `Resolved: ${issue.resolvedAt}` : "",
    "",
    "Notes:"
  ].filter((line) => line !== "");

  const noteLines = String(issue.notes || "No notes provided.")
    .split(/\r?\n/)
    .flatMap((line) => wrapPdfLine(line, 84));

  return [
    "SITEWORKS",
    "Preventative Maintenance",
    "",
    ...rows,
    ...noteLines,
    "",
    issue.footerLabel
  ];
}

function paginatePdfLines(lines, maxLinesPerPage = 44) {
  const pages = [];
  for (let index = 0; index < lines.length; index += maxLinesPerPage) {
    pages.push(lines.slice(index, index + maxLinesPerPage));
  }
  return pages.length ? pages : [["SITEWORKS"]];
}

function buildPdfPageContent(lines, pageNumber, pageCount) {
  const commands = [
    "BT /F1 18 Tf 54 750 Td (SITEWORKS) Tj ET",
    "BT /F1 9 Tf 54 735 Td (Preventative Maintenance) Tj ET"
  ];
  let y = 700;
  lines.forEach((line, index) => {
    const fontSize = index === 0 ? 14 : 10;
    const x = index === 0 ? 54 : 62;
    commands.push(`BT /F1 ${fontSize} Tf ${x} ${y} Td (${pdfText(line)}) Tj ET`);
    y -= index === 0 ? 22 : 15;
  });
  commands.push(`BT /F1 8 Tf 54 36 Td (Page ${pageNumber} of ${pageCount}) Tj ET`);
  return commands.join("\n");
}

function buildPdfBuffer(pages) {
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "",
    "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj"
  ];
  const pageObjectIds = [];
  const contentObjectIds = [];
  let nextObjectId = 4;

  pages.forEach((lines, index) => {
    const pageObjectId = nextObjectId++;
    const contentObjectId = nextObjectId++;
    pageObjectIds.push(pageObjectId);
    contentObjectIds.push(contentObjectId);
    const content = buildPdfPageContent(lines, index + 1, pages.length);
    objects.push(`${pageObjectId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>\nendobj`);
    objects.push(`${contentObjectId} 0 obj\n<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream\nendobj`);
  });

  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>\nendobj`;

  const header = "%PDF-1.4\n";
  let body = header;
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${object}\n`;
  });
  const xrefOffset = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, "latin1");
}

function buildIssuePdfAttachment(issue) {
  const lines = buildIssuePdfLines(issue);
  const pages = paginatePdfLines(lines);
  const pdfBuffer = buildPdfBuffer(pages);
  return {
    filename: `siteworks-${safePdfFilename(issue.issueNumber || issue.id)}.pdf`,
    content: pdfBuffer.toString("base64"),
    content_type: "application/pdf"
  };
}

async function sendResendEmail({ to, issue }) {
  if (!RESEND_API_KEY) {
    const error = new Error("RESEND_API_KEY is not configured on this server.");
    error.status = 500;
    throw error;
  }
  if (!isEmailAddress(to)) {
    const error = new Error("A valid recipient email is required.");
    error.status = 400;
    throw error;
  }

  const payload = {
    from: ISSUE_EMAIL_FROM,
    to: [to],
    subject: buildEmailSubject(issue),
    html: buildEmailHtml(issue),
    text: buildEmailText(issue),
    attachments: [buildIssuePdfAttachment(issue)]
  };
  if (ISSUE_EMAIL_REPLY_TO) payload.reply_to = ISSUE_EMAIL_REPLY_TO;

  const upstream = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const result = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const error = new Error(result?.message || "Resend could not send the email.");
    error.status = upstream.status;
    error.details = result;
    throw error;
  }
  return result;
}

function requireSupabase(response) {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) return true;
  sendError(response, 500, "Supabase is not configured on this server.");
  return false;
}

function requireServiceRole(response) {
  if (SUPABASE_SERVICE_ROLE_KEY) return true;
  sendError(response, 500, "Supabase service role key is required for this endpoint.");
  return false;
}

async function supabaseFetch(path, options = {}, useServiceRole = false) {
  const token = useServiceRole ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  return fetch(`${SUPABASE_URL}${path}`, { ...options, headers });
}

async function proxyJson(response, upstream) {
  const text = await upstream.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return sendJson(response, upstream.status, body);
}

async function resolveLoginEmail(login) {
  const value = String(login || "").trim().toLowerCase();
  if (!value) return value;
  if (value.includes("@")) return value;

  const escaped = value.replace(/[%*_]/g, "\\$&");
  const query = `/rest/v1/profiles?or=(email.ilike.${encodeURIComponent(escaped)},name.ilike.${encodeURIComponent(escaped)})&select=email&limit=1`;
  const upstream = await supabaseFetch(query, {}, true);
  if (!upstream.ok) return value;
  const rows = await upstream.json();
  return rows?.[0]?.email || value;
}

function normalizeTable(table) {
  const clean = String(table || "").replace(/[^a-z0-9_]/gi, "");
  return STRUCTURED_TABLES.has(clean) ? clean : "";
}

function encodeFilterValue(value) {
  return encodeURIComponent(String(value || ""));
}

function actorDataScope(actor, table) {
  const viewer = policies.normalizeUser(actor);
  if (policies.isAdmin(viewer)) return [];
  if (table === "pm_templates") return [];
  if (!viewer.customerId) return ["id=eq.__siteworks_no_customer__"];

  if (table === "customers") return [`id=eq.${encodeFilterValue(viewer.customerId)}`];

  const filters = [`customer_id=eq.${encodeFilterValue(viewer.customerId)}`];
  if (viewer.locationId && ["locations", "assets", "work_orders", "service_requests", "asset_files"].includes(table)) {
    filters.push(`location_id=eq.${encodeFilterValue(viewer.locationId)}`);
  }
  return filters;
}

async function scopedAssetIdsForActor(actor) {
  const viewer = policies.normalizeUser(actor);
  if (policies.isAdmin(viewer)) return null;
  if (!viewer.customerId) return [];
  const filters = [`customer_id=eq.${encodeFilterValue(viewer.customerId)}`];
  if (viewer.locationId) filters.push(`location_id=eq.${encodeFilterValue(viewer.locationId)}`);
  const upstream = await supabaseFetch(`/rest/v1/assets?select=id&${filters.join("&")}`, {}, true);
  if (!upstream.ok) return [];
  const rows = await upstream.json().catch(() => []);
  return Array.isArray(rows) ? rows.map((row) => row.id).filter(Boolean) : [];
}

async function buildScopedTableQuery(table, actor, options = {}) {
  const select = options.select || "*";
  const parts = [`select=${encodeURIComponent(select)}`];
  if (options.order) parts.push(`order=${encodeURIComponent(options.order)}`);
  if (options.limit) parts.push(`limit=${encodeURIComponent(options.limit)}`);

  if (table === "pm_history") {
    const assetIds = await scopedAssetIdsForActor(actor);
    if (Array.isArray(assetIds)) {
      if (!assetIds.length) parts.push("asset_id=eq.__siteworks_no_asset__");
      else parts.push(`asset_id=in.(${assetIds.map(encodeFilterValue).join(",")})`);
    }
  } else {
    parts.push(...actorDataScope(actor, table));
  }

  return `/rest/v1/${table}?${parts.join("&")}`;
}

async function assertRowsMatchActorScope(actor, table, rows) {
  const viewer = policies.normalizeUser(actor);
  if (policies.isAdmin(viewer) || table === "pm_templates") return;
  policies.assertAllowed(Boolean(viewer.customerId), "This user does not have a customer scope.");

  if (table === "pm_history") {
    const allowedAssetIds = await scopedAssetIdsForActor(viewer);
    const allowed = new Set(allowedAssetIds || []);
    rows.forEach((row) => {
      policies.assertAllowed(allowed.has(row.asset_id || row.assetId || ""), "This history row is outside the user's scope.");
    });
    return;
  }

  rows.forEach((row) => {
    if (table === "customers") {
      policies.assertAllowed((row.id || "") === viewer.customerId, "This customer row is outside the user's scope.");
      return;
    }
    const rowCustomerId = row.customer_id || row.customerId || "";
    const rowLocationId = row.location_id || row.locationId || "";
    policies.assertAllowed(rowCustomerId === viewer.customerId, "This row is outside the user's customer scope.");
    if (viewer.locationId && ["locations", "assets", "work_orders", "service_requests", "asset_files"].includes(table)) {
      policies.assertAllowed(rowLocationId === viewer.locationId, "This row is outside the user's location scope.");
    }
  });
}

async function handleAuth(request, response, pathname) {
  if (pathname === "/api/auth/login" && request.method === "POST") {
    if (!requireSupabase(response)) return true;
    const body = await getRequestBody(request);
    const email = await resolveLoginEmail(body.login || body.email);
    const upstream = await supabaseFetch("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password: body.password })
    });
    return proxyJson(response, upstream);
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    return sendJson(response, 200, { ok: true });
  }

  if (pathname === "/api/auth/me" && request.method === "GET") {
    const actor = await getRequestActor(request);
    return sendJson(response, 200, {
      mode: "server-shim",
      authenticated: Boolean(actor.id || actor.email),
      user: actor
    });
  }

  return false;
}

async function handleUsers(request, response, pathname) {
  if (pathname === "/api/users/resolve-login" && request.method === "GET") {
    if (!requireSupabase(response) || !requireServiceRole(response)) return true;
    const url = new URL(request.url, `http://${request.headers.host}`);
    const email = await resolveLoginEmail(url.searchParams.get("login"));
    return sendJson(response, 200, email ? [{ email }] : []);
  }

  if (pathname === "/api/users" && request.method === "GET") {
    if (!requireSupabase(response) || !requireServiceRole(response)) return true;
    const actor = await getRequestActor(request);
    policies.assertAllowed(policies.canManageUsers(actor), "Only Admin or Manager users can load users.");
    const viewer = policies.normalizeUser(actor);
    const scope = policies.isAdmin(viewer) ? "" : `&customer_id=eq.${encodeFilterValue(viewer.customerId)}`;
    const upstream = await supabaseFetch(`/rest/v1/profiles?select=*&order=created_at.asc${scope}`, {}, true);
    return proxyJson(response, upstream);
  }

  if (pathname === "/api/users" && request.method === "POST") {
    if (!requireSupabase(response) || !requireServiceRole(response)) return true;
    const actor = await getRequestActor(request);
    const body = await getRequestBody(request);
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || email).trim();
    const password = String(body.password || "");
    const role = body.role || "Technician";
    if (!email || !password) return sendError(response, 400, "Email and password are required.");
    policies.assertAllowed(policies.canManageUsers(actor), "Only Admin or Manager users can create users.");
    policies.assertAllowed(policies.canCreateUserRole(actor, role), `A ${actor.role} user cannot create a ${role} user.`);
    policies.assertAllowed(policies.canManageUserScope(actor, {
      role,
      customer_id: body.customer_id || "",
      location_id: body.location_id || ""
    }), "This user can only create users inside their allowed customer/location scope.");

    const userResponse = await supabaseFetch("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { name }
      })
    }, true);
    if (!userResponse.ok) return proxyJson(response, userResponse);
    const created = await userResponse.json();
    const profile = {
      id: created.id || created.user?.id,
      email,
      name,
      display_name: name,
      role,
      customer_id: body.customer_id || "",
      location_id: body.location_id || ""
    };
    const profileResponse = await supabaseFetch("/rest/v1/profiles?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(profile)
    }, true);
    return proxyJson(response, profileResponse);
  }

  const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch && ["GET", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    if (!requireSupabase(response) || !requireServiceRole(response)) return true;
    const actor = await getRequestActor(request);
    const userId = encodeURIComponent(userMatch[1]);
    if (request.method === "GET") {
      policies.assertAllowed(policies.canManageUsers(actor), "Only Admin or Manager users can load user records.");
      const scope = policies.isAdmin(actor) ? "" : `&customer_id=eq.${encodeFilterValue(actor.customerId)}`;
      const upstream = await supabaseFetch(`/rest/v1/profiles?id=eq.${userId}&select=*&limit=1${scope}`, {}, true);
      return proxyJson(response, upstream);
    }
    if (request.method === "DELETE") {
      policies.assertAllowed(policies.isAdmin(actor), "Only Admin users can delete users.");
      const upstream = await supabaseFetch(`/rest/v1/profiles?id=eq.${userId}`, { method: "DELETE" }, true);
      return proxyJson(response, upstream);
    }
    const body = await getRequestBody(request);
    policies.assertAllowed(policies.canManageUsers(actor), "Only Admin or Manager users can update users.");
    policies.assertAllowed(policies.canCreateUserRole(actor, body.role || "Technician"), `A ${actor.role} user cannot assign that role.`);
    policies.assertAllowed(policies.canManageUserScope(actor, body), "This user can only update users inside their allowed customer/location scope.");
    const upstream = await supabaseFetch("/rest/v1/profiles?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ ...body, id: userMatch[1] })
    }, true);
    return proxyJson(response, upstream);
  }

  return false;
}

async function handlePublicReports(request, response, pathname) {
  if (pathname === "/api/public/reports" && request.method === "GET") {
    if (!requireSupabase(response)) return true;
    const actor = await getRequestActor(request);
    policies.assertAllowed(policies.canManageTickets(actor, {}), "Only Admin or Manager users can load public reports.");
    const scopeFilters = actorDataScope(actor, "service_requests").join("&");
    const upstream = await supabaseFetch(`/rest/v1/public_reports?select=id,equipment_id,customer_id,customer_name,location_id,location_name,equipment_name,note,contact,photo_data_url,photo_name,created_at&order=created_at.desc&limit=50${scopeFilters ? `&${scopeFilters}` : ""}`);
    return proxyJson(response, upstream);
  }

  if (pathname === "/api/public/reports" && request.method === "POST") {
    if (!requireSupabase(response)) return true;
    const body = await getRequestBody(request);
    const upstream = await supabaseFetch("/rest/v1/public_reports?select=id", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body)
    });
    return proxyJson(response, upstream);
  }

  return false;
}

async function handleSharedState(request, response, pathname) {
  const match = pathname.match(/^\/api\/sync\/shared-state\/([^/]+)$/);
  if (!match || !["GET", "PUT"].includes(request.method)) return false;
  if (!requireSupabase(response) || !requireServiceRole(response)) return true;
  const actor = await getRequestActor(request);
  policies.assertAllowed(policies.isAdmin(actor) || policies.isManager(actor), "Only Admin or Manager users can access shared state.");

  const stateId = encodeURIComponent(match[1]);
  if (request.method === "GET") {
    const upstream = await supabaseFetch(`/rest/v1/app_state?id=eq.${stateId}&select=data,updated_at`, {}, true);
    return proxyJson(response, upstream);
  }

  const body = await getRequestBody(request);
  const upstream = await supabaseFetch("/rest/v1/app_state?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(body)
  }, true);
  return proxyJson(response, upstream);
}

async function handleData(request, response, pathname) {
  const batchMatch = pathname.match(/^\/api\/data\/([^/]+)\/batch$/);
  const deleteMatch = pathname.match(/^\/api\/data\/([^/]+)\/delete$/);
  const peekMatch = pathname.match(/^\/api\/data\/([^/]+)\/peek$/);
  const tableMatch = pathname.match(/^\/api\/data\/([^/]+)$/);
  const table = normalizeTable(batchMatch?.[1] || deleteMatch?.[1] || peekMatch?.[1] || tableMatch?.[1]);
  if (!table) return false;
  if (!requireSupabase(response) || !requireServiceRole(response)) return true;
  const actor = await getRequestActor(request);

  if (tableMatch && request.method === "GET") {
    policies.assertAllowed(policies.canAccessTable(actor, table, "read"), `This user cannot read ${table}.`);
    const url = new URL(request.url, `http://${request.headers.host}`);
    const query = await buildScopedTableQuery(table, actor, {
      order: url.searchParams.get("order") || "updated_at.asc"
    });
    const upstream = await supabaseFetch(query, {}, true);
    return proxyJson(response, upstream);
  }

  if (peekMatch && request.method === "GET") {
    policies.assertAllowed(policies.canAccessTable(actor, table, "read"), `This user cannot check ${table}.`);
    const url = new URL(request.url, `http://${request.headers.host}`);
    const timestampColumn = String(url.searchParams.get("timestampColumn") || "updated_at").replace(/[^a-z0-9_]/gi, "");
    const query = await buildScopedTableQuery(table, actor, {
      select: `id,${timestampColumn}`,
      order: `${timestampColumn}.desc`,
      limit: 1
    });
    const upstream = await supabaseFetch(query, {}, true);
    return proxyJson(response, upstream);
  }

  if (batchMatch && request.method === "POST") {
    policies.assertAllowed(policies.canAccessTable(actor, table, "write"), `This user cannot write ${table}.`);
    const body = await getRequestBody(request);
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return sendJson(response, 200, { ok: true, saved: 0 });
    await assertRowsMatchActorScope(actor, table, rows);
    const upstream = await supabaseFetch(`/rest/v1/${table}?on_conflict=id`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(rows)
    }, true);
    return proxyJson(response, upstream);
  }

  if (deleteMatch && request.method === "POST") {
    policies.assertAllowed(policies.canAccessTable(actor, table, "delete"), `This user cannot delete ${table}.`);
    const body = await getRequestBody(request);
    const column = String(body.column || "id").replace(/[^a-z0-9_]/gi, "");
    const values = Array.isArray(body.values) ? body.values.filter(Boolean) : [];
    if (!values.length) return sendJson(response, 200, { ok: true, deleted: 0 });
    const filter = values.map((value) => encodeURIComponent(value)).join(",");
    const scopeFilters = table === "pm_history" ? [] : actorDataScope(actor, table);
    const upstream = await supabaseFetch(`/rest/v1/${table}?${column}=in.(${filter})${scopeFilters.length ? `&${scopeFilters.join("&")}` : ""}`, { method: "DELETE" }, true);
    return proxyJson(response, upstream);
  }

  return false;
}

async function handleFiles(request, response, pathname) {
  if (pathname === "/api/files/signed-url" && request.method === "POST") {
    if (!requireSupabase(response) || !requireServiceRole(response)) return true;
    const actor = await getRequestActor(request);
    policies.assertAllowed(policies.canAccessTable(actor, "asset_files", "read"), "This user cannot view files.");

    const body = await getRequestBody(request);
    const path = normalizeStoragePath(body.path || body.storageKey || body.storage_key);
    const bucket = String(body.bucket || SUPABASE_STORAGE_BUCKET).trim() || SUPABASE_STORAGE_BUCKET;
    const customerId = body.customerId || body.customer_id || "";
    const locationId = body.locationId || body.location_id || "";
    const expiresIn = normalizeSignedUrlExpires(body.expiresIn || body.expires_in);

    if (!path) return sendError(response, 400, "A storage path is required.");
    if (!policies.isAdmin(actor)) {
      policies.assertAllowed(customerId, "Customer context is required to create a signed file link.");
      policies.assertAllowed(policies.canSeeLocation(actor, locationId, customerId), "This file is outside the user's customer/location scope.");
    }

    const upstream = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ expiresIn })
    });
    if (!upstream.ok) return proxyJson(response, upstream);
    const result = await upstream.json().catch(() => ({}));
    const signedPath = result.signedURL || result.signedUrl || "";
    return sendJson(response, 200, {
      bucket,
      path,
      storageKey: path,
      expiresIn,
      signedUrl: signedPath ? `${SUPABASE_URL}/storage/v1${signedPath}` : "",
      data: result
    });
  }

  if (pathname !== "/api/files" || request.method !== "POST") return false;
  if (!requireSupabase(response) || !requireServiceRole(response)) return true;
  const actor = await getRequestActor(request);
  policies.assertAllowed(policies.canAccessTable(actor, "asset_files", "write"), "This user cannot upload files.");

  const rawBody = await getRawRequestBody(request);
  const { fields, files } = parseMultipartFormData(request, rawBody);
  const file = files[0];
  validateUpload(file);

  const folder = fields.folder || "uploads";
  const path = buildStoragePath(file, folder);
  const upstream = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": file.type,
      "x-upsert": "false"
    },
    body: file.buffer
  });

  if (!upstream.ok) return proxyJson(response, upstream);

  return sendJson(response, 201, {
    name: file.name,
    type: file.type,
    size: file.size,
    bucket: SUPABASE_STORAGE_BUCKET,
    path,
    storageKey: path,
    storage_key: path,
    url: `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${encodeURI(path)}`,
    publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${encodeURI(path)}`,
    public_url: `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${encodeURI(path)}`,
    accessMode: "signed-url-ready",
    ownerType: fields.ownerType || fields.owner_type || "",
    ownerId: fields.ownerId || fields.owner_id || "",
    customerId: fields.customerId || fields.customer_id || actor.customerId || "",
    locationId: fields.locationId || fields.location_id || actor.locationId || "",
    kind: fields.kind || "upload",
    uploadedBy: actor.id || actor.email || "server"
  });
}

async function handleEmail(request, response, pathname) {
  const emailMatch = pathname.match(/^\/api\/email\/(ticket|service-request|assignment)$/);
  if (!emailMatch || request.method !== "POST") return false;

  const actor = await getRequestActor(request);
  const body = await getRequestBody(request);
  const to = String(body.to || "").trim();
  const sourceReport = body.issue || body.ticket || body.serviceRequest || body.report || {};
  const kind = emailMatch[1];
  const defaults = {
    ticket: {
      reportTitle: "Ticket PDF Email",
      footerLabel: "SiteWorks Ticket"
    },
    "service-request": {
      reportTitle: "Service Request PDF Email",
      footerLabel: "SiteWorks Service Request"
    },
    assignment: {
      reportTitle: "Assignment Notice",
      footerLabel: "SiteWorks Assignment"
    }
  }[kind];
  const issue = normalizeIssueReport(sourceReport, defaults);

  policies.assertAllowed(
    policies.canManageTickets(actor, issue) || policies.canWorkOnTicket(actor, issue),
    "This user cannot send email for this ticket or service request."
  );

  const result = await sendResendEmail({ to, issue });
  return sendJson(response, 200, {
    ok: true,
    id: result?.id || "",
    data: result,
    pdfStatus: "attached",
    message: "Email sent by the SiteWorks server with a PDF attachment."
  });
}

async function handleRequest(request, response) {
  try {
    if (request.method === "OPTIONS") return sendJson(response, 204, {});
    const url = new URL(request.url, `http://${request.headers.host}`);
    const pathname = url.pathname;

    if (pathname === "/api/health") {
      return sendJson(response, 200, {
        ok: true,
        service: "SiteWorks API shim",
        supabaseConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
        serviceRoleConfigured: Boolean(SUPABASE_SERVICE_ROLE_KEY),
        emailConfigured: Boolean(RESEND_API_KEY),
        policyLayer: "enabled",
        authMode: ALLOW_DEV_AUTH_HEADERS ? "dev-headers-enabled" : "supabase-bearer-token",
        devAuthHeadersEnabled: ALLOW_DEV_AUTH_HEADERS,
        maxUploadBytes: MAX_UPLOAD_BYTES,
        signedUrlExpiresSeconds: SIGNED_URL_EXPIRES_SECONDS,
        allowedUploadTypes: [...ALLOWED_UPLOAD_TYPES]
      });
    }

    const handled = await handleAuth(request, response, pathname)
      || await handleUsers(request, response, pathname)
      || await handlePublicReports(request, response, pathname)
      || await handleSharedState(request, response, pathname)
      || await handleData(request, response, pathname)
      || await handleFiles(request, response, pathname)
      || await handleEmail(request, response, pathname);

    if (!handled) sendError(response, 404, "Route not found.");
  } catch (error) {
    sendError(response, error.status || 500, error.message || "Server error.");
  }
}

if (require.main === module) {
  http.createServer(handleRequest).listen(PORT, () => {
    console.log(`SiteWorks API shim listening on http://localhost:${PORT}`);
  });
}

module.exports = {
  buildIssuePdfAttachment,
  normalizeIssueReport
};
