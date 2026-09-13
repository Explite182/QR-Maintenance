const http = require("http");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { createHash, createHmac, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } = require("crypto");
const policies = require("./siteworks-policies");

const PORT = Number(process.env.PORT || 8787);
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const db = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "siteworks-files";
const SUPABASE_STORAGE_PUBLIC_URLS = process.env.SUPABASE_STORAGE_PUBLIC_URLS === "true";
const LOCAL_FILE_STORAGE_DIR = path.resolve(process.env.LOCAL_FILE_STORAGE_DIR || path.join(__dirname, "siteworks-files"));
const LOCAL_AUTH_TOKEN_TTL_SECONDS = Number(process.env.LOCAL_AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 7);
const LOCAL_AUTH_SECRET = process.env.LOCAL_AUTH_SECRET || SUPABASE_SERVICE_ROLE_KEY || DATABASE_URL || "siteworks-local-auth-dev-secret";
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
  "estimates",
  "pm_history",
  "asset_files",
  "preferred_contractors",
  "inventory_items",
  "keys",
  "key_logs",
  "site_maps",
  "monitoring_devices",
  "monitoring_channels",
  "monitoring_events",
  "monitoring_alerts"
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
  try {
    const upstream = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`
      }
    });
    if (!upstream.ok) return null;
    return upstream.json().catch(() => null);
  } catch (error) {
    console.warn("Supabase auth lookup skipped.", error?.message || error);
    return null;
  }
}

async function loadProfileForAuthUser(userId) {
  if (!userId || !SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const upstream = await supabaseFetch(
      `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
      {},
      true
    );
    if (!upstream.ok) return null;
    const rows = await upstream.json().catch(() => []);
    return Array.isArray(rows) ? rows[0] || null : null;
  } catch (error) {
    console.warn("Supabase profile lookup skipped.", error?.message || error);
    return null;
  }
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlJson(value) {
  return base64UrlEncode(JSON.stringify(value));
}

function signLocalAuthPayload(encodedPayload) {
  return createHmac("sha256", LOCAL_AUTH_SECRET).update(encodedPayload).digest("base64url");
}

function localAuthTokenForProfile(profile) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    typ: "siteworks-local-auth",
    sub: profile.id,
    email: profile.email || "",
    iat: now,
    exp: now + LOCAL_AUTH_TOKEN_TTL_SECONDS
  };
  const encodedPayload = base64UrlJson(payload);
  return `swl_${encodedPayload}.${signLocalAuthPayload(encodedPayload)}`;
}

function verifyLocalAuthToken(token = "") {
  const cleanToken = String(token || "").trim();
  if (!cleanToken.startsWith("swl_")) return null;
  const [encodedPayload, signature] = cleanToken.slice(4).split(".");
  if (!encodedPayload || !signature) return null;
  const expected = signLocalAuthPayload(encodedPayload);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (payload.typ !== "siteworks-local-auth") return null;
    if (Number(payload.exp || 0) <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function hashLocalPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(String(password || ""), salt, 210000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function verifyLocalPassword(password, record) {
  if (!record?.password_hash || !record?.password_salt) return false;
  const { hash } = hashLocalPassword(password, record.password_salt);
  const expected = Buffer.from(record.password_hash, "hex");
  const actual = Buffer.from(hash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function ensureLocalAuthSchema() {
  if (!db) return false;
  await db.query(`
    CREATE TABLE IF NOT EXISTS local_auth_users (
      profile_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      password_salt text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  return true;
}

function profileFromRow(row = {}) {
  if (!row?.id) return null;
  return policies.normalizeUser({
    id: row.id,
    email: row.email || "",
    name: row.name || row.display_name || row.email || "",
    role: row.role || "Customer",
    customer_id: row.customer_id || "",
    location_id: row.location_id || ""
  });
}

async function loadLocalProfileById(profileId) {
  if (!db || !profileId) return null;
  const result = await db.query("SELECT * FROM profiles WHERE id = $1 LIMIT 1", [profileId]);
  return profileFromRow(result.rows[0]);
}

async function findLocalProfileForLogin(login) {
  if (!db) return null;
  const value = String(login || "").trim().toLowerCase();
  if (!value) return null;
  const result = await db.query(
    "SELECT * FROM profiles WHERE lower(email) = $1 OR lower(name) = $1 LIMIT 1",
    [value]
  );
  return profileFromRow(result.rows[0]);
}

async function loadLocalActorFromToken(token) {
  const payload = verifyLocalAuthToken(token);
  if (!payload?.sub) return null;
  return loadLocalProfileById(payload.sub);
}

async function signInLocalUser(login, password) {
  if (!db) return null;
  await ensureLocalAuthSchema();
  const profile = await findLocalProfileForLogin(login);
  if (!profile?.id) return null;
  const result = await db.query(
    "SELECT * FROM local_auth_users WHERE profile_id = $1 OR lower(email) = lower($2) LIMIT 1",
    [profile.id, profile.email || login]
  );
  const authRecord = result.rows[0];
  if (!verifyLocalPassword(password, authRecord)) return null;
  const accessToken = localAuthTokenForProfile(profile);
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: LOCAL_AUTH_TOKEN_TTL_SECONDS,
    expires_at: Math.floor(Date.now() / 1000) + LOCAL_AUTH_TOKEN_TTL_SECONDS,
    user: {
      id: profile.id,
      email: profile.email,
      user_metadata: { name: profile.name }
    },
    profile
  };
}

async function setLocalUserPassword(login, password) {
  if (!db) {
    const error = new Error("PostgreSQL is not configured on this server.");
    error.status = 500;
    throw error;
  }
  const cleanPassword = String(password || "");
  if (cleanPassword.length < 8) {
    const error = new Error("Password must be at least 8 characters.");
    error.status = 400;
    throw error;
  }
  await ensureLocalAuthSchema();
  const profile = await findLocalProfileForLogin(login);
  if (!profile?.id || !profile.email) {
    const error = new Error("No matching profile was found for that login.");
    error.status = 404;
    throw error;
  }
  const passwordRecord = hashLocalPassword(cleanPassword);
  await db.query(`
    INSERT INTO local_auth_users (profile_id, email, password_hash, password_salt, updated_at)
    VALUES ($1, $2, $3, $4, now())
    ON CONFLICT (profile_id)
    DO UPDATE SET email = EXCLUDED.email,
      password_hash = EXCLUDED.password_hash,
      password_salt = EXCLUDED.password_salt,
      updated_at = now()
  `, [profile.id, profile.email, passwordRecord.hash, passwordRecord.salt]);
  return profile;
}

async function changeLocalUserPassword(actor, currentPassword, newPassword) {
  if (!db) {
    const error = new Error("PostgreSQL is not configured on this server.");
    error.status = 500;
    throw error;
  }
  if (!actor?.id) {
    const error = new Error("Login required.");
    error.status = 401;
    throw error;
  }
  const cleanNewPassword = String(newPassword || "");
  if (cleanNewPassword.length < 8) {
    const error = new Error("Password must be at least 8 characters.");
    error.status = 400;
    throw error;
  }
  await ensureLocalAuthSchema();
  const result = await db.query("SELECT * FROM local_auth_users WHERE profile_id = $1 LIMIT 1", [actor.id]);
  const authRecord = result.rows[0];
  if (!verifyLocalPassword(currentPassword, authRecord)) {
    const error = new Error("Current password is incorrect.");
    error.status = 403;
    throw error;
  }
  const passwordRecord = hashLocalPassword(cleanNewPassword);
  await db.query(`
    UPDATE local_auth_users
    SET password_hash = $2,
      password_salt = $3,
      updated_at = now()
    WHERE profile_id = $1
  `, [actor.id, passwordRecord.hash, passwordRecord.salt]);
  return true;
}

function publicProfileRow(row = {}) {
  if (!row) return null;
  return {
    id: row.id || "",
    email: row.email || "",
    name: row.name || "",
    role: row.role || "Customer",
    customer_id: row.customer_id || "",
    location_id: row.location_id || "",
    created_at: row.created_at || "",
    updated_at: row.updated_at || ""
  };
}

async function upsertLocalProfile(profile) {
  const result = await db.query(`
    INSERT INTO profiles (id, email, name, role, customer_id, location_id, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, now()), now())
    ON CONFLICT (id)
    DO UPDATE SET email = EXCLUDED.email,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      customer_id = EXCLUDED.customer_id,
      location_id = EXCLUDED.location_id,
      updated_at = now()
    RETURNING id, email, name, role, customer_id, location_id, created_at, updated_at
  `, [
    profile.id || randomUUID(),
    profile.email,
    profile.name,
    profile.role || "Customer",
    profile.customer_id || "",
    profile.location_id || "",
    profile.created_at || null
  ]);
  return publicProfileRow(result.rows[0]);
}

async function createLocalAuthUser(profile, password) {
  const cleanPassword = String(password || "");
  if (cleanPassword.length < 8) {
    const error = new Error("Password must be at least 8 characters.");
    error.status = 400;
    throw error;
  }
  await ensureLocalAuthSchema();
  const passwordRecord = hashLocalPassword(cleanPassword);
  await db.query(`
    INSERT INTO local_auth_users (profile_id, email, password_hash, password_salt, updated_at)
    VALUES ($1, $2, $3, $4, now())
    ON CONFLICT (profile_id)
    DO UPDATE SET email = EXCLUDED.email,
      password_hash = EXCLUDED.password_hash,
      password_salt = EXCLUDED.password_salt,
      updated_at = now()
  `, [profile.id, profile.email, passwordRecord.hash, passwordRecord.salt]);
}

async function getRequestActor(request) {
  const devActor = getDevHeaderActor(request);
  if (devActor) return devActor;

  const token = getBearerToken(request);
  const localActor = await loadLocalActorFromToken(token);
  if (localActor) return localActor;

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
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Device-UID, X-API-Key",
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

function publicStorageUrl(path) {
  if (!SUPABASE_STORAGE_PUBLIC_URLS || !path) return "";
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${encodeURI(path)}`;
}

function localFileUrl(request, storagePath) {
  const proto = request.headers["x-forwarded-proto"] || "http";
  const host = request.headers["x-forwarded-host"] || request.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}/api/files/local/${storagePath.split("/").map(encodeURIComponent).join("/")}`;
}

function resolveLocalStoragePath(storagePath) {
  const cleanPath = normalizeStoragePath(storagePath);
  if (!cleanPath) {
    const error = new Error("A storage path is required.");
    error.status = 400;
    throw error;
  }
  const target = path.resolve(LOCAL_FILE_STORAGE_DIR, cleanPath);
  if (!target.startsWith(`${LOCAL_FILE_STORAGE_DIR}${path.sep}`)) {
    const error = new Error("Storage path is outside the local file store.");
    error.status = 400;
    throw error;
  }
  return { cleanPath, target };
}

function contentTypeForPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".heic") return "image/heic";
  if (extension === ".heif") return "image/heif";
  if (extension === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

function isLocalRequest(request) {
  const address = request.socket?.remoteAddress || "";
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);
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

async function sendResendMessage({ to, subject, html, text }) {
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
    subject: String(subject || "SiteWorks Email").trim() || "SiteWorks Email",
    html: String(html || "").trim() || `<p>${escapeHtml(text || "SiteWorks email")}</p>`,
    text: String(text || "").trim() || String(subject || "SiteWorks email")
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

function requireDatabase(response) {
  if (db) return true;
  sendError(response, 500, "PostgreSQL is not configured on this server.");
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
  const localProfile = await findLocalProfileForLogin(value);
  if (localProfile?.email) return localProfile.email;

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

function quoteIdent(value) {
  const clean = String(value || "").replace(/[^a-z0-9_]/gi, "");
  if (!clean) throw new Error("Invalid SQL identifier.");
  return `"${clean.replace(/"/g, "\"\"")}"`;
}

function normalizeColumn(value, fallback = "id") {
  return String(value || fallback).replace(/[^a-z0-9_]/gi, "") || fallback;
}

function normalizeNfcUid(value = "") {
  return String(value || "").trim().toUpperCase().replace(/[^0-9A-F]/g, "");
}

function normalizeSelectColumns(select) {
  if (!select || select === "*") return ["*"];
  return String(select)
    .split(",")
    .map((column) => normalizeColumn(column.trim(), ""))
    .filter(Boolean);
}

function normalizeOrder(value, fallbackColumn = "updated_at") {
  const [rawColumn, rawDirection] = String(value || "").split(".");
  const column = normalizeColumn(rawColumn, fallbackColumn);
  const direction = String(rawDirection || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";
  return { column, direction };
}

function addParam(params, value) {
  params.push(value);
  return `$${params.length}`;
}

function coerceStructuredDbValue(table, column, value) {
  if (value == null) return value;
  const jsonColumns = {
    pm_templates: new Set(["items"]),
    pm_history: new Set(["completed_checks"]),
    estimates: new Set(["lines"]),
    site_maps: new Set(["image", "pins"]),
    monitoring_devices: new Set(["source_phases"]),
    monitoring_events: new Set(["payload"])
  };
  if (column === "data" || jsonColumns[table]?.has(column)) {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  return value;
}

function locationScopedStructuredTables() {
  return [
    "locations",
    "assets",
    "work_orders",
    "service_requests",
    "estimates",
    "asset_files",
    "inventory_items",
    "keys",
    "key_logs",
    "site_maps",
    "monitoring_devices",
    "monitoring_channels",
    "monitoring_events",
    "monitoring_alerts"
  ];
}

function addActorScopeWhere(where, params, actor, table) {
  const viewer = policies.normalizeUser(actor);
  if (policies.isAdmin(viewer) || table === "pm_templates") return;
  if (!viewer.customerId) {
    where.push(`id = ${addParam(params, "__siteworks_no_customer__")}`);
    return;
  }

  if (table === "customers") {
    where.push(`id = ${addParam(params, viewer.customerId)}`);
    return;
  }

  where.push(`customer_id = ${addParam(params, viewer.customerId)}`);
  if (viewer.locationId && locationScopedStructuredTables().includes(table)) {
    where.push(`location_id = ${addParam(params, viewer.locationId)}`);
  }
}

async function selectStructuredRows(table, actor, options = {}) {
  const params = [];
  const where = [];
  const selected = normalizeSelectColumns(options.select);
  const columns = selected[0] === "*" ? "*" : selected.map(quoteIdent).join(", ");

  if (table === "pm_history") {
    const assetIds = await scopedAssetIdsForActor(actor);
    if (Array.isArray(assetIds)) {
      if (!assetIds.length) where.push(`asset_id = ${addParam(params, "__siteworks_no_asset__")}`);
      else where.push(`asset_id = ANY(${addParam(params, assetIds)})`);
    }
  } else {
    addActorScopeWhere(where, params, actor, table);
  }

  const order = normalizeOrder(options.order || "updated_at.asc");
  const limit = Number(options.limit || 0);
  const sql = [
    `SELECT ${columns} FROM ${quoteIdent(table)}`,
    where.length ? `WHERE ${where.join(" AND ")}` : "",
    `ORDER BY ${quoteIdent(order.column)} ${order.direction}`,
    limit > 0 ? `LIMIT ${Math.floor(limit)}` : ""
  ].filter(Boolean).join(" ");

  const result = await db.query(sql, params);
  return result.rows;
}

function actorDataScope(actor, table) {
  const viewer = policies.normalizeUser(actor);
  if (policies.isAdmin(viewer)) return [];
  if (table === "pm_templates") return [];
  if (!viewer.customerId) return ["id=eq.__siteworks_no_customer__"];

  if (table === "customers") return [`id=eq.${encodeFilterValue(viewer.customerId)}`];

  const filters = [`customer_id=eq.${encodeFilterValue(viewer.customerId)}`];
  if (viewer.locationId && locationScopedStructuredTables().includes(table)) {
    filters.push(`location_id=eq.${encodeFilterValue(viewer.locationId)}`);
  }
  return filters;
}

async function scopedAssetIdsForActor(actor) {
  const viewer = policies.normalizeUser(actor);
  if (policies.isAdmin(viewer)) return null;
  if (!viewer.customerId) return [];
  if (!db) return [];
  const params = [viewer.customerId];
  const where = ["customer_id = $1"];
  if (viewer.locationId) {
    params.push(viewer.locationId);
    where.push(`location_id = $${params.length}`);
  }
  const result = await db.query(`SELECT id FROM assets WHERE ${where.join(" AND ")}`, params);
  return result.rows.map((row) => row.id).filter(Boolean);
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
    if (viewer.locationId && locationScopedStructuredTables().includes(table)) {
      policies.assertAllowed(rowLocationId === viewer.locationId, "This row is outside the user's location scope.");
    }
  });
}

async function upsertStructuredRows(table, rows) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row || {}).map((key) => normalizeColumn(key, "")).filter(Boolean)))];
  if (!columns.length) return 0;
  policies.assertAllowed(columns.includes("id"), "Structured rows require an id.");

  const params = [];
  const valueGroups = rows.map((row) => {
    const placeholders = columns.map((column) => addParam(params, coerceStructuredDbValue(table, column, row[column])));
    return `(${placeholders.join(", ")})`;
  });
  const updateColumns = columns.filter((column) => column !== "id");
  const conflictAction = updateColumns.length
    ? `DO UPDATE SET ${updateColumns.map((column) => `${quoteIdent(column)} = EXCLUDED.${quoteIdent(column)}`).join(", ")}`
    : "DO NOTHING";

  const sql = `
    INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")})
    VALUES ${valueGroups.join(", ")}
    ON CONFLICT (id) ${conflictAction}
  `;
  await db.query(sql, params);
  return rows.length;
}

async function deleteStructuredRows(table, actor, column, values) {
  const params = [];
  const where = [`${quoteIdent(column)} = ANY(${addParam(params, values)})`];

  if (table === "pm_history") {
    const assetIds = await scopedAssetIdsForActor(actor);
    if (Array.isArray(assetIds)) {
      if (!assetIds.length) where.push(`asset_id = ${addParam(params, "__siteworks_no_asset__")}`);
      else where.push(`asset_id = ANY(${addParam(params, assetIds)})`);
    }
  } else {
    addActorScopeWhere(where, params, actor, table);
  }

  const result = await db.query(`DELETE FROM ${quoteIdent(table)} WHERE ${where.join(" AND ")}`, params);
  return result.rowCount || 0;
}

async function handleAuth(request, response, pathname) {
  if (pathname === "/api/auth/local-password" && request.method === "POST") {
    if (!isLocalRequest(request)) return sendError(response, 403, "Local password setup can only run from the server.");
    const body = await getRequestBody(request);
    const profile = await setLocalUserPassword(body.login || body.email, body.password);
    return sendJson(response, 200, {
      ok: true,
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role
      }
    });
  }

  if (pathname === "/api/auth/login" && request.method === "POST") {
    const body = await getRequestBody(request);
    const login = body.login || body.email;
    const localSession = await signInLocalUser(login, body.password);
    if (localSession) return sendJson(response, 200, localSession);

    if (!requireSupabase(response)) return true;
    const email = await resolveLoginEmail(login);
    const upstream = await supabaseFetch("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password: body.password })
    });
    return proxyJson(response, upstream);
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    return sendJson(response, 200, { ok: true });
  }

  if (pathname === "/api/auth/change-password" && request.method === "POST") {
    const actor = await getRequestActor(request);
    const body = await getRequestBody(request);
    await changeLocalUserPassword(actor, body.currentPassword, body.newPassword);
    return sendJson(response, 200, { ok: true });
  }

  if (pathname === "/api/auth/me" && request.method === "GET") {
    const actor = await getRequestActor(request);
    return sendJson(response, 200, {
      mode: "server-local-auth",
      authenticated: Boolean(actor.id || actor.email),
      user: actor
    });
  }

  return false;
}

async function handleUsers(request, response, pathname) {
  if (pathname === "/api/users/resolve-login" && request.method === "GET") {
    if (!requireDatabase(response)) return true;
    const url = new URL(request.url, `http://${request.headers.host}`);
    const profile = await findLocalProfileForLogin(url.searchParams.get("login"));
    const email = profile?.email || "";
    return sendJson(response, 200, email ? [{ email }] : []);
  }

  if (pathname === "/api/users" && request.method === "GET") {
    if (!requireDatabase(response)) return true;
    const actor = await getRequestActor(request);
    policies.assertAllowed(policies.canManageUsers(actor), "Only Admin or Manager users can load users.");
    const viewer = policies.normalizeUser(actor);
    const params = [];
    const where = [];
    if (!policies.isAdmin(viewer)) {
      where.push(`customer_id = ${addParam(params, viewer.customerId)}`);
    }
    const result = await db.query(`
      SELECT id, email, name, role, customer_id, location_id, created_at, updated_at
      FROM profiles
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY created_at ASC
    `, params);
    return sendJson(response, 200, result.rows);
  }

  if (pathname === "/api/users" && request.method === "POST") {
    if (!requireDatabase(response)) return true;
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

    const existing = await db.query("SELECT id FROM profiles WHERE lower(email) = $1 LIMIT 1", [email]);
    if (existing.rows[0]?.id) return sendError(response, 409, "A user with that email already exists.");
    const profile = await upsertLocalProfile({
      id: body.id || randomUUID(),
      email,
      name,
      role,
      customer_id: body.customer_id || "",
      location_id: body.location_id || ""
    });
    await createLocalAuthUser(profile, password);
    return sendJson(response, 201, [profile]);
  }

  const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch && ["GET", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    if (request.method === "GET" && !requireDatabase(response)) return true;
    if (request.method !== "GET" && !requireDatabase(response)) return true;
    const actor = await getRequestActor(request);
    const userId = userMatch[1];
    if (request.method === "GET") {
      policies.assertAllowed(policies.canManageUsers(actor), "Only Admin or Manager users can load user records.");
      const viewer = policies.normalizeUser(actor);
      const params = [userId];
      const where = ["id = $1"];
      if (!policies.isAdmin(viewer)) {
        params.push(viewer.customerId);
        where.push(`customer_id = $${params.length}`);
      }
      const result = await db.query(`
        SELECT id, email, name, role, customer_id, location_id, created_at, updated_at
        FROM profiles
        WHERE ${where.join(" AND ")}
        LIMIT 1
      `, params);
      return sendJson(response, 200, result.rows);
    }
    if (request.method === "DELETE") {
      policies.assertAllowed(policies.isAdmin(actor), "Only Admin users can delete users.");
      const result = await db.query("DELETE FROM profiles WHERE id = $1 RETURNING id", [userId]);
      return sendJson(response, 200, { ok: true, deleted: result.rowCount || 0 });
    }
    const body = await getRequestBody(request);
    policies.assertAllowed(policies.canManageUsers(actor), "Only Admin or Manager users can update users.");
    policies.assertAllowed(policies.canCreateUserRole(actor, body.role || "Technician"), `A ${actor.role} user cannot assign that role.`);
    policies.assertAllowed(policies.canManageUserScope(actor, body), "This user can only update users inside their allowed customer/location scope.");
    const existing = await db.query("SELECT * FROM profiles WHERE id = $1 LIMIT 1", [userId]);
    if (!existing.rows[0]) return sendError(response, 404, "User not found.");
    const next = {
      id: userId,
      email: String(body.email || existing.rows[0].email || "").trim().toLowerCase(),
      name: String(body.name || existing.rows[0].name || body.email || "").trim(),
      role: body.role || existing.rows[0].role || "Customer",
      customer_id: body.customer_id ?? existing.rows[0].customer_id ?? "",
      location_id: body.location_id ?? existing.rows[0].location_id ?? "",
      created_at: existing.rows[0].created_at
    };
    const updated = await upsertLocalProfile(next);
    if (body.password) await createLocalAuthUser(updated, body.password);
    return sendJson(response, 200, [updated]);
  }

  return false;
}

async function handlePublicReports(request, response, pathname) {
  if (pathname === "/api/public/reports" && request.method === "GET") {
    if (!requireDatabase(response)) return true;
    const actor = await getRequestActor(request);
    policies.assertAllowed(policies.canManageTickets(actor, {}), "Only Admin or Manager users can load public reports.");
    const params = [];
    const where = [];
    const viewer = policies.normalizeUser(actor);
    if (!policies.isAdmin(viewer)) {
      policies.assertAllowed(viewer.customerId, "This user does not have a customer scope.");
      where.push(`customer_id = ${addParam(params, viewer.customerId)}`);
      if (viewer.locationId) where.push(`location_id = ${addParam(params, viewer.locationId)}`);
    }
    const result = await db.query(`
      SELECT id, equipment_id, customer_id, customer_name, location_id, location_name,
        equipment_name, note, contact, photo_data_url, photo_name, created_at
      FROM public_reports
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY created_at DESC
      LIMIT 50
    `, params);
    return sendJson(response, 200, result.rows);
  }

  if (pathname === "/api/public/reports" && request.method === "POST") {
    if (!requireDatabase(response)) return true;
    const body = await getRequestBody(request);
    const report = {
      id: body.id || randomUUID(),
      equipment_id: body.equipment_id || null,
      customer_id: body.customer_id || null,
      customer_name: body.customer_name || "",
      location_id: body.location_id || null,
      location_name: body.location_name || "",
      equipment_name: body.equipment_name || "",
      note: body.note || "",
      contact: body.contact || "",
      photo_data_url: body.photo_data_url || "",
      photo_name: body.photo_name || "",
      created_at: body.created_at || new Date().toISOString()
    };
    await db.query(`
      INSERT INTO public_reports (
        id, equipment_id, customer_id, customer_name, location_id, location_name,
        equipment_name, note, contact, photo_data_url, photo_name, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      report.id,
      report.equipment_id,
      report.customer_id,
      report.customer_name,
      report.location_id,
      report.location_name,
      report.equipment_name,
      report.note,
      report.contact,
      report.photo_data_url,
      report.photo_name,
      report.created_at
    ]);
    return sendJson(response, 201, [report]);
  }

  return false;
}

async function ensureEstimatesSchema() {
  if (!db) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS estimates (
      id uuid PRIMARY KEY,
      estimate_number text,
      work_order_id uuid,
      customer_id uuid,
      location_id uuid,
      asset_id uuid,
      title text,
      status text,
      valid_until date,
      customer_note text,
      lines jsonb NOT NULL DEFAULT '[]'::jsonb,
      approved_at timestamptz,
      approved_by text,
      declined_at timestamptz,
      declined_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      data jsonb NOT NULL DEFAULT '{}'::jsonb
    )
  `);
  const alters = [
    "ADD COLUMN IF NOT EXISTS estimate_number text",
    "ADD COLUMN IF NOT EXISTS work_order_id uuid",
    "ADD COLUMN IF NOT EXISTS customer_id uuid",
    "ADD COLUMN IF NOT EXISTS location_id uuid",
    "ADD COLUMN IF NOT EXISTS asset_id uuid",
    "ADD COLUMN IF NOT EXISTS title text",
    "ADD COLUMN IF NOT EXISTS status text",
    "ADD COLUMN IF NOT EXISTS valid_until date",
    "ADD COLUMN IF NOT EXISTS customer_note text",
    "ADD COLUMN IF NOT EXISTS lines jsonb NOT NULL DEFAULT '[]'::jsonb",
    "ADD COLUMN IF NOT EXISTS approved_at timestamptz",
    "ADD COLUMN IF NOT EXISTS approved_by text",
    "ADD COLUMN IF NOT EXISTS declined_at timestamptz",
    "ADD COLUMN IF NOT EXISTS declined_by text",
    "ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()",
    "ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()",
    "ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb"
  ];
  for (const alter of alters) {
    await db.query(`ALTER TABLE estimates ${alter}`);
  }
}

function publicQuoteTokenHash(token = "") {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

function safeTextCompare(a = "", b = "") {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (!left.length || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function publicQuoteTokenMatches(row = {}, token = "") {
  const data = row.data && typeof row.data === "object" ? row.data : {};
  const rawToken = data.publicToken || "";
  if (rawToken && safeTextCompare(rawToken, token)) return true;
  const hash = row.public_token_hash || data.publicTokenHash || "";
  return Boolean(hash && safeTextCompare(hash, publicQuoteTokenHash(token)));
}

function publicQuoteFromRow(row = {}) {
  const data = row.data && typeof row.data === "object" ? row.data : {};
  const lines = Array.isArray(row.lines) ? row.lines : Array.isArray(data.lines) ? data.lines : [];
  const lineAmount = (line) => Math.max(0, Number(line.quantity || 0)) * Math.max(0, Number(line.rate || 0));
  const requiredTotal = lines.reduce((sum, line) => line.optional ? sum : sum + lineAmount(line), 0);
  const fullTotal = lines.reduce((sum, line) => sum + lineAmount(line), 0);
  return {
    id: row.id,
    estimate_number: row.estimate_number || data.estimateNumber || "",
    title: row.title || data.title || "Estimate",
    status: row.status || data.status || "Sent",
    valid_until: row.valid_until || data.validUntil || "",
    customer_note: row.customer_note || data.customerNote || "",
    lines,
    required_total: Math.round(requiredTotal * 100) / 100,
    full_total: Math.round(fullTotal * 100) / 100,
    customer_name: row.customer_name || "",
    location_name: row.location_name || "",
    asset_name: row.asset_name || "",
    work_order_title: row.work_order_title || "",
    issue_number: row.issue_number || null,
    approved_at: row.approved_at || data.approvedAt || "",
    approved_by: row.approved_by || data.approvedBy || "",
    declined_at: row.declined_at || data.declinedAt || "",
    declined_by: row.declined_by || data.declinedBy || ""
  };
}

async function loadPublicQuoteRow(estimateId) {
  await ensureEstimatesSchema();
  const result = await db.query(`
    SELECT e.*,
      c.name AS customer_name,
      l.name AS location_name,
      a.name AS asset_name,
      w.title AS work_order_title,
      w.issue_number AS issue_number
    FROM estimates e
    LEFT JOIN customers c ON c.id::text = e.customer_id::text
    LEFT JOIN locations l ON l.id::text = e.location_id::text
    LEFT JOIN assets a ON a.id::text = e.asset_id::text
    LEFT JOIN work_orders w ON w.id::text = e.work_order_id::text
    WHERE e.id::text = $1
    LIMIT 1
  `, [estimateId]);
  return result.rows[0] || null;
}

async function handlePublicQuotes(request, response, pathname) {
  const quoteMatch = pathname.match(/^\/api\/public\/quotes\/([^/]+)$/);
  const responseMatch = pathname.match(/^\/api\/public\/quotes\/([^/]+)\/respond$/);
  const estimateId = quoteMatch?.[1] || responseMatch?.[1] || "";
  if (!estimateId) return false;
  if (!requireDatabase(response)) return true;

  if (quoteMatch && request.method === "GET") {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get("token") || "";
    const row = await loadPublicQuoteRow(estimateId);
    if (!row || !publicQuoteTokenMatches(row, token)) return sendError(response, 404, "Quote link not found.");
    return sendJson(response, 200, publicQuoteFromRow(row), { "Cache-Control": "no-store" });
  }

  if (responseMatch && request.method === "POST") {
    const body = await getRequestBody(request);
    const token = body.token || "";
    const row = await loadPublicQuoteRow(estimateId);
    if (!row || !publicQuoteTokenMatches(row, token)) return sendError(response, 404, "Quote link not found.");
    const status = body.status === "Declined" ? "Declined" : "Accepted";
    const actorName = String(body.name || "").trim();
    if (!actorName) return sendError(response, 400, "Name is required.");
    const now = new Date().toISOString();
    const data = row.data && typeof row.data === "object" ? row.data : {};
    const nextData = {
      ...data,
      status,
      updatedAt: now,
      publicResponseNote: String(body.note || "").trim(),
      publicRespondedAt: now
    };
    if (status === "Accepted") {
      nextData.approvedAt = now;
      nextData.approvedBy = actorName;
      nextData.declinedAt = "";
      nextData.declinedBy = "";
    } else {
      nextData.declinedAt = now;
      nextData.declinedBy = actorName;
      nextData.approvedAt = "";
      nextData.approvedBy = "";
    }
    await db.query(`
      UPDATE estimates
      SET status = $2,
        approved_at = $3,
        approved_by = $4,
        declined_at = $5,
        declined_by = $6,
        updated_at = $7,
        data = $8::jsonb
      WHERE id = $1
    `, [
      estimateId,
      status,
      status === "Accepted" ? now : null,
      status === "Accepted" ? actorName : "",
      status === "Declined" ? now : null,
      status === "Declined" ? actorName : "",
      now,
      JSON.stringify(nextData)
    ]);
    const updated = await loadPublicQuoteRow(estimateId);
    return sendJson(response, 200, publicQuoteFromRow(updated), { "Cache-Control": "no-store" });
  }

  return false;
}

function publicScheduleTokenMatches(schedule = {}, token = "") {
  const rawToken = schedule.token || schedule.publicToken || "";
  if (rawToken && safeTextCompare(rawToken, token)) return true;
  const hash = schedule.tokenHash || schedule.publicTokenHash || "";
  return Boolean(hash && safeTextCompare(hash, publicQuoteTokenHash(token)));
}

function publicScheduleFromRow(row = {}, visitId = "") {
  const data = row.data && typeof row.data === "object" ? row.data : {};
  const confirmations = data.scheduleConfirmations && typeof data.scheduleConfirmations === "object"
    ? data.scheduleConfirmations
    : {};
  const schedule = confirmations[visitId] || {};
  return {
    work_order_id: row.id,
    visit_id: visitId,
    issue_number: row.issue_number ? `SW-${String(row.issue_number).padStart(4, "0")}` : "",
    title: row.title || data.title || "Scheduled visit",
    status: schedule.status || "Scheduled",
    scheduled_at: schedule.scheduledAt || "",
    duration_minutes: schedule.durationMinutes || 60,
    assigned_user_name: schedule.assignedUserName || row.assigned_user_name || "",
    notes: schedule.notes || "",
    response_status: schedule.responseStatus || "",
    response_name: schedule.responseName || "",
    response_note: schedule.responseNote || "",
    responded_at: schedule.respondedAt || "",
    customer_name: row.customer_name || "",
    location_name: row.location_name || "",
    asset_name: row.asset_name || data.areaName || ""
  };
}

async function loadPublicScheduleRow(workOrderId) {
  const result = await db.query(`
    SELECT w.*,
      c.name AS customer_name,
      l.name AS location_name,
      a.name AS asset_name
    FROM work_orders w
    LEFT JOIN customers c ON c.id::text = w.customer_id::text
    LEFT JOIN locations l ON l.id::text = w.location_id::text
    LEFT JOIN assets a ON a.id::text = w.asset_id::text
    WHERE w.id::text = $1
    LIMIT 1
  `, [workOrderId]);
  return result.rows[0] || null;
}

async function handlePublicSchedules(request, response, pathname) {
  const scheduleMatch = pathname.match(/^\/api\/public\/schedules\/([^/]+)\/([^/]+)$/);
  const responseMatch = pathname.match(/^\/api\/public\/schedules\/([^/]+)\/([^/]+)\/respond$/);
  const workOrderId = scheduleMatch?.[1] || responseMatch?.[1] || "";
  const visitId = scheduleMatch?.[2] || responseMatch?.[2] || "";
  if (!workOrderId || !visitId) return false;
  if (!requireDatabase(response)) return true;

  const url = new URL(request.url, `http://${request.headers.host}`);
  const body = request.method === "POST" ? await getRequestBody(request) : {};
  const token = request.method === "POST" ? body.token || "" : url.searchParams.get("token") || "";
  const row = await loadPublicScheduleRow(workOrderId);
  const data = row?.data && typeof row.data === "object" ? row.data : {};
  const confirmations = data.scheduleConfirmations && typeof data.scheduleConfirmations === "object"
    ? data.scheduleConfirmations
    : {};
  const schedule = confirmations[visitId] || {};
  if (!row || !schedule || !publicScheduleTokenMatches(schedule, token)) {
    return sendError(response, 404, "Schedule link not found.");
  }

  if (scheduleMatch && request.method === "GET") {
    return sendJson(response, 200, publicScheduleFromRow(row, visitId), { "Cache-Control": "no-store" });
  }

  if (responseMatch && request.method === "POST") {
    const responseStatus = ["Confirmed", "Change requested", "Cancelled"].includes(body.status)
      ? body.status
      : "Confirmed";
    const actorName = String(body.name || "").trim();
    if (!actorName) return sendError(response, 400, "Name is required.");
    const now = new Date().toISOString();
    const nextSchedule = {
      ...schedule,
      status: responseStatus === "Cancelled" ? "Cancelled" : schedule.status || "Scheduled",
      responseStatus,
      responseName: actorName,
      responseNote: String(body.note || "").trim(),
      respondedAt: now,
      updatedAt: now
    };
    const nextData = {
      ...data,
      scheduleConfirmations: {
        ...confirmations,
        [visitId]: nextSchedule
      }
    };
    await db.query(`
      UPDATE work_orders
      SET updated_at = $2,
        data = $3::jsonb
      WHERE id = $1
    `, [workOrderId, now, JSON.stringify(nextData)]);
    const updated = await loadPublicScheduleRow(workOrderId);
    return sendJson(response, 200, publicScheduleFromRow(updated, visitId), { "Cache-Control": "no-store" });
  }

  return false;
}

function publicKeyFromRow(row = {}) {
  const data = row.data && typeof row.data === "object" ? row.data : {};
  return {
    found: true,
    id: row.id,
    unique_tag_id: row.unique_tag_id || data.uniqueTagId || "",
    key_name: row.key_name || data.keyName || data.name || "",
    key_number: row.key_number || data.keyNumber || "",
    storage_location: row.storage_location || data.storageLocation || "",
    current_status: row.current_status || data.currentStatus || "Available",
    current_holder_name: row.current_holder_name || data.currentHolderName || "",
    default_checkout_hours: row.default_checkout_hours || data.defaultCheckoutHours || 24,
    due_back_at: row.due_back_at || data.dueBackAt || "",
    customer_id: row.customer_id || data.customerId || "",
    customer_name: row.customer_name || "",
    location_id: row.location_id || data.locationId || "",
    location_name: row.location_name || "",
    updated_at: row.updated_at || data.updatedAt || ""
  };
}

async function lookupPublicKeyRow(uid = "", keyId = "") {
  const normalizedUid = normalizeNfcUid(uid);
  const params = [];
  const where = [];
  if (keyId) where.push(`k.id = ${addParam(params, keyId)}`);
  if (normalizedUid) {
    where.push(`(
      regexp_replace(upper(coalesce(k.unique_tag_id, '')), '[^0-9A-F]', '', 'g') = ${addParam(params, normalizedUid)}
      OR regexp_replace(upper(coalesce(k.data->>'uniqueTagId', '')), '[^0-9A-F]', '', 'g') = ${addParam(params, normalizedUid)}
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(k.data->'additionalTagUids') = 'array' THEN k.data->'additionalTagUids'
            WHEN jsonb_typeof(k.data->'additional_tag_uids') = 'array' THEN k.data->'additional_tag_uids'
            ELSE '[]'::jsonb
          END
        ) tag(uid)
        WHERE regexp_replace(upper(tag.uid), '[^0-9A-F]', '', 'g') = ${addParam(params, normalizedUid)}
      )
    )`);
  }
  if (!where.length) return null;
  const result = await db.query(`
    SELECT k.*, c.name AS customer_name, l.name AS location_name
    FROM keys k
    LEFT JOIN customers c ON c.id = k.customer_id
    LEFT JOIN locations l ON l.id = k.location_id
    WHERE ${where.join(" AND ")}
    ORDER BY k.updated_at DESC
    LIMIT 1
  `, params);
  return result.rows[0] || null;
}

async function handlePublicKeys(request, response, pathname) {
  const lookupMatch = pathname.match(/^\/api\/public\/keys\/([^/]+)$/);
  if (lookupMatch && request.method === "GET") {
    if (!requireDatabase(response)) return true;
    const url = new URL(request.url, `http://${request.headers.host}`);
    const uid = decodeURIComponent(lookupMatch[1] || "");
    const keyId = url.searchParams.get("key_id") || url.searchParams.get("keyId") || "";
    const row = await lookupPublicKeyRow(uid === "lookup" ? "" : uid, keyId);
    if (!row) return sendJson(response, 200, { found: false, message: "No key record matched this tag." });
    return sendJson(response, 200, publicKeyFromRow(row));
  }

  if (pathname === "/api/public/keys/action" && request.method === "POST") {
    if (!requireDatabase(response)) return true;
    const body = await getRequestBody(request);
    const action = body.action === "Check-Out" ? "Check-Out" : "Check-In";
    const row = await lookupPublicKeyRow(body.tag_uid || body.uid || "", body.key_id || body.keyId || "");
    if (!row) return sendError(response, 404, "No key record matched this tag.");
    const now = new Date().toISOString();
    const holderName = String(body.holder_name || body.holderName || "").trim();
    const notes = String(body.notes || "").trim();
    const checkoutHours = Number(row.default_checkout_hours || row.data?.defaultCheckoutHours || 24);
    const dueBackAt = action === "Check-Out"
      ? new Date(Date.now() + Math.max(1, checkoutHours) * 60 * 60 * 1000).toISOString()
      : null;
    const nextStatus = action === "Check-Out" ? "Checked Out" : "Available";
    await db.query(`
      UPDATE keys
      SET current_status = $2,
        current_holder_name = $3,
        due_back_at = $4,
        updated_at = $5,
        data = coalesce(data, '{}'::jsonb) || $6::jsonb
      WHERE id = $1
    `, [
      row.id,
      nextStatus,
      action === "Check-Out" ? holderName : "",
      dueBackAt,
      now,
      JSON.stringify({
        currentStatus: nextStatus,
        currentHolderName: action === "Check-Out" ? holderName : "",
        dueBackAt: dueBackAt || "",
        updatedAt: now
      })
    ]);
    await db.query(`
      INSERT INTO key_logs (id, key_id, customer_id, location_id, user_name, action, notes, due_back_at, timestamp, data)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
    `, [
      randomUUID(),
      row.id,
      row.customer_id || null,
      row.location_id || null,
      holderName,
      action,
      notes,
      dueBackAt,
      now,
      JSON.stringify({ source: "public-key-scan", holderName, notes })
    ]);
    const updated = await lookupPublicKeyRow("", row.id);
    return sendJson(response, 200, publicKeyFromRow(updated || { ...row, current_status: nextStatus, current_holder_name: holderName, due_back_at: dueBackAt, updated_at: now }));
  }

  return false;
}

async function selectOptionalMonitoringRows(table, actor, options = {}) {
  try {
    const columnResult = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `, [table]);
    const columns = new Set(columnResult.rows.map((row) => row.column_name).filter(Boolean));
    if (!columns.size) return [];

    const params = [];
    const where = [];
    const viewer = policies.normalizeUser(actor);
    if (!policies.isAdmin(viewer)) {
      if (!viewer.customerId || !columns.has("customer_id")) return [];
      where.push(`customer_id = ${addParam(params, viewer.customerId)}`);
      if (viewer.locationId && columns.has("location_id")) {
        where.push(`location_id = ${addParam(params, viewer.locationId)}`);
      }
    }

    const requestedOrder = normalizeOrder(options.order || "updated_at.desc");
    const orderColumn = columns.has(requestedOrder.column)
      ? requestedOrder.column
      : columns.has("updated_at")
        ? "updated_at"
        : columns.has("created_at")
          ? "created_at"
          : "id";
    const limit = Number(options.limit || 0);
    const sql = [
      `SELECT * FROM ${quoteIdent(table)}`,
      where.length ? `WHERE ${where.join(" AND ")}` : "",
      columns.has(orderColumn) ? `ORDER BY ${quoteIdent(orderColumn)} ${requestedOrder.direction}` : "",
      limit > 0 ? `LIMIT ${Math.floor(limit)}` : ""
    ].filter(Boolean).join(" ");
    const result = await db.query(sql, params);
    return result.rows;
  } catch (error) {
    if (error?.code === "42P01" || /does not exist/i.test(String(error?.message || ""))) return [];
    throw error;
  }
}

async function handleMonitoring(request, response, pathname) {
  if (
    (pathname === "/api/breaker-monitor/heartbeat" || pathname === "/api/breaker-monitor/ingest")
    && request.method === "GET"
  ) {
    return sendJson(response, 200, {
      ok: true,
      endpoint: "SiteWorks breaker monitor heartbeat",
      method: "POST",
      requiredHeaders: ["X-Device-UID", "X-API-Key"]
    }, { "Cache-Control": "no-store" });
  }

  if (
    (pathname === "/api/breaker-monitor/heartbeat" || pathname === "/api/breaker-monitor/ingest")
    && request.method === "POST"
  ) {
    if (!requireDatabase(response)) return true;
    return handleMonitoringHeartbeat(request, response);
  }

  if (pathname !== "/api/breaker-monitor/status" || request.method !== "GET") return false;
  if (!requireDatabase(response)) return true;
  const actor = await getRequestActor(request);
  policies.assertAllowed(Boolean(actor.id || actor.email), "Login required.");
  const [devices, channels, events] = await Promise.all([
    selectOptionalMonitoringRows("monitoring_devices", actor, { order: "updated_at.desc" }),
    selectOptionalMonitoringRows("monitoring_channels", actor, { order: "circuit_number.asc" }),
    selectOptionalMonitoringRows("monitoring_events", actor, { order: "created_at.desc", limit: 50 })
  ]);
  return sendJson(response, 200, { devices, channels, events });
}

async function verifyMonitoringApiKey(apiKey, apiKeyHash) {
  const cleanKey = String(apiKey || "").trim();
  const hash = String(apiKeyHash || "").trim();
  if (!cleanKey || !hash) return false;
  if (cleanKey === hash) return true;
  for (const expression of ["extensions.crypt($1, $2) = $2", "crypt($1, $2) = $2"]) {
    try {
      const result = await db.query(`SELECT ${expression} AS ok`, [cleanKey, hash]);
      if (result.rows[0]?.ok === true) return true;
    } catch (error) {
      if (error?.code !== "42883" && error?.code !== "3F000") throw error;
    }
  }
  return false;
}

function monitoringHeartbeatTimestamp(payload) {
  const raw = payload?.timestamp || payload?.received_at || payload?.receivedAt || "";
  const date = raw ? new Date(raw) : new Date();
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function monitoringPayloadInputChannels(payload) {
  const channels = payload?.inputs?.channels;
  return Array.isArray(channels) ? channels : [];
}

function monitoringPhysicalChannelIndex(value) {
  const text = String(value || "").trim().toUpperCase();
  if (/^DI\d+$/.test(text)) return Number(text.slice(2)) - 1;
  if (/^\d+$/.test(text)) return Number(text) - 1;
  return -1;
}

function monitoringPayloadSourcePhaseOk(payload, device, channel) {
  const phase = String(channel.source_phase || "A").trim() || "A";
  const payloadPhases = payload?.source_phases || payload?.sourcePhases || null;
  const devicePhases = device.source_phases || device.sourcePhases || null;
  const phases = payloadPhases && typeof payloadPhases === "object" ? payloadPhases : devicePhases;
  if (!phases || typeof phases !== "object") return true;
  const value = phases[phase];
  return value === undefined || value === null ? true : Boolean(value);
}

function deriveMonitoringHeartbeatState(payload, device, channel, rawState, receivedAt) {
  if (device.maintenance_mode || channel.monitoring_mode === "maintenance") {
    return { state: "maintenance-mode", firstAbsentAt: null };
  }
  if (channel.monitoring_mode === "disabled") {
    return { state: "disabled", firstAbsentAt: null };
  }
  if (!monitoringPayloadSourcePhaseOk(payload, device, channel)) {
    return { state: "upstream-power-loss", firstAbsentAt: null };
  }
  if (rawState === true) {
    return { state: "energized", firstAbsentAt: null };
  }

  const firstAbsentAt = channel.first_absent_at || receivedAt;
  const elapsedSeconds = (new Date(receivedAt).getTime() - new Date(firstAbsentAt).getTime()) / 1000;
  const alarmDelaySeconds = Number(channel.alarm_delay_seconds || 0);
  return {
    state: elapsedSeconds >= alarmDelaySeconds ? "suspected-trip" : "open",
    firstAbsentAt
  };
}

async function handleMonitoringHeartbeat(request, response) {
  const deviceUid = String(request.headers["x-device-uid"] || "").trim();
  const apiKey = String(request.headers["x-api-key"] || "").trim();
  if (!deviceUid || !apiKey) {
    return sendJson(response, 400, { ok: false, error: "X-Device-UID and X-API-Key headers are required." }, { "Cache-Control": "no-store" });
  }

  const payload = await getRequestBody(request);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return sendJson(response, 400, { ok: false, error: "A JSON heartbeat body is required." }, { "Cache-Control": "no-store" });
  }

  const deviceResult = await db.query("SELECT * FROM monitoring_devices WHERE device_uid = $1 LIMIT 1", [deviceUid]);
  const device = deviceResult.rows[0];
  const apiKeyOk = device ? await verifyMonitoringApiKey(apiKey, device.api_key_hash) : false;
  if (!device || !apiKeyOk) {
    return sendJson(response, 401, { ok: false, error: "unknown device or invalid api key" }, { "Cache-Control": "no-store" });
  }

  const receivedAt = monitoringHeartbeatTimestamp(payload);
  const deviceData = {
    ...(device.data && typeof device.data === "object" ? device.data : {}),
    last_payload: payload,
    rawPayloads: [
      { receivedAt, payload },
      ...((Array.isArray(device.data?.rawPayloads) ? device.data.rawPayloads : []).slice(0, 9))
    ]
  };

  await db.query(
    `UPDATE monitoring_devices
     SET online_status = 'online',
         health_status = COALESCE($2, $3, health_status),
         source_phases = COALESCE($4::jsonb, source_phases),
         firmware_version = COALESCE($5, firmware_version),
         last_seen_at = $6,
         updated_at = now(),
         data = $7::jsonb
     WHERE id = $1`,
    [
      device.id,
      payload.health_status || null,
      payload.device_health_status || null,
      payload.source_phases || payload.sourcePhases ? JSON.stringify(payload.source_phases || payload.sourcePhases) : null,
      payload.firmware_version || payload.firmwareVersion || null,
      receivedAt,
      JSON.stringify(deviceData)
    ]
  );

  const inputs = monitoringPayloadInputChannels(payload);
  const channelResult = await db.query("SELECT * FROM monitoring_channels WHERE device_id = $1 ORDER BY circuit_number ASC", [device.id]);
  let changedChannels = 0;

  for (const channel of channelResult.rows) {
    const inputIndex = monitoringPhysicalChannelIndex(channel.physical_channel);
    if (inputIndex < 0 || inputIndex >= inputs.length) continue;
    const rawState = Boolean(inputs[inputIndex]);
    const previousRaw = channel.last_raw_state;
    const previousState = channel.last_derived_state || "";
    const derived = deriveMonitoringHeartbeatState(payload, device, channel, rawState, receivedAt);
    const nextData = {
      ...(channel.data && typeof channel.data === "object" ? channel.data : {}),
      last_payload_received_at: receivedAt
    };

    await db.query(
      `UPDATE monitoring_channels
       SET last_raw_state = $2,
           last_derived_state = $3,
           first_absent_at = $4,
           updated_at = now(),
           data = $5::jsonb
       WHERE id = $1`,
      [channel.id, rawState, derived.state, derived.firstAbsentAt, JSON.stringify(nextData)]
    );

    if (previousRaw !== rawState || previousState !== derived.state) {
      changedChannels += 1;
      await db.query(
        `INSERT INTO monitoring_events (
          customer_id, location_id, device_id, channel_id, panel_asset_id,
          circuit_number, event_type, previous_state, new_state, payload, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
        [
          device.customer_id,
          device.location_id,
          device.id,
          channel.id,
          device.panel_asset_id,
          channel.circuit_number,
          "channel-state",
          previousState,
          derived.state,
          JSON.stringify({
            physical_channel: channel.physical_channel,
            raw_state: rawState,
            source_phase: channel.source_phase
          }),
          receivedAt
        ]
      );
    }
  }

  await db.query(
    `INSERT INTO monitoring_events (
      customer_id, location_id, device_id, panel_asset_id, event_type, payload, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
    [device.customer_id, device.location_id, device.id, device.panel_asset_id, "device-status", JSON.stringify(payload), receivedAt]
  );

  console.info("Breaker monitor heartbeat received.", {
    deviceUid,
    deviceId: device.id,
    channelCount: channelResult.rows.length,
    changedChannels,
    receivedAt
  });

  return sendJson(response, 200, {
    ok: true,
    device_id: device.id,
    received_at: receivedAt,
    channel_count: channelResult.rows.length,
    changed_channels: changedChannels
  }, { "Cache-Control": "no-store" });
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

function canAccessStructuredTable(actor, table, action = "read") {
  if (table === "estimates") {
    if (action === "delete") return policies.isAdmin(actor) || policies.isManager(actor);
    return policies.canAccessTable(actor, "work_orders", action);
  }
  return policies.canAccessTable(actor, table, action);
}

async function handleData(request, response, pathname) {
  const batchMatch = pathname.match(/^\/api\/data\/([^/]+)\/batch$/);
  const deleteMatch = pathname.match(/^\/api\/data\/([^/]+)\/delete$/);
  const peekMatch = pathname.match(/^\/api\/data\/([^/]+)\/peek$/);
  const tableMatch = pathname.match(/^\/api\/data\/([^/]+)$/);
  const table = normalizeTable(batchMatch?.[1] || deleteMatch?.[1] || peekMatch?.[1] || tableMatch?.[1]);
  if (!table) return false;
  if (!requireDatabase(response)) return true;
  if (table === "estimates") await ensureEstimatesSchema();
  const actor = await getRequestActor(request);

  if (tableMatch && request.method === "GET") {
    policies.assertAllowed(canAccessStructuredTable(actor, table, "read"), `This user cannot read ${table}.`);
    const url = new URL(request.url, `http://${request.headers.host}`);
    const rows = await selectStructuredRows(table, actor, {
      order: url.searchParams.get("order") || "updated_at.asc"
    });
    return sendJson(response, 200, rows);
  }

  if (peekMatch && request.method === "GET") {
    policies.assertAllowed(canAccessStructuredTable(actor, table, "read"), `This user cannot check ${table}.`);
    const url = new URL(request.url, `http://${request.headers.host}`);
    const timestampColumn = String(url.searchParams.get("timestampColumn") || "updated_at").replace(/[^a-z0-9_]/gi, "");
    const rows = await selectStructuredRows(table, actor, {
      select: `id,${timestampColumn}`,
      order: `${timestampColumn}.desc`,
      limit: 1
    });
    return sendJson(response, 200, rows);
  }

  if (batchMatch && request.method === "POST") {
    policies.assertAllowed(canAccessStructuredTable(actor, table, "write"), `This user cannot write ${table}.`);
    const body = await getRequestBody(request);
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return sendJson(response, 200, { ok: true, saved: 0 });
    await assertRowsMatchActorScope(actor, table, rows);
    const saved = await upsertStructuredRows(table, rows);
    return sendJson(response, 200, { ok: true, saved });
  }

  if (deleteMatch && request.method === "POST") {
    policies.assertAllowed(canAccessStructuredTable(actor, table, "delete"), `This user cannot delete ${table}.`);
    const body = await getRequestBody(request);
    const column = normalizeColumn(body.column || "id");
    const values = Array.isArray(body.values) ? body.values.filter(Boolean) : [];
    if (!values.length) return sendJson(response, 200, { ok: true, deleted: 0 });
    const deleted = await deleteStructuredRows(table, actor, column, values);
    return sendJson(response, 200, { ok: true, deleted });
  }

  return false;
}

async function handleFiles(request, response, pathname) {
  const localFileMatch = pathname.match(/^\/api\/files\/local\/(.+)$/);
  if (localFileMatch && request.method === "GET") {
    const { cleanPath, target } = resolveLocalStoragePath(decodeURIComponent(localFileMatch[1]));
    try {
      const file = await fs.promises.readFile(target);
      response.writeHead(200, {
        "Content-Type": contentTypeForPath(target),
        "Content-Length": file.length,
        "Cache-Control": "private, max-age=3600",
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "X-SiteWorks-Storage-Key": cleanPath
      });
      response.end(file);
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return sendError(response, 404, "File not found.");
      throw error;
    }
  }

  if (pathname === "/api/files/signed-url" && request.method === "POST") {
    const actor = await getRequestActor(request);
    policies.assertAllowed(policies.canAccessTable(actor, "asset_files", "read"), "This user cannot view files.");

    const body = await getRequestBody(request);
    const path = normalizeStoragePath(body.path || body.storageKey || body.storage_key);
    const customerId = body.customerId || body.customer_id || "";
    const locationId = body.locationId || body.location_id || "";
    const expiresIn = normalizeSignedUrlExpires(body.expiresIn || body.expires_in);

    if (!path) return sendError(response, 400, "A storage path is required.");
    if (!policies.isAdmin(actor)) {
      policies.assertAllowed(customerId, "Customer context is required to create a signed file link.");
      policies.assertAllowed(policies.canSeeLocation(actor, locationId, customerId), "This file is outside the user's customer/location scope.");
    }

    return sendJson(response, 200, {
      bucket: "local",
      path,
      storageKey: path,
      expiresIn,
      signedUrl: localFileUrl(request, path),
      accessMode: "local-server"
    });
  }

  if (pathname !== "/api/files" || request.method !== "POST") return false;
  const actor = await getRequestActor(request);
  policies.assertAllowed(policies.canAccessTable(actor, "asset_files", "write"), "This user cannot upload files.");

  const rawBody = await getRawRequestBody(request);
  const { fields, files } = parseMultipartFormData(request, rawBody);
  const file = files[0];
  validateUpload(file);

  const folder = fields.folder || "uploads";
  const storagePath = buildStoragePath(file, folder);
  const localTarget = resolveLocalStoragePath(storagePath);
  await fs.promises.mkdir(path.dirname(localTarget.target), { recursive: true });
  await fs.promises.writeFile(localTarget.target, file.buffer, { flag: "wx" });
  const publicUrl = localFileUrl(request, localTarget.cleanPath);

  return sendJson(response, 201, {
    name: file.name,
    type: file.type,
    size: file.size,
    bucket: "local",
    storageBucket: "local",
    path: localTarget.cleanPath,
    storageKey: localTarget.cleanPath,
    storage_key: localTarget.cleanPath,
    url: publicUrl,
    publicUrl,
    public_url: publicUrl,
    accessMode: "local-server",
    ownerType: fields.ownerType || fields.owner_type || "",
    ownerId: fields.ownerId || fields.owner_id || "",
    customerId: fields.customerId || fields.customer_id || actor.customerId || "",
    locationId: fields.locationId || fields.location_id || actor.locationId || "",
    kind: fields.kind || "upload",
    uploadedBy: actor.id || actor.email || "server"
  });
}

async function handleEmail(request, response, pathname) {
  const emailMatch = pathname.match(/^\/api\/email\/(ticket|service-request|assignment|quote|schedule)$/);
  if (!emailMatch || request.method !== "POST") return false;

  const actor = await getRequestActor(request);
  const body = await getRequestBody(request);
  const to = String(body.to || "").trim();
  const kind = emailMatch[1];
  if (kind === "quote" || kind === "schedule") {
    const scope = normalizeIssueReport(body.scope || body.issue || body.ticket || {}, {
      reportTitle: kind === "quote" ? "Quote Email" : "Schedule Notice",
      footerLabel: kind === "quote" ? "SiteWorks Quote" : "SiteWorks Schedule"
    });
    policies.assertAllowed(
      policies.canManageTickets(actor, scope),
      kind === "quote" ? "This user cannot send email for this quote." : "This user cannot send email for this scheduled visit."
    );
    const result = await sendResendMessage({
      to,
      subject: body.subject || (kind === "quote" ? `SiteWorks Quote: ${scope.title}` : `SiteWorks Scheduled Visit: ${scope.title}`),
      html: body.html || "",
      text: body.text || ""
    });
    return sendJson(response, 200, {
      ok: true,
      id: result?.id || "",
      data: result,
      message: kind === "quote" ? "Quote email sent by the SiteWorks server." : "Schedule email sent by the SiteWorks server."
    });
  }

  const sourceReport = body.issue || body.ticket || body.serviceRequest || body.report || {};
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
        authMode: ALLOW_DEV_AUTH_HEADERS ? "dev-headers-enabled" : "local-postgres-with-supabase-fallback",
        devAuthHeadersEnabled: ALLOW_DEV_AUTH_HEADERS,
        maxUploadBytes: MAX_UPLOAD_BYTES,
        signedUrlExpiresSeconds: SIGNED_URL_EXPIRES_SECONDS,
        localFileStorageDir: LOCAL_FILE_STORAGE_DIR,
        fileStorageMode: "local-server",
        storagePublicUrlsEnabled: SUPABASE_STORAGE_PUBLIC_URLS,
        allowedUploadTypes: [...ALLOWED_UPLOAD_TYPES]
      });
    }

    const handled = await handleAuth(request, response, pathname)
      || await handleUsers(request, response, pathname)
      || await handleMonitoring(request, response, pathname)
      || await handlePublicReports(request, response, pathname)
      || await handlePublicQuotes(request, response, pathname)
      || await handlePublicSchedules(request, response, pathname)
      || await handlePublicKeys(request, response, pathname)
      || await handleSharedState(request, response, pathname)
      || await handleData(request, response, pathname)
      || await handleFiles(request, response, pathname)
      || await handleEmail(request, response, pathname);

    if (!handled) sendError(response, 404, "Route not found.");
  } catch (error) {
    console.error("SiteWorks API request failed.", {
      method: request.method,
      url: request.url,
      message: error?.message || String(error),
      code: error?.code || "",
      stack: error?.stack || ""
    });
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
