const STORAGE_KEY = "qr-pm-prototype-v3";
const AUTO_BACKUP_KEY = "qr-pm-prototype-auto-backups-v1";
const MAX_AUTO_BACKUPS = 5;
const LEGACY_KEYS = ["qr-pm-prototype-v2", "qr-pm-prototype-v1"];
const SUPABASE_URL = "https://chpjmtfxmkcelszeixnu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_HduxX7ZCGdxQpT0xtDv7hQ_dVz_fAwr";
const SHARED_APP_STATE_ID = "main";
const AUTH_SESSION_KEY = "qr-maintenance-supabase-session-v1";
const INACTIVITY_LOGOUT_MS = 30 * 60 * 1000;
const today = new Date();
const DEFAULT_TEMPLATE_ITEMS = [
  "Visual inspection complete",
  "Cleaned and free of debris",
  "No leaks, damage, or abnormal noise",
  "Safety devices checked"
];

let state = normalizeState(loadState());
hydrateAssetFromHash();
let selectedId = getAssetIdFromUrl() || state.assets[0]?.id || null;
let selectedCustomerId = state.customers[0]?.id || "";
let selectedLocationId = "all";
let currentUser = getInitialUser();
let currentRole = currentUser?.role || "Customer";
let assetQuery = "";
let assetStatusFilter = "all";
let assetTemplateFilter = "all";
let assetSort = "due";
let assetPageSize = 25;
let assetPage = 1;
let selectedPrintAssetIds = new Set();
let workOrderViewFilter = "active";
let remoteReportsLoaded = false;
let remoteReportsLoading = false;
let lastRemoteReportsSyncAt = 0;
let lastActivityAt = Date.now();
let inactivityLogoutTimer = null;
let sharedStateReady = false;
let sharedStateLoading = false;
let sharedStateSaveTimer = null;
let applyingSharedState = false;
let structuredSyncTimer = null;
let structuredSyncActive = false;
let authProfilesLoaded = false;
let authProfilesLoading = false;
let lastAuthError = "";
let lastPublicReportError = "";

const els = {
  publicReportScreen: document.getElementById("publicReportScreen"),
  publicReportForm: document.getElementById("publicReportForm"),
  publicReportPhoto: document.getElementById("publicReportPhoto"),
  publicReportNote: document.getElementById("publicReportNote"),
  publicReportContact: document.getElementById("publicReportContact"),
  publicReportMessage: document.getElementById("publicReportMessage"),
  reportTitle: document.getElementById("reportTitle"),
  reportContext: document.getElementById("reportContext"),
  loginScreen: document.getElementById("loginScreen"),
  loginForm: document.getElementById("loginForm"),
  loginUsername: document.getElementById("loginUsername"),
  loginPassword: document.getElementById("loginPassword"),
  scanAccessBtn: document.getElementById("scanAccessBtn"),
  loginError: document.getElementById("loginError"),
  loginQrReportPrompt: document.getElementById("loginQrReportPrompt"),
  loginQrReportMessage: document.getElementById("loginQrReportMessage"),
  loginQrReportBtn: document.getElementById("loginQrReportBtn"),
  loginQrAreaReportBtn: document.getElementById("loginQrAreaReportBtn"),
  firstAdminForm: document.getElementById("firstAdminForm"),
  firstAdminUsername: document.getElementById("firstAdminUsername"),
  firstAdminName: document.getElementById("firstAdminName"),
  firstAdminPassword: document.getElementById("firstAdminPassword"),
  firstAdminMessage: document.getElementById("firstAdminMessage"),
  accessRequestForm: document.getElementById("accessRequestForm"),
  requestName: document.getElementById("requestName"),
  requestEmail: document.getElementById("requestEmail"),
  requestCompany: document.getElementById("requestCompany"),
  requestRole: document.getElementById("requestRole"),
  requestNotes: document.getElementById("requestNotes"),
  accessRequestMessage: document.getElementById("accessRequestMessage"),
  appOnly: document.querySelectorAll(".app-only"),
  adminToolsDrawer: document.getElementById("adminToolsDrawer"),
  quickAddDrawer: document.getElementById("quickAddDrawer"),
  setupDrawer: document.getElementById("setupDrawer"),
  backupDrawer: document.getElementById("backupDrawer"),
  dashboardPanel: document.querySelector(".dashboard-panel"),
  currentUserName: document.getElementById("currentUserName"),
  currentUserRole: document.getElementById("currentUserRole"),
  logoutBtn: document.getElementById("logoutBtn"),
  backupStatus: document.getElementById("backupStatus"),
  backupLocationBlock: document.getElementById("backupLocationBlock"),
  backupLocationForm: document.getElementById("backupLocationForm"),
  backupLocation: document.getElementById("backupLocation"),
  qrBaseUrlForm: document.getElementById("qrBaseUrlForm"),
  qrBaseUrl: document.getElementById("qrBaseUrl"),
  exportDataBtn: document.getElementById("exportDataBtn"),
  exportCompleteBackupBtn: document.getElementById("exportCompleteBackupBtn"),
  importDataBtn: document.getElementById("importDataBtn"),
  importDataInput: document.getElementById("importDataInput"),
  restoreBackupBtn: document.getElementById("restoreBackupBtn"),
  printReportLabelsBtn: document.getElementById("printReportLabelsBtn"),
  customerForm: document.getElementById("customerForm"),
  customerName: document.getElementById("customerName"),
  customerCount: document.getElementById("customerCount"),
  templateForm: document.getElementById("templateForm"),
  templateName: document.getElementById("templateName"),
  templateItems: document.getElementById("templateItems"),
  templateCount: document.getElementById("templateCount"),
  userForm: document.getElementById("userForm"),
  newUsername: document.getElementById("newUsername"),
  newUserName: document.getElementById("newUserName"),
  newUserPassword: document.getElementById("newUserPassword"),
  newUserRole: document.getElementById("newUserRole"),
  newUserCustomer: document.getElementById("newUserCustomer"),
  userCount: document.getElementById("userCount"),
  userList: document.getElementById("userList"),
  accessRequestCount: document.getElementById("accessRequestCount"),
  accessRequestList: document.getElementById("accessRequestList"),
  activityLogCount: document.getElementById("activityLogCount"),
  activityLogList: document.getElementById("activityLogList"),
  locationForm: document.getElementById("locationForm"),
  locationCustomer: document.getElementById("locationCustomer"),
  locationName: document.getElementById("locationName"),
  locationCount: document.getElementById("locationCount"),
  assetForm: document.getElementById("assetForm"),
  assetCustomer: document.getElementById("assetCustomer"),
  assetLocation: document.getElementById("assetLocation"),
  assetName: document.getElementById("assetName"),
  assetTemplate: document.getElementById("assetTemplate"),
  assetFrequency: document.getElementById("assetFrequency"),
  assetManufacturer: document.getElementById("assetManufacturer"),
  assetModel: document.getElementById("assetModel"),
  assetSerial: document.getElementById("assetSerial"),
  assetInstallDate: document.getElementById("assetInstallDate"),
  assetType: document.getElementById("assetType"),
  assetCriticality: document.getElementById("assetCriticality"),
  assetDocumentUrl: document.getElementById("assetDocumentUrl"),
  assetManualFile: document.getElementById("assetManualFile"),
  assetPhoto: document.getElementById("assetPhoto"),
  assetNotes: document.getElementById("assetNotes"),
  assetList: document.getElementById("assetList"),
  assetCount: document.getElementById("assetCount"),
  assetSearch: document.getElementById("assetSearch"),
  statusFilter: document.getElementById("statusFilter"),
  templateFilter: document.getElementById("templateFilter"),
  assetSort: document.getElementById("assetSort"),
  assetPageSize: document.getElementById("assetPageSize"),
  assetTableBody: document.getElementById("assetTableBody"),
  tableAssetCount: document.getElementById("tableAssetCount"),
  assetPageInfo: document.getElementById("assetPageInfo"),
  prevAssetPageBtn: document.getElementById("prevAssetPageBtn"),
  nextAssetPageBtn: document.getElementById("nextAssetPageBtn"),
  selectPageAssetsBtn: document.getElementById("selectPageAssetsBtn"),
  clearSelectedAssetsBtn: document.getElementById("clearSelectedAssetsBtn"),
  printSelectedLabelsBtn: document.getElementById("printSelectedLabelsBtn"),
  exportAssetRegisterBtn: document.getElementById("exportAssetRegisterBtn"),
  customerFilter: document.getElementById("customerFilter"),
  locationFilter: document.getElementById("locationFilter"),
  emptyState: document.getElementById("emptyState"),
  assetPanel: document.getElementById("assetPanel"),
  selectedLocation: document.getElementById("selectedLocation"),
  selectedAssetThumb: document.getElementById("selectedAssetThumb"),
  selectedName: document.getElementById("selectedName"),
  selectedMeta: document.getElementById("selectedMeta"),
  selectedBadges: document.getElementById("selectedBadges"),
  selectedQr: document.getElementById("selectedQr"),
  scanActionPanel: document.getElementById("scanActionPanel"),
  selectedTemplate: document.getElementById("selectedTemplate"),
  assetPhotoPanel: document.getElementById("assetPhotoPanel"),
  assetManualPanel: document.getElementById("assetManualPanel"),
  assetDetailsGrid: document.getElementById("assetDetailsGrid"),
  assetInfoForm: document.getElementById("assetInfoForm"),
  editAssetName: document.getElementById("editAssetName"),
  editAssetCustomer: document.getElementById("editAssetCustomer"),
  editAssetLocation: document.getElementById("editAssetLocation"),
  editAssetTemplate: document.getElementById("editAssetTemplate"),
  editAssetFrequency: document.getElementById("editAssetFrequency"),
  editAssetType: document.getElementById("editAssetType"),
  editAssetCriticality: document.getElementById("editAssetCriticality"),
  editAssetManufacturer: document.getElementById("editAssetManufacturer"),
  editAssetModel: document.getElementById("editAssetModel"),
  editAssetSerial: document.getElementById("editAssetSerial"),
  editAssetInstallDate: document.getElementById("editAssetInstallDate"),
  editAssetVendor: document.getElementById("editAssetVendor"),
  editAssetVendorContact: document.getElementById("editAssetVendorContact"),
  editAssetWarrantyDate: document.getElementById("editAssetWarrantyDate"),
  editAssetParts: document.getElementById("editAssetParts"),
  editAssetDocumentUrl: document.getElementById("editAssetDocumentUrl"),
  editAssetManualFile: document.getElementById("editAssetManualFile"),
  assetManualUploadStatus: document.getElementById("assetManualUploadStatus"),
  editAssetPhoto: document.getElementById("editAssetPhoto"),
  editAssetGalleryPhotos: document.getElementById("editAssetGalleryPhotos"),
  assetGalleryUploadStatus: document.getElementById("assetGalleryUploadStatus"),
  editAssetNotes: document.getElementById("editAssetNotes"),
  nextPm: document.getElementById("nextPm"),
  nextPmForm: document.getElementById("nextPmForm"),
  nextPmInput: document.getElementById("nextPmInput"),
  clearNextPmBtn: document.getElementById("clearNextPmBtn"),
  pmStatus: document.getElementById("pmStatus"),
  copyLinkBtn: document.getElementById("copyLinkBtn"),
  pmForm: document.getElementById("pmForm"),
  checklistFields: document.getElementById("checklistFields"),
  technician: document.getElementById("technician"),
  reading: document.getElementById("reading"),
  notes: document.getElementById("notes"),
  photoInput: document.getElementById("photoInput"),
  result: document.getElementById("result"),
  historyList: document.getElementById("historyList"),
  historyCount: document.getElementById("historyCount"),
  dueToday: document.getElementById("dueToday"),
  overdue: document.getElementById("overdue"),
  completed: document.getElementById("completed"),
  openWorkOrders: document.getElementById("openWorkOrders"),
  highPriorityIssues: document.getElementById("highPriorityIssues"),
  waitingPartsIssues: document.getElementById("waitingPartsIssues"),
  reportedIssues: document.getElementById("reportedIssues"),
  activeLocations: document.getElementById("activeLocations"),
  workOrderCount: document.getElementById("workOrderCount"),
  workOrderList: document.getElementById("workOrderList"),
  assetWorkOrderCount: document.getElementById("assetWorkOrderCount"),
  assetWorkOrderList: document.getElementById("assetWorkOrderList"),
  assetGalleryCount: document.getElementById("assetGalleryCount"),
  assetGalleryPanel: document.getElementById("assetGalleryPanel"),
  exportBtn: document.getElementById("exportBtn"),
  labelSheet: document.getElementById("labelSheet"),
  photoViewer: document.getElementById("photoViewer"),
  photoViewerImage: document.getElementById("photoViewerImage"),
  photoViewerCaption: document.getElementById("photoViewerCaption"),
  photoViewerClose: document.getElementById("photoViewerClose")
};

render();
window.setTimeout(syncLoginQrReportPrompt, 0);
window.setTimeout(syncLoginQrReportPrompt, 600);
setupInactivityLogout();
loadSupabaseProfiles();
loadSharedStateFromSupabase();
window.setInterval(syncPublicReportsFromSupabase, 30000);

window.addEventListener("hashchange", () => {
  hydrateAssetFromHash();
  restoreScannedAssetSelection();
  selectedId = getAssetIdFromUrl() || selectedId;
  syncFiltersToSelectedAsset();
  render();
});

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.loginError.textContent = "Signing in...";
  const user = await signInWithSupabase(els.loginUsername.value, els.loginPassword.value);

  if (!user) {
    const localUser = findUserForLogin(els.loginUsername.value, els.loginPassword.value);
    if (!localUser) {
      if (authProfilesLoaded && !hasSetupUsers()) {
        showFirstAdminSetup("No SiteWorks admin account exists yet. Create the first admin below.");
        return;
      }
      els.loginError.textContent = lastAuthError || "Email or password is incorrect.";
      return;
    }
    currentUser = localUser;
    currentRole = localUser.role;
    state.currentUserId = localUser.id;
    restoreScannedAssetSelection();
    saveState();
    els.loginForm.reset();
    els.loginError.textContent = "";
    render();
    return;
  }

  currentUser = user;
  currentRole = user.role;
  state.currentUserId = user.id;
  restoreScannedAssetSelection();
  saveState();
  els.loginForm.reset();
  els.loginError.textContent = "";
  render();
});

els.firstAdminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (hasSetupUsers()) return;
  const email = els.firstAdminUsername.value.trim().toLowerCase();
  const name = els.firstAdminName.value.trim() || email;
  const password = els.firstAdminPassword.value;
  if (!email || !password.trim()) {
    els.firstAdminMessage.textContent = "Enter an email and password.";
    return;
  }
  els.firstAdminMessage.textContent = "Creating admin...";
  const user = await signUpSupabaseUser(email, password, name, "Admin", "");
  if (!user) {
    if (lastAuthError.toLowerCase().includes("already")) {
      els.firstAdminMessage.textContent = "That email already exists in Supabase. Use the Log In form once and SiteWorks will attach the first Admin profile.";
      return;
    }
    els.firstAdminMessage.textContent = lastAuthError || "Could not create admin. If email confirmation is on, confirm the email and then log in.";
    return;
  }
  saveAuthSession(user.session);
  currentUser = user;
  currentRole = user.role;
  state.currentUserId = user.id;
  upsertLocalUser(user);
  addActivity("First admin created", email);
  saveState();
  els.firstAdminForm.reset();
  els.firstAdminMessage.textContent = "";
  render();
});

if (els.scanAccessBtn) {
  els.scanAccessBtn.addEventListener("click", () => {
    const user = getOrCreateCustomerAccessUser();
    currentUser = user;
    currentRole = user.role;
    state.currentUserId = user.id;
    saveState();
    els.loginForm.reset();
    els.loginError.textContent = "";
    render();
  });
}

if (els.loginQrReportBtn) {
  els.loginQrReportBtn.addEventListener("click", (event) => {
    if (els.loginQrReportBtn.getAttribute("href") === "#") {
      event.preventDefault();
      setLoginQrReportStatus(false);
    }
  });
}

if (els.loginQrAreaReportBtn) {
  els.loginQrAreaReportBtn.addEventListener("click", (event) => {
    if (els.loginQrAreaReportBtn.getAttribute("href") === "#") {
      event.preventDefault();
      setLoginQrReportStatus(false);
    }
  });
}

els.publicReportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = els.publicReportForm.querySelector("button[type='submit']");
  if (submitButton?.disabled) return;
  try {
    const report = getReportContext();
    if (!report) {
      els.publicReportMessage.textContent = "This QR report link is missing location or equipment details.";
      return;
    }
    submitButton.disabled = true;
    els.publicReportMessage.textContent = "Sending report...";
    const photo = await safeReadPublicReportPhoto(els.publicReportPhoto.files[0]);
    if (lastPublicReportError) {
      els.publicReportMessage.textContent = lastPublicReportError;
      return;
    }
    const note = els.publicReportNote.value.trim();
    const contact = els.publicReportContact.value.trim();
    const issue = createIssueFromPublicReport(report, note, contact, photo);
    const remoteId = await savePublicReportToSupabase(report, note, contact, photo);
    if (!remoteId) {
      els.publicReportMessage.textContent = lastPublicReportError || "Report was not sent. Please try again with a smaller photo or no photo.";
      return;
    }
    issue.remoteReportId = remoteId;
    state.workOrders.unshift(issue);
    addActivity("Public issue reported", issue.title);
    saveState();
    els.publicReportForm.reset();
    els.publicReportMessage.textContent = "Report sent to SiteWorks. Thank you.";
  } catch (error) {
    console.warn("Public report submit failed.", error);
    els.publicReportMessage.textContent = "Report was not sent. Try again with no photo first.";
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

els.publicReportNote.addEventListener("invalid", () => {
  els.publicReportMessage.textContent = "Add a quick note, then tap Send to Maintenance.";
});

els.accessRequestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = els.requestEmail.value.trim().toLowerCase();
  const existingOpenRequest = state.accessRequests.some((request) =>
    request.email.toLowerCase() === email && request.status === "Pending"
  );

  if (existingOpenRequest) {
    els.accessRequestMessage.textContent = "A request for that email is already pending.";
    return;
  }

  state.accessRequests.unshift({
    id: crypto.randomUUID(),
    name: els.requestName.value.trim(),
    email,
    company: els.requestCompany.value.trim(),
    role: els.requestRole.value,
    notes: els.requestNotes.value.trim(),
    status: "Pending",
    createdAt: new Date().toISOString()
  });
  addActivity("Access requested", `${els.requestName.value.trim()} requested ${els.requestRole.value} access.`);
  saveState();
  els.accessRequestForm.reset();
  els.accessRequestMessage.textContent = "Request sent. An admin can review it in Admin & Settings.";
});

els.logoutBtn.addEventListener("click", () => {
  logoutCurrentUser("manual");
});

function setupInactivityLogout() {
  ["pointerdown", "keydown", "input", "scroll", "touchstart"].forEach((eventName) => {
    document.addEventListener(eventName, resetInactivityLogoutTimer, { passive: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) resetInactivityLogoutTimer();
  });
  resetInactivityLogoutTimer();
}

function resetInactivityLogoutTimer() {
  lastActivityAt = Date.now();
  window.clearTimeout(inactivityLogoutTimer);
  if (!currentUser || isPublicReportUrl()) return;
  inactivityLogoutTimer = window.setTimeout(checkInactivityLogout, INACTIVITY_LOGOUT_MS);
}

function checkInactivityLogout() {
  if (!currentUser || isPublicReportUrl()) return;
  const inactiveFor = Date.now() - lastActivityAt;
  if (inactiveFor >= INACTIVITY_LOGOUT_MS) {
    logoutCurrentUser("inactivity");
    return;
  }
  inactivityLogoutTimer = window.setTimeout(checkInactivityLogout, INACTIVITY_LOGOUT_MS - inactiveFor);
}

function logoutCurrentUser(reason = "manual") {
  if (!currentUser) return;
  window.clearTimeout(inactivityLogoutTimer);

  addActivity(
    reason === "manual" ? "User logged out" : "Automatic logout",
    reason === "manual" ? "Signed out from the logout button." : "No activity for 30 minutes."
  );

  currentUser = null;
  currentRole = "Customer";
  state.currentUserId = "";
  clearAuthSession();
  if (!isQrAccessUrl()) {
    history.replaceState(null, "", getCurrentPageUrl());
  }
  saveState();
  render();
}

els.customerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canManageSetup()) return;
  const customer = {
    id: crypto.randomUUID(),
    name: els.customerName.value.trim(),
    createdAt: new Date().toISOString()
  };

  state.customers.push(customer);
  addActivity("Customer added", customer.name);
  selectedCustomerId = customer.id;
  selectedLocationId = "all";
  selectedId = null;
  saveState();
  els.customerForm.reset();
  render();
});

els.templateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canManageSetup()) return;
  const template = {
    id: crypto.randomUUID(),
    name: els.templateName.value.trim(),
    items: parseTemplateItems(els.templateItems.value),
    createdAt: new Date().toISOString()
  };

  state.templates.push(template);
  addActivity("Maintenance template added", template.name);
  saveState();
  els.templateForm.reset();
  render();
});

els.userForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!canManageSetup()) return;
  const username = els.newUsername.value.trim().toLowerCase();
  if (state.users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    alert("That email already exists.");
    return;
  }

  const newUserRole = els.newUserRole.value;
  const newUserCustomerId = newUserRole === "Admin" ? "" : els.newUserCustomer.value;
  const newUser = await signUpSupabaseUser(
    username,
    els.newUserPassword.value,
    els.newUserName.value.trim(),
    newUserRole,
    newUserCustomerId
  );
  if (!newUser) {
    alert("Could not create that user. Check that Supabase Auth allows email signups, then try again.");
    return;
  }
  upsertLocalUser(newUser);
  addActivity("User added", `${newUser.username} (${newUser.role})`);
  const sourceRequest = state.accessRequests.find((request) => request.id === els.userForm.dataset.requestId);
  if (sourceRequest) {
    sourceRequest.status = "Approved";
    sourceRequest.updatedAt = new Date().toISOString();
    addActivity("Access request approved", sourceRequest.email);
  }
  saveState();
  els.userForm.reset();
  delete els.userForm.dataset.requestId;
  render();
});

els.userList.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!canManageSetup()) return;
  const form = event.target.closest("form[data-user-id]");
  if (!form) return;
  const user = state.users.find((item) => item.id === form.dataset.userId);
  if (!user) return;

  const formData = new FormData(form);
  const username = String(formData.get("username") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const role = String(formData.get("role") || "Customer");
  const customerId = role === "Admin" ? "" : String(formData.get("customerId") || "");
  const duplicateUsername = state.users.some((item) =>
    item.id !== user.id && item.username.toLowerCase() === username.toLowerCase()
  );

  if (duplicateUsername) {
    alert("That username already exists.");
    return;
  }

  if (isLastAdmin(user) && role !== "Admin") {
    alert("At least one Admin user must remain.");
    return;
  }

  user.username = username;
  user.name = name;
  user.role = role;
  user.customerId = customerId;
  user.password = "";
  user.updatedAt = new Date().toISOString();
  await saveSupabaseProfile(user);
  if (currentUser?.id === user.id) {
    currentUser = user;
    currentRole = user.role;
  }
  addActivity("User updated", `${user.username} (${user.role})`);
  saveState();
  render();
});

els.userList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-user-action]");
  if (!button || !canManageSetup()) return;
  const user = state.users.find((item) => item.id === button.dataset.userId);
  if (!user) return;

  if (button.dataset.userAction === "delete") {
    if (currentUser?.id === user.id) {
      alert("You cannot delete the user you are currently logged in as.");
      return;
    }
    if (isLastAdmin(user)) {
      alert("At least one Admin user must remain.");
      return;
    }
    if (!confirm(`Delete user ${user.username}?`)) return;
    await deleteSupabaseProfile(user.id);
    addActivity("User deleted", `${user.username} (${user.role})`);
    state.users = state.users.filter((item) => item.id !== user.id);
    saveState();
    render();
  }
});

els.accessRequestList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-request-action]");
  if (!button || !canManageSetup()) return;
  const request = state.accessRequests.find((item) => item.id === button.dataset.requestId);
  if (!request) return;

  if (button.dataset.requestAction === "use") {
    els.newUsername.value = usernameFromEmail(request.email);
    els.newUserName.value = request.name;
    els.newUserRole.value = request.role;
    const matchedCustomer = state.customers.find((customer) =>
      customer.name.toLowerCase() === String(request.company || "").toLowerCase()
    );
    if (matchedCustomer) els.newUserCustomer.value = matchedCustomer.id;
    els.userForm.dataset.requestId = request.id;
    els.newUserPassword.focus();
  }

  if (button.dataset.requestAction === "dismiss") {
    request.status = "Dismissed";
    request.updatedAt = new Date().toISOString();
    addActivity("Access request dismissed", request.email);
    saveState();
    render();
  }
});

els.locationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canManageSetup()) return;
  const customerId = els.locationCustomer.value;
  const locationRecord = {
    id: crypto.randomUUID(),
    customerId,
    name: els.locationName.value.trim(),
    createdAt: new Date().toISOString()
  };

  state.locations.push(locationRecord);
  addActivity("Location added", `${locationRecord.name} for ${getCustomer(customerId)?.name || "customer"}`);
  selectedCustomerId = customerId;
  selectedLocationId = locationRecord.id;
  selectedId = null;
  saveState();
  els.locationForm.reset();
  render();
});

els.assetCustomer.addEventListener("change", () => {
  renderAssetLocationOptions();
});

els.editAssetCustomer.addEventListener("change", () => {
  renderEditAssetLocationOptions();
});

els.editAssetPhoto.addEventListener("change", async () => {
  const asset = getSelectedAsset();
  if (!asset || !canCompletePm() || !els.editAssetPhoto.files[0]) return;

  const replacementPhoto = await readPhoto(els.editAssetPhoto.files[0]);
  if (!replacementPhoto) return;
  asset.photo = replacementPhoto;
  addActivity("Equipment photo updated", asset.name);
  saveState();
  els.editAssetPhoto.value = "";
  render();
  openAssetEditor();
});

els.editAssetGalleryPhotos.addEventListener("change", async () => {
  const asset = getSelectedAsset();
  if (!asset || !canCompletePm() || !els.editAssetGalleryPhotos.files.length) return;

  const previousPhotos = [...(asset.photos || [])];
  try {
    setGalleryUploadStatus("Adding photos...");
    const galleryPhotos = await readPhotos(els.editAssetGalleryPhotos.files);
    if (!galleryPhotos.length) {
      setGalleryUploadStatus("No image files were selected.");
      return;
    }
    asset.photos = [...previousPhotos, ...galleryPhotos];
    addActivity("Equipment photos added", `${galleryPhotos.length} photo${galleryPhotos.length === 1 ? "" : "s"} added to ${asset.name}.`);
    saveState();
    els.editAssetGalleryPhotos.value = "";
    render();
    setGalleryUploadStatus(`${galleryPhotos.length} photo${galleryPhotos.length === 1 ? "" : "s"} added.`);
    scrollToAssetGallery();
  } catch {
    asset.photos = previousPhotos;
    els.editAssetGalleryPhotos.value = "";
    setGalleryUploadStatus("Photo was not saved. Try one smaller photo first.");
  }
});

els.editAssetManualFile.addEventListener("change", async () => {
  const asset = getSelectedAsset();
  if (!asset || !canCompletePm() || !els.editAssetManualFile.files[0]) return;

  const previousManual = asset.manualFile || null;
  try {
    setManualUploadStatus("Uploading PDF manual...");
    const manual = await readDocumentFile(els.editAssetManualFile.files[0], "application/pdf");
    if (!manual) {
      els.editAssetManualFile.value = "";
      return;
    }
    asset.manualFile = manual;
    addActivity("PDF manual uploaded", `${manual.name || "Manual"} for ${asset.name}`);
    saveState();
    els.editAssetManualFile.value = "";
    render();
    setManualUploadStatus("PDF manual uploaded.");
    scrollToAssetManual();
  } catch {
    asset.manualFile = previousManual;
    els.editAssetManualFile.value = "";
    setManualUploadStatus("PDF manual was not saved. Use the manual link field for this file.");
  }
});

els.assetPhotoPanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-view-photo]");
  if (!button) return;
  openPhotoViewer(button.dataset.photoSrc, button.dataset.photoCaption || "Equipment photo");
});

els.assetGalleryPanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-view-photo]");
  if (!button) return;
  openPhotoViewer(button.dataset.photoSrc, button.dataset.photoCaption || "Equipment photo");
});

els.historyList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-view-photo]");
  if (!button) return;
  openPhotoViewer(button.dataset.photoSrc, button.dataset.photoCaption || "PM evidence photo");
});

els.selectedAssetThumb.addEventListener("click", () => {
  const asset = getSelectedAsset();
  if (asset?.photo?.dataUrl) openPhotoViewer(asset.photo.dataUrl, asset.photo.name || "Equipment photo");
});

els.photoViewerClose.addEventListener("click", closePhotoViewer);

els.photoViewer.addEventListener("click", (event) => {
  if (event.target === els.photoViewer) closePhotoViewer();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.photoViewer.classList.contains("hidden")) {
    closePhotoViewer();
  }
});

els.assetSearch.addEventListener("input", () => {
  assetQuery = els.assetSearch.value.trim().toLowerCase();
  assetPage = 1;
  render();
});

els.statusFilter.addEventListener("change", () => {
  assetStatusFilter = els.statusFilter.value;
  assetPage = 1;
  render();
});

els.templateFilter.addEventListener("change", () => {
  assetTemplateFilter = els.templateFilter.value;
  assetPage = 1;
  render();
});

els.assetSort.addEventListener("change", () => {
  assetSort = els.assetSort.value;
  assetPage = 1;
  render();
});

els.assetPageSize.addEventListener("change", () => {
  assetPageSize = Number(els.assetPageSize.value);
  assetPage = 1;
  render();
});

document.querySelectorAll("[data-dashboard-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.dashboardFilter;
    const issueFilters = {
      workOrders: "active",
      highPriority: "highPriority",
      waitingParts: "waitingParts",
      reportedIssues: "reported"
    };
    if (issueFilters[filter]) {
      workOrderViewFilter = issueFilters[filter];
      assetSort = "workOrders";
      assetStatusFilter = "all";
      render();
      document.querySelector(".work-orders-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    } else {
      assetStatusFilter = filter;
      assetSort = filter === "all" ? "due" : assetSort;
    }
    assetPage = 1;
    render();
    document.querySelector(".asset-table-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

els.prevAssetPageBtn.addEventListener("click", () => {
  assetPage = Math.max(1, assetPage - 1);
  render();
});

els.nextAssetPageBtn.addEventListener("click", () => {
  const totalPages = getAssetTablePageCount();
  assetPage = Math.min(totalPages, assetPage + 1);
  render();
});

els.customerFilter.addEventListener("change", () => {
  selectedCustomerId = els.customerFilter.value;
  selectedLocationId = "all";
  selectedId = filteredAssets()[0]?.id || null;
  assetPage = 1;
  render();
});

els.locationFilter.addEventListener("change", () => {
  selectedLocationId = els.locationFilter.value;
  selectedId = filteredAssets()[0]?.id || null;
  assetPage = 1;
  render();
});

els.assetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!canManageSetup()) return;
  const photo = await readPhoto(els.assetPhoto.files[0]);
  const manualFile = await readDocumentFile(els.assetManualFile.files[0], "application/pdf");
  const asset = {
    id: crypto.randomUUID(),
    customerId: els.assetCustomer.value,
    locationId: els.assetLocation.value,
    templateId: els.assetTemplate.value,
    name: els.assetName.value.trim(),
    nextPmDate: "",
    manufacturer: els.assetManufacturer.value.trim(),
    model: els.assetModel.value.trim(),
    serial: els.assetSerial.value.trim(),
    installDate: els.assetInstallDate.value,
    type: els.assetType.value.trim(),
    criticality: els.assetCriticality.value,
    documentUrl: els.assetDocumentUrl.value.trim(),
    manualFile,
    notes: els.assetNotes.value.trim(),
    photo,
    frequencyDays: Number(els.assetFrequency.value),
    createdAt: new Date().toISOString(),
    history: []
  };

  state.assets.unshift(asset);
  addActivity("Asset added", asset.name);
  selectedId = asset.id;
  selectedCustomerId = asset.customerId;
  selectedLocationId = "all";
  saveState();
  els.assetForm.reset();
  els.assetFrequency.value = "30";
  location.hash = `asset/${asset.id}`;
  render();
});

els.pmForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const asset = getSelectedAsset();
  if (!asset || !canCompletePm()) return;

  const completedChecks = [...els.pmForm.querySelectorAll("input[name='checklist']:checked")]
    .map((input) => input.value);
  const photo = await readPhoto(els.photoInput.files[0]);
  const historyItem = {
    id: crypto.randomUUID(),
    completedAt: new Date().toISOString(),
    technician: els.technician.value.trim(),
    reading: els.reading.value.trim(),
    notes: els.notes.value.trim(),
    result: els.result.value,
    completedChecks,
    photo
  };

  asset.history.unshift(historyItem);
  addActivity("PM completed", `${asset.name} - ${historyItem.result}`);

  if (historyItem.result !== "Passed") {
    state.workOrders.unshift(createWorkOrderFromPm(asset, historyItem));
    addActivity("Work order created", `${asset.name} - ${historyItem.result}`);
  }

  saveState();
  els.pmForm.reset();
  render();
});

els.assetInfoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const asset = getSelectedAsset();
  if (!asset || !canCompletePm()) return;
  if (!canSeeCustomer(els.editAssetCustomer.value)) return;

  const replacementPhoto = await readPhoto(els.editAssetPhoto.files[0]);
  asset.name = els.editAssetName.value.trim();
  asset.customerId = els.editAssetCustomer.value;
  asset.locationId = els.editAssetLocation.value;
  asset.templateId = els.editAssetTemplate.value;
  asset.frequencyDays = Number(els.editAssetFrequency.value);
  asset.type = els.editAssetType.value.trim();
  asset.criticality = els.editAssetCriticality.value;
  asset.manufacturer = els.editAssetManufacturer.value.trim();
  asset.model = els.editAssetModel.value.trim();
  asset.serial = els.editAssetSerial.value.trim();
  asset.installDate = els.editAssetInstallDate.value;
  asset.vendor = els.editAssetVendor.value.trim();
  asset.vendorContact = els.editAssetVendorContact.value.trim();
  asset.warrantyDate = els.editAssetWarrantyDate.value;
  asset.parts = els.editAssetParts.value.trim();
  asset.documentUrl = els.editAssetDocumentUrl.value.trim();
  asset.notes = els.editAssetNotes.value.trim();
  if (replacementPhoto) asset.photo = replacementPhoto;

  addActivity("Asset updated", asset.name);
  saveState();
  syncFiltersToSelectedAsset();
  els.editAssetPhoto.value = "";
  location.hash = `asset/${asset.id}`;
  render();
});

els.nextPmForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const asset = getSelectedAsset();
  if (!asset || !canManageWorkOrders()) return;
  asset.nextPmDate = els.nextPmInput.value || "";
  addActivity("Next maintenance updated", `${asset.name} - ${asset.nextPmDate || "cleared"}`);
  saveState();
  render();
});

els.clearNextPmBtn.addEventListener("click", () => {
  const asset = getSelectedAsset();
  if (!asset || !canManageWorkOrders()) return;
  asset.nextPmDate = "";
  addActivity("Next maintenance cleared", asset.name);
  saveState();
  render();
});

els.copyLinkBtn.addEventListener("click", async () => {
  const asset = getSelectedAsset();
  if (!asset) return;
  await copyText(getAssetUrl(asset.id));
  els.copyLinkBtn.textContent = "Copied";
  setTimeout(() => {
    els.copyLinkBtn.textContent = "Copy Scan Link";
  }, 1200);
});

els.exportBtn.addEventListener("click", () => {
  const asset = getSelectedAsset();
  if (!asset) return;
  downloadCsv(asset);
});

els.selectPageAssetsBtn.addEventListener("click", () => {
  getCurrentAssetTablePageAssets().forEach((asset) => selectedPrintAssetIds.add(asset.id));
  renderAssetTable();
});

els.clearSelectedAssetsBtn.addEventListener("click", () => {
  selectedPrintAssetIds.clear();
  renderAssetTable();
});

els.printSelectedLabelsBtn.addEventListener("click", () => {
  const selectedAssets = selectedAssetsForPrinting();
  if (!selectedAssets.length) {
    alert("Select at least one equipment row to print.");
    return;
  }
  renderLabels(selectedAssets);
  window.print();
});

els.printReportLabelsBtn.addEventListener("click", () => {
  const selectedAssets = selectedAssetsForPrinting();
  if (!selectedAssets.length) {
    alert("Select at least one equipment row to print report QRs.");
    return;
  }
  renderReportLabels(selectedAssets);
  window.print();
});

els.qrBaseUrlForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.qrBaseUrl = normalizeBaseUrl(els.qrBaseUrl.value);
  addActivity("QR scan URL updated", state.qrBaseUrl);
  saveState();
  render();
});

els.backupLocationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (currentRole !== "Admin") return;
  state.backupLocation = els.backupLocation.value.trim() || defaultBackupLocation();
  addActivity("Backup location updated", state.backupLocation);
  saveState();
  render();
});

els.exportAssetRegisterBtn.addEventListener("click", () => {
  downloadAssetRegisterCsv(assetTableAssets());
});

els.exportDataBtn.addEventListener("click", () => {
  exportDataBackup();
});

els.exportCompleteBackupBtn.addEventListener("click", () => {
  exportCompleteBackup();
});

els.importDataBtn.addEventListener("click", () => {
  els.importDataInput.click();
});

els.importDataInput.addEventListener("change", async () => {
  const file = els.importDataInput.files[0];
  if (!file) return;
  await importDataBackup(file);
  els.importDataInput.value = "";
});

els.restoreBackupBtn.addEventListener("click", () => {
  restoreLatestAutoBackup();
});

document.addEventListener("click", (event) => {
  const scrollButton = event.target.closest("[data-scroll-target]");
  if (scrollButton) {
    document.getElementById(scrollButton.dataset.scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const button = event.target.closest("[data-work-order-action]");
  if (!button || !canManageWorkOrders()) return;
  const workOrder = getWorkOrder(button.dataset.workOrderId);
  if (!workOrder) return;

  workOrder.status = button.dataset.workOrderAction;
  if (workOrder.status === "Resolved" || workOrder.status === "Closed") {
    workOrder.resolvedAt = new Date().toISOString();
  }
  if (workOrder.status !== "Closed") {
    workOrder.resolvedAt = workOrder.status === "Resolved" ? workOrder.resolvedAt : "";
  }
  workOrder.updatedAt = new Date().toISOString();
  addActivity("Work order updated", `${workOrder.assetName} - ${workOrder.status}`);
  saveState();
  render();
});

function render() {
  renderAuth();
  if (isPublicReportUrl()) {
    renderPublicReport();
    return;
  }
  if (!currentUser) return;
  resetInactivityLogoutTimer();
  restoreScannedAssetSelection();
  syncPublicReportsFromSupabase();
  ensureSelection();
  renderUsers();
  renderAccessRequests();
  renderActivityLog();
  renderCustomerOptions();
  renderTemplateOptions();
  renderLocationOptions();
  renderAssetLocationOptions();
  renderDashboard();
  renderBackupStatus();
  renderQrSettings();
  renderAssetTableControls();
  renderAssetTable();
  renderWorkOrders();
  renderAssetList();

  const asset = getSelectedAsset();
  els.customerCount.textContent = state.customers.length;
  els.templateCount.textContent = state.templates.length;
  els.locationCount.textContent = state.locations.length;
  els.assetCount.textContent = filteredAssets().length;
  els.emptyState.innerHTML = renderEmptyStateContent(asset);
  els.emptyState.classList.toggle("hidden", Boolean(asset));
  els.assetPanel.classList.toggle("hidden", !asset);
  renderRole();

  if (!asset) return;

  const customer = getCustomer(asset.customerId);
  const locationRecord = getLocation(asset.locationId);
  const template = getTemplate(asset.templateId);
  const due = getDueInfo(asset);
  els.selectedLocation.textContent = `${customer?.name || "Unknown customer"} | ${locationRecord?.name || "Unknown location"}`;
  els.selectedName.textContent = asset.name;
  els.selectedMeta.textContent = `Equipment ID ${asset.id.slice(0, 8)} | Every ${asset.frequencyDays} days`;
  els.selectedBadges.innerHTML = renderAssetBadges(asset, due);
  els.selectedAssetThumb.innerHTML = renderAssetThumbnail(asset);
  els.selectedTemplate.textContent = template?.name || "Template missing";
  els.selectedQr.innerHTML = `<img alt="QR code for ${escapeHtml(asset.name)}" src="${qrUrl(getAssetUrl(asset.id))}">`;
  els.scanActionPanel.innerHTML = renderScanActionPanel(asset);
  els.nextPm.textContent = formatDate(due.nextDate);
  els.nextPmInput.value = asset.nextPmDate || toDateInputValue(due.nextDate);
  els.clearNextPmBtn.disabled = !asset.nextPmDate || !canManageWorkOrders();
  els.pmStatus.textContent = due.label;
  els.pmStatus.className = due.className;
  els.assetPhotoPanel.innerHTML = renderAssetPhoto(asset);
  els.assetManualPanel.innerHTML = renderAssetManual(asset);
  els.assetDetailsGrid.innerHTML = renderAssetDetails(asset);
  renderAssetInfoForm(asset);
  renderChecklist(template);
  renderAssetWorkOrders(asset);
  renderAssetGallery(asset);
  renderRole();

  if (els.historyCount) els.historyCount.textContent = asset.history.length;
  els.historyList.innerHTML = asset.history.length
    ? asset.history.map(renderHistoryItem).join("")
    : `<p class="muted">No completed maintenance yet.</p>`;
}

function renderAuth() {
  const isReport = isPublicReportUrl();
  const isLoggedIn = Boolean(currentUser);
  const hasScannedAsset = Boolean(getAssetIdFromUrl());
  const needsFirstAdmin = !isReport && !isLoggedIn && !hasSetupUsers();
  els.publicReportScreen.classList.toggle("hidden", !isReport);
  els.loginScreen.classList.toggle("hidden", isReport || isLoggedIn);
  els.loginForm.classList.toggle("hidden", needsFirstAdmin);
  els.loginQrReportPrompt.classList.toggle("hidden", isReport || isLoggedIn || !hasScannedAsset);
  if (!isReport && !isLoggedIn && hasScannedAsset) setLoginQrReportStatus(Boolean(getScannedReportAsset()));
  syncLoginQrReportPrompt();
  els.firstAdminForm.classList.toggle("hidden", !needsFirstAdmin);
  els.appOnly.forEach((node) => node.classList.toggle("hidden", isReport || !isLoggedIn));
  if (isReport || !isLoggedIn) return;
  els.currentUserName.textContent = currentUser.name || currentUser.username;
  els.currentUserRole.textContent = currentUser.role;
}

function getScannedReportAsset() {
  const assetId = getAssetIdFromUrl();
  if (!assetId) return null;
  hydrateAssetFromHash();
  return getRawAsset(assetId);
}

function syncLoginQrReportPrompt() {
  if (!els.loginQrReportPrompt) return;
  const isReport = isPublicReportUrl();
  const loginIsVisible = !els.loginScreen.classList.contains("hidden");
  const assetId = getAssetIdFromUrl();
  if (isReport || !loginIsVisible || !assetId) {
    els.loginQrReportPrompt.classList.add("hidden");
    return;
  }
  const asset = getScannedReportAsset();
  setLoginQrReportStatus(isScannedReportLinkReady(asset));
  els.loginQrReportPrompt.classList.remove("hidden");
}

function isScannedReportLinkReady(asset = getScannedReportAsset()) {
  if (asset) return true;
  const params = new URLSearchParams(location.search);
  return Boolean(params.get("a") && params.get("n") && params.get("c") && params.get("l"));
}

function getScannedEquipmentReportUrl() {
  const assetId = getAssetIdFromUrl();
  if (!assetId) return "#";
  const base = getCurrentPageUrl();
  const params = new URLSearchParams(location.search);
  params.set("report", "1");
  params.delete("qr");
  params.set("a", assetId);
  return `${base}?${params.toString()}`;
}

function getScannedAreaReportUrl() {
  const asset = getScannedReportAsset();
  if (asset?.locationId) return getReportLocationUrl(asset.locationId);

  const base = getCurrentPageUrl();
  const params = new URLSearchParams();
  const sourceParams = new URLSearchParams(location.search);
  const customerName = sourceParams.get("c") || "";
  const locationName = sourceParams.get("l") || "";
  if (!customerName || !locationName) return getScannedEquipmentReportUrl();
  params.set("report", "1");
  params.set("c", customerName);
  params.set("l", locationName);
  return `${base}?${params.toString()}`;
}

function setLoginQrReportStatus(isReady) {
  if (!els.loginQrReportMessage) return;
  els.loginQrReportMessage.textContent = isReady
    ? "Send a photo and quick note without logging in."
    : "This scanned link is missing equipment details. Please scan a printed SiteWorks QR label for an existing asset.";
  [els.loginQrReportBtn, els.loginQrAreaReportBtn].forEach((button) => {
    if (!button) return;
    button.classList.toggle("disabled-link", !isReady);
    button.setAttribute("aria-disabled", String(!isReady));
    if (!isReady) button.setAttribute("href", "#");
  });
}

function showFirstAdminSetup(message = "") {
  els.loginForm.classList.add("hidden");
  els.firstAdminForm.classList.remove("hidden");
  els.firstAdminMessage.textContent = message;
}

function findUserForLogin(username, password) {
  const normalizedUsername = username.trim().toLowerCase();
  const normalizedPassword = password.trim();
  return state.users.find((item) =>
    item.username.toLowerCase() === normalizedUsername &&
    item.password === normalizedPassword
  );
}

function getOrCreateCustomerAccessUser() {
  let user = state.users.find((item) => item.username === "scan-customer");
  if (!user) {
    user = {
      id: crypto.randomUUID(),
      username: "scan-customer",
      name: "Scanned Customer",
      password: "",
      role: "Customer",
      customerId: "",
      createdAt: new Date().toISOString()
    };
    state.users.push(user);
  }
  return user;
}

function assignQrCustomerAccessUser() {
  if (!currentUser || currentUser.username !== "scan-customer") return;
  const asset = getRawAsset(getAssetIdFromUrl());
  currentUser.customerId = asset?.customerId || "";
  selectedCustomerId = currentUser.customerId || selectedCustomerId;
}

function renderRole() {
  const setupDisabled = !canManageSetup();
  const isAdmin = currentRole === "Admin";
  const isCustomer = currentRole === "Customer";
  els.dashboardPanel.classList.toggle("hidden", isCustomer);
  els.adminToolsDrawer.classList.toggle("hidden", !isAdmin);
  if (!isAdmin) els.adminToolsDrawer.open = false;
  [els.quickAddDrawer, els.setupDrawer, els.backupDrawer].forEach((drawer) => {
    drawer.classList.toggle("hidden", !isAdmin);
    if (!isAdmin) drawer.open = false;
  });
  els.backupLocationBlock.classList.toggle("hidden", currentRole !== "Admin");
  els.backupLocationForm.querySelectorAll("input, button").forEach((control) => {
    control.disabled = currentRole !== "Admin";
  });
  [els.customerForm, els.templateForm, els.locationForm, els.assetForm, els.userForm].forEach((form) => {
    form.querySelectorAll("input, select, textarea, button").forEach((control) => {
      control.disabled = setupDisabled;
    });
  });
  els.pmForm.querySelectorAll("input, select, textarea, button").forEach((control) => {
    control.disabled = !canCompletePm();
  });
  els.assetInfoForm.querySelectorAll("input, select, textarea, button").forEach((control) => {
    control.disabled = !canCompletePm();
  });
  els.nextPmForm.querySelectorAll("input, button").forEach((control) => {
    control.disabled = !canManageWorkOrders();
  });
}

function renderUsers() {
  els.userCount.textContent = state.users.length;
  els.userList.innerHTML = state.users.map(renderUserItem).join("");
}

function renderUserItem(user) {
  const disabled = canManageSetup() ? "" : "disabled";
  const currentLabel = currentUser?.id === user.id ? `<span class="current-user-label">Current user</span>` : "";
  const customer = getCustomer(user.customerId);
  const customerOptions = state.customers.map((customerRecord) =>
    `<option value="${customerRecord.id}" ${user.customerId === customerRecord.id ? "selected" : ""}>${escapeHtml(customerRecord.name)}</option>`
  ).join("");
  const customerAssignment = user.role !== "Admin"
    ? ` | ${escapeHtml(customer?.name || "No customer assigned")}`
    : "";
  return `
    <details class="user-list-item user-editor">
      <summary>
        <span>
          <strong>${escapeHtml(user.name || user.username)}</strong>
          <small>${escapeHtml(user.username)} | ${escapeHtml(user.role)}${customerAssignment}</small>
        </span>
        ${currentLabel}
      </summary>
      <form class="stack compact-form" data-user-id="${escapeAttribute(user.id)}">
        <label>
          Email
          <input name="username" required value="${escapeAttribute(user.username)}" ${disabled}>
        </label>
        <label>
          Display name
          <input name="name" required value="${escapeAttribute(user.name || user.username)}" ${disabled}>
        </label>
        <label>
          Password
          <input name="password" type="password" placeholder="Use Supabase password reset" disabled>
        </label>
        <label>
          Role
          <select name="role" ${disabled}>
            ${["Customer", "Technician", "Manager", "Admin"].map((role) =>
              `<option value="${role}" ${user.role === role ? "selected" : ""}>${role}</option>`
            ).join("")}
          </select>
        </label>
        <label>
          Assigned customer
          <select name="customerId" ${disabled}>
            ${customerOptions}
          </select>
        </label>
        <div class="user-actions">
          <button type="submit" class="secondary mini" ${disabled}>Save User</button>
          <button type="button" class="secondary mini danger-action" data-user-action="delete" data-user-id="${escapeAttribute(user.id)}" ${currentUser?.id === user.id || !canManageSetup() ? "disabled" : ""}>Delete</button>
        </div>
      </form>
    </details>
  `;
}

function renderAccessRequests() {
  const pendingRequests = state.accessRequests.filter((request) => request.status === "Pending");
  els.accessRequestCount.textContent = pendingRequests.length;
  els.accessRequestList.innerHTML = pendingRequests.length
    ? pendingRequests.map(renderAccessRequestItem).join("")
    : `<p class="muted">No pending access requests.</p>`;
}

function renderAccessRequestItem(request) {
  const notes = request.notes ? `<p>${escapeHtml(request.notes)}</p>` : "";
  return `
    <div class="user-list-item access-request-item">
      <strong>${escapeHtml(request.name)}</strong>
      <span>${escapeHtml(request.email)} | ${escapeHtml(request.role)}</span>
      ${request.company ? `<span>${escapeHtml(request.company)}</span>` : ""}
      ${notes}
      <div class="request-actions">
        <button type="button" class="secondary mini" data-request-action="use" data-request-id="${escapeAttribute(request.id)}">Use Request</button>
        <button type="button" class="secondary mini" data-request-action="dismiss" data-request-id="${escapeAttribute(request.id)}">Dismiss</button>
      </div>
    </div>
  `;
}

function renderActivityLog() {
  const items = (state.activityLog || []).slice(0, 30);
  els.activityLogCount.textContent = state.activityLog?.length || 0;
  els.activityLogList.innerHTML = items.length
    ? items.map(renderActivityLogItem).join("")
    : `<p class="muted">No activity recorded yet.</p>`;
}

function renderActivityLogItem(item) {
  return `
    <div class="activity-log-item">
      <strong>${escapeHtml(item.action || "Activity")}</strong>
      <span>${escapeHtml(formatDateTime(new Date(item.createdAt)))} | ${escapeHtml(item.userName || "Unknown user")} | ${escapeHtml(item.userRole || "Unknown role")}</span>
      <p>${escapeHtml(item.details || "")}</p>
    </div>
  `;
}

function renderCustomerOptions() {
  const customers = visibleCustomers();
  const options = customers.map((customer) =>
    `<option value="${customer.id}">${escapeHtml(customer.name)}</option>`
  ).join("");
  const allCustomerOptions = state.customers.map((customer) =>
    `<option value="${customer.id}">${escapeHtml(customer.name)}</option>`
  ).join("");

  els.locationCustomer.innerHTML = options;
  els.assetCustomer.innerHTML = options;
  els.customerFilter.innerHTML = options;
  els.newUserCustomer.innerHTML = allCustomerOptions;

  els.locationCustomer.value = selectedCustomerId;
  els.assetCustomer.value = selectedCustomerId;
  els.customerFilter.value = selectedCustomerId;
  if (!els.newUserCustomer.value && state.customers[0]) {
    els.newUserCustomer.value = state.customers[0].id;
  }
  els.customerFilter.disabled = !canSeeAllCustomers();

  const setupAllowed = canManageSetup();
  els.locationForm.querySelector("button").disabled = !setupAllowed || !state.customers.length;
  els.assetForm.querySelector("button").disabled = !setupAllowed || !state.customers.length || !state.locations.length || !state.templates.length;
}

function renderTemplateOptions() {
  els.assetTemplate.innerHTML = state.templates.map((template) =>
    `<option value="${template.id}">${escapeHtml(template.name)}</option>`
  ).join("");
  if (!els.assetTemplate.value && state.templates[0]) {
    els.assetTemplate.value = state.templates[0].id;
  }
}

function renderLocationOptions() {
  const locations = locationsForCustomer(selectedCustomerId);
  els.locationFilter.innerHTML = [
    `<option value="all">All locations</option>`,
    ...locations.map((locationRecord) => `<option value="${locationRecord.id}">${escapeHtml(locationRecord.name)}</option>`)
  ].join("");
  els.locationFilter.value = locations.some((locationRecord) => locationRecord.id === selectedLocationId)
    ? selectedLocationId
    : "all";
}

function renderAssetLocationOptions() {
  const customerId = els.assetCustomer.value || selectedCustomerId;
  const locations = locationsForCustomer(customerId);
  els.assetLocation.innerHTML = locations.map((locationRecord) =>
    `<option value="${locationRecord.id}">${escapeHtml(locationRecord.name)}</option>`
  ).join("");
  els.assetLocation.disabled = locations.length === 0 || !canManageSetup();
  els.assetForm.querySelector("button").disabled = locations.length === 0 || !state.templates.length || !canManageSetup();
}

function renderEditAssetLocationOptions(selectedLocationId = "") {
  const customerId = els.editAssetCustomer.value;
  const locations = locationsForCustomer(customerId);
  els.editAssetLocation.innerHTML = locations.map((locationRecord) =>
    `<option value="${locationRecord.id}">${escapeHtml(locationRecord.name)}</option>`
  ).join("");
  if (selectedLocationId && locations.some((locationRecord) => locationRecord.id === selectedLocationId)) {
    els.editAssetLocation.value = selectedLocationId;
  }
  els.editAssetLocation.disabled = locations.length === 0 || !canCompletePm();
}

function renderDashboard() {
  const assets = filteredAssets();
  const dueInfos = assets.map(getDueInfo);
  const activeIssues = filteredWorkOrders().filter((item) => item.status !== "Closed");
  els.dueToday.textContent = dueInfos.filter((item) => item.daysUntil <= 0).length;
  els.overdue.textContent = dueInfos.filter((item) => item.daysUntil < 0).length;
  els.completed.textContent = assets.reduce((count, asset) => count + asset.history.length, 0);
  els.openWorkOrders.textContent = activeIssues.length;
  els.highPriorityIssues.textContent = activeIssues.filter((item) => item.priority === "High").length;
  els.waitingPartsIssues.textContent = activeIssues.filter((item) => item.status === "Waiting parts").length;
  els.reportedIssues.textContent = activeIssues.filter((item) => item.source === "Public QR report").length;
  els.activeLocations.textContent = activeAssetLocationCountForCurrentCustomer();
}

function renderAssetTableControls() {
  els.assetSearch.value = assetQuery;
  els.statusFilter.value = assetStatusFilter;
  els.assetSort.value = assetSort;
  els.assetPageSize.value = String(assetPageSize);
  els.printSelectedLabelsBtn.textContent = selectedPrintAssetIds.size
    ? `Print Selected (${selectedPrintAssetIds.size})`
    : "Print Selected";
  els.clearSelectedAssetsBtn.disabled = selectedPrintAssetIds.size === 0;
  els.templateFilter.innerHTML = [
    `<option value="all">All templates</option>`,
    ...state.templates.map((template) => `<option value="${template.id}">${escapeHtml(template.name)}</option>`)
  ].join("");
  els.templateFilter.value = state.templates.some((template) => template.id === assetTemplateFilter)
    ? assetTemplateFilter
    : "all";
}

function getCurrentAssetTablePageAssets(assets = assetTableAssets()) {
  const start = (assetPage - 1) * assetPageSize;
  return assets.slice(start, start + assetPageSize);
}

function selectedAssetsForPrinting() {
  const selectedIds = new Set(selectedPrintAssetIds);
  return assetTableAssets().filter((asset) => selectedIds.has(asset.id));
}

function renderAssetTable() {
  const assets = assetTableAssets();
  const totalPages = getAssetTablePageCount(assets);
  assetPage = Math.min(assetPage, totalPages);
  const pageAssets = getCurrentAssetTablePageAssets(assets);
  const start = (assetPage - 1) * assetPageSize;
  els.tableAssetCount.textContent = assets.length;
  els.assetTableBody.innerHTML = pageAssets.length
    ? pageAssets.map(renderAssetTableRow).join("")
    : `<tr><td colspan="10" class="empty-cell">No equipment matches these filters.</td></tr>`;

  els.assetTableBody.querySelectorAll("tr[data-id]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("[data-edit-asset], [data-print-select]")) return;
      selectedId = row.dataset.id;
      syncFiltersToSelectedAsset();
      location.hash = `asset/${selectedId}`;
      render();
    });
  });

  els.assetTableBody.querySelectorAll("[data-print-select]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedPrintAssetIds.add(checkbox.value);
      } else {
        selectedPrintAssetIds.delete(checkbox.value);
      }
      renderAssetTableControls();
    });
  });

  els.assetTableBody.querySelectorAll("[data-edit-asset]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedId = button.dataset.editAsset;
      syncFiltersToSelectedAsset();
      location.hash = `asset/${selectedId}`;
      render();
      openAssetEditor();
    });
  });

  const showingStart = assets.length ? start + 1 : 0;
  const showingEnd = Math.min(start + pageAssets.length, assets.length);
  els.assetPageInfo.textContent = `Showing ${showingStart}-${showingEnd} of ${assets.length}`;
  els.prevAssetPageBtn.disabled = assetPage <= 1;
  els.nextAssetPageBtn.disabled = assetPage >= totalPages;
}

function renderAssetTableRow(asset) {
  const customer = getCustomer(asset.customerId);
  const locationRecord = getLocation(asset.locationId);
  const template = getTemplate(asset.templateId);
  const due = getDueInfo(asset);
  const openCount = openWorkOrdersForAsset(asset.id).length;
  const active = asset.id === selectedId ? " selected-row" : "";
  return `
    <tr class="${active}" data-id="${asset.id}">
      <td class="select-cell">
        <input type="checkbox" data-print-select value="${escapeAttribute(asset.id)}" ${selectedPrintAssetIds.has(asset.id) ? "checked" : ""} aria-label="Select ${escapeAttribute(asset.name)} for QR printing">
      </td>
      <td>
        <strong>${escapeHtml(asset.name)}</strong>
        <span>${escapeHtml(asset.manufacturer || asset.model || "No details")}</span>
      </td>
      <td>${escapeHtml(customer?.name || "Unknown")}</td>
      <td>${escapeHtml(locationRecord?.name || "Unknown")}</td>
      <td>${renderStatusBadge(due.label, due.className)}</td>
      <td>${formatDate(due.nextDate)}</td>
      <td>${openCount ? `<span class="status-badge badge-warn">${openCount} open</span>` : `<span class="status-badge badge-muted">0</span>`}</td>
      <td>${escapeHtml(template?.name || "Template missing")}</td>
      <td>${escapeHtml(asset.serial || "-")}</td>
      <td><button type="button" class="secondary mini table-edit-btn" data-edit-asset="${escapeAttribute(asset.id)}">Edit</button></td>
    </tr>
  `;
}

function renderAssetBadges(asset, due = getDueInfo(asset)) {
  const badges = [
    renderStatusBadge(due.label, due.className)
  ];
  const openCount = openWorkOrdersForAsset(asset.id).length;
  if (openCount) badges.push(`<span class="status-badge badge-warn">${openCount} open issue${openCount === 1 ? "" : "s"}</span>`);
  if (asset.criticality) badges.push(`<span class="status-badge ${criticalityBadgeClass(asset.criticality)}">${escapeHtml(asset.criticality)} criticality</span>`);
  if (asset.manualFile?.dataUrl || asset.documentUrl) badges.push(`<span class="status-badge badge-muted">Manual ready</span>`);
  return badges.join("");
}

function renderScanActionPanel(asset) {
  const manualUrl = asset.manualFile?.dataUrl || safeDocumentLink(asset.documentUrl);
  const locationRecord = getLocation(asset.locationId);
  const customerScanCopy = currentRole === "Customer"
    ? {
        title: "Need to report an issue?",
        note: "Send a photo and note for this equipment or the surrounding area."
      }
    : {
        title: "Scan actions",
        note: "Fast access for staff, technicians, and customers."
      };
  return `
    <div class="scan-action-copy">
      <strong>${customerScanCopy.title}</strong>
      <span>${customerScanCopy.note}</span>
    </div>
    <div class="scan-action-buttons">
      <a class="secondary primary-action" href="${escapeAttribute(getReportAssetUrl(asset.id))}">Report Equipment Issue</a>
      ${locationRecord ? `<a class="secondary" href="${escapeAttribute(getReportLocationUrl(locationRecord.id))}">Report Area Issue</a>` : ""}
      ${manualUrl ? `<a class="secondary" href="${escapeAttribute(manualUrl)}" target="_blank" rel="noopener">Open Manual</a>` : ""}
      <button type="button" class="secondary" data-scroll-target="pmForm">Checklist</button>
      <button type="button" class="secondary" data-scroll-target="assetGalleryPanel">Photos</button>
    </div>
  `;
}

function renderStatusBadge(label, className) {
  return `<span class="status-badge ${badgeClassForStatus(className)}">${escapeHtml(label)}</span>`;
}

function badgeClassForStatus(className) {
  if (className === "status-danger") return "badge-danger";
  if (className === "status-warn") return "badge-warn";
  if (className === "status-ok") return "badge-ok";
  return "badge-muted";
}

function criticalityBadgeClass(criticality) {
  if (criticality === "High") return "badge-danger";
  if (criticality === "Medium") return "badge-warn";
  if (criticality === "Low") return "badge-ok";
  return "badge-muted";
}

function openAssetEditor() {
  const editor = document.querySelector(".asset-info-editor");
  if (!editor) return;
  editor.open = true;
  editor.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToAssetGallery() {
  const gallery = document.getElementById("assetGalleryPanel");
  if (!gallery) return;
  gallery.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToAssetManual() {
  const manual = document.getElementById("assetManualPanel");
  if (!manual) return;
  manual.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setGalleryUploadStatus(message) {
  els.assetGalleryUploadStatus.textContent = message;
}

function setManualUploadStatus(message) {
  els.assetManualUploadStatus.textContent = message;
}

function getAssetTablePageCount(assets = assetTableAssets()) {
  return Math.max(1, Math.ceil(assets.length / assetPageSize));
}

function renderBackupStatus() {
  const latest = getAutoBackups()[0];
  els.restoreBackupBtn.disabled = !latest;
  els.backupStatus.textContent = latest
    ? `Last auto backup ${formatDateTime(new Date(latest.createdAt))}`
    : "No auto backup yet";
  els.backupLocation.value = state.backupLocation || defaultBackupLocation();
}

function renderQrSettings() {
  els.qrBaseUrl.value = state.qrBaseUrl || getCurrentPageUrl();
}

function renderPublicReport() {
  const report = getReportContext();
  if (!report) {
    els.reportTitle.textContent = "Report link not recognized";
    els.reportContext.textContent = "This QR code is missing equipment or location information.";
    els.publicReportForm.classList.add("hidden");
    return;
  }
  els.publicReportForm.classList.remove("hidden");
  els.reportTitle.textContent = `Report ${report.asset ? "equipment" : "area"} issue`;
  els.reportContext.textContent = [
    report.customer?.name,
    report.location?.name,
    report.asset?.name
  ].filter(Boolean).join(" | ");
}

function renderWorkOrders() {
  const workOrders = filterWorkOrdersForView(filteredWorkOrders());
  els.workOrderCount.textContent = workOrders.length;
  els.workOrderList.innerHTML = workOrders.length
    ? workOrders.map(renderWorkOrderItem).join("")
    : `<p class="muted">No open issues for this view.</p>`;
}

function renderAssetWorkOrders(asset) {
  const workOrders = state.workOrders.filter((item) => item.assetId === asset.id);
  els.assetWorkOrderCount.textContent = workOrders.length;
  els.assetWorkOrderList.innerHTML = workOrders.length
    ? workOrders.map(renderWorkOrderItem).join("")
    : `<p class="muted">No issues for this equipment.</p>`;
}

function filterWorkOrdersForView(workOrders) {
  const active = workOrders.filter((item) => item.status !== "Closed");
  if (workOrderViewFilter === "highPriority") return active.filter((item) => item.priority === "High");
  if (workOrderViewFilter === "waitingParts") return active.filter((item) => item.status === "Waiting parts");
  if (workOrderViewFilter === "reported") return active.filter((item) => item.source === "Public QR report");
  return active;
}

function renderAssetList() {
  const assets = assetTableAssets().slice(0, 12);
  els.assetList.innerHTML = assets.length ? assets.map((asset) => {
    const customer = getCustomer(asset.customerId);
    const locationRecord = getLocation(asset.locationId);
    const due = getDueInfo(asset);
    const active = asset.id === selectedId ? " active" : "";
    return `
      <button class="asset-button${active}" type="button" data-id="${asset.id}">
        <strong>${escapeHtml(asset.name)}</strong>
        <span>${escapeHtml(customer?.name || "Unknown")} | ${escapeHtml(locationRecord?.name || "Unknown")} | ${escapeHtml(due.label)}</span>
      </button>
    `;
  }).join("") : `<p class="muted">No equipment for this view.</p>`;

  els.assetList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      selectedId = button.dataset.id;
      syncFiltersToSelectedAsset();
      location.hash = `asset/${selectedId}`;
      render();
    });
  });
}

function renderEmptyStateContent(asset) {
  if (asset) return "";
  if (currentRole !== "Admin" && !currentUser?.customerId) {
    return `
      <h2>No customer assigned</h2>
      <p>This ${escapeHtml(currentRole)} login needs an assigned customer before equipment can be shown. Ask an Admin to edit the user and choose a customer.</p>
    `;
  }
  if (!visibleCustomers().length) {
    return `
      <h2>No customer access</h2>
      <p>This login does not currently have access to a customer.</p>
    `;
  }
  return `
    <h2>No equipment found</h2>
    <p>No equipment is available for the selected customer or filters.</p>
  `;
}

function assetTableAssets() {
  return filteredAssets()
    .filter(matchesAssetSearch)
    .filter(matchesStatusFilter)
    .filter(matchesTemplateFilter)
    .sort(sortAssetsForTable);
}

function matchesAssetSearch(asset) {
  if (!assetQuery) return true;
  const customer = getCustomer(asset.customerId);
  const locationRecord = getLocation(asset.locationId);
  const template = getTemplate(asset.templateId);
  const haystack = [
    asset.name,
    asset.serial,
    asset.model,
    asset.manufacturer,
    asset.type,
    asset.criticality,
    asset.documentUrl,
    asset.manualFile?.name,
    asset.vendor,
    asset.vendorContact,
    asset.warrantyDate,
    asset.parts,
    asset.notes,
    customer?.name,
    locationRecord?.name,
    template?.name,
    asset.id
  ].join(" ").toLowerCase();
  return haystack.includes(assetQuery);
}

function matchesStatusFilter(asset) {
  if (assetStatusFilter === "all") return true;
  const due = getDueInfo(asset);
  if (assetStatusFilter === "dueNow") return due.daysUntil <= 0;
  if (assetStatusFilter === "overdue") return due.daysUntil < 0;
  if (assetStatusFilter === "due") return due.daysUntil === 0;
  if (assetStatusFilter === "upcoming") return due.daysUntil > 0;
  return true;
}

function matchesTemplateFilter(asset) {
  return assetTemplateFilter === "all" || asset.templateId === assetTemplateFilter;
}

function sortAssetsForTable(a, b) {
  if (assetSort === "name") return a.name.localeCompare(b.name);
  if (assetSort === "location") {
    return (getLocation(a.locationId)?.name || "").localeCompare(getLocation(b.locationId)?.name || "");
  }
  if (assetSort === "status") return getDueInfo(a).daysUntil - getDueInfo(b).daysUntil;
  if (assetSort === "workOrders") return openWorkOrdersForAsset(b.id).length - openWorkOrdersForAsset(a.id).length;
  return getDueInfo(a).nextDate - getDueInfo(b).nextDate;
}

function renderChecklist(template) {
  const items = template?.items?.length ? template.items : DEFAULT_TEMPLATE_ITEMS;
  els.checklistFields.innerHTML = items.map((item) => `
    <label class="check-row">
      <input type="checkbox" name="checklist" value="${escapeHtml(item)}">
      <span>${escapeHtml(item)}</span>
    </label>
  `).join("");
}

function renderAssetDetails(asset) {
  const rows = [
    ["Equipment type", asset.type],
    ["Criticality", asset.criticality],
    ["Manufacturer", asset.manufacturer],
    ["Model", asset.model],
    ["Serial", asset.serial],
    ["Install date", asset.installDate],
    ["Vendor / service company", asset.vendor],
    ["Vendor contact", asset.vendorContact],
    ["Warranty expires", asset.warrantyDate],
    ["Parts / supply notes", asset.parts],
    ["Notes", asset.notes]
  ];
  return rows.map(([label, value]) => `
    <div>
      <span class="label">${escapeHtml(label)}</span>
      <strong>${label === "Manual / document" && value ? value : escapeHtml(value || "Not entered")}</strong>
    </div>
  `).join("");
}

function renderAssetManual(asset) {
  const uploadedManual = asset.manualFile?.dataUrl ? `
    <a class="manual-link" href="${asset.manualFile.dataUrl}" target="_blank" rel="noopener">
      <strong>Open uploaded PDF manual</strong>
      <span>${escapeHtml(asset.manualFile.name || "Asset manual.pdf")}</span>
    </a>
  ` : "";
  const linkedManual = safeDocumentLink(asset.documentUrl)
    ? `<div class="manual-link manual-link-muted"><strong>Manual link</strong><span>${safeDocumentLink(asset.documentUrl)}</span></div>`
    : "";
  if (!uploadedManual && !linkedManual) {
    return `<div class="asset-photo-empty">No manual uploaded or linked.</div>`;
  }
  return `
    <div class="asset-manual-card">
      ${uploadedManual}
      ${linkedManual}
    </div>
  `;
}

function renderAssetPhoto(asset) {
  if (!asset.photo?.dataUrl) {
    return `<div class="asset-photo-empty">No equipment photo uploaded.</div>`;
  }
  return `
    <figure class="asset-photo-card">
      <button type="button" class="photo-open-button" data-view-photo data-photo-src="${escapeAttribute(asset.photo.dataUrl)}" data-photo-caption="${escapeAttribute(asset.photo.name || "Primary equipment photo")}">
        <img alt="Photo of ${escapeHtml(asset.name)}" src="${asset.photo.dataUrl}">
      </button>
      <figcaption>
        <strong>Primary equipment photo</strong>
        <span>${escapeHtml(asset.photo.name || "Equipment photo")}</span>
      </figcaption>
    </figure>
  `;
}

function renderAssetGallery(asset) {
  const gallery = asset.photos || [];
  els.assetGalleryCount.textContent = gallery.length;
  els.assetGalleryPanel.innerHTML = gallery.length
    ? `<div class="asset-gallery-grid thumb-grid">${gallery.map(renderGalleryPhotoButton).join("")}</div>`
    : `<p class="muted">No extra equipment photos added yet.</p>`;
}

function renderGalleryPhotoButton(photo, index) {
  return `
    <button type="button" class="asset-gallery-item" data-view-photo data-photo-src="${escapeAttribute(photo.dataUrl)}" data-photo-caption="${escapeAttribute(photo.name || `Equipment photo ${index + 1}`)}">
      <img alt="Equipment gallery photo ${index + 1}" src="${photo.dataUrl}">
      <span>${escapeHtml(photo.name || `Photo ${index + 1}`)}</span>
    </button>
  `;
}

function renderAssetThumbnail(asset) {
  if (!asset.photo?.dataUrl) {
    return `<span>No photo</span>`;
  }
  return `<img alt="Photo of ${escapeHtml(asset.name)}" src="${asset.photo.dataUrl}">`;
}

function openPhotoViewer(src, caption) {
  if (!src) return;
  els.photoViewerImage.src = src;
  els.photoViewerCaption.textContent = caption || "Equipment photo";
  els.photoViewer.classList.remove("hidden");
}

function closePhotoViewer() {
  els.photoViewer.classList.add("hidden");
  els.photoViewerImage.removeAttribute("src");
  els.photoViewerCaption.textContent = "";
}

function renderAssetInfoForm(asset) {
  els.editAssetName.value = asset.name || "";
  els.editAssetCustomer.innerHTML = visibleCustomers().map((customer) =>
    `<option value="${customer.id}">${escapeHtml(customer.name)}</option>`
  ).join("");
  els.editAssetCustomer.value = asset.customerId;
  renderEditAssetLocationOptions(asset.locationId);
  els.editAssetTemplate.innerHTML = state.templates.map((template) =>
    `<option value="${template.id}">${escapeHtml(template.name)}</option>`
  ).join("");
  els.editAssetTemplate.value = asset.templateId;
  els.editAssetFrequency.value = String(asset.frequencyDays || 30);
  els.editAssetType.value = asset.type || "";
  els.editAssetCriticality.value = asset.criticality || "";
  els.editAssetManufacturer.value = asset.manufacturer || "";
  els.editAssetModel.value = asset.model || "";
  els.editAssetSerial.value = asset.serial || "";
  els.editAssetInstallDate.value = asset.installDate || "";
  els.editAssetVendor.value = asset.vendor || "";
  els.editAssetVendorContact.value = asset.vendorContact || "";
  els.editAssetWarrantyDate.value = asset.warrantyDate || "";
  els.editAssetParts.value = asset.parts || "";
  els.editAssetDocumentUrl.value = asset.documentUrl || "";
  els.editAssetNotes.value = asset.notes || "";
  els.editAssetManualFile.value = "";
  els.assetManualUploadStatus.textContent = "";
  els.editAssetPhoto.value = "";
  els.editAssetGalleryPhotos.value = "";
  els.assetGalleryUploadStatus.textContent = "";
}

function renderHistoryItem(item, index) {
  const checks = item.completedChecks || [];
  const completedAt = new Date(item.completedAt);
  const photo = item.photo?.dataUrl ? `
    <button type="button" class="history-photo-button" data-view-photo data-photo-src="${escapeAttribute(item.photo.dataUrl)}" data-photo-caption="${escapeAttribute(item.photo.name || "PM evidence photo")}">
      <img class="history-photo" alt="PM evidence photo" src="${item.photo.dataUrl}">
    </button>
  ` : `<p class="muted">No photo attached.</p>`;
  return `
    <details class="history-item pm-history-record" ${index === 0 ? "open" : ""}>
      <summary>
        <span>
          <strong>${escapeHtml(item.result || "Completed")}</strong>
          <small>${escapeHtml(formatDateTime(completedAt))} | ${escapeHtml(item.technician || "No technician entered")}</small>
        </span>
        <span class="history-open-label">View</span>
      </summary>
      <div class="history-detail-grid">
        <div>
          <span class="label">Completed</span>
          <strong>${escapeHtml(formatDateTime(completedAt))}</strong>
        </div>
        <div>
          <span class="label">Technician</span>
          <strong>${escapeHtml(item.technician || "Not entered")}</strong>
        </div>
        <div>
          <span class="label">Result</span>
          <strong>${escapeHtml(item.result || "Completed")}</strong>
        </div>
        <div>
          <span class="label">Meter / reading</span>
          <strong>${escapeHtml(item.reading || "Not entered")}</strong>
        </div>
      </div>
      <div class="history-checklist">
        <strong>Completed checklist</strong>
        ${checks.length
          ? `<ul>${checks.map((check) => `<li>${escapeHtml(check)}</li>`).join("")}</ul>`
          : `<p class="muted">No checklist items selected.</p>`}
      </div>
      <div class="history-notes">
        <strong>Notes</strong>
        <p>${escapeHtml(item.notes || "No notes entered.")}</p>
      </div>
      <div class="history-evidence">
        <strong>Photo evidence</strong>
        ${photo}
      </div>
    </details>
  `;
}

function renderWorkOrderItem(item) {
  const asset = getAsset(item.assetId);
  const customer = getCustomer(item.customerId);
  const locationRecord = getLocation(item.locationId);
  const assetAction = asset
    ? `<button class="secondary mini" type="button" data-asset-link="${item.assetId}">View Equipment</button>`
    : "";
  const actions = item.status === "Closed" ? `
    <div class="work-order-actions">
      <button class="secondary" data-work-order-id="${item.id}" data-work-order-action="Open">Reopen</button>
    </div>
  ` : `
    <div class="work-order-actions">
      ${item.status === "Open" ? `<button class="secondary" data-work-order-id="${item.id}" data-work-order-action="In progress">Start</button>` : ""}
      ${item.status !== "Waiting parts" ? `<button class="secondary" data-work-order-id="${item.id}" data-work-order-action="Waiting parts">Waiting Parts</button>` : ""}
      ${item.status !== "Resolved" ? `<button class="secondary" data-work-order-id="${item.id}" data-work-order-action="Resolved">Resolve</button>` : ""}
      <button class="secondary" data-work-order-id="${item.id}" data-work-order-action="Closed">Close</button>
    </div>
  `;
  const statusClass = item.status === "Closed"
    ? "badge-muted"
    : item.status === "Waiting parts"
      ? "badge-warn"
      : item.status === "Resolved"
        ? "badge-ok"
        : item.priority === "High"
          ? "badge-danger"
          : "badge-warn";
  return `
    <article class="work-order-item">
      <header>
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <span><span class="status-badge ${statusClass}">${escapeHtml(item.status)}</span> ${escapeHtml(item.priority)} priority | Due ${formatDate(new Date(item.dueAt))}</span>
        </div>
        ${assetAction}
      </header>
      <p>${escapeHtml(customer?.name || "Unknown customer")} | ${escapeHtml(locationRecord?.name || "Unknown location")} | ${escapeHtml(asset?.name || item.areaName || "Area report")}</p>
      <p>${escapeHtml(item.notes)}</p>
      ${item.photo ? `<img class="history-photo" alt="Issue report photo" src="${item.photo.dataUrl}">` : ""}
      ${actions}
    </article>
  `;
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-asset-link]");
  if (!button) return;
  const asset = getAsset(button.dataset.assetLink);
  if (!asset) return;
  selectedId = asset.id;
  syncFiltersToSelectedAsset();
  location.hash = `asset/${asset.id}`;
  render();
});

function renderLabels(assets = filteredAssets()) {
  els.labelSheet.innerHTML = assets.map((asset) => {
    const customer = getCustomer(asset.customerId);
    const locationRecord = getLocation(asset.locationId);
    return `
      <div class="print-label">
        <img alt="" src="${qrUrl(getAssetUrl(asset.id))}">
        <div>
          <span class="label-brand">SiteWorks</span>
          <strong>${escapeHtml(asset.name)}</strong>
          <span>${escapeHtml(customer?.name || "Unknown customer")}</span>
          <span>${escapeHtml(locationRecord?.name || "Unknown location")}</span>
          <span>Scan for maintenance checklist and history</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderReportLabels(assets = filteredAssets()) {
  const assetLabels = assets.map((asset) => {
    const customer = getCustomer(asset.customerId);
    const locationRecord = getLocation(asset.locationId);
    return `
      <div class="print-label">
        <img alt="" src="${qrUrl(getReportAssetUrl(asset.id))}">
        <div>
          <span class="label-brand">SiteWorks</span>
          <strong>${escapeHtml(asset.name)}</strong>
          <span>${escapeHtml(customer?.name || "Unknown customer")}</span>
          <span>${escapeHtml(locationRecord?.name || "Unknown location")}</span>
          <span>Scan to report an equipment issue</span>
        </div>
      </div>
    `;
  });
  const locationLabels = visibleLocationsForReportLabels().map((locationRecord) => {
    const customer = getCustomer(locationRecord.customerId);
    return `
      <div class="print-label">
        <img alt="" src="${qrUrl(getReportLocationUrl(locationRecord.id))}">
        <div>
          <span class="label-brand">SiteWorks</span>
          <strong>${escapeHtml(locationRecord.name)}</strong>
          <span>${escapeHtml(customer?.name || "Unknown customer")}</span>
          <span>Area report QR</span>
          <span>Scan to report an area issue</span>
        </div>
      </div>
    `;
  });
  els.labelSheet.innerHTML = [...assetLabels, ...locationLabels].join("");
}

function visibleLocationsForReportLabels() {
  const visibleCustomerIds = new Set(visibleCustomers().map((customer) => customer.id));
  return state.locations.filter((locationRecord) => visibleCustomerIds.has(locationRecord.customerId));
}

function ensureSelection() {
  const customers = visibleCustomers();
  if (!customers.length) {
    selectedCustomerId = "";
    selectedLocationId = "all";
    selectedId = null;
    return;
  }

  if (!customers.some((customer) => customer.id === selectedCustomerId)) {
    selectedCustomerId = customers[0].id;
  }

  if (selectedId && !filteredAssets().some((asset) => asset.id === selectedId)) {
    const asset = getSelectedAsset();
    if (asset) {
      selectedCustomerId = asset.customerId;
      selectedLocationId = "all";
    } else {
      selectedId = filteredAssets()[0]?.id || null;
    }
  }
}

function syncFiltersToSelectedAsset() {
  const asset = getSelectedAsset();
  if (!asset) return;
  if (!canSeeCustomer(asset.customerId)) return;
  selectedCustomerId = asset.customerId;
  selectedLocationId = "all";
}

function restoreScannedAssetSelection() {
  const scannedAssetId = getAssetIdFromUrl();
  if (!scannedAssetId) return;
  hydrateAssetFromHash();
  const asset = getRawAsset(scannedAssetId);
  if (!asset || !canSeeCustomer(asset.customerId)) return;
  selectedId = asset.id;
  selectedCustomerId = asset.customerId;
  selectedLocationId = "all";
}

function filteredAssets() {
  return state.assets.filter((asset) => {
    if (!canSeeCustomer(asset.customerId)) return false;
    const matchesCustomer = asset.customerId === selectedCustomerId;
    const matchesLocation = selectedLocationId === "all" || asset.locationId === selectedLocationId;
    return matchesCustomer && matchesLocation;
  });
}

function filteredWorkOrders() {
  return state.workOrders.filter((item) => {
    if (!canSeeCustomer(item.customerId)) return false;
    const matchesCustomer = item.customerId === selectedCustomerId;
    const matchesLocation = selectedLocationId === "all" || item.locationId === selectedLocationId;
    return matchesCustomer && matchesLocation;
  });
}

function openWorkOrdersForAsset(assetId) {
  return state.workOrders.filter((item) => item.assetId === assetId && item.status !== "Closed");
}

function locationsForCustomer(customerId) {
  return state.locations.filter((locationRecord) => locationRecord.customerId === customerId);
}

function getSelectedAsset() {
  return getAsset(selectedId);
}

function getAsset(id) {
  const asset = state.assets.find((item) => item.id === id) || null;
  if (!asset || !currentUser) return asset;
  return canSeeCustomer(asset.customerId) ? asset : null;
}

function getRawAsset(id) {
  return state.assets.find((asset) => asset.id === id) || null;
}

function getCustomer(id) {
  return state.customers.find((customer) => customer.id === id) || null;
}

function getLocation(id) {
  return state.locations.find((locationRecord) => locationRecord.id === id) || null;
}

function getTemplate(id) {
  return state.templates.find((template) => template.id === id) || state.templates[0] || null;
}

function getWorkOrder(id) {
  return state.workOrders.find((item) => item.id === id) || null;
}

function getDueInfo(asset) {
  const last = asset.history[0]?.completedAt ? new Date(asset.history[0].completedAt) : new Date(asset.createdAt);
  const nextDate = asset.nextPmDate ? parseLocalDate(asset.nextPmDate) : addDays(last, asset.frequencyDays);
  const daysUntil = Math.ceil((startOfDay(nextDate) - startOfDay(today)) / 86400000);

  if (daysUntil < 0) {
    return { nextDate, daysUntil, label: `${Math.abs(daysUntil)} days overdue`, className: "status-danger" };
  }
  if (daysUntil === 0) {
    return { nextDate, daysUntil, label: "Due today", className: "status-warn" };
  }
  return { nextDate, daysUntil, label: `Due in ${daysUntil} days`, className: "status-ok" };
}

function createWorkOrderFromPm(asset, historyItem) {
  const priority = historyItem.result === "Failed" ? "High" : "Medium";
  return {
    id: crypto.randomUUID(),
    assetId: asset.id,
    customerId: asset.customerId,
    locationId: asset.locationId,
    sourceHistoryId: historyItem.id,
    title: `${historyItem.result}: ${asset.name}`,
    priority,
    status: "Open",
    dueAt: addDays(new Date(), priority === "High" ? 2 : 7).toISOString(),
    notes: historyItem.notes || "Created automatically from PM result.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function canManageSetup() {
  return currentRole === "Admin";
}

function canCompletePm() {
  return currentRole === "Admin" || currentRole === "Manager" || currentRole === "Technician" || currentRole === "Customer";
}

function canManageWorkOrders() {
  return currentRole === "Admin" || currentRole === "Manager";
}

function hasSetupUsers() {
  if (!authProfilesLoaded) return true;
  return state.users.some((user) => user.username !== "scan-customer" && !user.password);
}

function visibleCustomers() {
  if (canSeeAllCustomers()) return state.customers;
  return state.customers.filter((customer) => customer.id === currentUser?.customerId);
}

function activeLocationCountForAssets(assets = filteredAssets()) {
  return new Set(assets.map((asset) => asset.locationId).filter(Boolean)).size;
}

function activeAssetLocationCountForCurrentCustomer() {
  const customerAssets = state.assets.filter((asset) =>
    canSeeCustomer(asset.customerId) && asset.customerId === selectedCustomerId
  );
  return activeLocationCountForAssets(customerAssets);
}

function canSeeCustomer(customerId) {
  return canSeeAllCustomers() || currentUser?.customerId === customerId;
}

function canSeeAllCustomers() {
  return currentRole === "Admin";
}

function getAssetUrl(id) {
  const base = state.qrBaseUrl || getCurrentPageUrl();
  const params = getCompactAssetParams(id);
  return `${base}?qr=1&a=${encodeURIComponent(id)}${params ? `&${params}` : ""}`;
}

function getReportAssetUrl(id) {
  const base = state.qrBaseUrl || getCurrentPageUrl();
  const params = getCompactAssetParams(id);
  return `${base}?report=1&a=${encodeURIComponent(id)}${params ? `&${params}` : ""}`;
}

function getReportLocationUrl(locationId) {
  const base = state.qrBaseUrl || getCurrentPageUrl();
  const locationRecord = getLocation(locationId);
  const customer = getCustomer(locationRecord?.customerId);
  const params = new URLSearchParams();
  if (customer?.id) params.set("cid", customer.id);
  if (customer?.name) params.set("c", customer.name);
  if (locationRecord?.id) params.set("lid", locationRecord.id);
  if (locationRecord?.name) params.set("l", locationRecord.name);
  return `${base}?report=1&${params.toString()}`;
}

function getCurrentPageUrl() {
  return location.href.split(/[?#]/)[0];
}

function normalizeBaseUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.split(/[?#]/)[0];
}

function getAssetIdFromUrl() {
  const queryId = new URLSearchParams(location.search).get("a");
  if (queryId) return queryId;
  const match = location.hash.match(/^#asset\/([^?]+)/);
  return match ? match[1] : null;
}

function isQrAccessUrl() {
  return new URLSearchParams(location.search).get("qr") === "1";
}

function isPublicReportUrl() {
  return new URLSearchParams(location.search).get("report") === "1";
}

function hydrateAssetFromHash() {
  const id = getAssetIdFromUrl();
  if (!id || getAsset(id)) return;

  const snapshot = getCompactAssetSnapshot(id);
  if (!snapshot) return;

  if (!getCustomer(snapshot.customer.id)) {
    state.customers.push(snapshot.customer);
  }
  if (!getLocation(snapshot.location.id)) {
    state.locations.push(snapshot.location);
  }
  if (!state.templates.some((template) => template.id === snapshot.template.id)) {
    state.templates.push(snapshot.template);
  }

  state.assets.push(snapshot.asset);
  saveState();
}

function getReportContext() {
  const params = new URLSearchParams(location.search);
  const assetId = params.get("a");
  if (assetId) hydrateAssetFromHash();
  const asset = assetId ? getRawAsset(assetId) : null;
  if (asset) {
    return {
      asset,
      customer: getCustomer(asset.customerId),
      location: getLocation(asset.locationId)
    };
  }

  const locationId = params.get("lid");
  const customerId = params.get("cid");
  let locationRecord = locationId ? getLocation(locationId) : null;
  let customer = customerId ? getCustomer(customerId) : null;

  if (!customer && params.get("c")) {
    customer = state.customers.find((item) => item.name.toLowerCase() === params.get("c").toLowerCase()) || null;
  }
  if (!locationRecord && params.get("l")) {
    locationRecord = state.locations.find((item) =>
      item.name.toLowerCase() === params.get("l").toLowerCase() &&
      (!customer || item.customerId === customer.id)
    ) || null;
  }

  if (!customer && params.get("c")) {
    customer = {
      id: `report-customer-${slugify(params.get("c"))}`,
      name: params.get("c"),
      createdAt: new Date().toISOString()
    };
    state.customers.push(customer);
  }
  if (!locationRecord && params.get("l") && customer) {
    locationRecord = {
      id: `report-location-${slugify(customer.name)}-${slugify(params.get("l"))}`,
      customerId: customer.id,
      name: params.get("l"),
      createdAt: new Date().toISOString()
    };
    state.locations.push(locationRecord);
  }

  if (!customer || !locationRecord) return null;
  return { asset: null, customer, location: locationRecord };
}

function createIssueFromPublicReport(report, note, contact, photo) {
  const subject = report.asset?.name || report.location?.name || "Area";
  return {
    id: crypto.randomUUID(),
    assetId: report.asset?.id || "",
    customerId: report.customer?.id || "",
    locationId: report.location?.id || "",
    areaName: report.asset ? "" : report.location?.name || "Area report",
    source: "Public QR report",
    title: `Customer report: ${subject}`,
    priority: "Medium",
    status: "Open",
    dueAt: addDays(new Date(), 3).toISOString(),
    notes: [
      note,
      contact ? `Contact: ${contact}` : "",
      "Source: public QR report"
    ].filter(Boolean).join("\n"),
    photo,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function savePublicReportToSupabase(report, note, contact, photo) {
  lastPublicReportError = "";
  const payload = {
    equipment_id: report.asset?.id || null,
    customer_id: report.customer?.id || null,
    customer_name: report.customer?.name || "",
    location_id: report.location?.id || null,
    location_name: report.location?.name || "",
    equipment_name: report.asset?.name || "",
    note,
    contact,
    photo_data_url: photo?.dataUrl || "",
    photo_name: photo?.name || ""
  };
  try {
    const response = await supabaseFetch("public_reports?select=id", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorText = await response.text();
      lastPublicReportError = "Report was not sent to SiteWorks. Try again with a smaller photo or no photo.";
      console.warn("Supabase public report save skipped.", errorText);
      return "";
    }
    const data = await response.json();
    return data?.[0]?.id || "";
  } catch (error) {
    lastPublicReportError = "Report was not sent. Check the phone connection and try again.";
    console.warn("Supabase public report save skipped.", error);
    return "";
  }
}

async function syncPublicReportsFromSupabase() {
  if (remoteReportsLoading || !canManageWorkOrders()) return;
  const now = Date.now();
  if (now - lastRemoteReportsSyncAt < 15000) return;
  lastRemoteReportsSyncAt = now;
  remoteReportsLoading = true;
  let data = [];
  try {
    const response = await supabaseFetch("public_reports?select=*&order=created_at.desc&limit=100");
    remoteReportsLoading = false;
    remoteReportsLoaded = true;
    if (!response.ok) {
      console.warn("Supabase public report sync skipped.", await response.text());
      return;
    }
    data = await response.json();
  } catch (error) {
    remoteReportsLoading = false;
    remoteReportsLoaded = true;
    console.warn("Supabase public report sync skipped.", error);
    return;
  }
  const added = (data || []).reduce((count, report) => {
    if (isCodexTestPublicReport(report)) return count;
    if (state.workOrders.some((item) => item.remoteReportId === report.id)) return count;
    state.workOrders.unshift(createIssueFromRemoteReport(report));
    return count + 1;
  }, 0);
  if (added) {
    addActivity("Public reports synced", `${added} report${added === 1 ? "" : "s"} imported from Supabase.`);
    saveState();
    render();
  }
}

function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  return fetch(url, { ...options, headers });
}

function supabaseAuthFetch(path, options = {}, session = null) {
  const url = `${SUPABASE_URL}/auth/v1/${path}`;
  const token = session?.access_token || SUPABASE_ANON_KEY;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  return fetch(url, { ...options, headers });
}

async function signInWithSupabase(email, password) {
  lastAuthError = "";
  try {
    const response = await supabaseAuthFetch("token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase(), password })
    });
    if (!response.ok) {
      const errorText = await response.text();
      lastAuthError = readableSupabaseError(errorText) || "Supabase login failed. Check the email, password, and Auth settings.";
      console.warn("Supabase sign in failed.", errorText);
      return null;
    }
    const session = await response.json();
    saveAuthSession(session);
    let profile = await getProfileForAuthUser(session.user);
    if (!profile) {
      profile = await createMissingAuthProfile(session.user);
      if (!profile) {
        lastAuthError = "Login worked, but SiteWorks could not create the missing profile. Run the Supabase SQL and try again.";
        return null;
      }
    }
    upsertLocalUser(profile);
    return profile;
  } catch (error) {
    lastAuthError = "Could not reach Supabase Auth. Local login will still work if this browser has a saved admin.";
    console.warn("Supabase sign in failed.", error);
    return null;
  }
}

async function createMissingAuthProfile(authUser) {
  if (!authUser?.id) return null;
  const profile = {
    id: authUser.id,
    username: authUser.email || "",
    name: authUser.user_metadata?.name || authUser.email || "Admin",
    role: "Admin",
    customerId: "",
    createdAt: new Date().toISOString()
  };
  await saveSupabaseProfile(profile);
  upsertLocalUser(profile);
  return profile;
}

function readableSupabaseError(errorText) {
  try {
    const error = JSON.parse(errorText);
    return error.msg || error.message || error.error_description || error.error || "";
  } catch {
    return errorText || "";
  }
}

async function signUpSupabaseUser(email, password, name, role, customerId) {
  lastAuthError = "";
  try {
    const response = await supabaseAuthFetch("signup", {
      method: "POST",
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        data: { name }
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      lastAuthError = readableSupabaseError(errorText) || "Supabase could not create this user.";
      console.warn("Supabase sign up failed.", errorText);
      return null;
    }
    const authData = await response.json();
    const authUser = authData.user || authData;
    const session = authData.session || (authData.access_token ? authData : null);
    if (!authUser?.id) {
      lastAuthError = "Supabase created no user record. Check Auth email settings.";
      return null;
    }
    const profile = {
      id: authUser.id,
      username: authUser.email || email.trim().toLowerCase(),
      name: name || authUser.email || email,
      role,
      customerId,
      createdAt: new Date().toISOString(),
      session
    };
    await saveSupabaseProfile(profile);
    upsertLocalUser(profile);
    return profile;
  } catch (error) {
    console.warn("Supabase sign up failed.", error);
    return null;
  }
}

async function loadSupabaseProfiles() {
  if (authProfilesLoading) return;
  authProfilesLoading = true;
  try {
    const response = await supabaseFetch("profiles?select=*&order=created_at.asc");
    authProfilesLoading = false;
    authProfilesLoaded = true;
    if (!response.ok) {
      console.warn("Supabase profiles sync skipped.", await response.text());
      return;
    }
    const profiles = await response.json();
    const scanUser = state.users.find((user) => user.username === "scan-customer");
    state.users = [
      ...(scanUser ? [scanUser] : []),
      ...profiles.map(profileFromSupabase)
    ];
    restoreSavedSessionUser();
    persistLocalStateOnly();
    render();
  } catch (error) {
    authProfilesLoading = false;
    authProfilesLoaded = true;
    console.warn("Supabase profiles sync skipped.", error);
  }
}

async function saveSupabaseProfile(profile) {
  const payload = {
    id: profile.id,
    email: profile.username,
    name: profile.name || profile.username,
    role: profile.role || "Customer",
    customer_id: profile.role === "Admin" ? "" : profile.customerId || "",
    updated_at: new Date().toISOString()
  };
  const response = await supabaseFetch("profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) console.warn("Supabase profile save skipped.", await response.text());
}

async function deleteSupabaseProfile(userId) {
  const response = await supabaseFetch(`profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: "DELETE"
  });
  if (!response.ok) console.warn("Supabase profile delete skipped.", await response.text());
}

async function getProfileForAuthUser(authUser) {
  if (!authUser?.id) return null;
  const response = await supabaseFetch(`profiles?id=eq.${encodeURIComponent(authUser.id)}&select=*&limit=1`);
  if (!response.ok) {
    console.warn("Supabase profile lookup failed.", await response.text());
    return null;
  }
  const rows = await response.json();
  return rows?.[0] ? profileFromSupabase(rows[0]) : null;
}

function profileFromSupabase(profile) {
  return {
    id: profile.id,
    username: profile.email || "",
    name: profile.name || profile.email || "User",
    password: "",
    role: profile.role || "Customer",
    customerId: profile.customer_id || "",
    createdAt: profile.created_at || new Date().toISOString(),
    updatedAt: profile.updated_at || ""
  };
}

function upsertLocalUser(user) {
  const cleanUser = {
    ...user,
    password: "",
    username: user.username || user.email || "",
    customerId: user.role === "Admin" ? "" : user.customerId || ""
  };
  const index = state.users.findIndex((item) => item.id === cleanUser.id || item.username.toLowerCase() === cleanUser.username.toLowerCase());
  if (index >= 0) {
    state.users[index] = { ...state.users[index], ...cleanUser };
  } else {
    state.users.push(cleanUser);
  }
}

function restoreSavedSessionUser() {
  if (currentUser || isPublicReportUrl()) return;
  const savedSession = getSavedAuthSession();
  const sessionUserId = savedSession?.user?.id || "";
  if (!sessionUserId) return;
  const user = state.users.find((item) => item.id === sessionUserId);
  if (!user || user.username === "scan-customer") return;
  currentUser = user;
  currentRole = user.role || "Customer";
  state.currentUserId = user.id;
}

function saveAuthSession(session) {
  if (!session?.access_token) return;
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function getSavedAuthSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

async function loadSharedStateFromSupabase() {
  if (sharedStateLoading || !SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  sharedStateLoading = true;
  const localHadSharedData = hasSharedMaintenanceData(state);

  try {
    const response = await supabaseFetch(`app_state?id=eq.${encodeURIComponent(SHARED_APP_STATE_ID)}&select=data,updated_at`);
    sharedStateLoading = false;
    sharedStateReady = true;

    if (!response.ok) {
      console.warn("Supabase shared data sync skipped.", await response.text());
      return;
    }

    const rows = await response.json();
    const remoteRecord = rows?.[0];
    if (!remoteRecord?.data) {
      if (localHadSharedData) scheduleSharedStateSave(0);
      return;
    }

    if (!localHadSharedData || isRemoteSharedStateNewer(remoteRecord.updated_at)) {
      applySharedState(remoteRecord.data, remoteRecord.updated_at);
      return;
    }
  } catch (error) {
    sharedStateLoading = false;
    sharedStateReady = true;
    console.warn("Supabase shared data sync skipped.", error);
  }
}

function applySharedState(sharedData, updatedAt = "") {
  const localUsers = state.users || [];
  const localAccessRequests = state.accessRequests || [];
  const localCurrentUserId = state.currentUserId || "";
  applyingSharedState = true;
  state = normalizeState({
    ...state,
    ...sharedData,
    users: localUsers,
    accessRequests: localAccessRequests,
    currentUserId: localCurrentUserId,
    sharedDataUpdatedAt: updatedAt || sharedData.sharedDataUpdatedAt || ""
  });
  currentUser = state.users.find((user) => user.id === state.currentUserId) || currentUser;
  currentRole = currentUser?.role || "Customer";
  selectedCustomerId = selectedCustomerId || state.customers[0]?.id || "";
  selectedLocationId = "all";
  selectedId = getAssetIdFromUrl() || state.assets[0]?.id || null;
  persistLocalStateOnly();
  applyingSharedState = false;
  render();
  window.setTimeout(syncLoginQrReportPrompt, 0);
}

function isRemoteSharedStateNewer(remoteUpdatedAt = "") {
  const remoteTime = Date.parse(remoteUpdatedAt || "");
  const localTime = Date.parse(state.sharedDataUpdatedAt || "");
  return Number.isFinite(remoteTime) && (!Number.isFinite(localTime) || remoteTime > localTime);
}

function scheduleSharedStateSave(delay = 1200) {
  if (!sharedStateReady || applyingSharedState || isPublicReportUrl() || !hasSharedMaintenanceData(state)) return;
  window.clearTimeout(sharedStateSaveTimer);
  sharedStateSaveTimer = window.setTimeout(saveSharedStateToSupabase, delay);
}

async function saveSharedStateToSupabase() {
  if (!sharedStateReady || applyingSharedState || !hasSharedMaintenanceData(state)) return;
  const uploadedAt = new Date().toISOString();
  const payload = {
    id: SHARED_APP_STATE_ID,
    data: buildSharedStatePayload(uploadedAt),
    updated_at: uploadedAt
  };

  try {
    const response = await supabaseFetch("app_state?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      console.warn("Supabase shared data save skipped.", await response.text());
      return;
    }
    state.sharedDataUpdatedAt = uploadedAt;
    persistLocalStateOnly();
  } catch (error) {
    console.warn("Supabase shared data save skipped.", error);
  }
}

function buildSharedStatePayload(uploadedAt) {
  return {
    customers: state.customers || [],
    locations: state.locations || [],
    templates: state.templates || [],
    assets: state.assets || [],
    workOrders: state.workOrders || [],
    activityLog: state.activityLog || [],
    backupLocation: state.backupLocation || defaultBackupLocation(),
    qrBaseUrl: state.qrBaseUrl || guessNetworkQrUrl(),
    sharedDataUpdatedAt: uploadedAt
  };
}

function hasSharedMaintenanceData(candidate) {
  return Boolean(
    candidate?.customers?.length ||
    candidate?.locations?.length ||
    candidate?.assets?.length ||
    candidate?.workOrders?.length
  );
}

function scheduleStructuredDataSync(delay = 2000) {
  if (applyingSharedState || isPublicReportUrl() || !hasSharedMaintenanceData(state)) return;
  window.clearTimeout(structuredSyncTimer);
  structuredSyncTimer = window.setTimeout(syncStructuredDataToSupabase, delay);
}

async function syncStructuredDataToSupabase() {
  if (structuredSyncActive || !hasSharedMaintenanceData(state)) return;
  structuredSyncActive = true;
  try {
    await upsertStructuredRows("customers", state.customers.map((customer) => ({
      id: customer.id,
      name: customer.name || "",
      created_at: customer.createdAt || new Date().toISOString(),
      updated_at: customer.updatedAt || state.updatedAt || new Date().toISOString()
    })));

    await upsertStructuredRows("locations", state.locations.map((locationRecord) => ({
      id: locationRecord.id,
      customer_id: locationRecord.customerId,
      name: locationRecord.name || "",
      created_at: locationRecord.createdAt || new Date().toISOString(),
      updated_at: locationRecord.updatedAt || state.updatedAt || new Date().toISOString()
    })));

    await upsertStructuredRows("pm_templates", state.templates.map((template) => ({
      id: template.id,
      name: template.name || "",
      items: template.items || [],
      created_at: template.createdAt || new Date().toISOString(),
      updated_at: template.updatedAt || state.updatedAt || new Date().toISOString()
    })));

    await upsertStructuredRows("assets", state.assets.map((asset) => ({
      id: asset.id,
      customer_id: asset.customerId,
      location_id: asset.locationId,
      template_id: asset.templateId || null,
      name: asset.name || "",
      frequency_days: Number(asset.frequencyDays || 30),
      next_pm_date: asset.nextPmDate || null,
      manufacturer: asset.manufacturer || "",
      model: asset.model || "",
      serial: asset.serial || "",
      install_date: asset.installDate || null,
      type: asset.type || "",
      criticality: asset.criticality || "",
      document_url: asset.documentUrl || "",
      vendor: asset.vendor || "",
      vendor_contact: asset.vendorContact || "",
      warranty_date: asset.warrantyDate || null,
      parts: asset.parts || "",
      notes: asset.notes || "",
      created_at: asset.createdAt || new Date().toISOString(),
      updated_at: asset.updatedAt || state.updatedAt || new Date().toISOString()
    })));

    await upsertStructuredRows("work_orders", state.workOrders.map((item) => ({
      id: item.id,
      asset_id: item.assetId || null,
      customer_id: item.customerId || null,
      location_id: item.locationId || null,
      title: item.title || "",
      priority: item.priority || "Medium",
      status: item.status || "Open",
      source: item.source || "",
      area_name: item.areaName || "",
      notes: item.notes || "",
      due_at: item.dueAt || null,
      resolved_at: item.resolvedAt || null,
      created_at: item.createdAt || new Date().toISOString(),
      updated_at: item.updatedAt || state.updatedAt || new Date().toISOString()
    })));

    const historyRows = state.assets.flatMap((asset) => (asset.history || []).map((item) => ({
      id: item.id,
      asset_id: asset.id,
      technician: item.technician || "",
      result: item.result || "",
      reading: item.reading || "",
      notes: item.notes || "",
      completed_checks: item.completedChecks || [],
      completed_at: item.completedAt || new Date().toISOString()
    })));
    await upsertStructuredRows("pm_history", historyRows);
  } catch (error) {
    console.warn("Structured Supabase sync skipped.", error);
  } finally {
    structuredSyncActive = false;
  }
}

async function upsertStructuredRows(table, rows) {
  if (!rows.length) return;
  const response = await supabaseFetch(`${table}?on_conflict=id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(rows)
  });
  if (!response.ok) {
    console.warn(`Structured Supabase sync skipped for ${table}.`, await response.text());
  }
}

function isCodexTestPublicReport(report) {
  const note = String(report.note || "");
  return note === "Codex connectivity test" ||
    note.startsWith("Local submit test from Codex") ||
    note.startsWith("Codex remote insert check") ||
    note.startsWith("Codex public report submit check");
}

function createIssueFromRemoteReport(report) {
  const asset = report.equipment_id ? getRawAsset(report.equipment_id) : null;
  const customerId = asset?.customerId || report.customer_id || "";
  const locationId = asset?.locationId || report.location_id || "";
  return {
    id: crypto.randomUUID(),
    remoteReportId: report.id,
    assetId: asset?.id || report.equipment_id || "",
    customerId,
    locationId,
    areaName: asset ? "" : report.location_name || "Area report",
    source: "Public QR report",
    title: `Customer report: ${asset?.name || report.equipment_name || report.location_name || "Area"}`,
    priority: "Medium",
    status: "Open",
    dueAt: addDays(new Date(report.created_at || Date.now()), 3).toISOString(),
    notes: [
      report.note || "",
      report.contact ? `Contact: ${report.contact}` : "",
      "Source: public QR report"
    ].filter(Boolean).join("\n"),
    photo: report.photo_data_url ? { name: report.photo_name || "Report photo", dataUrl: report.photo_data_url } : null,
    createdAt: report.created_at || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function getCompactAssetSnapshot(id) {
  const hashParamsText = location.hash.split("?")[1];
  const params = new URLSearchParams(location.search || hashParamsText || "");
  const name = params.get("n");
  if (!name) return null;
  const customerName = params.get("c") || "Scanned Customer";
  const locationName = params.get("l") || "Scanned Location";
  const templateName = params.get("t") || "General Equipment PM";
  const customerId = `scan-customer-${slugify(customerName)}`;
  const locationId = `scan-location-${slugify(customerName)}-${slugify(locationName)}`;
  const templateId = `scan-template-${slugify(templateName)}`;
  return {
    customer: {
      id: customerId,
      name: customerName,
      createdAt: new Date().toISOString()
    },
    location: {
      id: locationId,
      customerId,
      name: locationName,
      createdAt: new Date().toISOString()
    },
    template: {
      id: templateId,
      name: templateName,
      items: DEFAULT_TEMPLATE_ITEMS,
      createdAt: new Date().toISOString()
    },
    asset: {
      id,
      customerId,
      locationId,
      templateId,
      name,
      nextPmDate: params.get("d") || "",
      manufacturer: "",
      model: "",
      serial: params.get("s") || "",
      installDate: "",
      notes: "",
      frequencyDays: Number(params.get("f")) || 30,
      createdAt: new Date().toISOString(),
      history: []
    }
  };
}

function getCompactAssetParams(id) {
  const asset = getAsset(id);
  if (!asset) return "";
  const customer = getCustomer(asset.customerId);
  const locationRecord = getLocation(asset.locationId);
  const template = getTemplate(asset.templateId);
  const params = new URLSearchParams();
  params.set("n", asset.name);
  if (customer?.name) params.set("c", customer.name);
  if (locationRecord?.name) params.set("l", locationRecord.name);
  if (template?.name) params.set("t", template.name);
  params.set("f", String(asset.frequencyDays || 30));
  if (asset.serial) params.set("s", asset.serial);
  if (asset.nextPmDate) params.set("d", asset.nextPmDate);
  return params.toString();
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function qrUrl(value) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(value)}`;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) return saved;

    for (const key of LEGACY_KEYS) {
      const legacy = JSON.parse(localStorage.getItem(key));
      if (legacy) return legacy;
    }
  } catch {
    return emptyState();
  }

  return emptyState();
}

function getCurrentSessionUser() {
  const loaded = loadState();
  const normalized = normalizeState(loaded);
  const savedSession = getSavedAuthSession();
  if (!savedSession?.user?.id) return null;
  const sessionUserId = savedSession.user.id;
  return normalized.users.find((user) => user.id === sessionUserId) || null;
}

function getInitialUser() {
  const user = getCurrentSessionUser();
  if (user?.username && user.username !== "scan-customer") {
    return user;
  }

  if (user?.username === "scan-customer") {
    state.currentUserId = "";
    saveState();
    return null;
  }
  return user;
}

function normalizeState(input) {
  const normalized = {
    customers: input.customers || [],
    locations: input.locations || [],
    templates: input.templates?.length ? input.templates : seedTemplates(),
    assets: input.assets || [],
    workOrders: input.workOrders || [],
    users: input.users || [],
    accessRequests: input.accessRequests || [],
    activityLog: input.activityLog || [],
    currentUserId: input.currentUserId || "",
    backupLocation: input.backupLocation || defaultBackupLocation(),
    qrBaseUrl: input.qrBaseUrl || guessNetworkQrUrl(),
    updatedAt: input.updatedAt || "",
    sharedDataUpdatedAt: input.sharedDataUpdatedAt || ""
  };
  const defaultCustomer = normalized.customers[0] || { id: crypto.randomUUID(), name: "Default Customer", createdAt: new Date().toISOString() };
  const defaultLocation = normalized.locations[0] || { id: crypto.randomUUID(), customerId: defaultCustomer.id, name: "Default Location", createdAt: new Date().toISOString() };

  if (!normalized.customers.length && normalized.assets.length) normalized.customers.push(defaultCustomer);
  if (!normalized.locations.length && normalized.assets.length) normalized.locations.push(defaultLocation);

  normalized.assets = normalized.assets.map((asset) => ({
    customerId: asset.customerId || defaultCustomer.id,
    locationId: asset.locationId || defaultLocation.id,
    templateId: asset.templateId || normalized.templates[0].id,
    nextPmDate: asset.nextPmDate || "",
    manufacturer: asset.manufacturer || "",
    model: asset.model || "",
    serial: asset.serial || "",
    installDate: asset.installDate || "",
    vendor: asset.vendor || "",
    vendorContact: asset.vendorContact || "",
    warrantyDate: asset.warrantyDate || "",
    parts: asset.parts || "",
    type: asset.type || "",
    criticality: asset.criticality || "",
    documentUrl: asset.documentUrl || "",
    manualFile: asset.manualFile || null,
    photo: asset.photo || null,
    photos: asset.photos || [],
    notes: asset.notes || "",
    history: (asset.history || []).map((item) => ({ photo: null, ...item })),
    ...asset
  }));

  normalized.users = normalized.users.map((user) => ({
    ...user,
    customerId: user.role !== "Admin" && user.username !== "scan-customer"
      ? user.customerId || normalized.customers[0]?.id || ""
      : user.customerId || ""
  }));

  return normalized;
}

function emptyState() {
  return {
    customers: [],
    locations: [],
    templates: seedTemplates(),
    assets: [],
    workOrders: [],
    users: [],
    accessRequests: [],
    activityLog: [],
    currentUserId: "",
    backupLocation: defaultBackupLocation(),
    qrBaseUrl: guessNetworkQrUrl(),
    updatedAt: "",
    sharedDataUpdatedAt: ""
  };
}

function defaultBackupLocation() {
  return "C:\\Users\\expli\\Documents\\SiteWorks Backups\\Data Backups";
}

function guessNetworkQrUrl() {
  if (location.protocol.startsWith("http") && location.hostname !== "127.0.0.1" && location.hostname !== "localhost") {
    return getCurrentPageUrl();
  }
  return "http://10.0.0.12:8766/index.html";
}

function saveState() {
  state.updatedAt = new Date().toISOString();
  persistLocalStateOnly();
  scheduleSharedStateSave();
  scheduleStructuredDataSync();
}

function persistLocalStateOnly() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    try {
      localStorage.removeItem(AUTO_BACKUP_KEY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (retryError) {
      alert("The browser could not save this file. Try one smaller photo first, or export a backup and remove a few old photos.");
      throw retryError;
    }
  }
  try {
    createAutoBackup();
  } catch (error) {
    console.warn("Auto backup skipped because browser storage is full.", error);
  }
}

function addActivity(action, details = "") {
  state.activityLog = [
    {
      id: crypto.randomUUID(),
      action,
      details,
      userId: currentUser?.id || "",
      userName: currentUser?.name || currentUser?.username || "System",
      userRole: currentRole || "System",
      createdAt: new Date().toISOString()
    },
    ...(state.activityLog || [])
  ].slice(0, 200);
}

function createAutoBackup() {
  const backup = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    version: 3,
    state
  };
  const backups = [backup, ...getAutoBackups()].slice(0, MAX_AUTO_BACKUPS);
  writeAutoBackups(backups);
}

function getAutoBackups() {
  try {
    return JSON.parse(localStorage.getItem(AUTO_BACKUP_KEY)) || [];
  } catch {
    return [];
  }
}

function writeAutoBackups(backups) {
  let remaining = backups;
  while (remaining.length) {
    try {
      localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(remaining));
      return;
    } catch {
      remaining = remaining.slice(0, -1);
    }
  }
}

function exportDataBackup(reason = "manual") {
  const payload = buildBackupPayload(reason);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = reason === "logout"
    ? `siteworks-logout-backup-${timestampForFile()}.json`
    : `siteworks-data-backup-${timestampForFile()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportCompleteBackup() {
  const payload = buildBackupPayload("complete");
  const prettyPayload = JSON.stringify(payload, null, 2);
  payload.manifest.approximateFileSize = formatBytes(new Blob([prettyPayload], { type: "application/json" }).size);
  const finalPayload = JSON.stringify(payload, null, 2);
  const blob = new Blob([finalPayload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `siteworks-complete-backup-${timestampForFile()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function buildBackupPayload(reason) {
  return {
    app: "SiteWorks",
    version: 4,
    backupReason: reason,
    exportedAt: new Date().toISOString(),
    manifest: buildBackupManifest(),
    state
  };
}

function buildBackupManifest() {
  const primaryPhotos = state.assets.filter((asset) => asset.photo?.dataUrl).length;
  const extraPhotos = state.assets.reduce((total, asset) => total + (asset.photos || []).length, 0);
  const pmPhotos = state.assets.reduce((total, asset) => (
    total + (asset.history || []).filter((item) => item.photo?.dataUrl).length
  ), 0);
  const uploadedManuals = state.assets.filter((asset) => asset.manualFile?.dataUrl).length;
  return {
    backupLocation: state.backupLocation || defaultBackupLocation(),
    customers: state.customers.length,
    locations: state.locations.length,
    assets: state.assets.length,
    users: state.users.length,
    activityLogEntries: state.activityLog?.length || 0,
    pmTemplates: state.templates.length,
    workOrders: state.workOrders.length,
    publicQrReports: state.workOrders.filter((item) => item.source === "Public QR report").length,
    maintenanceHistoryRecords: state.assets.reduce((total, asset) => total + (asset.history || []).length, 0),
    primaryAssetPhotos: primaryPhotos,
    extraAssetPhotos: extraPhotos,
    pmEvidencePhotos: pmPhotos,
    uploadedPdfManuals: uploadedManuals,
    manualLinks: state.assets.filter((asset) => asset.documentUrl).length,
    note: "This complete backup includes the app data plus any uploaded photos and PDF manuals currently stored in the browser."
  };
}

async function importDataBackup(file) {
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const importedState = payload.state || payload;
    state = normalizeState(importedState);
    currentUser = state.users.find((user) => user.id === state.currentUserId) || null;
    currentRole = currentUser?.role || "Customer";
    selectedCustomerId = state.customers[0]?.id || "";
    selectedLocationId = "all";
    selectedId = state.assets[0]?.id || null;
    addActivity("Data imported", file.name || "Backup file");
    saveState();
    if (selectedId) location.hash = `asset/${selectedId}`;
    render();
  } catch {
    alert("That backup file could not be imported. Please choose a valid SiteWorks data backup JSON file.");
  }
}

function restoreLatestAutoBackup() {
  const latest = getAutoBackups()[0];
  if (!latest) return;
  state = normalizeState(latest.state);
  currentUser = state.users.find((user) => user.id === state.currentUserId) || null;
  currentRole = currentUser?.role || "Customer";
  selectedCustomerId = state.customers[0]?.id || "";
  selectedLocationId = "all";
  selectedId = state.assets[0]?.id || null;
  addActivity("Latest auto backup restored", formatDateTime(new Date(latest.createdAt)));
  saveState();
  if (selectedId) location.hash = `asset/${selectedId}`;
  render();
}

function seedTemplates() {
  return [
    {
      id: crypto.randomUUID(),
      name: "General Equipment PM",
      items: DEFAULT_TEMPLATE_ITEMS,
      createdAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      name: "HVAC Monthly PM",
      items: ["Inspect belts and pulleys", "Check filter condition", "Inspect drain pan", "Record supply air temperature"],
      createdAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      name: "Generator PM",
      items: ["Check oil level", "Inspect battery terminals", "Run test start", "Record voltage output"],
      createdAt: new Date().toISOString()
    }
  ];
}

function seedDemo() {
  const templates = seedTemplates();
  state.templates = templates;
  const northstar = { id: crypto.randomUUID(), name: "Northstar Foods", createdAt: new Date().toISOString() };
  const apex = { id: crypto.randomUUID(), name: "Apex Industrial", createdAt: new Date().toISOString() };
  const northPlant = demoLocation(northstar.id, "Main Processing Plant");
  const coldStorage = demoLocation(northstar.id, "Cold Storage Warehouse");
  const apexShop = demoLocation(apex.id, "Fabrication Shop");
  const rooftop = demoAsset("Rooftop Unit 1", northstar.id, northPlant.id, templates[1].id, 30, -34, "Passed", {
    manufacturer: "Trane",
    model: "XR-14",
    serial: "RTU-10492",
    installDate: "2021-04-12",
    notes: "Roof hatch access through north stairwell."
  });
  const conveyor = demoAsset("Packaging Line Conveyor", northstar.id, northPlant.id, templates[0].id, 7, -9, "Needs attention", {
    manufacturer: "Dorner",
    model: "2200 Series",
    serial: "CNV-7791",
    installDate: "2022-09-01",
    notes: "Belt tracking issue appears every few weeks."
  });
  const freezer = demoAsset("Freezer Door Seal", northstar.id, coldStorage.id, templates[0].id, 30, -42, "Passed", {
    manufacturer: "Chase",
    model: "ColdGuard",
    serial: "FRZ-2210",
    installDate: "2020-11-18",
    notes: "Inspect after forklift traffic."
  });
  const compressor = demoAsset("Air Compressor", apex.id, apexShop.id, templates[0].id, 7, -3, "Passed", {
    manufacturer: "Ingersoll Rand",
    model: "UP6",
    serial: "AIR-9002",
    installDate: "2019-06-15",
    notes: "Drain condensate weekly."
  });
  const generator = demoAsset("Emergency Generator", apex.id, apexShop.id, templates[2].id, 30, -39, "Failed", {
    manufacturer: "Generac",
    model: "Protector 45kW",
    serial: "GEN-4588",
    installDate: "2018-03-21",
    notes: "Critical backup asset."
  });

  state = {
    customers: [northstar, apex],
    locations: [northPlant, coldStorage, apexShop],
    templates,
    assets: [rooftop, conveyor, freezer, compressor, generator],
    workOrders: [
      createWorkOrderFromPm(conveyor, conveyor.history[0]),
      createWorkOrderFromPm(generator, generator.history[0])
    ],
    users: state.users || [],
    currentUserId: currentUser?.id || ""
  };
  selectedCustomerId = state.customers[0].id;
  selectedLocationId = "all";
  selectedId = state.assets[0].id;
  saveState();
  location.hash = `asset/${selectedId}`;
  render();
}

function demoLocation(customerId, name) {
  return {
    id: crypto.randomUUID(),
    customerId,
    name,
    createdAt: new Date().toISOString()
  };
}

function demoAsset(name, customerId, locationId, templateId, frequencyDays, completedDaysAgo, result, details) {
  return {
    id: crypto.randomUUID(),
    customerId,
    locationId,
    templateId,
    name,
    frequencyDays,
    nextPmDate: "",
    ...details,
    createdAt: addDays(today, -60).toISOString(),
    history: [
      {
        id: crypto.randomUUID(),
        completedAt: addDays(today, completedDaysAgo).toISOString(),
        technician: "Demo Tech",
        reading: "",
        notes: result === "Needs attention" || result === "Failed" ? "Follow-up work order recommended." : "Routine PM completed.",
        result,
        completedChecks: getTemplateItems(templateId),
        photo: null
      }
    ]
  };
}

function getTemplateItems(templateId) {
  return state.templates?.find((template) => template.id === templateId)?.items || DEFAULT_TEMPLATE_ITEMS;
}

function parseTemplateItems(value) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readPhoto(file) {
  if (!file) return null;
  const rawDataUrl = await fileToDataUrl(file);
  const dataUrl = await resizePhotoDataUrl(rawDataUrl, 1000, 0.72);
  return { name: file.name, dataUrl };
}

async function readPublicReportPhoto(file) {
  if (!file) return null;
  const rawDataUrl = await fileToDataUrl(file);
  const dataUrl = await resizePhotoDataUrl(rawDataUrl, 520, 0.45);
  return { name: file.name, dataUrl };
}

async function safeReadPublicReportPhoto(file) {
  lastPublicReportError = "";
  if (!file) return null;
  try {
    return await readPublicReportPhoto(file);
  } catch (error) {
    console.warn("Public report photo could not be read.", error);
    lastPublicReportError = "That photo could not be attached. Send the report with no photo first, then try a smaller photo if needed.";
    return null;
  }
}

async function readPhotos(files) {
  const selectedFiles = [...files].filter((file) => file.type.startsWith("image/"));
  return (await Promise.all(selectedFiles.map(readGalleryPhoto))).filter(Boolean);
}

async function readGalleryPhoto(file) {
  if (!file) return null;
  const rawDataUrl = await fileToDataUrl(file);
  const dataUrl = await resizePhotoDataUrl(rawDataUrl, 760, 0.64);
  return { name: file.name, dataUrl };
}

async function readDocumentFile(file, expectedType) {
  if (!file) return null;
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (expectedType === "application/pdf" && !isPdf) {
    alert("Please choose a PDF file.");
    return null;
  }
  if (file.size > 4 * 1024 * 1024) {
    alert("That PDF is too large for this browser prototype. Please use the manual link field for larger manuals. Smaller PDFs under 4 MB can be uploaded.");
    return null;
  }
  const dataUrl = await fileToDataUrl(file);
  return { name: file.name, type: file.type || expectedType || "application/octet-stream", dataUrl };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resizePhotoDataUrl(dataUrl, maxSize, quality) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

function downloadCsv(asset) {
  const customer = getCustomer(asset.customerId);
  const locationRecord = getLocation(asset.locationId);
  const rows = [
    ["Customer", "Location", "Asset", "Completed At", "Technician", "Result", "Reading", "Checks", "Notes", "Photo"],
    ...asset.history.map((item) => [
      customer?.name || "",
      locationRecord?.name || "",
      asset.name,
      item.completedAt,
      item.technician,
      item.result,
      item.reading,
      item.completedChecks.join("; "),
      item.notes,
      item.photo?.name || ""
    ])
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${asset.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-history.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadAssetRegisterCsv(assets) {
  const rows = [
    ["Customer", "Location", "Equipment", "Status", "Next Maintenance", "Open Issues", "Template", "Equipment Type", "Criticality", "Manufacturer", "Model", "Serial", "Install Date", "Vendor", "Vendor Contact", "Warranty Expires", "Parts / Supply Notes", "Manual / Document Link", "Uploaded Manual File", "Photo File", "Notes"],
    ...assets.map((asset) => {
      const customer = getCustomer(asset.customerId);
      const locationRecord = getLocation(asset.locationId);
      const template = getTemplate(asset.templateId);
      const due = getDueInfo(asset);
      return [
        customer?.name || "",
        locationRecord?.name || "",
        asset.name,
        due.label,
        due.nextDate.toISOString(),
        openWorkOrdersForAsset(asset.id).length,
        template?.name || "",
        asset.type,
        asset.criticality,
        asset.manufacturer,
        asset.model,
        asset.serial,
        asset.installDate,
        asset.vendor,
        asset.vendorContact,
        asset.warrantyDate,
        asset.parts,
        asset.documentUrl,
        asset.manualFile?.name || "",
        asset.photo?.name || "",
        asset.notes
      ];
    })
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `asset-register-${timestampForFile()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyText(value) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["bytes", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function usernameFromEmail(email) {
  const base = email.split("@")[0].replace(/[^a-z0-9]+/gi, "").toLowerCase() || "user";
  let username = base;
  let counter = 2;
  while (state.users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    username = `${base}${counter}`;
    counter += 1;
  }
  return username;
}

function isLastAdmin(user) {
  if (user.role !== "Admin") return false;
  return state.users.filter((item) => item.role === "Admin").length <= 1;
}

function safeDocumentLink(value) {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.href);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return `<a href="${escapeAttribute(url.href)}" target="_blank" rel="noopener">Open link</a>`;
  } catch {
    return "";
  }
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInputValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function timestampForFile() {
  const pad = (value) => String(value).padStart(2, "0");
  const now = new Date();
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
