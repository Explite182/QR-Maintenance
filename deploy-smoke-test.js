const DEFAULT_BASE_URL = "http://localhost:8787";

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function fail(message, detail = "") {
  console.error(`SiteWorks deployment smoke test failed: ${message}`);
  if (detail) console.error(detail);
  process.exit(1);
}

function assertHealthFlag(health, key, expected = true) {
  if (health[key] !== expected) {
    fail(`Expected /api/health ${key} to be ${expected}.`, JSON.stringify(health, null, 2));
  }
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.SITEWORKS_API_TEST_URL || process.argv[2]);
  const healthUrl = `${baseUrl}/api/health`;
  console.log(`Checking SiteWorks API health at ${healthUrl}`);

  let response;
  try {
    response = await fetch(healthUrl, { headers: { Accept: "application/json" } });
  } catch (error) {
    fail("Could not reach the API health endpoint.", error.message);
  }

  if (!response.ok) {
    fail(`Health endpoint returned HTTP ${response.status}.`, await response.text().catch(() => ""));
  }

  const health = await response.json().catch(() => null);
  if (!health || typeof health !== "object") {
    fail("Health endpoint did not return JSON.");
  }

  assertHealthFlag(health, "ok", true);
  assertHealthFlag(health, "policyLayer", "enabled");

  const requiredKeys = [
    "supabaseConfigured",
    "serviceRoleConfigured",
    "emailConfigured",
    "authMode",
    "devAuthHeadersEnabled",
    "maxUploadBytes",
    "allowedUploadTypes"
  ];
  const missingKeys = requiredKeys.filter((key) => !(key in health));
  if (missingKeys.length) {
    fail(`Health response is missing: ${missingKeys.join(", ")}`, JSON.stringify(health, null, 2));
  }

  if (!Array.isArray(health.allowedUploadTypes) || !health.allowedUploadTypes.includes("application/pdf")) {
    fail("Health response does not list PDF as an allowed upload type.", JSON.stringify(health, null, 2));
  }

  if (!Number.isFinite(Number(health.maxUploadBytes)) || Number(health.maxUploadBytes) <= 0) {
    fail("Health response has an invalid maxUploadBytes value.", JSON.stringify(health, null, 2));
  }

  console.log("SiteWorks deployment smoke test passed.");
  console.log(`Backend mode: ${health.service || "SiteWorks API"}`);
  console.log(`Supabase configured: ${health.supabaseConfigured}`);
  console.log(`Service role configured: ${health.serviceRoleConfigured}`);
  console.log(`Email configured: ${health.emailConfigured}`);
  console.log(`Auth mode: ${health.authMode}`);
  if (health.devAuthHeadersEnabled) {
    console.warn("Warning: development auth headers are enabled. Turn ALLOW_DEV_AUTH_HEADERS off before production use.");
  }
  console.log(`Max upload bytes: ${health.maxUploadBytes}`);
}

main();
