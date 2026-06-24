const STORAGE_KEY = "qr-pm-prototype-v3";
const AUTO_BACKUP_KEY = "qr-pm-prototype-auto-backups-v1";
const MAX_AUTO_BACKUPS = 5;
const LEGACY_KEYS = ["qr-pm-prototype-v2", "qr-pm-prototype-v1"];
const SUPABASE_URL = "https://chpjmtfxmkcelszeixnu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_HduxX7ZCGdxQpT0xtDv7hQ_dVz_fAwr";
const ISSUE_REPORT_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-issue-report`;
const SHARED_APP_STATE_ID = "main";
const AUTH_SESSION_KEY = "qr-maintenance-supabase-session-v1";
const USER_SWITCH_ADMIN_KEY = "siteworks-user-switch-admin-v1";
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
let selectedId = getAssetIdFromUrl() || null;
let selectedCustomerId = state.customers[0]?.id || "";
let selectedLocationId = "all";
let selectedContractorCustomerId = selectedCustomerId;
let currentUser = getInitialUser();
let currentRole = currentUser?.role || "Customer";
let globalQuery = "";
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
  appShell: document.querySelector(".app-shell"),
  appSidebar: document.getElementById("appSidebar"),
  adminToolsDrawer: document.getElementById("adminToolsDrawer"),
  quickAddDrawer: document.getElementById("quickAddDrawer"),
  workHeader: document.getElementById("workHeader"),
  currentViewLabel: document.getElementById("currentViewLabel"),
  newActionBar: document.getElementById("newActionBar"),
  newEquipmentBtn: document.getElementById("newEquipmentBtn"),
  newIssueBtn: document.getElementById("newIssueBtn"),
  newServiceRequestBtn: document.getElementById("newServiceRequestBtn"),
  newIssueDrawer: document.getElementById("newIssueDrawer"),
  newIssueForm: document.getElementById("newIssueForm"),
  newIssueCustomer: document.getElementById("newIssueCustomer"),
  newIssueLocation: document.getElementById("newIssueLocation"),
  newIssueAsset: document.getElementById("newIssueAsset"),
  newIssueTargetEquipment: document.getElementById("newIssueTargetEquipment"),
  newIssueTargetArea: document.getElementById("newIssueTargetArea"),
  newIssueArea: document.getElementById("newIssueArea"),
  newIssueTitle: document.getElementById("newIssueTitle"),
  newIssuePriority: document.getElementById("newIssuePriority"),
  newIssueNotes: document.getElementById("newIssueNotes"),
  newIssuePhoto: document.getElementById("newIssuePhoto"),
  newIssueStatus: document.getElementById("newIssueStatus"),
  setupDrawer: document.getElementById("setupDrawer"),
  userDrawer: document.getElementById("userDrawer"),
  contractorDrawer: document.getElementById("contractorDrawer"),
  backupDrawer: document.getElementById("backupDrawer"),
  dashboardPanel: document.querySelector(".dashboard-panel"),
  userSwitcherWrap: document.getElementById("userSwitcherWrap"),
  userSwitcher: document.getElementById("userSwitcher"),
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
  customerContactName: document.getElementById("customerContactName"),
  customerContactEmail: document.getElementById("customerContactEmail"),
  customerContactPhone: document.getElementById("customerContactPhone"),
  customerContactNotes: document.getElementById("customerContactNotes"),
  customerCount: document.getElementById("customerCount"),
  customerList: document.getElementById("customerList"),
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
  contractorForm: document.getElementById("contractorForm"),
  contractorCustomer: document.getElementById("contractorCustomer"),
  contractorName: document.getElementById("contractorName"),
  contractorEmail: document.getElementById("contractorEmail"),
  contractorTrade: document.getElementById("contractorTrade"),
  contractorCount: document.getElementById("contractorCount"),
  contractorCustomerHint: document.getElementById("contractorCustomerHint"),
  contractorList: document.getElementById("contractorList"),
  activityLogCount: document.getElementById("activityLogCount"),
  activityLogList: document.getElementById("activityLogList"),
  locationForm: document.getElementById("locationForm"),
  locationCustomer: document.getElementById("locationCustomer"),
  locationName: document.getElementById("locationName"),
  locationContactName: document.getElementById("locationContactName"),
  locationContactEmail: document.getElementById("locationContactEmail"),
  locationContactPhone: document.getElementById("locationContactPhone"),
  locationContactNotes: document.getElementById("locationContactNotes"),
  locationCount: document.getElementById("locationCount"),
  locationList: document.getElementById("locationList"),
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
  assetImportDrawer: document.getElementById("assetImportDrawer"),
  assetImportFile: document.getElementById("assetImportFile"),
  assetImportCreateLocations: document.getElementById("assetImportCreateLocations"),
  assetImportBtn: document.getElementById("assetImportBtn"),
  assetImportStatus: document.getElementById("assetImportStatus"),
  assetImportPreview: document.getElementById("assetImportPreview"),
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
  assetRegisterDrawer: document.getElementById("assetRegisterDrawer"),
  customerFilterField: document.getElementById("customerFilterField"),
  customerFilter: document.getElementById("customerFilter"),
  locationFilter: document.getElementById("locationFilter"),
  globalSearch: document.getElementById("globalSearch"),
  globalSearchResults: document.getElementById("globalSearchResults"),
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
  serviceRequestsMetric: document.getElementById("serviceRequestsMetric"),
  highPriorityIssues: document.getElementById("highPriorityIssues"),
  waitingPartsIssues: document.getElementById("waitingPartsIssues"),
  reportedIssues: document.getElementById("reportedIssues"),
  activeLocations: document.getElementById("activeLocations"),
  assignedToMeIssues: document.getElementById("assignedToMeIssues"),
  workOrderCount: document.getElementById("workOrderCount"),
  workOrderList: document.getElementById("workOrderList"),
  completedPmCount: document.getElementById("completedPmCount"),
  completedPmList: document.getElementById("completedPmList"),
  serviceRequestCount: document.getElementById("serviceRequestCount"),
  serviceRequestList: document.getElementById("serviceRequestList"),
  serviceRequestCreateDrawer: document.getElementById("serviceRequestCreateDrawer"),
  serviceRequestForm: document.getElementById("serviceRequestForm"),
  serviceRequestCustomer: document.getElementById("serviceRequestCustomer"),
  serviceRequestLocation: document.getElementById("serviceRequestLocation"),
  serviceRequestAsset: document.getElementById("serviceRequestAsset"),
  serviceRequestPriority: document.getElementById("serviceRequestPriority"),
  serviceRequestRequestedBy: document.getElementById("serviceRequestRequestedBy"),
  serviceRequestPreferredDate: document.getElementById("serviceRequestPreferredDate"),
  serviceRequestTitle: document.getElementById("serviceRequestTitle"),
  serviceRequestNotes: document.getElementById("serviceRequestNotes"),
  serviceRequestPhoto: document.getElementById("serviceRequestPhoto"),
  serviceRequestStatus: document.getElementById("serviceRequestStatus"),
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

moveTopActionDrawers();
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
    rememberAdminUserSwitcher(localUser);
    restoreScannedAssetSelection();
    closeAssetRegisterDrawer();
    saveState();
    els.loginForm.reset();
    els.loginError.textContent = "";
    render();
    return;
  }

  currentUser = user;
  currentRole = user.role;
  state.currentUserId = user.id;
  rememberAdminUserSwitcher(user);
  restoreScannedAssetSelection();
  closeAssetRegisterDrawer();
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
  rememberAdminUserSwitcher(user);
  closeAssetRegisterDrawer();
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
    closeAssetRegisterDrawer();
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
    addWorkOrderHistory(issue, "Created", `${formatIssueNumber(issue)} - ${issue.title}`);
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

els.userSwitcher?.addEventListener("change", () => {
  const user = state.users.find((item) => item.id === els.userSwitcher.value);
  if (!user || !canUseUserSwitcher()) return;
  currentUser = user;
  currentRole = user.role;
  state.currentUserId = user.id;
  selectedCustomerId = visibleCustomers()[0]?.id || "";
  selectedLocationId = "all";
  selectedId = null;
  clearSelectedAssetUrl();
  closeAssetRegisterDrawer();
  persistLocalStateOnly();
  render();
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
  sessionStorage.removeItem(USER_SWITCH_ADMIN_KEY);
  clearAuthSession();
  if (!isQrAccessUrl()) {
    history.replaceState(null, "", getCurrentPageUrl());
  }
  saveState();
  render();
}

els.customerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canCreateCustomers()) return;
  const customer = {
    id: crypto.randomUUID(),
    name: els.customerName.value.trim(),
    contactName: els.customerContactName?.value.trim() || "",
    contactEmail: els.customerContactEmail?.value.trim() || "",
    contactPhone: els.customerContactPhone?.value.trim() || "",
    contactNotes: els.customerContactNotes?.value.trim() || "",
    createdAt: new Date().toISOString()
  };

  state.customers.push(customer);
  addActivity("Customer added", customer.name);
  selectedCustomerId = customer.id;
  selectedContractorCustomerId = customer.id;
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

els.customerList?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canManageSetup()) return;
  const form = event.target.closest("form[data-customer-id]");
  if (!form) return;
  const customer = getCustomer(form.dataset.customerId);
  if (!customer) return;
  if (!canManageCustomerSetup(customer.id)) return;
  const formData = new FormData(form);
  const nextName = String(formData.get("name") || "").trim();
  if (!nextName) return;

  customer.name = nextName;
  customer.contactName = String(formData.get("contactName") || "").trim();
  customer.contactEmail = String(formData.get("contactEmail") || "").trim();
  customer.contactPhone = String(formData.get("contactPhone") || "").trim();
  customer.contactNotes = String(formData.get("contactNotes") || "").trim();
  customer.updatedAt = new Date().toISOString();
  addActivity("Customer updated", customer.name);
  saveState();
  render();
});

els.userForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!canManageUsers()) return;
  const username = els.newUsername.value.trim().toLowerCase();
  if (state.users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    alert("That login name already exists.");
    return;
  }

  const newUserRole = els.newUserRole.value;
  if (!canCreateUserRole(newUserRole)) {
    alert("Managers can only add Customer or Technician users.");
    return;
  }
  const newUserCustomerId = newUserRole === "Admin" ? "" : els.newUserCustomer.value;
  if (!canManageUserCustomer(newUserCustomerId, newUserRole)) {
    alert("Managers can only add users for their assigned customer.");
    return;
  }
  const newUser = isEmailAddress(username)
    ? await signUpSupabaseUser(
      username,
      els.newUserPassword.value,
      els.newUserName.value.trim(),
      newUserRole,
      newUserCustomerId
    )
    : createLocalUser(
      username,
      els.newUserPassword.value,
      els.newUserName.value.trim(),
      newUserRole,
      newUserCustomerId
    );
  if (!newUser) {
    alert("Could not create that user. For shared cloud login, use an email address. For local testing, use a simple login name.");
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
  if (!canManageUsers()) return;
  const form = event.target.closest("form[data-user-id]");
  if (!form) return;
  const user = state.users.find((item) => item.id === form.dataset.userId);
  if (!user) return;
  if (!canEditUserRecord(user)) return;

  const formData = new FormData(form);
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "").trim();
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

  if (!canCreateUserRole(role) || !canManageUserCustomer(customerId, role)) {
    alert("Managers can only manage Customer or Technician users for their assigned customer.");
    return;
  }

  user.username = username;
  user.name = name;
  user.role = role;
  user.customerId = customerId;
  user.localOnly = user.localOnly || !isEmailAddress(username);
  if (user.localOnly && password) user.password = password;
  if (!user.localOnly && isEmailAddress(username)) user.password = "";
  user.updatedAt = new Date().toISOString();
  if (!user.localOnly && isEmailAddress(username)) await saveSupabaseProfile(user);
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
  if (!button || !canManageUsers()) return;
  const user = state.users.find((item) => item.id === button.dataset.userId);
  if (!user) return;
  if (!canEditUserRecord(user)) return;

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
  if (!canManageCustomerSetup(customerId)) return;
  const locationRecord = {
    id: crypto.randomUUID(),
    customerId,
    name: els.locationName.value.trim(),
    contactName: els.locationContactName?.value.trim() || "",
    contactEmail: els.locationContactEmail?.value.trim() || "",
    contactPhone: els.locationContactPhone?.value.trim() || "",
    contactNotes: els.locationContactNotes?.value.trim() || "",
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

els.locationList.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canManageSetup()) return;
  const form = event.target.closest("form[data-location-id]");
  if (!form) return;
  const locationRecord = getLocation(form.dataset.locationId);
  if (!locationRecord) return;
  const formData = new FormData(form);
  const oldCustomerId = locationRecord.customerId;
  const nextCustomerId = String(formData.get("customerId") || "");
  const nextName = String(formData.get("name") || "").trim();
  if (!nextCustomerId || !nextName) return;
  if (!canManageCustomerSetup(oldCustomerId) || !canManageCustomerSetup(nextCustomerId)) return;

  locationRecord.customerId = nextCustomerId;
  locationRecord.name = nextName;
  locationRecord.contactName = String(formData.get("contactName") || "").trim();
  locationRecord.contactEmail = String(formData.get("contactEmail") || "").trim();
  locationRecord.contactPhone = String(formData.get("contactPhone") || "").trim();
  locationRecord.contactNotes = String(formData.get("contactNotes") || "").trim();
  locationRecord.updatedAt = new Date().toISOString();

  if (oldCustomerId !== nextCustomerId) {
    state.assets
      .filter((asset) => asset.locationId === locationRecord.id)
      .forEach((asset) => {
        asset.customerId = nextCustomerId;
        asset.updatedAt = new Date().toISOString();
      });
    state.workOrders
      .filter((item) => item.locationId === locationRecord.id)
      .forEach((item) => {
        item.customerId = nextCustomerId;
        item.updatedAt = new Date().toISOString();
      });
    state.serviceRequests
      .filter((item) => item.locationId === locationRecord.id)
      .forEach((item) => {
        item.customerId = nextCustomerId;
        item.updatedAt = new Date().toISOString();
      });
  }

  selectedCustomerId = nextCustomerId;
  selectedLocationId = locationRecord.id;
  addActivity("Location updated", `${locationRecord.name} for ${getCustomer(nextCustomerId)?.name || "customer"}`);
  saveState();
  render();
});

els.locationList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-location-action='delete']");
  if (!button || !canManageSetup()) return;
  const locationRecord = getLocation(button.dataset.locationId);
  if (!locationRecord) return;
  if (!canManageCustomerSetup(locationRecord.customerId)) return;

  const locationAssets = state.assets.filter((asset) => asset.locationId === locationRecord.id);
  const locationWorkOrders = state.workOrders.filter((item) => item.locationId === locationRecord.id);
  const locationServiceRequests = state.serviceRequests.filter((item) => item.locationId === locationRecord.id);
  const customerName = getCustomer(locationRecord.customerId)?.name || "customer";
  const confirmed = window.confirm(
    `Delete ${locationRecord.name} for ${customerName}?\n\n` +
    `This will also delete ${locationAssets.length} equipment record(s), ${locationWorkOrders.length} issue(s), and ${locationServiceRequests.length} service request(s) tied to this location.`
  );
  if (!confirmed) return;

  await deleteLocation(locationRecord.id);
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

els.serviceRequestList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-view-photo]");
  if (!button) return;
  openPhotoViewer(button.dataset.photoSrc, button.dataset.photoCaption || "Service request photo");
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

els.globalSearch?.addEventListener("input", () => {
  globalQuery = els.globalSearch.value.trim().toLowerCase();
  assetPage = 1;
  render();
});

els.globalSearch?.addEventListener("focus", () => {
  renderGlobalSearchResults();
});

els.globalSearchResults?.addEventListener("click", (event) => {
  const result = event.target.closest("[data-search-result-type]");
  if (!result) return;
  openDashboardResult(result.dataset.searchResultType, result.dataset.searchResultId);
  els.globalSearchResults.classList.add("hidden");
});

document.addEventListener("click", (event) => {
  const result = event.target.closest("[data-dashboard-result-type]");
  if (!result) return;
  event.stopPropagation();
  openDashboardResult(result.dataset.dashboardResultType, result.dataset.dashboardResultId);
  closeMetricMenus();
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
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMetricMenu(button.dataset.dashboardFilter);
  });
});

els.newEquipmentBtn?.addEventListener("click", () => {
  if (!canAddEquipment()) return;
  toggleTopActionDrawer(els.quickAddDrawer);
});

document.addEventListener("click", (event) => {
  if (event.target.closest("#quickAddDrawer, #newIssueDrawer, #serviceRequestCreateDrawer, #newEquipmentBtn, #newIssueBtn, #newServiceRequestBtn")) return;
  closeTopActionDrawers();
  closeMetricMenus();
});

els.newIssueBtn?.addEventListener("click", () => {
  if (!canManageWorkOrders()) return;
  renderNewIssueFormOptions();
  toggleTopActionDrawer(els.newIssueDrawer);
});

els.newServiceRequestBtn?.addEventListener("click", () => {
  if (!canCreateServiceRequests() || !canManageWorkOrders()) return;
  renderServiceRequestFormOptions();
  toggleTopActionDrawer(els.serviceRequestCreateDrawer);
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
  selectedContractorCustomerId = selectedCustomerId;
  selectedLocationId = "all";
  selectedId = null;
  clearSelectedAssetUrl();
  assetPage = 1;
  render();
});

els.locationFilter.addEventListener("change", () => {
  selectedLocationId = els.locationFilter.value;
  selectedId = null;
  clearSelectedAssetUrl();
  assetPage = 1;
  render();
});

els.serviceRequestCustomer?.addEventListener("change", () => {
  renderServiceRequestFormOptions();
});

els.serviceRequestLocation?.addEventListener("change", () => {
  renderServiceRequestFormOptions();
});

els.newIssueCustomer?.addEventListener("change", () => {
  renderNewIssueFormOptions();
});

els.newIssueLocation?.addEventListener("change", () => {
  renderNewIssueFormOptions();
});

els.newIssueAsset?.addEventListener("change", () => {
  syncNewIssueTitle();
});

els.newIssueTargetEquipment?.addEventListener("change", () => {
  renderNewIssueFormOptions();
});

els.newIssueTargetArea?.addEventListener("change", () => {
  renderNewIssueFormOptions();
});

els.newIssueArea?.addEventListener("input", () => {
  syncNewIssueTitle();
  updateNewIssueSubmitState();
});

els.newIssueForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await createIssueFromTopAction();
});

els.serviceRequestForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await createServiceRequest();
});

els.assetRegisterDrawer?.addEventListener("toggle", () => {
  if (!els.assetRegisterDrawer.open) delete els.assetRegisterDrawer.dataset.openedByMetric;
});

els.assetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!canAddEquipment()) return;
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

  if (!canSeeCustomer(asset.customerId)) return;
  state.assets.unshift(asset);
  addActivity("Asset added", asset.name);
  selectedId = asset.id;
  selectedCustomerId = asset.customerId;
  selectedLocationId = "all";
  saveState();
  els.assetForm.reset();
  els.assetFrequency.value = "30";
  els.quickAddDrawer.open = false;
  location.hash = `asset/${asset.id}`;
  render();
});

els.assetImportBtn?.addEventListener("click", async () => {
  await importEquipmentCsv();
});

els.assetImportFile?.addEventListener("change", () => {
  if (els.assetImportStatus) els.assetImportStatus.textContent = "";
  if (els.assetImportPreview) els.assetImportPreview.innerHTML = "";
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
    pmNumber: nextPmNumber(),
    completedAt: new Date().toISOString(),
    technician: els.technician.value.trim(),
    reading: els.reading.value.trim(),
    notes: els.notes.value.trim(),
    result: els.result.value,
    completedChecks,
    photo
  };

  asset.history.unshift(historyItem);
  addActivity("PM completed", `${formatPmNumber(historyItem)} - ${asset.name} - ${historyItem.result}`);

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

els.contractorForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canManageContractors()) return;
  const name = els.contractorName.value.trim();
  const email = els.contractorEmail.value.trim();
  const trade = els.contractorTrade.value.trim();
  const customerId = currentRole === "Admin" ? els.contractorCustomer.value : currentUser?.customerId || "";
  if (!name || !isEmailAddress(email)) {
    alert("Enter a contractor name and valid email address.");
    return;
  }
  if (!canManageContractorCustomer(customerId)) {
    alert("Managers can only add contractors for their assigned customer.");
    return;
  }
  state.preferredContractors.push({
    id: crypto.randomUUID(),
    customerId,
    name,
    email,
    trade,
    createdAt: new Date().toISOString()
  });
  addActivity("Contractor added", `${name} | ${email}`);
  saveState();
  els.contractorForm.reset();
  selectedContractorCustomerId = customerId;
  render();
});

els.contractorCustomer?.addEventListener("change", () => {
  selectedContractorCustomerId = els.contractorCustomer.value;
  updateContractorCustomerHint();
  renderPreferredContractors();
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
  const panelToggle = event.target.closest("[data-panel-toggle]");
  if (panelToggle) {
    if (panelToggle.dataset.panelToggle === "dashboardPanel") return;
    togglePanel(panelToggle.dataset.panelToggle);
    return;
  }

  const scrollButton = event.target.closest("[data-scroll-target]");
  if (scrollButton) {
    document.getElementById(scrollButton.dataset.scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const pdfButton = event.target.closest("[data-work-order-pdf]");
  if (pdfButton) {
    const workOrder = getWorkOrder(pdfButton.dataset.workOrderPdf);
    if (workOrder) openIssuePdfForm(workOrder);
    return;
  }

  const emailButton = event.target.closest("[data-work-order-email]");
  if (emailButton) {
    const workOrder = getWorkOrder(emailButton.dataset.workOrderEmail);
    if (workOrder) emailIssueReport(workOrder);
    return;
  }

  const sendPdfButton = event.target.closest("[data-work-order-send-pdf]");
  if (sendPdfButton) {
    const workOrder = getWorkOrder(sendPdfButton.dataset.workOrderSendPdf);
    if (workOrder) sendIssuePdfEmail(workOrder, sendPdfButton);
    return;
  }

  const servicePdfButton = event.target.closest("[data-service-request-pdf]");
  if (servicePdfButton) {
    const request = getServiceRequest(servicePdfButton.dataset.serviceRequestPdf);
    if (request) openServiceRequestPdfForm(request);
    return;
  }

  const serviceEmailButton = event.target.closest("[data-service-request-email]");
  if (serviceEmailButton) {
    const request = getServiceRequest(serviceEmailButton.dataset.serviceRequestEmail);
    if (request) emailServiceRequest(request);
    return;
  }

  const serviceSendPdfButton = event.target.closest("[data-service-request-send-pdf]");
  if (serviceSendPdfButton) {
    const request = getServiceRequest(serviceSendPdfButton.dataset.serviceRequestSendPdf);
    if (request) sendServiceRequestPdfEmail(request, serviceSendPdfButton);
    return;
  }

  const completedPmButton = event.target.closest("[data-completed-pm-asset]");
  if (completedPmButton) {
    const asset = getAsset(completedPmButton.dataset.completedPmAsset);
    if (!asset) return;
    selectedId = asset.id;
    syncFiltersToSelectedAsset();
    location.hash = `asset/${selectedId}`;
    render();
    document.getElementById("assetPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const serviceActionButton = event.target.closest("[data-service-request-action]");
  if (serviceActionButton && canManageWorkOrders()) {
    updateServiceRequestStatus(serviceActionButton.dataset.serviceRequestId, serviceActionButton.dataset.serviceRequestAction);
    return;
  }

  const serviceConvertButton = event.target.closest("[data-service-request-convert]");
  if (serviceConvertButton && canManageWorkOrders()) {
    convertServiceRequestToIssue(serviceConvertButton.dataset.serviceRequestConvert);
    return;
  }

  const workOrderConvertButton = event.target.closest("[data-work-order-convert-service]");
  if (workOrderConvertButton && canManageWorkOrders()) {
    convertOpenIssueToServiceRequest(workOrderConvertButton.dataset.workOrderConvertService);
    return;
  }

  const contractorDeleteButton = event.target.closest("[data-delete-contractor]");
  if (contractorDeleteButton && canManageContractors()) {
    deletePreferredContractor(contractorDeleteButton.dataset.deleteContractor);
    return;
  }

  const button = event.target.closest("[data-work-order-action]");
  if (!button || !canManageWorkOrders()) return;
  const workOrder = getWorkOrder(button.dataset.workOrderId);
  if (!workOrder) return;

  const previousStatus = workOrder.status || "Open";
  workOrder.status = button.dataset.workOrderAction;
  if (workOrder.status === "Resolved" || workOrder.status === "Closed") {
    workOrder.resolvedAt = new Date().toISOString();
  }
  if (workOrder.status !== "Closed") {
    workOrder.resolvedAt = workOrder.status === "Resolved" ? workOrder.resolvedAt : "";
  }
  workOrder.updatedAt = new Date().toISOString();
  addWorkOrderHistory(workOrder, "Status changed", `${previousStatus} -> ${workOrder.status}`);
  addActivity("Work order updated", `${workOrder.title} - ${workOrder.status}`);
  saveState();
  render();
});

document.addEventListener("change", (event) => {
  const select = event.target.closest("[data-work-order-assignee]");
  if (!select || !canManageWorkOrders()) return;
  const workOrder = getWorkOrder(select.dataset.workOrderAssignee);
  if (!workOrder) return;
  const users = getAssignableUsersForWorkOrder(workOrder);
  const user = users.find((item) => item.id === select.value) || null;
  const previousAssignee = workOrder.assignedUserName || "Unassigned";
  workOrder.assignedUserId = user?.id || "";
  workOrder.assignedUserName = user ? user.name || user.username : "";
  workOrder.updatedAt = new Date().toISOString();
  addWorkOrderHistory(workOrder, "Assigned", `${previousAssignee} -> ${workOrder.assignedUserName || "Unassigned"}`);
  addActivity("Issue assigned", `${workOrder.title} - ${workOrder.assignedUserName || "Unassigned"}`);
  saveState();
  render();
});

document.addEventListener("change", (event) => {
  const select = event.target.closest("[data-service-request-assignee]");
  if (!select || !canManageWorkOrders()) return;
  const request = getServiceRequest(select.dataset.serviceRequestAssignee);
  if (!request) return;
  const users = getAssignableUsersForWorkOrder(request);
  const user = users.find((item) => item.id === select.value);
  const previousAssignee = request.assignedUserName || "Unassigned";
  request.assignedUserId = user?.id || "";
  request.assignedUserName = user?.name || user?.username || "";
  request.updatedAt = new Date().toISOString();
  addServiceRequestHistory(request, "Assigned", `${previousAssignee} -> ${request.assignedUserName || "Unassigned"}`);
  addActivity("Service request assigned", `${formatServiceRequestNumber(request)} - ${request.assignedUserName || "Unassigned"}`);
  saveState();
  render();
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-work-order-edit-form]");
  if (!form) return;
  event.preventDefault();
  if (!canManageWorkOrders()) return;
  const workOrder = getWorkOrder(form.dataset.workOrderEditForm);
  if (!workOrder) return;
  const formData = new FormData(form);
  const photo = await readPhoto(form.querySelector("input[name='photo']")?.files?.[0]);
  const before = {
    title: workOrder.title || "",
    priority: workOrder.priority || "Medium",
    status: workOrder.status || "Open",
    dueAt: workOrder.dueAt || "",
    notes: workOrder.notes || "",
    photoName: workOrder.photo?.name || ""
  };
  workOrder.title = String(formData.get("title") || "").trim() || workOrder.title;
  workOrder.priority = normalizePriority(formData.get("priority"));
  workOrder.status = String(formData.get("status") || workOrder.status);
  const dueDate = String(formData.get("dueDate") || "");
  workOrder.dueAt = dueDate ? parseLocalDate(dueDate).toISOString() : workOrder.dueAt;
  workOrder.notes = String(formData.get("notes") || "").trim();
  if (photo) workOrder.photo = photo;
  if (workOrder.status === "Resolved" || workOrder.status === "Closed") {
    workOrder.resolvedAt = workOrder.resolvedAt || new Date().toISOString();
  } else {
    workOrder.resolvedAt = "";
  }
  workOrder.updatedAt = new Date().toISOString();
  const changes = [];
  if (before.title !== workOrder.title) changes.push(`Title: ${before.title || "Not entered"} -> ${workOrder.title}`);
  if (before.priority !== workOrder.priority) changes.push(`Priority: ${before.priority} -> ${workOrder.priority}`);
  if (before.status !== workOrder.status) changes.push(`Status: ${before.status} -> ${workOrder.status}`);
  if (before.dueAt !== workOrder.dueAt) changes.push(`Due date updated`);
  if (before.notes !== workOrder.notes) changes.push("Notes updated");
  if (photo) changes.push("Photo updated");
  addWorkOrderHistory(workOrder, "Edited", changes.join(" | ") || "No visible changes");
  addActivity("Issue edited", `${formatIssueNumber(workOrder)} - ${workOrder.title}`);
  saveState();
  render();
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-service-request-edit-form]");
  if (!form) return;
  event.preventDefault();
  if (!canManageWorkOrders()) return;
  const request = getServiceRequest(form.dataset.serviceRequestEditForm);
  if (!request) return;
  const formData = new FormData(form);
  const photo = await readPhoto(form.querySelector("input[name='photo']")?.files?.[0]);
  const before = {
    title: request.title || "",
    priority: request.priority || "Medium",
    status: request.status || "New",
    preferredDate: request.preferredDate || "",
    requestedBy: request.requestedBy || "",
    notes: request.notes || "",
    photoName: request.photo?.name || ""
  };
  request.title = String(formData.get("title") || "").trim() || request.title;
  request.priority = normalizePriority(formData.get("priority"));
  request.status = String(formData.get("status") || request.status);
  request.preferredDate = String(formData.get("preferredDate") || "");
  request.requestedBy = String(formData.get("requestedBy") || "").trim();
  request.notes = String(formData.get("notes") || "").trim();
  if (photo) request.photo = photo;
  request.updatedAt = new Date().toISOString();
  const changes = [];
  if (before.title !== request.title) changes.push("request");
  if (before.priority !== request.priority) changes.push(`priority ${before.priority} -> ${request.priority}`);
  if (before.status !== request.status) changes.push(`status ${before.status} -> ${request.status}`);
  if (before.preferredDate !== request.preferredDate) changes.push("preferred date");
  if (before.requestedBy !== request.requestedBy) changes.push("requested by");
  if (before.notes !== request.notes) changes.push("details");
  if (photo && before.photoName !== request.photo?.name) changes.push("photo");
  addServiceRequestHistory(request, "Edited", changes.length ? changes.join(", ") : "Saved with no visible changes.");
  addActivity("Service request edited", `${formatServiceRequestNumber(request)} - ${request.title}`);
  saveState();
  render();
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-manual-issue-form]");
  if (!form) return;
  event.preventDefault();
  const asset = getAsset(form.dataset.manualIssueForm);
  if (!asset || !canManageWorkOrders()) return;
  const submitButton = form.querySelector("button[type='submit']");
  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Creating...";
    }
    const formData = new FormData(form);
    const photo = await readPhoto(form.querySelector("input[name='photo']")?.files?.[0]);
    createManualIssueForAsset(asset, {
      title: String(formData.get("title") || "").trim(),
      priority: String(formData.get("priority") || "Medium"),
      notes: String(formData.get("notes") || "").trim(),
      photo
    });
  } catch (error) {
    console.warn("Manual issue creation failed.", error);
    alert("Issue was not created. Try again with no photo or a smaller photo.");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Create Issue";
    }
  }
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
  renderPreferredContractors();
  renderAccessRequests();
  renderActivityLog();
  renderCustomers();
  renderLocations();
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
  renderServiceRequests();
  renderServiceRequestFormOptions();
  renderNewIssueFormOptions();
  renderCompletedPms();
  renderPanelToggles();

  const asset = getSelectedAsset();
  els.customerCount.textContent = manageableSetupCustomers().length;
  els.templateCount.textContent = state.templates.length;
  els.locationCount.textContent = state.locations.filter((locationRecord) =>
    manageableSetupCustomers().some((customer) => customer.id === locationRecord.customerId)
  ).length;
  els.assetCount.textContent = filteredAssets().length;
  els.emptyState.innerHTML = renderEmptyStateContent(asset);
  els.emptyState.classList.toggle("hidden", Boolean(asset));
  els.assetPanel.classList.toggle("hidden", !asset);
  renderPanelToggles();
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
  els.userSwitcherWrap?.classList.add("hidden");
  if (!isReport && !isLoggedIn && hasScannedAsset) setLoginQrReportStatus(Boolean(getScannedReportAsset()));
  syncLoginQrReportPrompt();
  els.firstAdminForm.classList.toggle("hidden", !needsFirstAdmin);
  els.appOnly.forEach((node) => node.classList.toggle("hidden", isReport || !isLoggedIn));
  if (isReport || !isLoggedIn) return;
  els.currentUserName.textContent = currentUser.name || currentUser.username;
  els.currentUserRole.textContent = currentUser.role;
  renderUserSwitcher();
}

function closeAssetRegisterDrawer() {
  if (!els.assetRegisterDrawer) return;
  els.assetRegisterDrawer.open = false;
  delete els.assetRegisterDrawer.dataset.openedByMetric;
}

function openAssetRegisterDrawer(openedByMetric = "") {
  if (!els.assetRegisterDrawer) return;
  if (openedByMetric) els.assetRegisterDrawer.dataset.openedByMetric = openedByMetric;
  els.assetRegisterDrawer.open = true;
}

function toggleAssetRegisterDrawer() {
  if (els.assetRegisterDrawer) els.assetRegisterDrawer.open = !els.assetRegisterDrawer.open;
}

function togglePanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const wasCollapsed = panel.classList.contains("is-collapsed");
  panel.classList.toggle("is-collapsed");
  if (panelId === "assetPanel" && wasCollapsed) closeSelectedAssetDrawers();
  renderPanelToggles();
}

function openPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const wasCollapsed = panel.classList.contains("is-collapsed");
  panel.classList.remove("is-collapsed");
  if (panelId === "assetPanel" && wasCollapsed) closeSelectedAssetDrawers();
  renderPanelToggles();
}

function closeSelectedAssetDrawers() {
  document.querySelectorAll("#assetPanel .asset-sub-drawer").forEach((drawer) => {
    drawer.open = false;
  });
}

function renderPanelToggles() {
  document.querySelectorAll(".panel-toggle[data-panel-toggle]").forEach((button) => {
    const panel = document.getElementById(button.dataset.panelToggle);
    if (!panel) return;
    button.textContent = panel.classList.contains("is-collapsed") ? "Show" : "Hide";
    button.setAttribute("aria-expanded", String(!panel.classList.contains("is-collapsed")));
  });
}

function rememberAdminUserSwitcher(user) {
  if (user?.role === "Admin") {
    sessionStorage.setItem(USER_SWITCH_ADMIN_KEY, user.id);
  }
}

function canUseUserSwitcher() {
  const adminId = sessionStorage.getItem(USER_SWITCH_ADMIN_KEY);
  return Boolean(adminId && state.users.some((user) => user.id === adminId && user.role === "Admin"));
}

function renderUserSwitcher() {
  const canSwitch = canUseUserSwitcher();
  els.userSwitcherWrap?.classList.toggle("hidden", !canSwitch);
  if (!canSwitch || !els.userSwitcher) return;
  const users = state.users
    .filter((user) => user.username !== "scan-customer")
    .sort((a, b) => `${a.role} ${a.name || a.username}`.localeCompare(`${b.role} ${b.name || b.username}`));
  els.userSwitcher.innerHTML = users.map((user) =>
    `<option value="${escapeAttribute(user.id)}" ${currentUser?.id === user.id ? "selected" : ""}>${escapeHtml(user.name || user.username)} (${escapeHtml(user.role)})</option>`
  ).join("");
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

function createLocalUser(username, password, name, role, customerId) {
  const cleanUsername = username.trim().toLowerCase();
  const cleanPassword = password.trim();
  if (!cleanUsername || !cleanPassword) return null;
  return {
    id: crypto.randomUUID(),
    username: cleanUsername,
    name: name || cleanUsername,
    password: cleanPassword,
    role: role || "Customer",
    customerId: role === "Admin" ? "" : customerId || "",
    createdAt: new Date().toISOString(),
    localOnly: true
  };
}

function isEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
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
  const userManagementAllowed = canManageUsers();
  const contractorManagementAllowed = canManageContractors();
  const isAdmin = currentRole === "Admin";
  const canCreateCustomerRecords = canCreateCustomers();
  const canManageTemplates = canManageTemplateSetup();
  const canAddAssets = canAddEquipment();
  const canUseNewActions = currentRole === "Admin" || currentRole === "Manager";
  const isCustomer = currentRole === "Customer";
  const hasSidebarAccess = isAdmin || setupDisabled === false || userManagementAllowed || contractorManagementAllowed;
  els.appShell?.classList.toggle("no-sidebar", !hasSidebarAccess);
  els.appSidebar?.classList.toggle("hidden", !hasSidebarAccess);
  els.dashboardPanel.classList.toggle("hidden", isCustomer);
  els.customerFilterField?.classList.toggle("hidden", !isAdmin);
  els.workHeader?.classList.toggle("hidden", !currentUser || isCustomer);
  els.newActionBar?.classList.toggle("hidden", !canUseNewActions);
  els.newEquipmentBtn?.classList.toggle("hidden", !canAddAssets);
  els.newIssueBtn?.classList.toggle("hidden", !canManageWorkOrders());
  els.newServiceRequestBtn?.classList.toggle("hidden", !canUseNewActions || !canCreateServiceRequests());
  if (els.newEquipmentBtn) els.newEquipmentBtn.disabled = !canAddAssets;
  if (els.newIssueBtn) els.newIssueBtn.disabled = !canManageWorkOrders();
  if (els.newServiceRequestBtn) els.newServiceRequestBtn.disabled = !canUseNewActions || !canCreateServiceRequests();
  els.adminToolsDrawer.classList.toggle("hidden", !hasSidebarAccess);
  if (!hasSidebarAccess) els.adminToolsDrawer.open = false;
  els.quickAddDrawer.classList.toggle("hidden", !canAddAssets);
  if (!canAddAssets) els.quickAddDrawer.open = false;
  els.newIssueDrawer?.classList.toggle("hidden", !canManageWorkOrders());
  if (!canManageWorkOrders() && els.newIssueDrawer) els.newIssueDrawer.open = false;
  els.serviceRequestCreateDrawer?.classList.toggle("hidden", !canUseNewActions || !canCreateServiceRequests());
  if ((!canUseNewActions || !canCreateServiceRequests()) && els.serviceRequestCreateDrawer) els.serviceRequestCreateDrawer.open = false;
  els.setupDrawer.classList.toggle("hidden", setupDisabled);
  if (setupDisabled) els.setupDrawer.open = false;
  els.backupDrawer.classList.toggle("hidden", !isAdmin);
  if (!isAdmin) els.backupDrawer.open = false;
  els.contractorDrawer.classList.toggle("hidden", !contractorManagementAllowed);
  if (!contractorManagementAllowed) els.contractorDrawer.open = false;
  els.userDrawer.classList.toggle("hidden", !userManagementAllowed);
  if (!userManagementAllowed) els.userDrawer.open = false;
  els.backupLocationBlock.classList.toggle("hidden", currentRole !== "Admin");
  els.backupLocationForm.querySelectorAll("input, button").forEach((control) => {
    control.disabled = currentRole !== "Admin";
  });
  [els.customerForm, els.templateForm, els.locationForm, els.assetForm, els.userForm, els.contractorForm].forEach((form) => {
    form.querySelectorAll("input, select, textarea, button").forEach((control) => {
      control.disabled = setupDisabled;
    });
  });
  els.customerForm.classList.toggle("hidden", !canCreateCustomerRecords);
  els.customerForm.querySelectorAll("input, select, textarea, button").forEach((control) => {
    control.disabled = !canCreateCustomerRecords;
  });
  els.templateForm.closest(".setup-subdrawer")?.classList.toggle("hidden", !canManageTemplates);
  els.templateForm.querySelectorAll("input, select, textarea, button").forEach((control) => {
    control.disabled = !canManageTemplates;
  });
  els.locationForm.querySelectorAll("input, select, textarea, button").forEach((control) => {
    control.disabled = !canManageSetup();
  });
  els.userForm.querySelectorAll("input, select, textarea, button").forEach((control) => {
    control.disabled = !userManagementAllowed;
  });
  els.contractorForm.querySelectorAll("input, select, textarea, button").forEach((control) => {
    control.disabled = !contractorManagementAllowed;
  });
  if (els.contractorCustomer) els.contractorCustomer.disabled = currentRole !== "Admin";
  els.assetForm.querySelectorAll("input, select, textarea, button").forEach((control) => {
    control.disabled = !canAddAssets;
  });
  els.assetImportDrawer?.querySelectorAll("input, button").forEach((control) => {
    control.disabled = !canAddAssets;
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
  const users = visibleManagedUsers();
  els.userCount.textContent = users.length;
  els.userList.innerHTML = users.length
    ? users.map(renderUserItem).join("")
    : `<p class="muted">No users available for this customer.</p>`;
}

function renderPreferredContractors() {
  if (!els.contractorList) return;
  const customerId = contractorListCustomerId();
  const contractors = visiblePreferredContractors(customerId);
  els.contractorCount.textContent = contractors.length;
  els.contractorList.innerHTML = contractors.length
    ? contractors.map(renderPreferredContractorItem).join("")
    : `<p class="muted">No preferred contractors added yet.</p>`;
}

function contractorListCustomerId() {
  if (currentRole === "Admin") return selectedContractorCustomerId || els.contractorCustomer?.value || selectedCustomerId || "";
  return currentUser?.customerId || "";
}

function updateContractorCustomerHint() {
  if (!els.contractorCustomerHint) return;
  const contractorCustomerId = contractorListCustomerId();
  if (currentRole !== "Admin" || !contractorCustomerId || contractorCustomerId === selectedCustomerId) {
    els.contractorCustomerHint.textContent = "";
    return;
  }
  const contractorCustomer = getCustomer(contractorCustomerId)?.name || "this customer";
  const activeCustomer = getCustomer(selectedCustomerId)?.name || "the current customer";
  els.contractorCustomerHint.textContent = `These contractors are for ${contractorCustomer}, not ${activeCustomer}.`;
}

function renderPreferredContractorItem(contractor) {
  const customer = getCustomer(contractor.customerId);
  const customerLabel = currentRole === "Admin" ? `${customer?.name || "No customer"} | ` : "";
  const disabled = canManageContractorRecord(contractor) ? "" : "disabled";
  return `
    <article class="user-list-item">
      <div>
        <strong>${escapeHtml(contractor.name)}</strong>
        <small>${escapeHtml(customerLabel)}${escapeHtml(contractor.email)}${contractor.trade ? ` | ${escapeHtml(contractor.trade)}` : ""}</small>
      </div>
      <button type="button" class="secondary mini" data-delete-contractor="${escapeAttribute(contractor.id)}" ${disabled}>Delete</button>
    </article>
  `;
}

function deletePreferredContractor(contractorId) {
  const contractor = state.preferredContractors.find((item) => item.id === contractorId);
  if (!contractor) return;
  if (!canManageContractorRecord(contractor)) {
    alert("Managers can only delete contractors for their assigned customer.");
    return;
  }
  if (!confirm(`Delete ${contractor.name} from preferred contractors?`)) return;
  state.preferredContractors = state.preferredContractors.filter((item) => item.id !== contractorId);
  addActivity("Contractor deleted", contractor.name);
  saveState();
  render();
}

function renderUserItem(user) {
  const canEdit = canEditUserRecord(user);
  const disabled = canEdit ? "" : "disabled";
  const passwordDisabled = user.localOnly || !isEmailAddress(user.username) ? disabled : "disabled";
  const passwordHelp = user.localOnly || !isEmailAddress(user.username)
    ? "Leave blank to keep current password"
    : "Use Supabase password reset";
  const currentLabel = currentUser?.id === user.id ? `<span class="current-user-label">Current user</span>` : "";
  const customer = getCustomer(user.customerId);
  const customerOptions = manageableUserCustomers().map((customerRecord) =>
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
          Login name
          <input name="username" required value="${escapeAttribute(user.username)}" ${disabled}>
        </label>
        <label>
          Display name
          <input name="name" required value="${escapeAttribute(user.name || user.username)}" ${disabled}>
        </label>
        <label>
          Password
          <input name="password" type="password" placeholder="${passwordHelp}" ${passwordDisabled}>
        </label>
        <label>
          Role
          <select name="role" ${disabled}>
            ${userRoleOptionsForEditor(user.role).map((role) =>
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
          <button type="button" class="secondary mini danger-action" data-user-action="delete" data-user-id="${escapeAttribute(user.id)}" ${currentUser?.id === user.id || !canEdit ? "disabled" : ""}>Delete</button>
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

function renderCustomers() {
  if (!els.customerList) return;
  const customers = manageableSetupCustomers().sort((a, b) => a.name.localeCompare(b.name));
  els.customerList.innerHTML = customers.length
    ? customers.map(renderCustomerEditor).join("")
    : `<p class="muted">No customers added yet.</p>`;
}

function renderCustomerEditor(customer) {
  const disabled = canManageSetup() ? "" : "disabled";
  const contactSummary = [
    customer.contactName,
    customer.contactEmail,
    customer.contactPhone
  ].filter(Boolean).join(" | ");
  return `
    <details class="location-editor compact-form">
      <summary>
        <span>
          <strong>${escapeHtml(customer.name)}</strong>
          ${contactSummary ? `<small>${escapeHtml(contactSummary)}</small>` : ""}
        </span>
      </summary>
      <form class="stack compact-form" data-customer-id="${escapeAttribute(customer.id)}">
        <label>
          Customer name
          <input name="name" required value="${escapeAttribute(customer.name)}" ${disabled}>
        </label>
        <label>
          Main contact
          <input name="contactName" value="${escapeAttribute(customer.contactName || "")}" ${disabled}>
        </label>
        <label>
          Contact email
          <input name="contactEmail" type="email" value="${escapeAttribute(customer.contactEmail || "")}" ${disabled}>
        </label>
        <label>
          Contact phone
          <input name="contactPhone" value="${escapeAttribute(customer.contactPhone || "")}" ${disabled}>
        </label>
        <label>
          Contact notes
          <textarea name="contactNotes" rows="2" ${disabled}>${escapeHtml(customer.contactNotes || "")}</textarea>
        </label>
        <div class="record-actions">
          <button type="submit" class="secondary mini" ${disabled}>Save Customer</button>
        </div>
      </form>
    </details>
  `;
}

function renderLocations() {
  if (!els.locationList) return;
  const setupCustomerIds = new Set(manageableSetupCustomers().map((customer) => customer.id));
  const locations = state.locations.filter((locationRecord) =>
    setupCustomerIds.has(locationRecord.customerId) && canManageCustomerSetup(locationRecord.customerId)
  ).sort((a, b) => {
    const customerA = getCustomer(a.customerId)?.name || "";
    const customerB = getCustomer(b.customerId)?.name || "";
    return `${customerA} ${a.name}`.localeCompare(`${customerB} ${b.name}`);
  });
  els.locationList.innerHTML = locations.length
    ? locations.map(renderLocationEditor).join("")
    : `<p class="muted">No locations added yet.</p>`;
}

function renderLocationEditor(locationRecord) {
  const disabled = canManageSetup() ? "" : "disabled";
  const customerOptions = state.customers.map((customer) =>
    `<option value="${escapeAttribute(customer.id)}" ${locationRecord.customerId === customer.id ? "selected" : ""}>${escapeHtml(customer.name)}</option>`
  ).join("");
  const contactSummary = [
    locationRecord.contactName,
    locationRecord.contactEmail,
    locationRecord.contactPhone
  ].filter(Boolean).join(" | ");
  return `
    <details class="location-editor compact-form">
      <summary>
        <span>
          <strong>${escapeHtml(locationRecord.name)}</strong>
          <small>${escapeHtml(getCustomer(locationRecord.customerId)?.name || "Unknown customer")}${contactSummary ? ` | ${escapeHtml(contactSummary)}` : ""}</small>
        </span>
      </summary>
      <form class="stack compact-form" data-location-id="${escapeAttribute(locationRecord.id)}">
        <label>
          Customer
          <select name="customerId" ${disabled}>
            ${customerOptions}
          </select>
        </label>
        <label>
          Location name
          <input name="name" required value="${escapeAttribute(locationRecord.name)}" ${disabled}>
        </label>
        <label>
          Site contact
          <input name="contactName" value="${escapeAttribute(locationRecord.contactName || "")}" ${disabled}>
        </label>
        <label>
          Contact email
          <input name="contactEmail" type="email" value="${escapeAttribute(locationRecord.contactEmail || "")}" ${disabled}>
        </label>
        <label>
          Contact phone
          <input name="contactPhone" value="${escapeAttribute(locationRecord.contactPhone || "")}" ${disabled}>
        </label>
        <label>
          Location notes
          <textarea name="contactNotes" rows="2" ${disabled}>${escapeHtml(locationRecord.contactNotes || "")}</textarea>
        </label>
        <div class="record-actions">
          <button type="submit" class="secondary mini" ${disabled}>Save Location</button>
          <button type="button" class="secondary mini danger-action" data-location-action="delete" data-location-id="${escapeAttribute(locationRecord.id)}" ${disabled}>Delete</button>
        </div>
      </form>
    </details>
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
  const managedCustomerOptions = manageableUserCustomers().map((customer) =>
    `<option value="${customer.id}">${escapeHtml(customer.name)}</option>`
  ).join("");

  els.locationCustomer.innerHTML = options;
  els.assetCustomer.innerHTML = options;
  els.customerFilter.innerHTML = options;
  els.contractorCustomer.innerHTML = currentRole === "Admin" ? allCustomerOptions : options;
  els.newUserCustomer.innerHTML = currentRole === "Admin" ? allCustomerOptions : managedCustomerOptions;
  els.newUserRole.innerHTML = userRoleOptionsForEditor().map((role) =>
    `<option value="${role}">${role}</option>`
  ).join("");

  els.locationCustomer.value = selectedCustomerId;
  els.assetCustomer.value = selectedCustomerId;
  els.customerFilter.value = selectedCustomerId;
  const contractorCustomers = currentRole === "Admin" ? state.customers : visibleCustomers();
  if (!contractorCustomers.some((customer) => customer.id === selectedContractorCustomerId)) {
    selectedContractorCustomerId = currentRole === "Manager" && currentUser?.customerId
      ? currentUser.customerId
      : selectedCustomerId;
  }
  els.contractorCustomer.value = currentRole === "Manager" && currentUser?.customerId
    ? currentUser.customerId
    : selectedContractorCustomerId;
  updateContractorCustomerHint();
  if (currentRole === "Manager" && currentUser?.customerId) {
    els.newUserCustomer.value = currentUser.customerId;
  }
  if (!els.newUserCustomer.value && manageableUserCustomers()[0]) {
    els.newUserCustomer.value = manageableUserCustomers()[0].id;
  }
  els.customerFilter.disabled = !canSeeAllCustomers();

  const setupAllowed = canManageSetup();
  const addEquipmentAllowed = canAddEquipment();
  els.locationForm.querySelector("button").disabled = !setupAllowed || !state.customers.length;
  els.assetForm.querySelector("button").disabled = !addEquipmentAllowed || !customers.length || !state.locations.length || !state.templates.length;
  if (els.assetImportBtn) els.assetImportBtn.disabled = !addEquipmentAllowed || !customers.length || !state.templates.length;
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
  els.assetLocation.disabled = locations.length === 0 || !canAddEquipment();
  els.assetForm.querySelector("button").disabled = locations.length === 0 || !state.templates.length || !canAddEquipment();
}

async function importEquipmentCsv() {
  if (!canAddEquipment()) return;
  const file = els.assetImportFile?.files?.[0];
  if (!file) {
    setAssetImportStatus("Choose a CSV file first.");
    return;
  }

  setAssetImportStatus("Reading CSV...");
  const text = await file.text();
  const rows = parseCsvRows(text);
  if (!rows.length) {
    setAssetImportStatus("No equipment rows were found in that CSV.");
    return;
  }

  const createdAt = new Date().toISOString();
  const stats = {
    imported: 0,
    skipped: 0,
    duplicates: 0,
    locationsCreated: 0,
    customersCreated: 0,
    errors: []
  };
  const importedAssets = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const customerName = findCsvValue(row, ["customer", "customer name", "client", "company", "account"]);
    const locationName = findCsvValue(row, ["location", "location name", "site", "building", "facility"]);
    const equipmentName = findCsvValue(row, ["equipment name", "asset name", "equipment", "asset", "name"]);

    if (!equipmentName) {
      skipImportRow(stats, rowNumber, "missing equipment name");
      return;
    }

    const customer = findOrCreateImportCustomer(customerName, stats);
    if (!customer) {
      skipImportRow(stats, rowNumber, "customer is missing or not assigned to this user");
      return;
    }

    const locationRecord = findOrCreateImportLocation(locationName, customer.id, stats);
    if (!locationRecord) {
      skipImportRow(stats, rowNumber, "location is missing");
      return;
    }

    const serial = findCsvValue(row, ["serial", "serial number", "serial no", "serial #", "asset tag", "tag"]);
    if (isDuplicateImportAsset(customer.id, locationRecord.id, equipmentName, serial)) {
      stats.duplicates += 1;
      stats.skipped += 1;
      return;
    }

    const templateName = findCsvValue(row, ["template", "maintenance template", "pm template"]);
    const template = findTemplateByName(templateName) || state.templates[0];
    const asset = {
      id: crypto.randomUUID(),
      customerId: customer.id,
      locationId: locationRecord.id,
      templateId: template?.id || "",
      name: equipmentName,
      nextPmDate: normalizeCsvDate(findCsvValue(row, ["next pm date", "next pm", "next maintenance", "next maintenance date", "next service date"])),
      manufacturer: findCsvValue(row, ["manufacturer", "make", "mfg"]),
      model: findCsvValue(row, ["model", "model number", "model no"]),
      serial,
      installDate: normalizeCsvDate(findCsvValue(row, ["install date", "installed", "installation date"])),
      type: findCsvValue(row, ["equipment type", "asset type", "type", "category"]),
      criticality: normalizeCriticality(findCsvValue(row, ["criticality", "priority", "risk"])),
      documentUrl: findCsvValue(row, ["manual link", "document link", "manual url", "url"]),
      manualFile: null,
      notes: findCsvValue(row, ["notes", "description", "comments", "details"]),
      photo: null,
      frequencyDays: normalizeFrequencyDays(findCsvValue(row, ["pm frequency days", "frequency days", "maintenance frequency days", "pm frequency", "frequency"])),
      createdAt,
      history: []
    };

    state.assets.unshift(asset);
    importedAssets.push(asset);
    stats.imported += 1;
  });

  if (!stats.imported) {
    setAssetImportStatus(`No equipment imported. ${stats.skipped} row(s) skipped.`);
    renderAssetImportPreview(stats);
    return;
  }

  const firstAsset = importedAssets[0];
  selectedId = firstAsset.id;
  selectedCustomerId = firstAsset.customerId;
  selectedLocationId = "all";
  addActivity(
    "Equipment imported",
    `${stats.imported} equipment record(s) from ${file.name}`
  );
  saveState();
  if (els.assetImportFile) els.assetImportFile.value = "";
  setAssetImportStatus(
    `Imported ${stats.imported} equipment record(s). ${stats.skipped} skipped. ${stats.locationsCreated} location(s) created.`
  );
  renderAssetImportPreview(stats);
  location.hash = `asset/${firstAsset.id}`;
  render();
}

function setAssetImportStatus(message) {
  if (els.assetImportStatus) els.assetImportStatus.textContent = message;
}

function renderAssetImportPreview(stats) {
  if (!els.assetImportPreview) return;
  const messages = stats.errors.slice(0, 8);
  els.assetImportPreview.innerHTML = messages.length
    ? messages.map((message) => `<div>${escapeHtml(message)}</div>`).join("")
    : "";
}

function skipImportRow(stats, rowNumber, reason) {
  stats.skipped += 1;
  stats.errors.push(`Row ${rowNumber}: ${reason}.`);
}

function parseCsvRows(text) {
  const records = parseCsvRecords(text);
  if (records.length < 2) return [];
  const headers = records[0].map(normalizeCsvHeader);
  return records.slice(1)
    .filter((record) => record.some((cell) => String(cell || "").trim()))
    .map((record) => {
      const row = {};
      headers.forEach((header, index) => {
        if (!header) return;
        row[header] = String(record[index] || "").trim();
      });
      return row;
    });
}

function parseCsvRecords(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const value = String(text || "").replace(/^\uFEFF/, "");

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];
    if (character === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (character === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += character;
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((record) => record.some((entry) => String(entry || "").trim()));
}

function normalizeCsvHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function findCsvValue(row, aliases) {
  for (const alias of aliases) {
    const value = row[normalizeCsvHeader(alias)];
    if (value) return value.trim();
  }
  return "";
}

function findOrCreateImportCustomer(name, stats) {
  if (!canSeeAllCustomers()) {
    return currentUser?.customerId ? getCustomer(currentUser.customerId) : null;
  }

  const cleanName = String(name || "").trim();
  if (!cleanName) return getCustomer(selectedCustomerId) || state.customers[0] || null;
  const existing = state.customers.find((customer) => sameText(customer.name, cleanName));
  if (existing) return existing;

  const customer = {
    id: crypto.randomUUID(),
    name: cleanName,
    createdAt: new Date().toISOString(),
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    contactNotes: ""
  };
  state.customers.push(customer);
  stats.customersCreated += 1;
  return customer;
}

function findOrCreateImportLocation(name, customerId, stats) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return null;
  const existing = state.locations.find((locationRecord) =>
    locationRecord.customerId === customerId && sameText(locationRecord.name, cleanName)
  );
  if (existing) return existing;
  if (!els.assetImportCreateLocations?.checked) return null;

  const locationRecord = {
    id: crypto.randomUUID(),
    customerId,
    name: cleanName,
    createdAt: new Date().toISOString(),
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    contactNotes: ""
  };
  state.locations.push(locationRecord);
  stats.locationsCreated += 1;
  return locationRecord;
}

function isDuplicateImportAsset(customerId, locationId, name, serial) {
  return state.assets.some((asset) => {
    const sameCustomerLocation = asset.customerId === customerId && asset.locationId === locationId;
    const sameSerial = serial && sameText(asset.serial, serial);
    return sameCustomerLocation && (sameText(asset.name, name) || sameSerial);
  });
}

function findTemplateByName(name) {
  if (!name) return null;
  return state.templates.find((template) => sameText(template.name, name)) || null;
}

function normalizeCsvDate(value) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanValue)) return cleanValue;
  const slashMatch = cleanValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, "0");
    const day = slashMatch[2].padStart(2, "0");
    const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(cleanValue);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeFrequencyDays(value) {
  const cleanValue = String(value || "").trim().toLowerCase();
  if (!cleanValue) return 365;
  if (cleanValue.includes("week")) return 7;
  if (cleanValue.includes("month")) return 30;
  if (cleanValue.includes("quarter")) return 90;
  if (cleanValue.includes("year") || cleanValue.includes("annual")) return 365;
  const number = Number.parseInt(cleanValue.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(number) && number > 0 ? number : 365;
}

function normalizeCriticality(value) {
  const cleanValue = String(value || "").trim().toLowerCase();
  if (cleanValue === "high") return "High";
  if (cleanValue === "medium" || cleanValue === "med") return "Medium";
  if (cleanValue === "low") return "Low";
  return "";
}

function sameText(first, second) {
  return String(first || "").trim().toLowerCase() === String(second || "").trim().toLowerCase();
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
  const activeServiceRequests = filteredServiceRequests().filter((item) => item.status !== "Completed" && item.status !== "Declined");
  const completedIssues = completedIssueRecords();
  const currentCustomer = getCustomer(selectedCustomerId);
  const currentLocation = selectedLocationId === "all" ? null : getLocation(selectedLocationId);
  if (els.currentViewLabel) {
    els.currentViewLabel.textContent = `${currentCustomer?.name || "No customer selected"} | ${currentLocation?.name || "All locations"}`;
  }
  els.dueToday.textContent = dueInfos.filter((item) => item.daysUntil <= 0).length;
  els.overdue.textContent = dueInfos.filter((item) => item.daysUntil < 0).length;
  els.completed.textContent = completedIssues.length;
  els.openWorkOrders.textContent = activeIssues.length;
  if (els.serviceRequestsMetric) els.serviceRequestsMetric.textContent = activeServiceRequests.length;
  els.highPriorityIssues.textContent = activeIssues.filter((item) => item.priority === "High").length;
  els.waitingPartsIssues.textContent = activeIssues.filter((item) => item.status === "Waiting parts").length;
  if (els.assignedToMeIssues) els.assignedToMeIssues.textContent = activeIssues.filter((item) => item.assignedUserId === currentUser?.id).length;
  if (els.reportedIssues) els.reportedIssues.textContent = activeIssues.filter((item) => item.source === "Public QR report").length;
  if (els.activeLocations) els.activeLocations.textContent = activeAssetLocationCountForCurrentCustomer();
  if (els.globalSearch) els.globalSearch.value = globalQuery;
  renderDashboardMenus({ assets, dueInfos, activeIssues, activeServiceRequests, completedIssues });
  renderGlobalSearchResults();
}

function renderDashboardMenus({ assets, dueInfos, activeIssues, activeServiceRequests, completedIssues }) {
  const dueNowAssets = dueInfos
    .filter((item) => item.daysUntil <= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .map((item) => item.asset);
  const overdueAssets = dueInfos
    .filter((item) => item.daysUntil < 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .map((item) => item.asset);
  const highPriorityIssues = activeIssues.filter((item) => item.priority === "High");
  const waitingPartsIssues = activeIssues.filter((item) => item.status === "Waiting parts");
  const assignedIssues = activeIssues.filter((item) => item.assignedUserId === currentUser?.id);
  const menuData = {
    dueNow: dashboardAssetItems(dueNowAssets, "No equipment is due now."),
    overdue: dashboardAssetItems(overdueAssets, "No equipment is overdue."),
    completedPm: dashboardCompletedItems(completedIssues, "No completed issues for this view."),
    workOrders: dashboardIssueItems(activeIssues, "No open issues for this view."),
    serviceRequests: dashboardServiceRequestItems(activeServiceRequests, "No service requests for this view."),
    highPriority: dashboardIssueItems(highPriorityIssues, "No high priority issues for this view."),
    waitingParts: dashboardIssueItems(waitingPartsIssues, "No waiting parts issues for this view."),
    assignedToMe: dashboardIssueItems(assignedIssues, "No issues assigned to you for this view.")
  };

  Object.entries(menuData).forEach(([filter, html]) => {
    const menu = document.querySelector(`[data-dashboard-menu="${filter}"]`);
    if (menu) menu.innerHTML = html;
  });
}

function dashboardAssetItems(assets, emptyText) {
  return assets.length
    ? assets.slice(0, 6).map((asset) => {
        const due = getDueInfo(asset);
        return renderDashboardMenuItem({
          type: "asset",
          id: asset.id,
          label: asset.name,
          meta: `${getCustomer(asset.customerId)?.name || "Unknown customer"} | ${getLocation(asset.locationId)?.name || "Unknown location"} | ${due.label}`,
          badge: "Equipment"
        });
      }).join("") + renderDashboardMoreCount(assets.length)
    : renderDashboardEmpty(emptyText);
}

function dashboardIssueItems(issues, emptyText) {
  return issues.length
    ? issues.slice(0, 6).map((issue) => renderDashboardMenuItem({
        type: issue.status === "Closed" ? "completed" : "issue",
        id: issue.id,
        label: `${formatIssueNumber(issue)} - ${issue.title || "Issue"}`,
        meta: `${getCustomer(issue.customerId)?.name || "Unknown customer"} | ${getLocation(issue.locationId)?.name || "Unknown location"} | ${issue.status || "Open"}`,
        badge: issue.priority || "Issue"
      })).join("") + renderDashboardMoreCount(issues.length)
    : renderDashboardEmpty(emptyText);
}

function dashboardServiceRequestItems(requests, emptyText) {
  return requests.length
    ? requests.slice(0, 6).map((request) => renderDashboardMenuItem({
        type: "service",
        id: request.id,
        label: `${formatServiceRequestNumber(request)} - ${request.title || "Service request"}`,
        meta: `${getCustomer(request.customerId)?.name || "Unknown customer"} | ${getLocation(request.locationId)?.name || "Unknown location"} | ${request.status || "New"}`,
        badge: "Service"
      })).join("") + renderDashboardMoreCount(requests.length)
    : renderDashboardEmpty(emptyText);
}

function dashboardCompletedItems(records, emptyText) {
  return records.length
    ? records.slice(0, 6).map((record) => {
        const isIssue = record.type === "workOrder";
        return renderDashboardMenuItem({
          type: "completed",
          id: isIssue ? record.workOrder.id : record.history?.id || record.asset.id,
          label: isIssue
            ? `${formatIssueNumber(record.workOrder)} - ${record.workOrder.title || "Completed issue"}`
            : `${formatPmNumber(record.history)} - ${record.asset.name}`,
          meta: `${record.customer?.name || "Unknown customer"} | ${record.location?.name || "Unknown location"}`,
          badge: isIssue ? "Issue" : "PM"
        });
      }).join("") + renderDashboardMoreCount(records.length)
    : renderDashboardEmpty(emptyText);
}

function renderDashboardMenuItem(item) {
  return `
    <button type="button" class="metric-dropdown-item" data-dashboard-result-type="${escapeAttribute(item.type)}" data-dashboard-result-id="${escapeAttribute(item.id)}">
      <span>
        <strong>${escapeHtml(item.label)}</strong>
        <small>${escapeHtml(item.meta)}</small>
      </span>
      <em>${escapeHtml(item.badge)}</em>
    </button>
  `;
}

function renderDashboardMoreCount(total) {
  return total > 6 ? `<p class="metric-dropdown-more">Showing 6 of ${total}</p>` : "";
}

function renderDashboardEmpty(message) {
  return `<p class="metric-dropdown-empty">${escapeHtml(message)}</p>`;
}

function renderGlobalSearchResults() {
  if (!els.globalSearchResults) return;
  if (!globalQuery) {
    els.globalSearchResults.classList.add("hidden");
    els.globalSearchResults.innerHTML = "";
    return;
  }

  const results = [
    ...filteredAssets().slice(0, 5).map((asset) => ({
      type: "asset",
      id: asset.id,
      label: asset.name,
      meta: `${getCustomer(asset.customerId)?.name || "Unknown customer"} | ${getLocation(asset.locationId)?.name || "Unknown location"}`,
      badge: "Equipment"
    })),
    ...filteredWorkOrders().slice(0, 5).map((issue) => ({
      type: issue.status === "Closed" ? "completed" : "issue",
      id: issue.id,
      label: `${formatIssueNumber(issue)} - ${issue.title || "Issue"}`,
      meta: `${getCustomer(issue.customerId)?.name || "Unknown customer"} | ${getLocation(issue.locationId)?.name || "Unknown location"} | ${issue.status || "Open"}`,
      badge: issue.status === "Closed" ? "Completed" : "Issue"
    })),
    ...filteredServiceRequests().slice(0, 5).map((request) => ({
      type: "service",
      id: request.id,
      label: `${formatServiceRequestNumber(request)} - ${request.title || "Service request"}`,
      meta: `${getCustomer(request.customerId)?.name || "Unknown customer"} | ${getLocation(request.locationId)?.name || "Unknown location"} | ${request.status || "New"}`,
      badge: "Service Request"
    })),
    ...completedPmRecords().slice(0, 5).map((record) => ({
      type: "completed",
      id: record.history?.id || record.asset.id,
      label: `${formatPmNumber(record.history)} - ${record.asset.name}`,
      meta: `${record.customer?.name || "Unknown customer"} | ${record.location?.name || "Unknown location"} | ${record.history.result || "Completed"}`,
      badge: "Completed PM"
    }))
  ].slice(0, 12);

  els.globalSearchResults.classList.remove("hidden");
  els.globalSearchResults.innerHTML = results.length
    ? `
      <div class="search-results-title">Search results</div>
      ${results.map(renderGlobalSearchResult).join("")}
    `
    : `<p class="muted">No matches found for "${escapeHtml(globalQuery)}".</p>`;
}

function renderGlobalSearchResult(result) {
  return `
    <button type="button" class="global-search-result" data-search-result-type="${escapeAttribute(result.type)}" data-search-result-id="${escapeAttribute(result.id)}">
      <span>
        <strong>${escapeHtml(result.label)}</strong>
        <small>${escapeHtml(result.meta)}</small>
      </span>
      <em>${escapeHtml(result.badge)}</em>
    </button>
  `;
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
      openPanel("assetPanel");
      render();
      document.getElementById("assetPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    ${canManageWorkOrders() ? renderManualIssueForm(asset) : ""}
  `;
}

function renderManualIssueForm(asset) {
  return `
    <details class="manual-issue-form">
      <summary>Create Open Issue</summary>
      <form class="stack compact-form" data-manual-issue-form="${escapeAttribute(asset.id)}">
        <div class="form-grid">
          <label>
            Issue title
            <input name="title" required value="Issue: ${escapeAttribute(asset.name)}">
          </label>
          <label>
            Priority
            <select name="priority">
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Low">Low</option>
            </select>
          </label>
        </div>
        <label>
          Notes
          <textarea name="notes" rows="3" placeholder="What needs attention?"></textarea>
        </label>
        <label>
          Issue photo
          <input name="photo" type="file" accept="image/*">
        </label>
        <button type="submit" class="secondary primary-action">Create Issue</button>
      </form>
    </details>
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

function scrollToMaintenanceHistory() {
  const historyPanel = document.getElementById("historyList");
  if (!historyPanel) return;
  historyPanel.scrollIntoView({ behavior: "smooth", block: "start" });
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
    : `<p class="muted">${currentRole === "Technician" ? "No open issues assigned to you for this view." : "No open issues for this view."}</p>`;
}

function renderCompletedPms() {
  const records = completedIssueRecords();
  if (els.completedPmCount) els.completedPmCount.textContent = records.length;
  if (!els.completedPmList) return;
  els.completedPmList.innerHTML = records.length
    ? records.map((record) => {
        try {
          return renderCompletedIssueItem(record);
        } catch {
          return `<article class="work-order-item"><p class="muted">A completed record could not be displayed.</p></article>`;
        }
      }).join("")
    : `<p class="muted">No completed issues for this view.</p>`;
}

function renderCompletedIssueItem(record) {
  if (record.type === "workOrder") {
    return `
      <article class="work-order-item completed-pm-item">
        <header>
          <div>
            <strong>${escapeHtml(formatIssueNumber(record.workOrder))} - ${escapeHtml(record.workOrder.title || "Completed issue")}</strong>
            <span>${escapeHtml(record.customer?.name || "Unknown customer")} | ${escapeHtml(record.location?.name || "Unknown location")}</span>
          </div>
          ${record.asset ? `<button type="button" class="secondary mini" data-completed-pm-asset="${escapeAttribute(record.asset.id)}">View Equipment</button>` : ""}
        </header>
        <p><strong>${escapeHtml(record.workOrder.status || "Closed")}</strong> ${escapeHtml(record.workOrder.priority || "Medium")} priority | Completed ${escapeHtml(formatDateTime(new Date(record.completedAt)))}</p>
        <p>${escapeHtml(record.workOrder.notes || "No notes entered.")}</p>
      </article>
    `;
  }

  return `
    <article class="work-order-item completed-pm-item">
      <header>
        <div>
          <strong>${escapeHtml(formatPmNumber(record.history))} - ${escapeHtml(record.asset.name)}</strong>
          <span>${escapeHtml(record.customer?.name || "Unknown customer")} | ${escapeHtml(record.location?.name || "Unknown location")}</span>
        </div>
        <button type="button" class="secondary mini" data-completed-pm-asset="${escapeAttribute(record.asset.id)}">View Equipment</button>
      </header>
      <p><strong>${escapeHtml(record.history.result || "Completed")}</strong> by ${escapeHtml(record.history.technician || "No technician entered")} on ${escapeHtml(formatDateTime(new Date(record.history.completedAt)))}</p>
      <p>${escapeHtml(record.history.notes || "No notes entered.")}</p>
    </article>
  `;
}

function moveTopActionDrawers() {
  els.newEquipmentBtn?.insertAdjacentElement("afterend", els.quickAddDrawer);
  els.newIssueBtn?.insertAdjacentElement("afterend", els.newIssueDrawer);
  els.newServiceRequestBtn?.insertAdjacentElement("afterend", els.serviceRequestCreateDrawer);
}

function getTopActionDrawers() {
  return [els.quickAddDrawer, els.newIssueDrawer, els.serviceRequestCreateDrawer].filter(Boolean);
}

function closeTopActionDrawers(except = null) {
  getTopActionDrawers().forEach((drawer) => {
    if (drawer !== except) drawer.open = false;
  });
}

function toggleTopActionDrawer(drawer) {
  if (!drawer) return;
  const shouldOpen = !drawer.open;
  closeTopActionDrawers(drawer);
  drawer.open = shouldOpen;
}

function closeMetricMenus(except = null) {
  document.querySelectorAll("[data-dashboard-menu]").forEach((menu) => {
    if (menu !== except) menu.classList.add("hidden");
  });
}

function toggleMetricMenu(filter) {
  const menu = document.querySelector(`[data-dashboard-menu="${filter}"]`);
  if (!menu) return;
  const shouldOpen = menu.classList.contains("hidden");
  closeTopActionDrawers();
  closeMetricMenus(menu);
  menu.classList.toggle("hidden", !shouldOpen);
}

function runDashboardAction(filter) {
  const issueFilters = {
    workOrders: "active",
    highPriority: "highPriority",
    waitingParts: "waitingParts",
    reportedIssues: "reported",
    assignedToMe: "assignedToMe"
  };

  if (filter === "completedPm") {
    const panel = document.getElementById("completedPmPanel");
    const willOpen = panel?.classList.contains("is-collapsed");
    togglePanel("completedPmPanel");
    render();
    panel?.scrollIntoView({ behavior: "smooth", block: willOpen ? "start" : "nearest" });
    return;
  }

  if (filter === "serviceRequests") {
    const panel = document.getElementById("serviceRequestsPanel");
    const willOpen = panel?.classList.contains("is-collapsed");
    togglePanel("serviceRequestsPanel");
    render();
    panel?.scrollIntoView({ behavior: "smooth", block: willOpen ? "start" : "nearest" });
    return;
  }

  if (issueFilters[filter]) {
    workOrderViewFilter = issueFilters[filter];
    assetSort = "workOrders";
    assetStatusFilter = "all";
    const panel = document.getElementById("workOrdersPanel");
    const willOpen = panel?.classList.contains("is-collapsed");
    togglePanel("workOrdersPanel");
    render();
    if (willOpen) panel?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const openedByMetric = els.assetRegisterDrawer?.dataset.openedByMetric || "";
  const clickedOpenRegisterMetric = els.assetRegisterDrawer?.open && openedByMetric === filter;
  if (clickedOpenRegisterMetric) {
    closeAssetRegisterDrawer();
    render();
    return;
  }

  assetStatusFilter = filter;
  assetSort = filter === "all" ? "due" : assetSort;
  assetPage = 1;
  const willOpen = !els.assetRegisterDrawer?.open;
  openAssetRegisterDrawer(filter);
  render();
  if (willOpen) els.assetRegisterDrawer?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openDashboardResult(type, id) {
  if (type === "asset") {
    selectedId = id;
    syncFiltersToSelectedAsset();
    location.hash = `asset/${selectedId}`;
    openPanel("assetPanel");
  } else if (type === "issue") {
    workOrderViewFilter = "active";
    openPanel("workOrdersPanel");
  } else if (type === "service") {
    openPanel("serviceRequestsPanel");
  } else if (type === "completed") {
    openPanel("completedPmPanel");
  }
  render();
  const target = type === "asset"
    ? document.getElementById("assetPanel")
    : type === "issue"
      ? document.getElementById("workOrdersPanel")
      : type === "service"
        ? document.getElementById("serviceRequestsPanel")
        : document.getElementById("completedPmPanel");
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderNewIssueFormOptions() {
  if (!els.newIssueForm) return;
  const customers = visibleCustomers();
  const currentCustomerId = customers.some((customer) => customer.id === els.newIssueCustomer.value)
    ? els.newIssueCustomer.value
    : customers.some((customer) => customer.id === selectedCustomerId)
      ? selectedCustomerId
      : customers[0]?.id || "";
  els.newIssueCustomer.innerHTML = customers.map((customer) =>
    `<option value="${escapeAttribute(customer.id)}">${escapeHtml(customer.name)}</option>`
  ).join("");
  els.newIssueCustomer.value = currentCustomerId;
  els.newIssueCustomer.disabled = currentRole !== "Admin";
  els.newIssueCustomer.title = currentRole === "Admin"
    ? "Choose the customer for this issue."
    : "Only admin users can choose a different customer.";

  const locations = locationsForCustomer(currentCustomerId);
  const currentLocationId = locations.some((locationRecord) => locationRecord.id === els.newIssueLocation.value)
    ? els.newIssueLocation.value
    : locations.some((locationRecord) => locationRecord.id === selectedLocationId)
      ? selectedLocationId
      : locations[0]?.id || "";
  els.newIssueLocation.innerHTML = locations.map((locationRecord) =>
    `<option value="${escapeAttribute(locationRecord.id)}">${escapeHtml(locationRecord.name)}</option>`
  ).join("");
  els.newIssueLocation.value = currentLocationId;

  const assets = state.assets.filter((asset) =>
    canSeeAsset(asset) &&
    asset.customerId === currentCustomerId &&
    (!currentLocationId || asset.locationId === currentLocationId)
  );
  const selectedAsset = getSelectedAsset();
  const currentAssetId = assets.some((asset) => asset.id === els.newIssueAsset.value)
    ? els.newIssueAsset.value
    : selectedAsset && assets.some((asset) => asset.id === selectedAsset.id)
      ? selectedAsset.id
      : assets[0]?.id || "";
  els.newIssueAsset.innerHTML = assets.length
    ? assets.map((asset) => `<option value="${escapeAttribute(asset.id)}">${escapeHtml(asset.name)}</option>`).join("")
    : `<option value="">No equipment available</option>`;
  els.newIssueAsset.value = currentAssetId;
  const isAreaIssue = Boolean(els.newIssueTargetArea?.checked);
  els.newIssueAsset.disabled = isAreaIssue || !assets.length;
  els.newIssueArea.disabled = !isAreaIssue || !locations.length;
  if (!isAreaIssue) els.newIssueArea.value = "";
  syncNewIssueTitle();
  updateNewIssueSubmitState();
}

function updateNewIssueSubmitState() {
  if (!els.newIssueForm) return;
  const submitButton = els.newIssueForm.querySelector("button[type='submit']");
  if (!submitButton) return;
  const isAreaIssue = Boolean(els.newIssueTargetArea?.checked);
  const hasCustomer = Boolean(els.newIssueCustomer?.value);
  const hasLocation = Boolean(els.newIssueLocation?.value);
  const hasValidTarget = isAreaIssue
    ? Boolean(els.newIssueArea?.value.trim())
    : Boolean(els.newIssueAsset?.value);
  submitButton.disabled = !hasCustomer || !hasLocation || !hasValidTarget || !canManageWorkOrders();
}

function syncNewIssueTitle() {
  if (!els.newIssueTitle || !els.newIssueAsset) return;
  const isAreaIssue = Boolean(els.newIssueTargetArea?.checked);
  const asset = getAsset(els.newIssueAsset.value);
  const areaName = String(els.newIssueArea?.value || "").trim();
  const label = isAreaIssue
    ? areaName || "Area"
    : asset?.name || "";
  if (!label) return;
  if (!els.newIssueTitle.value.trim() || els.newIssueTitle.value.startsWith("Issue: ")) {
    els.newIssueTitle.value = `Issue: ${label}`;
  }
}

function renderServiceRequestFormOptions() {
  if (!els.serviceRequestForm) return;
  const customers = visibleCustomers();
  const currentCustomerId = customers.some((customer) => customer.id === els.serviceRequestCustomer.value)
    ? els.serviceRequestCustomer.value
    : customers.some((customer) => customer.id === selectedCustomerId)
      ? selectedCustomerId
      : customers[0]?.id || "";
  els.serviceRequestCustomer.innerHTML = customers.map((customer) =>
    `<option value="${escapeAttribute(customer.id)}">${escapeHtml(customer.name)}</option>`
  ).join("");
  els.serviceRequestCustomer.value = currentCustomerId;
  els.serviceRequestCustomer.disabled = currentRole !== "Admin";
  els.serviceRequestCustomer.title = currentRole === "Admin"
    ? "Choose the customer for this service request."
    : "Only admin users can choose a different customer.";

  const locations = locationsForCustomer(currentCustomerId);
  const currentLocationId = locations.some((locationRecord) => locationRecord.id === els.serviceRequestLocation.value)
    ? els.serviceRequestLocation.value
    : locations.some((locationRecord) => locationRecord.id === selectedLocationId)
      ? selectedLocationId
      : locations[0]?.id || "";
  els.serviceRequestLocation.innerHTML = locations.map((locationRecord) =>
    `<option value="${escapeAttribute(locationRecord.id)}">${escapeHtml(locationRecord.name)}</option>`
  ).join("");
  els.serviceRequestLocation.value = currentLocationId;

  const assets = state.assets.filter((asset) =>
    canSeeAsset(asset) &&
    asset.customerId === currentCustomerId &&
    (!currentLocationId || asset.locationId === currentLocationId)
  );
  const currentAssetId = assets.some((asset) => asset.id === els.serviceRequestAsset.value)
    ? els.serviceRequestAsset.value
    : "";
  els.serviceRequestAsset.innerHTML = [
    `<option value="">No equipment selected</option>`,
    ...assets.map((asset) => `<option value="${escapeAttribute(asset.id)}">${escapeHtml(asset.name)}</option>`)
  ].join("");
  els.serviceRequestAsset.value = currentAssetId;
  els.serviceRequestForm.querySelector("button").disabled = !customers.length || !locations.length || !canCreateServiceRequests();
}

function renderServiceRequests() {
  const requests = filteredServiceRequests();
  if (els.serviceRequestCount) els.serviceRequestCount.textContent = requests.filter((item) => item.status !== "Completed" && item.status !== "Declined").length;
  if (!els.serviceRequestList) return;
  els.serviceRequestList.innerHTML = requests.length
    ? requests.map((request) => {
        try {
          return renderServiceRequestItem(request);
        } catch {
          return `<article class="work-order-item"><p class="muted">A service request could not be displayed.</p></article>`;
        }
      }).join("")
    : `<p class="muted">No service requests for this view.</p>`;
}

function renderServiceRequestItem(request) {
  const customer = getCustomer(request.customerId);
  const locationRecord = getLocation(request.locationId);
  const asset = getAsset(request.assetId);
  const assignedLabel = request.assignedUserName || "Unassigned";
  const canEdit = canManageWorkOrders();
  const statusClass = request.status === "Completed"
    ? "badge-ok"
    : request.status === "Declined"
      ? "badge-muted"
      : request.priority === "High"
        ? "badge-danger"
        : "badge-warn";
  const assignableUsers = getAssignableUsersForWorkOrder(request);
  const selectedAssigneeId = getSelectedAssigneeId(request, assignableUsers);
  const assigneeOptions = [`<option value="">Unassigned</option>`, ...assignableUsers.map((user) =>
    `<option value="${escapeAttribute(user.id)}" ${selectedAssigneeId === user.id ? "selected" : ""}>${escapeHtml(user.name || user.username)} (${escapeHtml(user.role)})</option>`
  )].join("");
  const requestPhoto = request.photo?.dataUrl
    ? `<button type="button" class="history-photo-button" data-view-photo data-photo-src="${escapeAttribute(request.photo.dataUrl)}" data-photo-caption="${escapeAttribute(request.photo.name || "Service request photo")}">
        <img class="history-photo" alt="Service request photo" src="${escapeAttribute(request.photo.dataUrl)}">
      </button>`
    : "";
  const requestHistory = renderServiceRequestHistory(request);
  return `
    <article class="work-order-item service-request-item">
      <header>
        <div>
          <strong>${escapeHtml(formatServiceRequestNumber(request))} - ${escapeHtml(request.title || "Service request")}</strong>
          <span><span class="status-badge ${statusClass}">${escapeHtml(request.status || "New")}</span> ${escapeHtml(request.priority || "Medium")} priority | Preferred ${request.preferredDate ? escapeHtml(formatDate(parseLocalDate(request.preferredDate))) : "Not set"}</span>
          <span class="assigned-label">Assigned to ${escapeHtml(assignedLabel)}</span>
        </div>
      </header>
      ${canEdit ? `<label class="work-order-assignment">Assign to<select data-service-request-assignee="${escapeAttribute(request.id)}">${assigneeOptions}</select></label>` : ""}
      <p>${escapeHtml(customer?.name || "Unknown customer")} | ${escapeHtml(locationRecord?.name || "Unknown location")} | ${escapeHtml(asset?.name || "No equipment selected")}</p>
      <p>Requested by ${escapeHtml(request.requestedBy || "Not entered")}. ${escapeHtml(request.notes || "No details entered.")}</p>
      ${requestPhoto}
      ${canEdit ? `
        <div class="work-order-actions">
          <details class="inline-edit-drawer">
            <summary>Edit</summary>
            ${renderServiceRequestEditForm(request)}
          </details>
          <button class="secondary" data-service-request-pdf="${escapeAttribute(request.id)}">PDF Form</button>
          <button class="secondary" data-service-request-email="${escapeAttribute(request.id)}">Email Request</button>
          <button class="secondary" data-service-request-send-pdf="${escapeAttribute(request.id)}">Send PDF Email</button>
          ${request.status !== "Reviewed" ? `<button class="secondary" data-service-request-id="${escapeAttribute(request.id)}" data-service-request-action="Reviewed">Review</button>` : ""}
          ${request.status !== "Scheduled" ? `<button class="secondary" data-service-request-id="${escapeAttribute(request.id)}" data-service-request-action="Scheduled">Schedule</button>` : ""}
          ${request.status !== "Completed" ? `<button class="secondary" data-service-request-id="${escapeAttribute(request.id)}" data-service-request-action="Completed">Complete</button>` : ""}
          ${request.status !== "Declined" ? `<button class="secondary" data-service-request-id="${escapeAttribute(request.id)}" data-service-request-action="Declined">Decline</button>` : ""}
          ${!request.convertedWorkOrderId ? `<button class="primary" data-service-request-convert="${escapeAttribute(request.id)}">Convert to Issue</button>` : `<span class="status-badge badge-ok">Converted</span>`}
        </div>
      ` : ""}
      ${requestHistory}
    </article>
  `;
}

function renderServiceRequestHistory(request) {
  const entries = serviceRequestHistoryEntries(request);
  return `
    <details class="service-request-audit">
      <summary>
        <span>History</span>
        <span>${entries.length}</span>
      </summary>
      <div class="service-request-audit-list">
        ${entries.map((entry) => `
          <article class="service-request-audit-entry">
            <strong>${escapeHtml(entry.action || "Updated")}</strong>
            <span>${escapeHtml(formatDateTime(new Date(entry.createdAt || request.createdAt || new Date().toISOString())))} | ${escapeHtml(entry.userName || "System")}${entry.userRole ? ` | ${escapeHtml(entry.userRole)}` : ""}</span>
            ${entry.details ? `<p>${escapeHtml(entry.details)}</p>` : ""}
          </article>
        `).join("")}
      </div>
    </details>
  `;
}

function serviceRequestHistoryEntries(request) {
  const entries = Array.isArray(request.history) ? request.history.filter(Boolean) : [];
  if (entries.length) return [...entries].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return [{
    id: "created",
    action: "Created",
    details: `${formatServiceRequestNumber(request)} - ${request.title || "Service request"}`,
    userName: request.requestedBy || "System",
    userRole: "",
    createdAt: request.createdAt || request.updatedAt || new Date().toISOString()
  }];
}

function addServiceRequestHistory(request, action, details = "") {
  if (!request) return;
  if (!Array.isArray(request.history)) request.history = [];
  request.history.unshift({
    id: crypto.randomUUID(),
    action,
    details,
    userId: currentUser?.id || "",
    userName: currentUser?.name || currentUser?.username || "System",
    userRole: currentRole || "System",
    createdAt: new Date().toISOString()
  });
}

function renderWorkOrderHistory(item) {
  const entries = workOrderHistoryEntries(item);
  return `
    <details class="service-request-audit">
      <summary>
        <span>History</span>
        <span>${entries.length}</span>
      </summary>
      <div class="service-request-audit-list">
        ${entries.map((entry) => `
          <article class="service-request-audit-entry">
            <strong>${escapeHtml(entry.action || "Updated")}</strong>
            <span>${escapeHtml(formatDateTime(new Date(entry.createdAt || item.createdAt || new Date().toISOString())))} | ${escapeHtml(entry.userName || "System")}${entry.userRole ? ` | ${escapeHtml(entry.userRole)}` : ""}</span>
            ${entry.details ? `<p>${escapeHtml(entry.details)}</p>` : ""}
          </article>
        `).join("")}
      </div>
    </details>
  `;
}

function workOrderHistoryEntries(item) {
  const entries = Array.isArray(item.history) ? item.history.filter(Boolean) : [];
  if (entries.length) return [...entries].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return [{
    id: "created",
    action: "Created",
    details: `${formatIssueNumber(item)} - ${item.title || "Open issue"}`,
    userName: item.source || "System",
    userRole: "",
    createdAt: item.createdAt || item.updatedAt || new Date().toISOString()
  }];
}

function addWorkOrderHistory(item, action, details = "") {
  if (!item) return;
  if (!Array.isArray(item.history)) item.history = [];
  item.history.unshift({
    id: crypto.randomUUID(),
    action,
    details,
    userId: currentUser?.id || "",
    userName: currentUser?.name || currentUser?.username || "System",
    userRole: currentRole || "System",
    createdAt: new Date().toISOString()
  });
}

function renderServiceRequestEditForm(request) {
  const priorities = ["Low", "Medium", "High"];
  const statuses = ["New", "Reviewed", "Scheduled", "Completed", "Declined"];
  return `
    <form class="inline-edit-form compact-form" data-service-request-edit-form="${escapeAttribute(request.id)}">
      <div class="form-grid">
        <label>
          Request
          <input name="title" value="${escapeAttribute(request.title || "")}" required>
        </label>
        <label>
          Priority
          <select name="priority">
            ${priorities.map((priority) => `<option ${request.priority === priority ? "selected" : ""}>${priority}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="form-grid">
        <label>
          Status
          <select name="status">
            ${statuses.map((status) => `<option ${request.status === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </label>
        <label>
          Preferred date
          <input name="preferredDate" type="date" value="${escapeAttribute(request.preferredDate || "")}">
        </label>
      </div>
      <label>
        Requested by
        <input name="requestedBy" value="${escapeAttribute(request.requestedBy || "")}">
      </label>
      <label>
        Details
        <textarea name="notes" rows="3">${escapeHtml(request.notes || "")}</textarea>
      </label>
      <label>
        Replace photo
        <input name="photo" type="file" accept="image/*">
      </label>
      <div class="work-order-actions">
        <button class="primary" type="submit">Save Changes</button>
      </div>
    </form>
  `;
}

function renderAssetWorkOrders(asset) {
  const workOrders = state.workOrders.filter((item) => item.assetId === asset.id && canSeeWorkOrder(item));
  els.assetWorkOrderCount.textContent = workOrders.length;
  els.assetWorkOrderList.innerHTML = workOrders.length
    ? workOrders.map(renderWorkOrderItem).join("")
    : `<p class="muted">${currentRole === "Technician" ? "No issues assigned to you for this equipment." : "No issues for this equipment."}</p>`;
}

function filterWorkOrdersForView(workOrders) {
  const active = workOrders.filter((item) => item.status !== "Closed");
  if (workOrderViewFilter === "highPriority") return active.filter((item) => item.priority === "High");
  if (workOrderViewFilter === "waitingParts") return active.filter((item) => item.status === "Waiting parts");
  if (workOrderViewFilter === "reported") return active.filter((item) => item.source === "Public QR report");
  if (workOrderViewFilter === "assignedToMe") return active.filter((item) => item.assignedUserId === currentUser?.id);
  return active;
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
  if (currentRole === "Technician") {
    return `
      <h2>No assigned equipment issues</h2>
      <p>Equipment will appear here when an open issue is assigned to you.</p>
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
  return assetSearchText(asset).includes(assetQuery);
}

function matchesAssetGlobalSearch(asset) {
  if (!globalQuery) return true;
  return assetSearchText(asset).includes(globalQuery);
}

function assetSearchText(asset) {
  const customer = getCustomer(asset.customerId);
  const locationRecord = getLocation(asset.locationId);
  const template = getTemplate(asset.templateId);
  const relatedIssueNumbers = state.workOrders
    .filter((item) => item.assetId === asset.id)
    .flatMap((item) => [formatIssueNumber(item), item.issueNumber]);
  const relatedPmNumbers = (asset.history || [])
    .flatMap((item) => [formatPmNumber(item), item.pmNumber]);
  const relatedServiceRequestNumbers = state.serviceRequests
    .filter((item) => item.assetId === asset.id)
    .flatMap((item) => [formatServiceRequestNumber(item), item.serviceRequestNumber]);
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
    customer?.contactName,
    customer?.contactEmail,
    customer?.contactPhone,
    customer?.contactNotes,
    locationRecord?.name,
    locationRecord?.contactName,
    locationRecord?.contactEmail,
    locationRecord?.contactPhone,
    locationRecord?.contactNotes,
    template?.name,
    ...relatedIssueNumbers,
    ...relatedPmNumbers,
    ...relatedServiceRequestNumbers,
    asset.id
  ].join(" ").toLowerCase();
  return haystack;
}

function matchesWorkOrderGlobalSearch(item) {
  if (!globalQuery) return true;
  const asset = getRawAsset(item.assetId);
  return [
    formatIssueNumber(item),
    item.issueNumber,
    item.title,
    item.status,
    item.priority,
    item.notes,
    item.source,
    item.contact,
    item.assignedUserName,
    getUser(item.assignedUserId)?.name,
    getUser(item.assignedUserId)?.username,
    getCustomer(item.customerId)?.name,
    getLocation(item.locationId)?.name,
    asset?.name,
    asset?.serial,
    asset?.model,
    asset?.manufacturer,
    asset?.type,
    item.id
  ].join(" ").toLowerCase().includes(globalQuery);
}

function matchesServiceRequestGlobalSearch(item) {
  if (!globalQuery) return true;
  const asset = getRawAsset(item.assetId);
  return [
    formatServiceRequestNumber(item),
    item.serviceRequestNumber,
    item.title,
    item.status,
    item.priority,
    item.notes,
    item.requestedBy,
    item.assignedUserName,
    getUser(item.assignedUserId)?.name,
    getUser(item.assignedUserId)?.username,
    getCustomer(item.customerId)?.name,
    getLocation(item.locationId)?.name,
    asset?.name,
    asset?.serial,
    asset?.model,
    asset?.manufacturer,
    asset?.type,
    item.id
  ].join(" ").toLowerCase().includes(globalQuery);
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
          <strong>${escapeHtml(formatPmNumber(item))} - ${escapeHtml(item.result || "Completed")}</strong>
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
  const assignedLabel = item.assignedUserName || getUser(item.assignedUserId)?.name || getUser(item.assignedUserId)?.username || "Unassigned";
  const assignmentControl = renderWorkOrderAssignmentControl(item);
  const assetAction = asset
    ? `<button class="secondary mini" type="button" data-asset-link="${item.assetId}">View Equipment</button>`
    : "";
  const reportActions = `
    <details class="inline-edit-drawer">
      <summary>Edit</summary>
      ${renderWorkOrderEditForm(item)}
    </details>
    <button class="secondary mini" type="button" data-work-order-pdf="${escapeAttribute(item.id)}">PDF Form</button>
    <button class="secondary mini" type="button" data-work-order-email="${escapeAttribute(item.id)}">Email Issue</button>
    <button class="secondary mini" type="button" data-work-order-send-pdf="${escapeAttribute(item.id)}">Send PDF Email</button>
  `;
  const actions = item.status === "Closed" ? `
    <div class="work-order-actions">
      ${reportActions}
      <button class="secondary" data-work-order-id="${item.id}" data-work-order-action="Open">Reopen</button>
    </div>
  ` : `
    <div class="work-order-actions">
      ${reportActions}
      ${item.status === "Open" ? `<button class="secondary" data-work-order-id="${item.id}" data-work-order-action="In progress">Start</button>` : ""}
      ${item.status !== "Waiting parts" ? `<button class="secondary" data-work-order-id="${item.id}" data-work-order-action="Waiting parts">Waiting Parts</button>` : ""}
      ${item.status !== "Resolved" ? `<button class="secondary" data-work-order-id="${item.id}" data-work-order-action="Resolved">Resolve</button>` : ""}
      <button class="secondary" data-work-order-convert-service="${escapeAttribute(item.id)}">Convert to Service Request</button>
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
          <strong>${escapeHtml(formatIssueNumber(item))} - ${escapeHtml(item.title)}</strong>
          <span><span class="status-badge ${statusClass}">${escapeHtml(item.status)}</span> ${escapeHtml(item.priority)} priority | Due ${formatDate(new Date(item.dueAt))}</span>
          <span class="assigned-label">Assigned to ${escapeHtml(assignedLabel)}</span>
        </div>
        ${assetAction}
      </header>
      ${assignmentControl}
      <p>${escapeHtml(customer?.name || "Unknown customer")} | ${escapeHtml(locationRecord?.name || "Unknown location")} | ${escapeHtml(asset?.name || item.areaName || "Area report")}</p>
      <p>${escapeHtml(item.notes)}</p>
      ${item.photo ? `<img class="history-photo" alt="Issue report photo" src="${item.photo.dataUrl}">` : ""}
      ${actions}
      ${renderWorkOrderHistory(item)}
    </article>
  `;
}

function renderWorkOrderEditForm(item) {
  const priorities = ["Low", "Medium", "High"];
  const statuses = ["Open", "In progress", "Waiting parts", "Resolved", "Closed"];
  const dueValue = item.dueAt ? toDateInputValue(new Date(item.dueAt)) : "";
  return `
    <form class="inline-edit-form compact-form" data-work-order-edit-form="${escapeAttribute(item.id)}">
      <div class="form-grid">
        <label>
          Issue
          <input name="title" value="${escapeAttribute(item.title || "")}" required>
        </label>
        <label>
          Priority
          <select name="priority">
            ${priorities.map((priority) => `<option ${item.priority === priority ? "selected" : ""}>${priority}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="form-grid">
        <label>
          Status
          <select name="status">
            ${statuses.map((status) => `<option ${item.status === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </label>
        <label>
          Due date
          <input name="dueDate" type="date" value="${escapeAttribute(dueValue)}">
        </label>
      </div>
      <label>
        Notes
        <textarea name="notes" rows="3">${escapeHtml(item.notes || "")}</textarea>
      </label>
      <label>
        Replace photo
        <input name="photo" type="file" accept="image/*">
      </label>
      <div class="work-order-actions">
        <button class="primary" type="submit">Save Changes</button>
      </div>
    </form>
  `;
}

function renderWorkOrderAssignmentControl(item) {
  if (!canManageWorkOrders()) {
    return `<p class="assigned-readonly">Assigned to ${escapeHtml(item.assignedUserName || "Unassigned")}</p>`;
  }
  const users = getAssignableUsersForWorkOrder(item);
  const selectedAssigneeId = getSelectedAssigneeId(item, users);
  const options = [
    `<option value="">Unassigned</option>`,
    ...users.map((user) =>
      `<option value="${escapeAttribute(user.id)}" ${selectedAssigneeId === user.id ? "selected" : ""}>${escapeHtml(user.name || user.username)} (${escapeHtml(user.role)})</option>`
    )
  ].join("");
  return `
    <label class="work-order-assignment">
      Assigned to
      <select data-work-order-assignee="${escapeAttribute(item.id)}">
        ${options}
      </select>
    </label>
  `;
}

function getIssueReportDetails(item) {
  const asset = getAsset(item.assetId) || getRawAsset(item.assetId);
  const customer = getCustomer(item.customerId);
  const locationRecord = getLocation(item.locationId);
  const assignedLabel = item.assignedUserName || getUser(item.assignedUserId)?.name || getUser(item.assignedUserId)?.username || "Unassigned";
  return {
    id: item.id,
    customerId: item.customerId || "",
    issueNumber: formatIssueNumber(item),
    reportTitle: "Issue Report",
    numberLabel: "Issue Number",
    footerLabel: "Preventative Maintenance Issue Form",
    title: item.title || "Open issue",
    customer: customer?.name || "Unknown customer",
    location: locationRecord?.name || "Unknown location",
    equipment: asset?.name || item.areaName || "Area report",
    status: item.status || "Open",
    priority: item.priority || "Medium",
    assignedTo: assignedLabel,
    source: item.source || "Maintenance",
    dueAt: item.dueAt ? formatDate(new Date(item.dueAt)) : "Not set",
    createdAt: item.createdAt ? formatDateTime(new Date(item.createdAt)) : "Not recorded",
    updatedAt: item.updatedAt ? formatDateTime(new Date(item.updatedAt)) : "Not recorded",
    resolvedAt: item.resolvedAt ? formatDateTime(new Date(item.resolvedAt)) : "",
    notes: item.notes || "No notes provided.",
    photoDataUrl: item.photo?.dataUrl || ""
  };
}

function openIssuePdfForm(item) {
  const details = getIssueReportDetails(item);
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    alert("Pop-up blocked. Please allow pop-ups for SiteWorks to create the PDF form.");
    return;
  }
  reportWindow.document.write(buildIssuePdfHtml(details));
  reportWindow.document.close();
  reportWindow.focus();
  window.setTimeout(() => {
    try {
      reportWindow.print();
    } catch (error) {
      console.warn("Issue report print skipped.", error);
    }
  }, 500);
  addWorkOrderHistory(item, "PDF opened", `${details.issueNumber} PDF form opened`);
  addActivity("Issue PDF opened", `${details.issueNumber} - ${details.title}`);
  saveState();
  render();
}

async function emailIssueReport(item) {
  const details = getIssueReportDetails(item);
  const recipient = await choosePreferredContractorEmail("Email this issue request to:", details.customerId);
  if (recipient === null) return;
  addWorkOrderHistory(item, "Email draft opened", `Draft to ${recipient.trim()}`);
  addActivity("Issue email draft opened", `${details.title} to ${recipient.trim()}`);
  saveState();
  render();
  openIssueEmailDraft(details, recipient);
}

function openIssueEmailDraft(details, recipient) {
  const subject = `SiteWorks Issue: ${details.priority} - ${details.equipment}`;
  const body = [
    "SiteWorks Issue Report",
    "",
    `Issue Number: ${details.issueNumber}`,
    `Issue: ${details.title}`,
    `Status: ${details.status}`,
    `Priority: ${details.priority}`,
    `Assigned to: ${details.assignedTo}`,
    `Customer: ${details.customer}`,
    `Location: ${details.location}`,
    `Equipment / Area: ${details.equipment}`,
    `Due: ${details.dueAt}`,
    `Created: ${details.createdAt}`,
    `Issue ID: ${details.id}`,
    "",
    "Notes:",
    details.notes,
    "",
    "If a PDF copy is needed, use the PDF Form button in SiteWorks and attach the saved PDF to this email."
  ].join("\n");
  window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function sendIssuePdfEmail(item, button) {
  const details = getIssueReportDetails(item);
  const recipient = await choosePreferredContractorEmail("Email this issue PDF to:", details.customerId);
  if (!recipient) return;

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Sending...";
  try {
    const response = await fetch(ISSUE_REPORT_FUNCTION_URL, {
      method: "POST",
      headers: supabaseFunctionHeaders(),
      body: JSON.stringify({
        to: recipient.trim(),
        issue: getEmailFunctionReportDetails(details)
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || "The issue email could not be sent.");
    }
    addWorkOrderHistory(item, "PDF email sent", `Sent to ${recipient.trim()}`);
    addActivity("Issue PDF emailed", `${details.title} to ${recipient.trim()}`);
    saveState();
    render();
    alert("Issue PDF email sent.");
  } catch (error) {
    console.warn("Issue PDF email failed.", error);
    addWorkOrderHistory(item, "PDF email failed", error.message || "Automatic PDF email could not be sent.");
    addActivity("Issue PDF email failed", `${details.title} to ${recipient.trim()}`);
    saveState();
    render();
    const useDraft = confirm([
      "The automatic PDF email could not be sent.",
      "",
      "This usually means the Supabase email function is not deployed yet, or the Resend API key is not saved in Supabase secrets.",
      "",
      "Open a regular email draft to this contractor instead?"
    ].join("\n"));
    if (useDraft) {
      addWorkOrderHistory(item, "Fallback email draft opened", `Draft to ${recipient.trim()}`);
      addActivity("Issue fallback email draft", `${details.title} to ${recipient.trim()}`);
      saveState();
      render();
      openIssueEmailDraft(details, recipient.trim());
    }
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function supabaseFunctionHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
  };
}

function getEmailFunctionReportDetails(details) {
  return { ...details };
}

function getServiceRequestReportDetails(request) {
  const asset = getAsset(request.assetId) || getRawAsset(request.assetId);
  const customer = getCustomer(request.customerId);
  const locationRecord = getLocation(request.locationId);
  const assignedLabel = request.assignedUserName || getUser(request.assignedUserId)?.name || getUser(request.assignedUserId)?.username || "Unassigned";
  return {
    id: request.id,
    customerId: request.customerId || "",
    issueNumber: formatServiceRequestNumber(request),
    reportTitle: "Service Request",
    numberLabel: "Service Request Number",
    footerLabel: "Service Request Form",
    title: request.title || "Service request",
    customer: customer?.name || "Unknown customer",
    location: locationRecord?.name || "Unknown location",
    equipment: asset?.name || "No equipment selected",
    status: request.status || "New",
    priority: request.priority || "Medium",
    assignedTo: assignedLabel,
    source: "Service request",
    dueAt: request.preferredDate ? formatDate(parseLocalDate(request.preferredDate)) : "Not set",
    createdAt: request.createdAt ? formatDateTime(new Date(request.createdAt)) : "Not recorded",
    updatedAt: request.updatedAt ? formatDateTime(new Date(request.updatedAt)) : "Not recorded",
    resolvedAt: request.status === "Completed" && request.updatedAt ? formatDateTime(new Date(request.updatedAt)) : "",
    notes: [
      `Requested by: ${request.requestedBy || "Not entered"}`,
      request.notes || "No details entered."
    ].join("\n"),
    photoDataUrl: request.photo?.dataUrl || ""
  };
}

function openServiceRequestPdfForm(request) {
  const details = getServiceRequestReportDetails(request);
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    alert("Pop-up blocked. Please allow pop-ups for SiteWorks to create the PDF form.");
    return;
  }
  reportWindow.document.write(buildIssuePdfHtml(details));
  reportWindow.document.close();
  reportWindow.focus();
  window.setTimeout(() => {
    try {
      reportWindow.print();
    } catch (error) {
      console.warn("Service request print skipped.", error);
    }
  }, 500);
  addServiceRequestHistory(request, "PDF opened", "Service request PDF form opened for printing.");
  addActivity("Service request PDF opened", `${formatServiceRequestNumber(request)} - ${request.title || "Service request"}`);
  saveState();
}

async function emailServiceRequest(request) {
  const details = getServiceRequestReportDetails(request);
  const recipient = await choosePreferredContractorEmail("Email this service request to:", details.customerId);
  if (recipient === null) return;
  addServiceRequestHistory(request, "Email draft opened", `Draft to ${recipient.trim()}`);
  addActivity("Service request email draft", `${details.title} to ${recipient.trim()}`);
  saveState();
  openServiceRequestEmailDraft(details, recipient);
}

function openServiceRequestEmailDraft(details, recipient) {
  const subject = `SiteWorks Service Request: ${details.priority} - ${details.equipment}`;
  const body = [
    "SiteWorks Service Request",
    "",
    `Service Request Number: ${details.issueNumber}`,
    `Request: ${details.title}`,
    `Status: ${details.status}`,
    `Priority: ${details.priority}`,
    `Assigned to: ${details.assignedTo}`,
    `Customer: ${details.customer}`,
    `Location: ${details.location}`,
    `Equipment / Area: ${details.equipment}`,
    `Preferred date: ${details.dueAt}`,
    `Created: ${details.createdAt}`,
    `Request ID: ${details.id}`,
    "",
    "Notes:",
    details.notes,
    "",
    "If a PDF copy is needed, use the PDF Form button in SiteWorks and attach the saved PDF to this email."
  ].join("\n");
  window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function sendServiceRequestPdfEmail(request, button) {
  const details = getServiceRequestReportDetails(request);
  const recipient = await choosePreferredContractorEmail("Email this service request PDF to:", details.customerId);
  if (!recipient) return;

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Sending...";
  try {
    const response = await fetch(ISSUE_REPORT_FUNCTION_URL, {
      method: "POST",
      headers: supabaseFunctionHeaders(),
      body: JSON.stringify({
        to: recipient.trim(),
        issue: getEmailFunctionReportDetails(details)
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || "The service request email could not be sent.");
    }
    addServiceRequestHistory(request, "PDF email sent", `Sent to ${recipient.trim()}`);
    addActivity("Service request PDF emailed", `${details.title} to ${recipient.trim()}`);
    saveState();
    render();
    alert("Service request PDF email sent.");
  } catch (error) {
    console.warn("Service request PDF email failed.", error);
    addServiceRequestHistory(request, "PDF email failed", error.message || "Automatic PDF email could not be sent.");
    addActivity("Service request PDF email failed", `${details.title} to ${recipient.trim()}`);
    saveState();
    render();
    const useDraft = confirm([
      "The automatic PDF email could not be sent.",
      "",
      "This usually means the Supabase email function is not deployed yet, or the Resend API key is not saved in Supabase secrets.",
      "",
      "Open a regular email draft to this contractor instead?"
    ].join("\n"));
    if (useDraft) {
      addServiceRequestHistory(request, "Fallback email draft opened", `Draft to ${recipient.trim()}`);
      addActivity("Service request fallback email draft", `${details.title} to ${recipient.trim()}`);
      saveState();
      render();
      openServiceRequestEmailDraft(details, recipient.trim());
    }
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function choosePreferredContractorEmail(promptTitle, customerId = "") {
  const contractors = visiblePreferredContractors(customerId);
  const contractorCustomer = customerId ? getCustomer(customerId) : null;
  const emptyContractorMessage = contractorCustomer
    ? `No preferred contractors have been added for ${contractorCustomer.name} yet.`
    : "No preferred contractors have been added yet.";
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "contractor-picker";
    overlay.innerHTML = `
      <section class="contractor-picker-card" role="dialog" aria-modal="true" aria-label="${escapeAttribute(promptTitle)}">
        <div class="section-title">
          <h2>${escapeHtml(promptTitle)}</h2>
          <button type="button" class="secondary mini" data-contractor-cancel>Cancel</button>
        </div>
        <div class="contractor-picker-list">
          ${contractors.length
            ? contractors.map((contractor) => `
              <button type="button" class="contractor-choice" data-contractor-email="${escapeAttribute(contractor.email)}">
                <strong>${escapeHtml(contractor.name)}</strong>
                <span>${escapeHtml(contractor.email)}${contractor.trade ? ` | ${escapeHtml(contractor.trade)}` : ""}</span>
              </button>
            `).join("")
            : `<p class="muted">${escapeHtml(emptyContractorMessage)}</p>`}
        </div>
        <form class="contractor-manual-form" data-contractor-manual-form>
          <label>
            Other email
            <input name="email" type="email" placeholder="service@example.com">
          </label>
          <button type="submit" class="primary">Use Email</button>
        </form>
      </section>
    `;
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "9999",
      display: "grid",
      placeItems: "center",
      padding: "20px",
      background: "rgba(23, 33, 38, 0.42)"
    });
    const pickerCard = overlay.querySelector(".contractor-picker-card");
    Object.assign(pickerCard.style, {
      width: "min(560px, calc(100vw - 32px))",
      maxHeight: "min(720px, calc(100vh - 32px))",
      overflow: "auto",
      padding: "18px",
      border: "1px solid var(--line)",
      borderRadius: "18px",
      background: "var(--panel)",
      boxShadow: "0 24px 70px rgba(23, 33, 38, 0.28)"
    });
    const close = (value) => {
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(value);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") close(null);
    };
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target.closest("[data-contractor-cancel]")) {
        close(null);
        return;
      }
      const choice = event.target.closest("[data-contractor-email]");
      if (choice) close(choice.dataset.contractorEmail);
    });
    overlay.querySelector("[data-contractor-manual-form]").addEventListener("submit", (event) => {
      event.preventDefault();
      const email = String(new FormData(event.currentTarget).get("email") || "").trim();
      if (!isEmailAddress(email)) {
        alert("Please enter a valid email address.");
        return;
      }
      close(email);
    });
    document.addEventListener("keydown", onKeyDown);
    document.body.appendChild(overlay);
    overlay.querySelector("button[data-contractor-email], input[name='email'], [data-contractor-cancel]")?.focus();
  });
}

function buildIssuePdfHtml(details) {
  const rows = [
    ["Customer", details.customer],
    ["Location", details.location],
    ["Equipment / Area", details.equipment],
    ["Status", details.status],
    ["Priority", details.priority],
    ["Assigned to", details.assignedTo],
    ["Source", details.source],
    ["Due", details.dueAt],
    ["Created", details.createdAt],
    ["Last updated", details.updatedAt],
    ...(details.resolvedAt ? [["Resolved", details.resolvedAt]] : []),
    [details.numberLabel || "Issue Number", details.issueNumber],
    ["Record ID", details.id]
  ];
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>SiteWorks Issue Report</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #172126; font-family: Arial, Helvetica, sans-serif; line-height: 1.35; }
    .report { min-height: 10in; border: 1px solid #cfd9d5; padding: 0.36in; }
    .top { display: flex; justify-content: space-between; gap: 0.25in; border-bottom: 3px solid #08705f; padding-bottom: 0.18in; margin-bottom: 0.22in; }
    .brand { color: #08705f; font-size: 13px; font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase; }
    h1 { margin: 0.04in 0 0; font-size: 28px; line-height: 1.05; }
    .meta { text-align: right; color: #627179; font-size: 11px; }
    .status { display: inline-block; margin-top: 0.08in; padding: 0.06in 0.12in; border-radius: 999px; background: #eef6f1; color: #08705f; font-weight: 800; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.12in; margin: 0.2in 0; }
    .field { border: 1px solid #dbe4e1; padding: 0.1in; min-height: 0.58in; }
    .field strong { display: block; color: #627179; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.03in; }
    .notes { margin-top: 0.2in; border: 1px solid #dbe4e1; padding: 0.16in; min-height: 1.4in; white-space: pre-wrap; }
    .notes strong, .photo strong, .signoff strong { display: block; color: #627179; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.05in; }
    .photo { margin-top: 0.2in; }
    .photo img { max-width: 100%; max-height: 3.2in; border: 1px solid #dbe4e1; object-fit: contain; }
    .signoff { display: grid; grid-template-columns: 1fr 1fr; gap: 0.2in; margin-top: 0.3in; }
    .line { border-bottom: 1px solid #8b989e; height: 0.35in; }
    .footer { margin-top: 0.25in; color: #627179; font-size: 10px; display: flex; justify-content: space-between; }
    @media print { .no-print { display: none; } .report { border-color: #cfd9d5; } }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="margin:0 0 12px;padding:10px 14px;border:1px solid #cfd9d5;border-radius:8px;background:#08705f;color:white;font-weight:800;">Print / Save PDF</button>
  <main class="report">
    <section class="top">
      <div>
        <div class="brand">SiteWorks</div>
        <h1>${escapeHtml(details.reportTitle || "Issue Report")}</h1>
        <div class="status">${escapeHtml(details.status)} | ${escapeHtml(details.priority)} Priority</div>
      </div>
      <div class="meta">
        <strong>Generated</strong><br>
        ${escapeHtml(formatDateTime(new Date()))}<br><br>
        <strong>${escapeHtml(details.numberLabel || "Issue Number")}</strong><br>
        ${escapeHtml(details.issueNumber)}<br><br>
        <strong>Record ID</strong><br>
        ${escapeHtml(details.id)}
      </div>
    </section>
    <h2>${escapeHtml(details.title)}</h2>
    <section class="grid">
      ${rows.map(([label, value]) => `
        <div class="field">
          <strong>${escapeHtml(label)}</strong>
          ${escapeHtml(value)}
        </div>
      `).join("")}
    </section>
    <section class="notes">
      <strong>Notes</strong>
      ${escapeHtml(details.notes)}
    </section>
    ${details.photoDataUrl ? `
      <section class="photo">
        <strong>Submitted Photo</strong>
        <img alt="Issue photo" src="${escapeAttribute(details.photoDataUrl)}">
      </section>
    ` : ""}
    <section class="signoff">
      <div>
        <strong>Technician / Reviewer</strong>
        <div class="line"></div>
      </div>
      <div>
        <strong>Date Completed</strong>
        <div class="line"></div>
      </div>
    </section>
    <footer class="footer">
      <span>${escapeHtml(details.footerLabel || "Preventative Maintenance Issue Form")}</span>
      <span>SiteWorks</span>
    </footer>
  </main>
</body>
</html>`;
}

function getAssignableUsersForWorkOrder(item) {
  return state.users
    .filter((user) => user.username !== "scan-customer")
    .filter((user) => user.role === "Admin" || user.customerId === item.customerId)
    .sort((a, b) => `${a.role} ${a.name || a.username}`.localeCompare(`${b.role} ${b.name || b.username}`));
}

function getSelectedAssigneeId(item, users = getAssignableUsersForWorkOrder(item)) {
  if (users.some((user) => user.id === item.assignedUserId)) return item.assignedUserId;
  const assignedName = String(item.assignedUserName || "").trim().toLowerCase();
  if (!assignedName) return "";
  const matchedUser = users.find((user) =>
    [user.name, user.username].some((value) => String(value || "").trim().toLowerCase() === assignedName)
  );
  return matchedUser?.id || "";
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
      selectedId = null;
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
    if (!canSeeAsset(asset)) return false;
    const matchesCustomer = asset.customerId === selectedCustomerId;
    const matchesLocation = selectedLocationId === "all" || asset.locationId === selectedLocationId;
    return matchesCustomer && matchesLocation && matchesAssetGlobalSearch(asset);
  });
}

function filteredWorkOrders() {
  return state.workOrders.filter((item) => {
    if (!canSeeWorkOrder(item)) return false;
    if (!canSeeCustomer(item.customerId)) return false;
    const matchesCustomer = item.customerId === selectedCustomerId;
    const matchesLocation = selectedLocationId === "all" || item.locationId === selectedLocationId;
    return matchesCustomer && matchesLocation && matchesWorkOrderGlobalSearch(item);
  });
}

function filteredServiceRequests() {
  return state.serviceRequests.filter((item) => {
    if (!canSeeServiceRequest(item)) return false;
    if (!canSeeCustomer(item.customerId)) return false;
    const matchesCustomer = item.customerId === selectedCustomerId;
    const matchesLocation = selectedLocationId === "all" || item.locationId === selectedLocationId;
    return matchesCustomer && matchesLocation && matchesServiceRequestGlobalSearch(item);
  });
}

function openWorkOrdersForAsset(assetId) {
  return state.workOrders.filter((item) => item.assetId === assetId && item.status !== "Closed" && canSeeWorkOrder(item));
}

function completedPmRecords() {
  return filteredAssets()
    .flatMap((asset) => (asset.history || []).map((history) => ({
      type: "pm",
      asset,
      history,
      customer: getCustomer(asset.customerId),
      location: getLocation(asset.locationId)
    })))
    .filter(matchesCompletedPmGlobalSearch)
    .sort((a, b) => new Date(b.history.completedAt || 0) - new Date(a.history.completedAt || 0));
}

function matchesCompletedPmGlobalSearch(record) {
  if (!globalQuery) return true;
  return [
    formatPmNumber(record.history),
    record.history.pmNumber,
    record.history.completedBy,
    record.history.notes,
    record.history.completedAt,
    record.asset?.name,
    record.asset?.serial,
    record.asset?.model,
    record.customer?.name,
    record.location?.name
  ].join(" ").toLowerCase().includes(globalQuery);
}

function completedIssueRecords() {
  const closedWorkOrders = filteredWorkOrders()
    .filter((item) => item.status === "Closed")
    .map((workOrder) => ({
      type: "workOrder",
      workOrder,
      asset: getAsset(workOrder.assetId),
      customer: getCustomer(workOrder.customerId),
      location: getLocation(workOrder.locationId),
      completedAt: workOrder.resolvedAt || workOrder.updatedAt || workOrder.createdAt
    }));

  return [...completedPmRecords(), ...closedWorkOrders]
    .sort((a, b) => new Date(b.completedAt || b.history?.completedAt || 0) - new Date(a.completedAt || a.history?.completedAt || 0));
}

function getMostRecentAssetWithCompletedPm() {
  return filteredAssets()
    .filter((asset) => asset.history?.length)
    .sort((a, b) => new Date(b.history[0]?.completedAt || 0) - new Date(a.history[0]?.completedAt || 0))[0] || null;
}

function locationsForCustomer(customerId) {
  return state.locations.filter((locationRecord) => locationRecord.customerId === customerId);
}

async function deleteLocation(locationId) {
  const locationRecord = getLocation(locationId);
  if (!locationRecord) return;
  if (!canManageCustomerSetup(locationRecord.customerId)) return;
  const removedAssetIds = new Set(
    state.assets
      .filter((asset) => asset.locationId === locationId)
      .map((asset) => asset.id)
  );
  const removedAssetCount = removedAssetIds.size;
  const removedWorkOrderCount = state.workOrders.filter((item) =>
    item.locationId === locationId || removedAssetIds.has(item.assetId)
  ).length;

  state.locations = state.locations.filter((item) => item.id !== locationId);
  state.assets = state.assets.filter((asset) => asset.locationId !== locationId);
  state.workOrders = state.workOrders.filter((item) =>
    item.locationId !== locationId && !removedAssetIds.has(item.assetId)
  );
  state.serviceRequests = state.serviceRequests.filter((item) =>
    item.locationId !== locationId && !removedAssetIds.has(item.assetId)
  );

  if (selectedLocationId === locationId) selectedLocationId = "all";
  if (removedAssetIds.has(selectedId)) selectedId = null;
  selectedCustomerId = state.customers.some((customer) => customer.id === selectedCustomerId)
    ? selectedCustomerId
    : state.customers[0]?.id || "";

  addActivity(
    "Location deleted",
    `${locationRecord.name}: ${removedAssetCount} equipment record(s), ${removedWorkOrderCount} issue(s)`
  );
  saveState();
  await deleteStructuredRows("locations", "id", [locationId]);
  if (selectedId) {
    location.hash = `asset/${selectedId}`;
  } else {
    history.replaceState(null, "", location.pathname + location.search);
  }
  render();
}

function getSelectedAsset() {
  return getAsset(selectedId);
}

function getAsset(id) {
  const asset = state.assets.find((item) => item.id === id) || null;
  if (!asset || !currentUser) return asset;
  return canSeeAsset(asset) ? asset : null;
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

function getServiceRequest(id) {
  return state.serviceRequests.find((item) => item.id === id) || null;
}

function getUser(id) {
  return state.users.find((user) => user.id === id) || null;
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
  const issue = {
    id: crypto.randomUUID(),
    issueNumber: nextIssueNumber(),
    assetId: asset.id,
    customerId: asset.customerId,
    locationId: asset.locationId,
    sourceHistoryId: historyItem.id,
    title: `${historyItem.result}: ${asset.name}`,
    priority,
    status: "Open",
    assignedUserId: "",
    assignedUserName: "",
    dueAt: addDays(new Date(), priority === "High" ? 2 : 7).toISOString(),
    notes: historyItem.notes || "Created automatically from PM result.",
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  addWorkOrderHistory(issue, "Created from PM", `${formatIssueNumber(issue)} - ${issue.title}`);
  return issue;
}

function createManualIssueForAsset(asset, issueData = {}) {
  if (!canManageWorkOrders() || !canSeeAsset(asset)) return;
  const title = issueData.title || `Issue: ${asset.name}`;
  if (!title.trim()) return;
  const priority = normalizePriority(issueData.priority);
  const issue = {
    id: crypto.randomUUID(),
    issueNumber: nextIssueNumber(),
    assetId: asset.id,
    customerId: asset.customerId,
    locationId: asset.locationId,
    source: "Manual issue",
    title: title.trim(),
    priority,
    status: "Open",
    assignedUserId: "",
    assignedUserName: "",
    dueAt: addDays(new Date(), priority === "High" ? 2 : 7).toISOString(),
    notes: issueData.notes || "No notes entered.",
    photo: issueData.photo || null,
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  addWorkOrderHistory(issue, "Created", `${formatIssueNumber(issue)} - ${issue.title}`);
  state.workOrders.unshift(issue);
  workOrderViewFilter = "active";
  addActivity("Issue created", `${formatIssueNumber(issue)} - ${issue.title}`);
  saveState();
  openPanel("workOrdersPanel");
  render();
  document.getElementById("workOrdersPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function createManualIssueForArea(customerId, locationId, areaName, issueData = {}) {
  if (!canManageWorkOrders() || !canSeeCustomer(customerId)) return;
  const locationRecord = getLocation(locationId);
  if (!locationRecord || locationRecord.customerId !== customerId) return;
  const title = issueData.title || `Issue: ${areaName || locationRecord.name}`;
  if (!title.trim()) return;
  const priority = normalizePriority(issueData.priority);
  const issue = {
    id: crypto.randomUUID(),
    issueNumber: nextIssueNumber(),
    assetId: "",
    customerId,
    locationId,
    areaName: areaName || locationRecord.name,
    source: "Manual area issue",
    title: title.trim(),
    priority,
    status: "Open",
    assignedUserId: "",
    assignedUserName: "",
    dueAt: addDays(new Date(), priority === "High" ? 2 : 7).toISOString(),
    notes: issueData.notes || "No notes entered.",
    photo: issueData.photo || null,
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  addWorkOrderHistory(issue, "Created", `${formatIssueNumber(issue)} - ${issue.title}`);
  state.workOrders.unshift(issue);
  workOrderViewFilter = "active";
  addActivity("Area issue created", `${formatIssueNumber(issue)} - ${issue.title}`);
  saveState();
  openPanel("workOrdersPanel");
  render();
  document.getElementById("workOrdersPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function createIssueFromTopAction() {
  if (!els.newIssueForm || !canManageWorkOrders()) return;
  const isAreaIssue = Boolean(els.newIssueTargetArea?.checked);
  const asset = getAsset(els.newIssueAsset?.value);
  const customerId = els.newIssueCustomer?.value || "";
  const locationId = els.newIssueLocation?.value || "";
  const areaName = String(els.newIssueArea?.value || "").trim();
  const locationRecord = getLocation(locationId);
  if (!isAreaIssue && !asset) {
    if (els.newIssueStatus) els.newIssueStatus.textContent = "Choose equipment or select Area first.";
    return;
  }
  if (isAreaIssue && (!customerId || !locationRecord || !areaName)) {
    if (els.newIssueStatus) els.newIssueStatus.textContent = "Choose a location and enter the area first.";
    return;
  }
  const submitButton = els.newIssueForm.querySelector("button[type='submit']");
  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Creating...";
    }
    const photo = await readPhoto(els.newIssuePhoto?.files?.[0]);
    const issueData = {
      title: els.newIssueTitle?.value.trim() || `Issue: ${isAreaIssue ? areaName : asset.name}`,
      priority: els.newIssuePriority?.value || "Medium",
      notes: els.newIssueNotes?.value.trim(),
      photo
    };
    els.newIssueDrawer.open = false;
    els.newIssueForm.reset();
    if (isAreaIssue) {
      createManualIssueForArea(customerId, locationId, areaName, issueData);
    } else {
      createManualIssueForAsset(asset, issueData);
    }
  } catch (error) {
    console.warn("Top action issue creation failed.", error);
    if (els.newIssueStatus) els.newIssueStatus.textContent = "Issue was not created. Try again with no photo or a smaller photo.";
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Create Issue";
    }
  }
}

async function createServiceRequest() {
  if (!els.serviceRequestForm) return;
  if (!canCreateServiceRequests()) {
    setServiceRequestStatus("This login cannot create service requests.");
    return;
  }
  const photo = await readPhoto(els.serviceRequestPhoto?.files?.[0]);
  const request = {
    id: crypto.randomUUID(),
    serviceRequestNumber: nextServiceRequestNumber(),
    customerId: els.serviceRequestCustomer.value,
    locationId: els.serviceRequestLocation.value,
    assetId: els.serviceRequestAsset.value,
    title: els.serviceRequestTitle.value.trim(),
    priority: normalizePriority(els.serviceRequestPriority.value),
    status: "New",
    requestedBy: els.serviceRequestRequestedBy.value.trim(),
    preferredDate: els.serviceRequestPreferredDate.value,
    assignedUserId: "",
    assignedUserName: "",
    notes: els.serviceRequestNotes.value.trim(),
    photo,
    convertedWorkOrderId: "",
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!request.customerId || !request.locationId) {
    setServiceRequestStatus("Choose a customer and location first.");
    return;
  }
  if (!request.title) {
    setServiceRequestStatus("Enter a short service request.");
    return;
  }
  addServiceRequestHistory(request, "Created", `${formatServiceRequestNumber(request)} - ${request.title}`);
  state.serviceRequests.unshift(request);
  addActivity("Service request created", `${formatServiceRequestNumber(request)} - ${request.title}`);
  saveState();
  els.serviceRequestForm.reset();
  const successMessage = `${formatServiceRequestNumber(request)} created.`;
  document.getElementById("serviceRequestCreateDrawer")?.removeAttribute("open");
  openPanel("serviceRequestsPanel");
  render();
  setServiceRequestStatus(successMessage);
  document.getElementById("serviceRequestsPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setServiceRequestStatus(message) {
  if (els.serviceRequestStatus) els.serviceRequestStatus.textContent = message;
}

function updateServiceRequestStatus(requestId, status) {
  const request = getServiceRequest(requestId);
  if (!request) return;
  const previousStatus = request.status || "New";
  request.status = status;
  request.updatedAt = new Date().toISOString();
  addServiceRequestHistory(request, "Status changed", `${previousStatus} -> ${status}`);
  addActivity("Service request updated", `${formatServiceRequestNumber(request)} - ${status}`);
  saveState();
  render();
}

function convertServiceRequestToIssue(requestId) {
  const request = getServiceRequest(requestId);
  if (!request || request.convertedWorkOrderId) return;
  const issue = {
    id: crypto.randomUUID(),
    issueNumber: nextIssueNumber(),
    assetId: request.assetId || "",
    customerId: request.customerId,
    locationId: request.locationId,
    source: "Service request",
    areaName: request.assetId ? "" : getLocation(request.locationId)?.name || "Service request",
    title: request.title || `Service request ${formatServiceRequestNumber(request)}`,
    priority: request.priority || "Medium",
    status: "Open",
    assignedUserId: request.assignedUserId || "",
    assignedUserName: request.assignedUserName || "",
    dueAt: addDays(new Date(), request.priority === "High" ? 2 : 7).toISOString(),
    notes: `${formatServiceRequestNumber(request)}\nRequested by: ${request.requestedBy || "Not entered"}\n${request.notes || "No details entered."}`,
    photo: request.photo || null,
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  addWorkOrderHistory(issue, "Created from service request", `${formatServiceRequestNumber(request)} -> ${formatIssueNumber(issue)}`);
  state.workOrders.unshift(issue);
  request.convertedWorkOrderId = issue.id;
  request.status = "Reviewed";
  request.updatedAt = new Date().toISOString();
  addServiceRequestHistory(request, "Converted to issue", `${formatServiceRequestNumber(request)} -> ${formatIssueNumber(issue)}`);
  workOrderViewFilter = "active";
  addActivity("Service request converted", `${formatServiceRequestNumber(request)} to ${formatIssueNumber(issue)}`);
  saveState();
  openPanel("workOrdersPanel");
  render();
}

function convertOpenIssueToServiceRequest(workOrderId) {
  const workOrder = getWorkOrder(workOrderId);
  if (!workOrder || workOrder.status === "Closed") return;
  const serviceRequest = {
    id: crypto.randomUUID(),
    serviceRequestNumber: nextServiceRequestNumber(),
    customerId: workOrder.customerId || "",
    locationId: workOrder.locationId || "",
    assetId: workOrder.assetId || "",
    title: workOrder.title || `Service request from ${formatIssueNumber(workOrder)}`,
    priority: workOrder.priority || "Medium",
    status: "New",
    requestedBy: workOrder.source || "Converted from open issue",
    preferredDate: "",
    assignedUserId: workOrder.assignedUserId || "",
    assignedUserName: workOrder.assignedUserName || "",
    notes: [
      `Converted from open issue ${formatIssueNumber(workOrder)}.`,
      workOrder.notes || "No details entered."
    ].join("\n"),
    photo: workOrder.photo || null,
    convertedWorkOrderId: workOrder.id,
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  addServiceRequestHistory(serviceRequest, "Created from issue", `${formatIssueNumber(workOrder)} -> ${formatServiceRequestNumber(serviceRequest)}`);
  state.serviceRequests.unshift(serviceRequest);
  workOrder.status = "Closed";
  workOrder.resolvedAt = new Date().toISOString();
  workOrder.updatedAt = new Date().toISOString();
  workOrder.notes = [
    workOrder.notes || "",
    `Converted to service request ${formatServiceRequestNumber(serviceRequest)}.`
  ].filter(Boolean).join("\n");
  addWorkOrderHistory(workOrder, "Converted to service request", `${formatIssueNumber(workOrder)} -> ${formatServiceRequestNumber(serviceRequest)}`);
  addActivity("Open issue converted", `${formatIssueNumber(workOrder)} to ${formatServiceRequestNumber(serviceRequest)}`);
  saveState();
  openPanel("serviceRequestsPanel");
  render();
  document.getElementById("serviceRequestsPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function normalizePriority(value) {
  const clean = String(value || "").trim().toLowerCase();
  if (clean === "high") return "High";
  if (clean === "low") return "Low";
  return "Medium";
}

function nextIssueNumber() {
  const highest = state.workOrders.reduce((max, item) => {
    const numeric = Number(item.issueNumber || String(item.issueNo || "").replace(/\D/g, ""));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);
  return highest + 1;
}

function formatIssueNumber(item) {
  const numeric = Number(item?.issueNumber || 0);
  return numeric ? `SW-${String(numeric).padStart(4, "0")}` : "SW-0000";
}

function nextPmNumber() {
  const highest = state.assets.reduce((max, asset) => {
    const assetHighest = (asset.history || []).reduce((innerMax, item) => {
      const numeric = Number(item.pmNumber || String(item.pmNo || "").replace(/\D/g, ""));
      return Number.isFinite(numeric) ? Math.max(innerMax, numeric) : innerMax;
    }, max);
    return Math.max(max, assetHighest);
  }, 0);
  return highest + 1;
}

function formatPmNumber(item) {
  const numeric = Number(item?.pmNumber || 0);
  return numeric ? `SW-PM-${String(numeric).padStart(4, "0")}` : "SW-PM-0000";
}

function nextServiceRequestNumber() {
  const highest = state.serviceRequests.reduce((max, item) => {
    const numeric = Number(item.serviceRequestNumber || String(item.serviceRequestNo || "").replace(/\D/g, ""));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);
  return highest + 1;
}

function formatServiceRequestNumber(item) {
  const numeric = Number(item?.serviceRequestNumber || 0);
  return numeric ? `SW-SR-${String(numeric).padStart(4, "0")}` : "SW-SR-0000";
}

function canManageSetup() {
  return currentRole === "Admin" || (currentRole === "Manager" && Boolean(currentUser?.customerId));
}

function canCreateCustomers() {
  return currentRole === "Admin";
}

function canManageTemplateSetup() {
  return currentRole === "Admin";
}

function canManageCustomerSetup(customerId) {
  if (currentRole === "Admin") return true;
  return currentRole === "Manager" && Boolean(currentUser?.customerId) && customerId === currentUser.customerId;
}

function manageableSetupCustomers() {
  if (currentRole === "Admin") {
    const selectedCustomer = getCustomer(selectedCustomerId);
    return selectedCustomer ? [selectedCustomer] : [...state.customers];
  }
  if (currentRole === "Manager" && currentUser?.customerId) {
    return state.customers.filter((customer) => customer.id === currentUser.customerId);
  }
  return [];
}

function canManageUsers() {
  return currentRole === "Admin" || (currentRole === "Manager" && Boolean(currentUser?.customerId));
}

function canManageContractors() {
  return currentRole === "Admin" || (currentRole === "Manager" && Boolean(currentUser?.customerId));
}

function canManageContractorCustomer(customerId) {
  if (currentRole === "Admin") return true;
  return currentRole === "Manager" && Boolean(currentUser?.customerId) && customerId === currentUser.customerId;
}

function canManageContractorRecord(contractor) {
  return canManageContractorCustomer(contractor.customerId);
}

function visiblePreferredContractors(customerId = "") {
  if (currentRole === "Admin") {
    return state.preferredContractors.filter((contractor) => !customerId || contractor.customerId === customerId);
  }
  if (currentRole === "Manager" && currentUser?.customerId) {
    return state.preferredContractors.filter((contractor) => contractor.customerId === currentUser.customerId);
  }
  if (customerId) return state.preferredContractors.filter((contractor) => contractor.customerId === customerId);
  return [];
}

function manageableUserCustomers() {
  if (currentRole === "Admin") return state.customers;
  if (currentRole === "Manager" && currentUser?.customerId) {
    return state.customers.filter((customer) => customer.id === currentUser.customerId);
  }
  return [];
}

function userRoleOptionsForEditor(existingRole = "") {
  if (currentRole === "Admin") return ["Customer", "Technician", "Manager", "Admin"];
  const roles = ["Customer", "Technician"];
  return roles.includes(existingRole) || !existingRole ? roles : [existingRole];
}

function canCreateUserRole(role) {
  if (currentRole === "Admin") return true;
  return currentRole === "Manager" && ["Customer", "Technician"].includes(role);
}

function canManageUserCustomer(customerId, role) {
  if (currentRole === "Admin") return true;
  if (currentRole !== "Manager") return false;
  if (role === "Admin" || role === "Manager") return false;
  return Boolean(currentUser?.customerId && customerId === currentUser.customerId);
}

function canViewUserRecord(user) {
  if (currentRole === "Admin") return true;
  if (currentRole !== "Manager") return false;
  return user.customerId === currentUser?.customerId && user.role !== "Admin";
}

function canEditUserRecord(user) {
  if (currentRole === "Admin") return true;
  if (currentRole !== "Manager") return false;
  if (currentUser?.id === user.id) return false;
  return user.customerId === currentUser?.customerId && ["Customer", "Technician"].includes(user.role);
}

function visibleManagedUsers() {
  return state.users.filter(canViewUserRecord);
}

function canAddEquipment() {
  return currentRole === "Admin" || currentRole === "Manager";
}

function canCompletePm() {
  return currentRole === "Admin" || currentRole === "Manager" || currentRole === "Technician" || currentRole === "Customer";
}

function canManageWorkOrders() {
  return currentRole === "Admin" || currentRole === "Manager";
}

function canCreateServiceRequests() {
  return Boolean(currentUser && visibleCustomers().length);
}

function canSeeWorkOrder(item) {
  if (currentRole === "Admin" || currentRole === "Manager") return canSeeCustomer(item.customerId);
  if (currentRole === "Technician") {
    return canSeeCustomer(item.customerId) && item.assignedUserId === currentUser?.id;
  }
  return canSeeCustomer(item.customerId);
}

function canSeeServiceRequest(item) {
  if (currentRole === "Admin" || currentRole === "Manager") return canSeeCustomer(item.customerId);
  if (currentRole === "Technician") {
    return canSeeCustomer(item.customerId) && item.assignedUserId === currentUser?.id;
  }
  return canSeeCustomer(item.customerId);
}

function canSeeAsset(asset) {
  if (!asset || !canSeeCustomer(asset.customerId)) return false;
  if (currentRole !== "Technician") return true;
  return state.workOrders.some((item) =>
    item.assetId === asset.id &&
    item.status !== "Closed" &&
    canSeeWorkOrder(item)
  );
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

function clearSelectedAssetUrl() {
  const params = new URLSearchParams(location.search);
  params.delete("a");
  params.delete("qr");
  const query = params.toString();
  history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}`);
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
    issueNumber: nextIssueNumber(),
    assetId: report.asset?.id || "",
    customerId: report.customer?.id || "",
    locationId: report.location?.id || "",
    areaName: report.asset ? "" : report.location?.name || "Area report",
    source: "Public QR report",
    title: `Customer report: ${subject}`,
    priority: "Medium",
    status: "Open",
    assignedUserId: "",
    assignedUserName: "",
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
    const localUsers = state.users.filter((user) =>
      user.username === "scan-customer" ||
      user.localOnly ||
      Boolean(user.password) ||
      !isEmailAddress(user.username)
    );
    const localUsernames = new Set(localUsers.map((user) => user.username.toLowerCase()));
    state.users = [
      ...localUsers,
      ...profiles.map(profileFromSupabase).filter((user) => !localUsernames.has(user.username.toLowerCase()))
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
  selectedId = getAssetIdFromUrl() || null;
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
    serviceRequests: state.serviceRequests || [],
    preferredContractors: state.preferredContractors || [],
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
    candidate?.workOrders?.length ||
    candidate?.serviceRequests?.length ||
    candidate?.preferredContractors?.length
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
      issue_number: item.issueNumber || null,
      asset_id: item.assetId || null,
      customer_id: item.customerId || null,
      location_id: item.locationId || null,
      title: item.title || "",
      priority: item.priority || "Medium",
      status: item.status || "Open",
      source: item.source || "",
      area_name: item.areaName || "",
      assigned_user_id: item.assignedUserId || "",
      assigned_user_name: item.assignedUserName || "",
      notes: item.notes || "",
      due_at: item.dueAt || null,
      resolved_at: item.resolvedAt || null,
      created_at: item.createdAt || new Date().toISOString(),
      updated_at: item.updatedAt || state.updatedAt || new Date().toISOString()
    })));

    await upsertStructuredRows("service_requests", state.serviceRequests.map((item) => ({
      id: item.id,
      service_request_number: item.serviceRequestNumber || null,
      asset_id: item.assetId || null,
      customer_id: item.customerId || null,
      location_id: item.locationId || null,
      title: item.title || "",
      priority: item.priority || "Medium",
      status: item.status || "New",
      requested_by: item.requestedBy || "",
      preferred_date: item.preferredDate || null,
      assigned_user_id: item.assignedUserId || "",
      assigned_user_name: item.assignedUserName || "",
      converted_work_order_id: item.convertedWorkOrderId || null,
      notes: item.notes || "",
      photo_data_url: item.photo?.dataUrl || "",
      photo_name: item.photo?.name || "",
      created_at: item.createdAt || new Date().toISOString(),
      updated_at: item.updatedAt || state.updatedAt || new Date().toISOString()
    })));

    const historyRows = state.assets.flatMap((asset) => (asset.history || []).map((item) => ({
      id: item.id,
      pm_number: item.pmNumber || null,
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

async function deleteStructuredRows(table, column, values) {
  const cleanValues = values.filter(Boolean);
  if (!cleanValues.length) return;
  const filter = cleanValues.map((value) => encodeURIComponent(value)).join(",");
  const response = await supabaseFetch(`${table}?${column}=in.(${filter})`, {
    method: "DELETE"
  });
  if (!response.ok) {
    console.warn(`Structured Supabase delete skipped for ${table}.`, await response.text());
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
    issueNumber: nextIssueNumber(),
    remoteReportId: report.id,
    assetId: asset?.id || report.equipment_id || "",
    customerId,
    locationId,
    areaName: asset ? "" : report.location_name || "Area report",
    source: "Public QR report",
    title: `Customer report: ${asset?.name || report.equipment_name || report.location_name || "Area"}`,
    priority: "Medium",
    status: "Open",
    assignedUserId: "",
    assignedUserName: "",
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
  const customerId = params.get("cid") || `scan-customer-${slugify(customerName)}`;
  const locationId = params.get("lid") || `scan-location-${slugify(customerName)}-${slugify(locationName)}`;
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
  if (customer?.id) params.set("cid", customer.id);
  if (customer?.name) params.set("c", customer.name);
  if (locationRecord?.id) params.set("lid", locationRecord.id);
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
    serviceRequests: input.serviceRequests || [],
    preferredContractors: input.preferredContractors || [],
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

  normalized.customers = normalized.customers.map((customer) => ({
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    contactNotes: "",
    ...customer
  }));

  normalized.locations = normalized.locations.map((locationRecord) => ({
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    contactNotes: "",
    ...locationRecord
  }));

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

  const usedPmNumbers = new Set();
  normalized.assets.forEach((asset) => {
    asset.history = (asset.history || []).map((item) => {
      const numeric = Number(item.pmNumber || String(item.pmNo || "").replace(/\D/g, ""));
      const pmNumber = Number.isFinite(numeric) && numeric > 0 && !usedPmNumbers.has(numeric)
        ? numeric
        : 0;
      if (pmNumber) usedPmNumbers.add(pmNumber);
      return { photo: null, ...item, pmNumber };
    });
  });
  let pmNumberCursor = 1;
  normalized.assets.forEach((asset) => {
    (asset.history || []).forEach((item) => {
      if (item.pmNumber) return;
      while (usedPmNumbers.has(pmNumberCursor)) pmNumberCursor += 1;
      item.pmNumber = pmNumberCursor;
      usedPmNumbers.add(pmNumberCursor);
    });
  });

  const usedIssueNumbers = new Set();
  normalized.workOrders = normalized.workOrders.map((item) => {
    const numeric = Number(item.issueNumber || String(item.issueNo || "").replace(/\D/g, ""));
    const issueNumber = Number.isFinite(numeric) && numeric > 0 && !usedIssueNumbers.has(numeric)
      ? numeric
      : 0;
    if (issueNumber) usedIssueNumbers.add(issueNumber);
    return {
      assignedUserId: "",
      assignedUserName: "",
      history: [],
      ...item,
      history: Array.isArray(item.history) ? item.history : [],
      issueNumber
    };
  });
  let issueNumberCursor = 1;
  normalized.workOrders.forEach((item) => {
    if (item.issueNumber) return;
    while (usedIssueNumbers.has(issueNumberCursor)) issueNumberCursor += 1;
    item.issueNumber = issueNumberCursor;
    usedIssueNumbers.add(issueNumberCursor);
  });

  const usedServiceRequestNumbers = new Set();
  normalized.serviceRequests = normalized.serviceRequests.map((item) => {
    const numeric = Number(item.serviceRequestNumber || String(item.serviceRequestNo || "").replace(/\D/g, ""));
    const serviceRequestNumber = Number.isFinite(numeric) && numeric > 0 && !usedServiceRequestNumbers.has(numeric)
      ? numeric
      : 0;
    if (serviceRequestNumber) usedServiceRequestNumbers.add(serviceRequestNumber);
    return {
      assetId: "",
      status: "New",
      assignedUserId: "",
      assignedUserName: "",
      convertedWorkOrderId: "",
      photo: null,
      history: [],
      ...item,
      photo: item.photo || null,
      history: Array.isArray(item.history) ? item.history : [],
      serviceRequestNumber
    };
  });
  let serviceRequestNumberCursor = 1;
  normalized.serviceRequests.forEach((item) => {
    if (item.serviceRequestNumber) return;
    while (usedServiceRequestNumbers.has(serviceRequestNumberCursor)) serviceRequestNumberCursor += 1;
    item.serviceRequestNumber = serviceRequestNumberCursor;
    usedServiceRequestNumbers.add(serviceRequestNumberCursor);
  });

  normalized.users = normalized.users.map((user) => ({
    ...user,
    customerId: user.role !== "Admin" && user.username !== "scan-customer"
      ? user.customerId || normalized.customers[0]?.id || ""
      : user.customerId || ""
  }));

  normalized.preferredContractors = normalized.preferredContractors.map((contractor) => ({
    id: contractor.id || crypto.randomUUID(),
    customerId: contractor.customerId || normalized.customers[0]?.id || "",
    name: contractor.name || "",
    email: contractor.email || "",
    trade: contractor.trade || "",
    createdAt: contractor.createdAt || new Date().toISOString(),
    ...contractor
  })).filter((contractor) => contractor.name && isEmailAddress(contractor.email));

  return normalized;
}

function emptyState() {
  return {
    customers: [],
    locations: [],
    templates: seedTemplates(),
    assets: [],
    workOrders: [],
    preferredContractors: [],
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
    preferredContractors: state.preferredContractors.length,
    activityLogEntries: state.activityLog?.length || 0,
    pmTemplates: state.templates.length,
    workOrders: state.workOrders.length,
    serviceRequests: state.serviceRequests.length,
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
    selectedId = getAssetIdFromUrl() || null;
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
  selectedId = getAssetIdFromUrl() || null;
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
  selectedId = null;
  saveState();
  history.replaceState(null, "", getCurrentPageUrl());
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
