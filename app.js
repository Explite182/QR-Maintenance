const STORAGE_KEY = "qr-pm-prototype-v3";
const AUTO_BACKUP_KEY = "qr-pm-prototype-auto-backups-v1";
const MAX_AUTO_BACKUPS = 5;
const LEGACY_KEYS = ["qr-pm-prototype-v2", "qr-pm-prototype-v1"];
const SUPABASE_URL = "https://chpjmtfxmkcelszeixnu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_HduxX7ZCGdxQpT0xtDv7hQ_dVz_fAwr";
const ISSUE_REPORT_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-issue-report`;
const SHARED_APP_STATE_ID = "main";
const AUTH_SESSION_KEY = "qr-maintenance-supabase-session-v1";
const SUPABASE_STORAGE_BUCKET = "siteworks-files";
const PRODUCTION_SITE_URL = "https://sitesworks.info/";
const SITEWORKS_API_BASE_URL = "";
const SITEWORKS_API_MODE = SITEWORKS_API_BASE_URL ? "server" : "supabase";
const USER_SWITCH_ADMIN_KEY = "siteworks-user-switch-admin-v1";
const INACTIVITY_LOGOUT_MS = 30 * 60 * 1000;
const PUBLIC_REPORT_SYNC_INTERVAL_MS = 2 * 60 * 1000;
const CLOUD_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const PUBLIC_REPORT_SYNC_MIN_AGE_MS = 60 * 1000;
const MANAGER_ROLES = ["Manager", "Facility Manager"];
const today = new Date();
const DEFAULT_TEMPLATE_ITEMS = [
  "Visual inspection complete",
  "Cleaned and free of debris",
  "No leaks, damage, or abnormal noise",
  "Safety devices checked"
];
const ASSET_DETAIL_FIELDS = [
  { field: "equipmentId", label: "Equipment ID", kind: "text", placeholder: "FT6-US-EMA0528A" },
  { field: "type", label: "Equipment type", kind: "text", placeholder: "HVAC, pump, conveyor" },
  { field: "criticality", label: "Criticality", kind: "select", options: ["", "Low", "Medium", "High"] },
  { field: "manufacturer", label: "Manufacturer", kind: "text", placeholder: "Manufacturer" },
  { field: "model", label: "Model", kind: "text", placeholder: "Model number" },
  { field: "serial", label: "Serial", kind: "text", placeholder: "Serial number" },
  { field: "installDate", label: "Install date", kind: "date" },
  { field: "vendor", label: "Vendor / service company", kind: "text", placeholder: "Vendor or service company" },
  { field: "vendorContact", label: "Vendor contact", kind: "text", placeholder: "Email or phone" },
  { field: "warrantyDate", label: "Warranty expires", kind: "date" },
  { field: "parts", label: "Parts / supply notes", kind: "textarea", placeholder: "Parts, suppliers, or ordering notes" },
  { field: "notes", label: "Notes", kind: "textarea", placeholder: "Equipment notes" }
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
let focusedWorkOrderId = "";
let focusedServiceRequestId = "";
let focusedCompletedRecordId = "";
let serviceRequestDrawerTab = "notes";
let commandPaletteQuery = "";
let workOrderNumberFilter = "all";
let pmCalendarRange = "month";
let pmCalendarDate = toDateInputValue(today);
let assetQuery = "";
let assetStatusFilter = "all";
let assetTemplateFilter = "all";
let assetSort = "due";
let assetRegisterTab = "active";
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
let structuredDataLoading = false;
let structuredDataReady = false;
let structuredSyncTimer = null;
let structuredSyncActive = false;
let authProfilesLoaded = false;
let authProfilesLoading = false;
let lastAuthError = "";
let lastPublicReportError = "";
let syncHealth = {
  lastCloudLoadAt: "",
  lastCloudSaveAt: "",
  lastPublicReportSyncAt: "",
  lastErrorAt: "",
  lastError: ""
};
let editingAssetDetailField = "";
let storageFullWarningShown = false;
let suppressStorageFullWarning = false;
const signedMediaUrlCache = new Map();
const signedMediaUrlPending = new Set();

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
  workNav: document.getElementById("workNav"),
  adminToolsDrawer: document.getElementById("adminToolsDrawer"),
  quickAddDrawer: document.getElementById("quickAddDrawer"),
  workHeader: document.getElementById("workHeader"),
  currentViewLabel: document.getElementById("currentViewLabel"),
  newActionBar: document.getElementById("newActionBar"),
  createNewBtn: document.getElementById("createNewBtn"),
  createNewMenu: document.getElementById("createNewMenu"),
  newEquipmentBtn: document.getElementById("newEquipmentBtn"),
  newIssueBtn: document.getElementById("newIssueBtn"),
  newServiceRequestBtn: document.getElementById("newServiceRequestBtn"),
  mobileCreateBtn: document.getElementById("mobileCreateBtn"),
  mobileCreateMenu: document.getElementById("mobileCreateMenu"),
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
  issueImportDrawer: document.getElementById("issueImportDrawer"),
  issueImportFile: document.getElementById("issueImportFile"),
  issueImportCreateLocations: document.getElementById("issueImportCreateLocations"),
  issueImportBtn: document.getElementById("issueImportBtn"),
  issueImportStatus: document.getElementById("issueImportStatus"),
  issueImportPreview: document.getElementById("issueImportPreview"),
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
  syncHealthPanel: document.getElementById("syncHealthPanel"),
  syncHealthSummary: document.getElementById("syncHealthSummary"),
  syncHealthGrid: document.getElementById("syncHealthGrid"),
  refreshCloudNowBtn: document.getElementById("refreshCloudNowBtn"),
  cloudCleanupBlock: document.getElementById("cloudCleanupBlock"),
  cloudCleanupStatus: document.getElementById("cloudCleanupStatus"),
  scanLocalFilesBtn: document.getElementById("scanLocalFilesBtn"),
  migrateLocalFilesBtn: document.getElementById("migrateLocalFilesBtn"),
  removeLocalCopiesBtn: document.getElementById("removeLocalCopiesBtn"),
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
  newUserLocation: document.getElementById("newUserLocation"),
  userFormStatus: document.getElementById("userFormStatus"),
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
  assetEquipmentId: document.getElementById("assetEquipmentId"),
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
  assetRegisterTabs: document.querySelectorAll("[data-asset-register-tab]"),
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
  commandPalette: document.getElementById("commandPalette"),
  commandPaletteInput: document.getElementById("commandPaletteInput"),
  commandPaletteResults: document.getElementById("commandPaletteResults"),
  emptyState: document.getElementById("emptyState"),
  assetPanel: document.getElementById("assetPanel"),
  assetPanelBackdrop: document.getElementById("assetPanelBackdrop"),
  workDrawerBackdrop: document.getElementById("workDrawerBackdrop"),
  closeAssetPanelBtn: document.getElementById("closeAssetPanelBtn"),
  selectedLocation: document.getElementById("selectedLocation"),
  selectedAssetThumb: document.getElementById("selectedAssetThumb"),
  selectedName: document.getElementById("selectedName"),
  selectedMeta: document.getElementById("selectedMeta"),
  selectedBadges: document.getElementById("selectedBadges"),
  selectedQr: document.getElementById("selectedQr"),
  selectedTemplate: document.getElementById("selectedTemplate"),
  assetPhotoPanel: document.getElementById("assetPhotoPanel"),
  assetManualPanel: document.getElementById("assetManualPanel"),
  assetDetailsGrid: document.getElementById("assetDetailsGrid"),
  electricalPanelScheduleDrawer: document.getElementById("electricalPanelScheduleDrawer"),
  electricalPanelScheduleCount: document.getElementById("electricalPanelScheduleCount"),
  electricalPanelScheduleContent: document.getElementById("electricalPanelScheduleContent"),
  panelScheduleBackdrop: document.getElementById("panelScheduleBackdrop"),
  panelScheduleSheet: document.getElementById("panelScheduleSheet"),
  panelScheduleSheetTitle: document.getElementById("panelScheduleSheetTitle"),
  panelScheduleSheetMeta: document.getElementById("panelScheduleSheetMeta"),
  panelScheduleForm: document.getElementById("panelScheduleForm"),
  panelScheduleCircuitRows: document.getElementById("panelScheduleCircuitRows"),
  addPanelCircuitBtn: document.getElementById("addPanelCircuitBtn"),
  panelScheduleCsvInput: document.getElementById("panelScheduleCsvInput"),
  importPanelScheduleCsvBtn: document.getElementById("importPanelScheduleCsvBtn"),
  panelScheduleImportStatus: document.getElementById("panelScheduleImportStatus"),
  panelScheduleLogoInput: document.getElementById("panelScheduleLogoInput"),
  panelScheduleLogoPreview: document.getElementById("panelScheduleLogoPreview"),
  removePanelScheduleLogoBtn: document.getElementById("removePanelScheduleLogoBtn"),
  printPanelScheduleBtn: document.getElementById("printPanelScheduleBtn"),
  exportSelectedAssetBtn: document.getElementById("exportSelectedAssetBtn"),
  deleteSelectedAssetBtn: document.getElementById("deleteSelectedAssetBtn"),
  assetInfoForm: document.getElementById("assetInfoForm"),
  editAssetName: document.getElementById("editAssetName"),
  editAssetEquipmentId: document.getElementById("editAssetEquipmentId"),
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
  reportIssueBtn: document.getElementById("reportIssueBtn"),
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
  failedPmIssues: document.getElementById("failedPmIssues"),
  activeLocations: document.getElementById("activeLocations"),
  assignedToMeIssues: document.getElementById("assignedToMeIssues"),
  pmCalendarCount: document.getElementById("pmCalendarCount"),
  pmCalendarRange: document.getElementById("pmCalendarRange"),
  pmCalendarDate: document.getElementById("pmCalendarDate"),
  pmCalendarSummary: document.getElementById("pmCalendarSummary"),
  pmCalendarList: document.getElementById("pmCalendarList"),
  printPmCalendarBtn: document.getElementById("printPmCalendarBtn"),
  emailPmCalendarBtn: document.getElementById("emailPmCalendarBtn"),
  exportPmCalendarBtn: document.getElementById("exportPmCalendarBtn"),
  workOrderCount: document.getElementById("workOrderCount"),
  workOrderNumberFilter: document.getElementById("workOrderNumberFilter"),
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
  photoViewerClose: document.getElementById("photoViewerClose"),
  photoSideBay: document.getElementById("photoSideBay"),
  photoSideBayImage: document.getElementById("photoSideBayImage")
};

moveTopActionDrawers();
render();
window.setTimeout(syncLoginQrReportPrompt, 0);
window.setTimeout(syncLoginQrReportPrompt, 600);
setupInactivityLogout();
loadSupabaseProfiles();
bootstrapCloudData();
window.setInterval(syncPublicReportsFromSupabase, PUBLIC_REPORT_SYNC_INTERVAL_MS);
window.setInterval(refreshCloudDataFromSupabase, CLOUD_REFRESH_INTERVAL_MS);

window.addEventListener("hashchange", () => {
  hydrateAssetFromHash();
  restoreScannedAssetSelection();
  selectedId = getAssetIdFromUrl() || selectedId;
  syncFiltersToSelectedAsset();
  render();
});

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  suppressStorageFullWarning = true;
  els.loginError.textContent = "Signing in...";
  const user = await signInWithSupabase(els.loginUsername.value, els.loginPassword.value);

  if (!user) {
    const localUser = findUserForLogin(els.loginUsername.value, els.loginPassword.value);
    if (!localUser) {
      if (authProfilesLoaded && !hasSetupUsers()) {
        showFirstAdminSetup("No SiteWorks admin account exists yet. Create the first admin below.");
        suppressStorageFullWarning = false;
        return;
      }
      els.loginError.textContent = lastAuthError || "Login did not work. Check that this manager user exists in Supabase and that the email/password are correct.";
      suppressStorageFullWarning = false;
      return;
    }
    currentUser = localUser;
    currentRole = localUser.role;
    state.currentUserId = localUser.id;
    rememberAdminUserSwitcher(localUser);
    restoreScannedAssetSelection();
    closeAssetRegisterDrawer();
    saveStateQuietly();
    els.loginForm.reset();
    els.loginError.textContent = "";
    render();
    window.setTimeout(() => {
      suppressStorageFullWarning = false;
    }, 1500);
    return;
  }

  currentUser = user;
  currentRole = user.role;
  state.currentUserId = user.id;
  rememberAdminUserSwitcher(user);
  restoreScannedAssetSelection();
  closeAssetRegisterDrawer();
  saveStateQuietly();
  els.loginForm.reset();
  els.loginError.textContent = "";
  render();
  window.setTimeout(() => {
    suppressStorageFullWarning = false;
  }, 1500);
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
  saveStateQuietly();
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
    saveStateQuietly();
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
      els.publicReportMessage.textContent = `${lastPublicReportError} Sending report without the photo...`;
    }
    const note = els.publicReportNote.value.trim();
    const contact = els.publicReportContact.value.trim();
    const ticket = createIssueFromPublicReport(report, note, contact, photo);
    let remoteId = await savePublicReportToSupabase(report, note, contact, photo);
    if (!remoteId && photo) {
      els.publicReportMessage.textContent = "Photo could not be attached, so SiteWorks is sending the report without it...";
      remoteId = await savePublicReportToSupabase(report, note, contact, null);
      ticket.photo = null;
    }
    if (!remoteId) {
      els.publicReportMessage.textContent = lastPublicReportError || "Report was not sent. Please try again.";
      return;
    }
    ticket.remoteReportId = remoteId;
    addWorkOrderHistory(ticket, "Created", `${formatIssueNumber(ticket)} - ${ticket.title}`);
    state.workOrders.unshift(ticket);
    addActivity("Public ticket reported", ticket.title);
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

document.querySelector("#mobileLogoutBtn")?.addEventListener("click", () => {
  logoutCurrentUser("manual");
});

els.mobileCreateBtn?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMobileCreateMenu();
});

els.mobileCreateMenu?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mobile-create-action]");
  if (!button) return;
  event.preventDefault();
  closeMobileCreateMenu();
  runCommandPaletteAction(button.dataset.mobileCreateAction);
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

function setUserFormStatus(message = "", isError = false) {
  if (!els.userFormStatus) return;
  els.userFormStatus.textContent = message;
  els.userFormStatus.classList.toggle("is-error", Boolean(isError));
  els.userFormStatus.classList.toggle("is-ok", Boolean(message && !isError));
}

els.userForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!canManageUsers()) return;
  const username = els.newUsername.value.trim().toLowerCase();
  setUserFormStatus("");
  if (!isEmailAddress(username)) {
    setUserFormStatus("Use an email address to create a shared login for PC, iPad, and phone.", true);
    return;
  }
  if (state.users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    setUserFormStatus("That email is already in the user list.", true);
    return;
  }

  const newUserRole = els.newUserRole.value;
  if (!canCreateUserRole(newUserRole)) {
    setUserFormStatus(userRolePermissionMessage(), true);
    return;
  }
  const newUserCustomerId = newUserRole === "Admin" ? "" : els.newUserCustomer.value;
  const newUserLocationId = newUserRole === "Admin" ? "" : els.newUserLocation?.value || "";
  if (!canManageUserCustomer(newUserCustomerId, newUserRole)) {
    setUserFormStatus("Managers can only add users for their assigned customer.", true);
    return;
  }
  if (!canManageUserLocation(newUserCustomerId, newUserLocationId)) {
    setUserFormStatus("Choose a location this user is allowed to access.", true);
    return;
  }
  const submitButton = els.userForm.querySelector("button[type='submit']");
  const originalButtonText = submitButton?.textContent || "Add User";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Creating...";
  }
  setUserFormStatus("Creating Supabase login...");
  const newUser = await signUpSupabaseUser(
    username,
    els.newUserPassword.value,
    els.newUserName.value.trim(),
    newUserRole,
    newUserCustomerId,
    newUserLocationId
  );
  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
  }
  if (!newUser) {
    setUserFormStatus(lastAuthError || "Could not create that Supabase user.", true);
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
  setUserFormStatus(`Cloud user created for ${newUser.username}.`);
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
  const locationId = role === "Admin" ? "" : String(formData.get("locationId") || "");
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
    alert(userRolePermissionMessage());
    return;
  }
  if (!canManageUserLocation(customerId, locationId)) {
    alert("Choose a location this user is allowed to access.");
    return;
  }

  user.username = username;
  user.name = name;
  user.role = role;
  user.customerId = customerId;
  user.locationId = locationId;
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
  if (!canCreateLocations()) {
    alert("This manager can only work inside their assigned location.");
    return;
  }
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
  if (!canManageLocationSetup(locationRecord.id, oldCustomerId)) return;
  if (currentUser?.locationId && nextCustomerId !== oldCustomerId) return;

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
  if (!canManageLocationSetup(locationRecord.id, locationRecord.customerId)) return;

  const locationAssets = state.assets.filter((asset) => asset.locationId === locationRecord.id);
  const locationWorkOrders = state.workOrders.filter((item) => item.locationId === locationRecord.id);
  const locationServiceRequests = state.serviceRequests.filter((item) => item.locationId === locationRecord.id);
  const customerName = getCustomer(locationRecord.customerId)?.name || "customer";
  const confirmed = window.confirm(
    `Delete ${locationRecord.name} for ${customerName}?\n\n` +
    `This will also delete ${locationAssets.length} equipment record(s), ${locationWorkOrders.length} ticket(s), and ${locationServiceRequests.length} service request(s) tied to this location.`
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
  if (!asset || !canEditEquipment() || !els.editAssetPhoto.files[0]) return;

  const previousPhoto = asset.photo || null;
  const replacementPhoto = await readPhoto(els.editAssetPhoto.files[0]);
  if (!replacementPhoto) return;
  asset.photo = replacementPhoto;
  addActivity("Equipment photo updated", asset.name);
  try {
    saveState();
    els.editAssetPhoto.value = "";
    render();
    openAssetEditor();
  } catch {
    asset.photo = previousPhoto;
    els.editAssetPhoto.value = "";
    render();
    openAssetEditor();
  }
});

els.editAssetGalleryPhotos.addEventListener("change", async () => {
  const asset = getSelectedAsset();
  if (!asset || !canEditEquipment() || !els.editAssetGalleryPhotos.files.length) return;

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
  if (!asset || !canEditEquipment() || !els.editAssetManualFile.files[0]) return;

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

els.workOrderList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-view-photo]");
  if (!button) return;
  openPhotoViewer(button.dataset.photoSrc, button.dataset.photoCaption || "Ticket photo");
});

els.assetWorkOrderList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-view-photo]");
  if (!button) return;
  openPhotoViewer(button.dataset.photoSrc, button.dataset.photoCaption || "Ticket photo");
});

els.selectedAssetThumb.addEventListener("click", () => {
  const asset = getSelectedAsset();
  const assetPhotoSrc = mediaSource(asset?.photo);
  if (assetPhotoSrc) openPhotoViewer(assetPhotoSrc, asset.photo.name || "Equipment photo");
});

els.photoViewerClose.addEventListener("click", closePhotoViewer);

els.photoViewer.addEventListener("click", (event) => {
  if (event.target === els.photoViewer) closePhotoViewer();
});

els.photoViewerImage.addEventListener("click", (event) => {
  event.stopPropagation();
});

els.photoSideBayImage?.addEventListener("click", (event) => {
  event.stopPropagation();
  closePhotoSideBay();
});

els.addPanelCircuitBtn?.addEventListener("click", () => {
  if (!canEditEquipment()) return;
  addPanelScheduleEditorRow({ number: getNextPanelCircuitNumber(), load: "", breaker: "", notes: "" });
});

els.panelScheduleForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  savePanelScheduleEditor();
});

els.panelScheduleCsvInput?.addEventListener("change", () => {
  const file = els.panelScheduleCsvInput.files?.[0];
  if (els.panelScheduleImportStatus) {
    els.panelScheduleImportStatus.textContent = file ? `Ready to import ${file.name}.` : "";
  }
});

els.importPanelScheduleCsvBtn?.addEventListener("click", async () => {
  await importPanelScheduleCsv();
});

els.printPanelScheduleBtn?.addEventListener("click", () => {
  printPanelSchedule();
});

els.panelScheduleLogoInput?.addEventListener("change", async () => {
  if (!canEditEquipment()) return;
  const logo = await readPhoto(els.panelScheduleLogoInput.files?.[0]);
  if (!logo || !els.panelScheduleForm) return;
  els.panelScheduleForm.dataset.logoUrl = mediaSource(logo);
  els.panelScheduleForm.dataset.logoName = logo.name || "Company logo";
  renderPanelScheduleLogoPreview(logo);
});

els.removePanelScheduleLogoBtn?.addEventListener("click", () => {
  if (!canEditEquipment()) return;
  if (!els.panelScheduleForm) return;
  delete els.panelScheduleForm.dataset.logoUrl;
  delete els.panelScheduleForm.dataset.logoName;
  if (els.panelScheduleLogoInput) els.panelScheduleLogoInput.value = "";
  renderPanelScheduleLogoPreview(null);
});

window.addEventListener("resize", () => {
  if (!els.photoSideBay || els.photoSideBay.classList.contains("hidden")) return;
  const activeDrawer = getActivePhotoDrawer();
  if (!activeDrawer) {
    closePhotoSideBay();
    return;
  }
  positionPhotoSideBay(activeDrawer);
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openCommandPalette();
    return;
  }
  if (event.key === "Escape" && els.commandPalette && !els.commandPalette.classList.contains("hidden")) {
    closeCommandPalette();
    return;
  }
  if (event.key === "Escape" && document.querySelector(".ticket-action-menu[open]")) {
    closeOpenTicketActionMenus();
    return;
  }
  if (event.key === "Escape" && els.photoSideBay && !els.photoSideBay.classList.contains("hidden")) {
    closePhotoSideBay();
    return;
  }
  if (event.key === "Escape" && els.panelScheduleSheet && !els.panelScheduleSheet.classList.contains("hidden")) {
    closePanelScheduleSheet();
    return;
  }
  if (event.key === "Escape" && !els.photoViewer.classList.contains("hidden")) {
    closePhotoViewer();
    return;
  }
  if (event.key === "Escape" && els.assetPanel && !els.assetPanel.classList.contains("hidden")) {
    closeSelectedAssetPanel();
    return;
  }
  if (event.key === "Escape" && document.querySelector(".work-order-drawer[open]:not(.completed-pm-item)")) {
    closeFocusedWorkDrawer();
    return;
  }
  if (event.key === "Enter" && document.activeElement === els.commandPaletteInput) {
    event.preventDefault();
    const firstResult = els.commandPaletteResults?.querySelector("[data-command-result-type]");
    if (firstResult) openCommandPaletteResult(firstResult.dataset.commandResultType, firstResult.dataset.commandResultId);
    return;
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

els.commandPaletteInput?.addEventListener("input", () => {
  commandPaletteQuery = els.commandPaletteInput.value.trim().toLowerCase();
  renderCommandPaletteResults();
});

els.commandPaletteResults?.addEventListener("click", (event) => {
  const result = event.target.closest("[data-command-result-type]");
  if (!result) return;
  openCommandPaletteResult(result.dataset.commandResultType, result.dataset.commandResultId);
});

els.commandPalette?.addEventListener("click", (event) => {
  if (event.target === els.commandPalette) closeCommandPalette();
});

document.addEventListener("click", (event) => {
  const result = event.target.closest("[data-dashboard-result-type]");
  if (!result) return;
  event.stopPropagation();
  openDashboardResult(result.dataset.dashboardResultType, result.dataset.dashboardResultId);
  closeMetricMenus();
});

document.addEventListener("click", () => {
  requestAnimationFrame(syncWorkDrawerBackdrop);
});

function closeOpenTicketActionMenus(exceptMenu = null) {
  document.querySelectorAll(".ticket-action-menu[open]").forEach((menu) => {
    if (menu !== exceptMenu) menu.removeAttribute("open");
  });
}

document.addEventListener("click", (event) => {
  closeOpenTicketActionMenus(event.target.closest(".ticket-action-menu"));
});

els.workOrderNumberFilter?.addEventListener("change", () => {
  workOrderNumberFilter = els.workOrderNumberFilter.value || "all";
  focusedWorkOrderId = "";
  focusedServiceRequestId = "";
  focusedCompletedRecordId = "";
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

els.assetRegisterTabs?.forEach((button) => {
  button.addEventListener("click", () => {
    assetRegisterTab = button.dataset.assetRegisterTab || "active";
    assetPage = 1;
    render();
  });
});

document.querySelectorAll("[data-dashboard-filter]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMetricMenu(button.dataset.dashboardFilter);
  });
});

els.newEquipmentBtn?.addEventListener("click", () => {
  if (!canAddEquipment()) return;
  closeCreateNewMenu();
  openTopActionDrawer(els.quickAddDrawer);
});

els.createNewBtn?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleCreateNewMenu();
});

document.addEventListener("click", (event) => {
  if (event.target.closest("#quickAddDrawer, #newIssueDrawer, #serviceRequestCreateDrawer, #createNewBtn, #createNewMenu, #mobileCreateBtn, #mobileCreateMenu")) return;
  closeTopActionDrawers();
  closeMetricMenus();
  closeCreateNewMenu();
  closeMobileCreateMenu();
});

els.newIssueBtn?.addEventListener("click", () => {
  if (!canCreateWorkOrders()) return;
  closeCreateNewMenu();
  renderNewIssueFormOptions();
  openTopActionDrawer(els.newIssueDrawer);
});

els.newServiceRequestBtn?.addEventListener("click", () => {
  if (!canCreateServiceRequests()) return;
  closeCreateNewMenu();
  renderServiceRequestFormOptions();
  openTopActionDrawer(els.serviceRequestCreateDrawer);
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

els.newUserRole?.addEventListener("change", () => {
  renderNewUserLocationOptions();
});

els.newUserCustomer?.addEventListener("change", () => {
  renderNewUserLocationOptions();
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
    const isOpen = els.assetRegisterDrawer.open;
    if (!isOpen) {
      delete els.assetRegisterDrawer.dataset.openedByMetric;
      if (els.assetRegisterDrawer.classList.contains("sidebar-controlled-panel")) {
        els.assetRegisterDrawer.classList.add("hidden");
      }
    } else if (els.assetRegisterDrawer.classList.contains("sidebar-controlled-panel")) {
      els.assetRegisterDrawer.classList.remove("hidden");
    }
    setSidebarTargetButtonState("assetRegisterDrawer", isOpen && !els.assetRegisterDrawer.classList.contains("hidden"));
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
    equipmentId: els.assetEquipmentId.value.trim(),
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
    extraChecklistItems: [],
    createdAt: new Date().toISOString(),
    history: []
  };

  if (!canSeeLocation(asset.locationId, asset.customerId)) return;
  const previousSelectedId = selectedId;
  const previousCustomerId = selectedCustomerId;
  const previousLocationId = selectedLocationId;
  state.assets.unshift(asset);
  addActivity("Asset added", asset.name);
  selectedId = asset.id;
  selectedCustomerId = asset.customerId;
  selectedLocationId = defaultLocationSelection();
  try {
    saveState();
  } catch (error) {
    state.assets = state.assets.filter((item) => item.id !== asset.id);
    state.activityLog = state.activityLog.filter((entry) =>
      !(entry.action === "Asset added" && entry.details === asset.name)
    );
    selectedId = previousSelectedId;
    selectedCustomerId = previousCustomerId;
    selectedLocationId = previousLocationId;
    render();
    return;
  }
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
  const file = els.assetImportFile?.files?.[0];
  if (els.assetImportStatus) {
    els.assetImportStatus.textContent = file ? `Ready to import ${file.name}.` : "";
  }
  if (els.assetImportPreview) els.assetImportPreview.innerHTML = "";
});

els.issueImportBtn?.addEventListener("click", async () => {
  await importTicketsCsv();
});

els.issueImportFile?.addEventListener("change", () => {
  const file = els.issueImportFile?.files?.[0];
  if (els.issueImportStatus) {
    els.issueImportStatus.textContent = file ? `Ready to import ${file.name}.` : "";
  }
  if (els.issueImportPreview) els.issueImportPreview.innerHTML = "";
});

els.pmForm.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-checklist-add]");
  if (addButton) {
    addCustomChecklistItem();
    return;
  }

  const removeButton = event.target.closest("[data-checklist-remove]");
  if (removeButton) {
    removeCustomChecklistItem(Number(removeButton.dataset.checklistRemove));
  }
});

els.pmForm.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || !event.target.closest("[data-checklist-new-item]")) return;
  event.preventDefault();
  addCustomChecklistItem();
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
  if (!asset || !canEditEquipment()) return;
  if (!canSeeLocation(els.editAssetLocation.value, els.editAssetCustomer.value)) return;

  const replacementPhoto = await readPhoto(els.editAssetPhoto.files[0]);
  asset.name = els.editAssetName.value.trim();
  asset.equipmentId = els.editAssetEquipmentId.value.trim();
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

els.reportIssueBtn?.addEventListener("click", () => {
  const asset = getSelectedAsset();
  if (!asset) return;
  location.href = getReportAssetUrl(asset.id);
});

els.exportBtn.addEventListener("click", () => {
  const asset = getSelectedAsset();
  if (!asset) return;
  downloadCsv(asset);
});

els.deleteSelectedAssetBtn?.addEventListener("click", () => {
  deleteSelectedEquipment();
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
    alert("Enter a contact name and valid email address.");
    return;
  }
  if (!canManageContractorCustomer(customerId)) {
    alert("Managers can only add contacts for their assigned customer.");
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

els.pmCalendarRange?.addEventListener("change", () => {
  pmCalendarRange = els.pmCalendarRange.value || "month";
  renderPmCalendar();
});

els.pmCalendarDate?.addEventListener("change", () => {
  pmCalendarDate = els.pmCalendarDate.value || toDateInputValue(today);
  renderPmCalendar();
});

els.printPmCalendarBtn?.addEventListener("click", () => {
  printPmCalendar();
});

els.emailPmCalendarBtn?.addEventListener("click", () => {
  emailPmCalendarList();
});

els.exportPmCalendarBtn?.addEventListener("click", () => {
  exportPmCalendarCsv();
});

els.exportAssetRegisterBtn.addEventListener("click", () => {
  downloadAssetRegisterCsv(assetTableAssets());
});

els.exportSelectedAssetBtn.addEventListener("click", () => {
  const asset = getSelectedAsset();
  if (!asset) return;
  const filename = `${asset.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-equipment-${timestampForFile()}.csv`;
  downloadAssetRegisterCsv([asset], filename);
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

els.scanLocalFilesBtn?.addEventListener("click", () => {
  renderBackupStatus();
  renderSyncHealth();
  updateCloudCleanupStatus(buildStorageHealthSummaryText(getStoredFileHealth()));
});

els.migrateLocalFilesBtn?.addEventListener("click", async () => {
  await migrateLocalFilesToCloud();
});

els.removeLocalCopiesBtn?.addEventListener("click", () => {
  removeCloudBackedLocalCopies();
});

els.refreshCloudNowBtn?.addEventListener("click", async () => {
  await refreshCloudDataFromSupabase();
  await syncPublicReportsFromSupabase(true);
  render();
});

document.addEventListener("click", (event) => {
  const closePanelScheduleButton = event.target.closest("[data-close-panel-schedule]");
  if (closePanelScheduleButton) {
    event.preventDefault();
    closePanelScheduleSheet();
    return;
  }

  const openPanelScheduleButton = event.target.closest("[data-open-panel-schedule]");
  if (openPanelScheduleButton) {
    event.preventDefault();
    openPanelScheduleSheet();
    return;
  }

  const printPanelScheduleButton = event.target.closest("[data-print-panel-schedule]");
  if (printPanelScheduleButton) {
    event.preventDefault();
    printPanelSchedule();
    return;
  }

  const removePanelCircuitButton = event.target.closest("[data-remove-panel-circuit]");
  if (removePanelCircuitButton) {
    event.preventDefault();
    removePanelScheduleEditorRow(removePanelCircuitButton.closest("[data-panel-circuit-row]"));
    return;
  }

  const closeAssetPanelButton = event.target.closest("[data-close-asset-panel]");
  if (closeAssetPanelButton) {
    event.preventDefault();
    closeSelectedAssetPanel();
    return;
  }

  const closeWorkDrawerButton = event.target.closest("[data-close-work-drawer]");
  if (closeWorkDrawerButton) {
    event.preventDefault();
    closeFocusedWorkDrawer(closeWorkDrawerButton.closest(".work-order-drawer"));
    return;
  }

  const openTicketEditButton = event.target.closest("[data-open-ticket-edit]");
  if (openTicketEditButton) {
    event.preventDefault();
    const drawer = openTicketEditButton.closest(".work-order-drawer");
    const editDrawer = drawer?.querySelector("[data-ticket-edit-drawer]");
    if (editDrawer) {
      editDrawer.open = true;
      editDrawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    return;
  }

  const cancelAssetDetailEdit = event.target.closest("[data-asset-detail-cancel]");
  if (cancelAssetDetailEdit) {
    event.preventDefault();
    closeInlineAssetDetailEditor();
    return;
  }

  const openAssetDetailEdit = event.target.closest("[data-asset-detail-open]");
  if (openAssetDetailEdit) {
    event.preventDefault();
    openInlineAssetDetailEditor(openAssetDetailEdit.dataset.assetDetailOpen);
    return;
  }

  const openWorkDrawer = document.querySelector(".work-order-drawer[open]:not(.completed-pm-item)");
  if (openWorkDrawer && !openWorkDrawer.contains(event.target)) {
    event.preventDefault();
    closeFocusedWorkDrawer(openWorkDrawer);
    return;
  }

  const serviceRequestTabButton = event.target.closest("[data-service-request-tab]");
  if (serviceRequestTabButton) {
    event.preventDefault();
    serviceRequestDrawerTab = serviceRequestTabButton.dataset.serviceRequestTab === "history" ? "history" : "notes";
    render();
    return;
  }

  const addEquipmentButton = event.target.closest("[data-empty-add-equipment]");
  if (addEquipmentButton) {
    event.preventDefault();
    openEmptyStateEquipmentForm();
    return;
  }

  const clearFiltersButton = event.target.closest("[data-empty-clear-filters]");
  if (clearFiltersButton) {
    event.preventDefault();
    clearWorkspaceFilters();
    return;
  }

  const panelToggle = event.target.closest("[data-panel-toggle]");
  if (panelToggle) {
    if (panelToggle.dataset.panelToggle === "dashboardPanel") return;
    const panel = document.getElementById(panelToggle.dataset.panelToggle);
    if (panel?.classList.contains("sidebar-controlled-panel")) {
      closeSidebarTarget(panelToggle.dataset.panelToggle);
      return;
    }
    togglePanel(panelToggle.dataset.panelToggle);
    return;
  }

  const openButton = event.target.closest("[data-open-target]");
  if (openButton) {
    openSidebarTarget(openButton.dataset.openTarget);
    return;
  }

  const mobileTabButton = event.target.closest("[data-mobile-tab]");
  if (mobileTabButton) {
    event.preventDefault();
    openMobileTab(mobileTabButton.dataset.mobileTab);
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

  const pmCalendarAssetButton = event.target.closest("[data-pm-calendar-asset]");
  if (pmCalendarAssetButton) {
    const asset = getAsset(pmCalendarAssetButton.dataset.pmCalendarAsset);
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

  const workOrderDeleteButton = event.target.closest("[data-work-order-delete]");
  if (workOrderDeleteButton) {
    deleteWorkOrder(workOrderDeleteButton.dataset.workOrderDelete);
    return;
  }

  const contractorDeleteButton = event.target.closest("[data-delete-contractor]");
  if (contractorDeleteButton && canManageContractors()) {
    deletePreferredContractor(contractorDeleteButton.dataset.deleteContractor);
    return;
  }

  const button = event.target.closest("[data-work-order-action]");
  if (!button) return;
  const workOrder = getWorkOrder(button.dataset.workOrderId);
  if (!workOrder) return;
  const nextStatus = button.dataset.workOrderAction;
  const managerOnlyStatus = nextStatus === "Open" || nextStatus === "Closed";
  if (!canWorkOnTicket(workOrder) || (managerOnlyStatus && !canManageWorkOrders())) return;

  const previousStatus = workOrder.status || "Open";
  workOrder.status = nextStatus;
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
  const previousAssigneeId = workOrder.assignedUserId || "";
  const previousAssignee = workOrder.assignedUserName || "Unassigned";
  workOrder.assignedUserId = user?.id || "";
  workOrder.assignedUserName = user ? user.name || user.username : "";
  workOrder.updatedAt = new Date().toISOString();
  addWorkOrderHistory(workOrder, "Assigned", `${previousAssignee} -> ${workOrder.assignedUserName || "Unassigned"}`);
  addActivity("Ticket assigned", `${workOrder.title} - ${workOrder.assignedUserName || "Unassigned"}`);
  saveState();
  render();
  if (user && user.id !== previousAssigneeId && workOrder.status !== "Closed") {
    sendIssueAssignmentEmail(workOrder, user);
  }
});

document.addEventListener("change", (event) => {
  const select = event.target.closest("[data-service-request-assignee]");
  if (!select || !canManageWorkOrders()) return;
  const request = getServiceRequest(select.dataset.serviceRequestAssignee);
  if (!request) return;
  const users = getAssignableUsersForWorkOrder(request);
  const user = users.find((item) => item.id === select.value);
  const previousAssigneeId = request.assignedUserId || "";
  const previousAssignee = request.assignedUserName || "Unassigned";
  request.assignedUserId = user?.id || "";
  request.assignedUserName = user?.name || user?.username || "";
  request.updatedAt = new Date().toISOString();
  addServiceRequestHistory(request, "Assigned", `${previousAssignee} -> ${request.assignedUserName || "Unassigned"}`);
  addActivity("Service request assigned", `${formatServiceRequestNumber(request)} - ${request.assignedUserName || "Unassigned"}`);
  saveState();
  render();
  if (user && user.id !== previousAssigneeId && request.status !== "Completed" && request.status !== "Declined") {
    sendServiceRequestAssignmentEmail(request, user);
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-asset-detail-edit]");
  if (!form) return;
  event.preventDefault();
  const formData = new FormData(form);
  saveInlineAssetDetail(form.dataset.assetDetailEdit, formData.get("value"));
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-work-order-edit-form]");
  if (!form) return;
  event.preventDefault();
  const workOrder = getWorkOrder(form.dataset.workOrderEditForm);
  if (!workOrder) return;
  if (!canWorkOnTicket(workOrder)) return;
  const formData = new FormData(form);
  const photo = await readIssuePhoto(form.querySelector("input[name='photo']")?.files?.[0]);
  const before = {
    title: workOrder.title || "",
    priority: workOrder.priority || "Medium",
    status: workOrder.status || "Open",
    dueAt: workOrder.dueAt || "",
    notes: workOrder.notes || "",
    photoCount: Array.isArray(workOrder.photos) ? workOrder.photos.length : 0
  };
  if (form.elements.title) workOrder.title = String(formData.get("title") || "").trim() || workOrder.title;
  if (form.elements.priority) workOrder.priority = normalizePriority(formData.get("priority"));
  if (form.elements.status) workOrder.status = String(formData.get("status") || workOrder.status);
  if (form.elements.dueDate) {
    const dueDate = String(formData.get("dueDate") || "");
    workOrder.dueAt = dueDate ? parseLocalDate(dueDate).toISOString() : workOrder.dueAt;
  }
  const noteText = String(formData.get("notes") || "").trim();
  if (noteText) {
    workOrder.notes = appendDatedWorkNote(workOrder.notes, noteText);
  }
  if (photo) {
    workOrder.photos = Array.isArray(workOrder.photos) ? workOrder.photos : [];
    workOrder.photos.push({
      ...photo,
      addedAt: new Date().toISOString(),
      addedBy: getCurrentUserLabel()
    });
  }
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
  if (before.notes !== workOrder.notes) changes.push("Work note added");
  if (photo) changes.push("Work photo added");
  addWorkOrderHistory(workOrder, "Edited", changes.join(" | ") || "No visible changes");
  addActivity("Ticket edited", `${formatIssueNumber(workOrder)} - ${workOrder.title}`);
  saveState();
  render();
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-work-order-quick-note-form]");
  if (!form) return;
  event.preventDefault();
  const workOrder = getWorkOrder(form.dataset.workOrderQuickNoteForm);
  if (!workOrder || !canWorkOnTicket(workOrder)) return;
  const formData = new FormData(form);
  const noteText = String(formData.get("note") || "").trim();
  const photo = await readIssuePhoto(form.querySelector("input[name='photo']")?.files?.[0]);
  if (!noteText && !photo) return;
  if (noteText) {
    workOrder.notes = appendDatedWorkNote(workOrder.notes, noteText);
    addWorkOrderHistory(workOrder, "Work note", noteText);
  }
  if (photo) {
    workOrder.photos = Array.isArray(workOrder.photos) ? workOrder.photos : [];
    workOrder.photos.push({
      ...photo,
      addedAt: new Date().toISOString(),
      addedBy: getCurrentUserLabel()
    });
    addWorkOrderHistory(workOrder, "Photo added", photo.name || "Photo attached to ticket");
  }
  workOrder.updatedAt = new Date().toISOString();
  addActivity("Ticket note added", `${formatIssueNumber(workOrder)} - ${workOrder.title || "Open ticket"}`);
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
  const photo = await readServiceRequestPhoto(form.querySelector("input[name='photo']")?.files?.[0]);
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
  renderPmCalendar();
  renderBackupStatus();
  renderSyncHealth();
  renderQrSettings();
  renderAssetTableControls();
  renderAssetTable();
  renderWorkOrders();
  renderServiceRequests();
  syncWorkDrawerBackdrop();
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
  els.emptyState.innerHTML = "";
  els.emptyState.classList.toggle("hidden", true);
  els.assetPanel.classList.toggle("hidden", !asset);
  positionAssetPanelNearSelection(asset);
  renderPanelToggles();
  renderRole();

  if (!asset) return;

  const customer = getCustomer(asset.customerId);
  const locationRecord = getLocation(asset.locationId);
  const template = getTemplate(asset.templateId);
  const due = getDueInfo(asset);
  els.selectedLocation.textContent = `${customer?.name || "Unknown customer"} | ${locationRecord?.name || "Unknown location"}`;
  els.selectedName.textContent = asset.name;
  els.selectedMeta.textContent = `Equipment ID ${getAssetEquipmentId(asset)} | Every ${asset.frequencyDays} days`;
  els.selectedBadges.innerHTML = renderAssetBadges(asset, due);
  els.selectedAssetThumb.innerHTML = renderAssetThumbnail(asset);
  els.selectedTemplate.textContent = template?.name || "Template missing";
  els.selectedQr.innerHTML = `<img alt="QR code for ${escapeHtml(asset.name)}" src="${qrUrl(getAssetUrl(asset.id))}">`;
  els.nextPm.textContent = formatDate(due.nextDate);
  els.nextPmInput.value = asset.nextPmDate || toDateInputValue(due.nextDate);
  els.clearNextPmBtn.disabled = !asset.nextPmDate || !canManageWorkOrders();
  els.pmStatus.textContent = due.label;
  els.pmStatus.className = due.className;
  els.assetPhotoPanel.innerHTML = renderAssetPhoto(asset);
  els.assetManualPanel.innerHTML = renderAssetManual(asset);
  els.assetDetailsGrid.innerHTML = renderAssetDetails(asset);
  renderElectricalPanelSchedule(asset);
  if (els.deleteSelectedAssetBtn) {
    els.deleteSelectedAssetBtn.classList.toggle("hidden", !canDeleteEquipment());
    els.deleteSelectedAssetBtn.disabled = !canDeleteEquipment();
  }
  renderAssetInfoForm(asset);
  renderChecklist(template, asset);
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
  if (els.assetRegisterDrawer.classList.contains("sidebar-controlled-panel")) {
    els.assetRegisterDrawer.classList.add("hidden");
  }
  delete els.assetRegisterDrawer.dataset.openedByMetric;
  setSidebarTargetButtonState("assetRegisterDrawer", false);
}

function openAssetRegisterDrawer(openedByMetric = "") {
  if (!els.assetRegisterDrawer) return;
  if (openedByMetric) els.assetRegisterDrawer.dataset.openedByMetric = openedByMetric;
  els.assetRegisterDrawer.classList.remove("hidden");
  els.assetRegisterDrawer.open = true;
  setSidebarTargetButtonState("assetRegisterDrawer", true);
}

function toggleAssetRegisterDrawer() {
  if (!els.assetRegisterDrawer) return;
  const isOpen = els.assetRegisterDrawer.open && !els.assetRegisterDrawer.classList.contains("hidden");
  if (isOpen) closeAssetRegisterDrawer();
  else openAssetRegisterDrawer();
}

function togglePanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const wasCollapsed = panel.classList.contains("is-collapsed");
  const willCollapse = !wasCollapsed;
  panel.classList.toggle("is-collapsed");
  if (panel.classList.contains("sidebar-controlled-panel")) {
    panel.classList.toggle("hidden", willCollapse);
    setSidebarTargetButtonState(panelId, !willCollapse);
  }
  if (panelId === "assetPanel" && wasCollapsed) closeSelectedAssetDrawers();
  renderPanelToggles();
  syncCalendarFocusState();
}

function openPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const wasCollapsed = panel.classList.contains("is-collapsed");
  panel.classList.remove("hidden");
  panel.classList.remove("is-collapsed");
  if (panel.classList.contains("sidebar-controlled-panel")) setSidebarTargetButtonState(panelId, true);
  if (panelId === "assetPanel" && wasCollapsed) closeSelectedAssetDrawers();
  renderPanelToggles();
  syncCalendarFocusState();
}

function setSidebarTargetButtonState(targetId, isOpen) {
  document.querySelectorAll("[data-open-target]").forEach((button) => {
    if (button.dataset.openTarget !== targetId) return;
    button.classList.toggle("is-active", isOpen);
    button.setAttribute("aria-expanded", String(isOpen));
    const hint = button.querySelector(".sidebar-nav-hint");
    if (hint) hint.textContent = isOpen ? "Close" : "Open";
  });
}

function closeSidebarTarget(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;
  if (targetId === "assetRegisterDrawer" && els.assetPanel?.classList.contains("floating-asset-panel")) {
    els.assetPanel.classList.add("hidden");
    els.assetPanel.classList.remove("floating-asset-panel", "is-collapsed");
    els.assetPanel.style.top = "";
  }
  if (target.tagName === "DETAILS") {
    target.open = false;
    if (target.classList.contains("sidebar-controlled-panel")) target.classList.add("hidden");
  }
  if (target.classList.contains("collapsible-panel")) {
    target.classList.add("is-collapsed");
    target.classList.add("hidden");
    renderPanelToggles();
  }
  setSidebarTargetButtonState(targetId, false);
  syncCalendarFocusState();
}

function openSidebarTarget(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;

  const isOpen = target.tagName === "DETAILS"
    ? target.open && !target.classList.contains("hidden")
    : target.classList.contains("collapsible-panel")
      && !target.classList.contains("hidden")
      && !target.classList.contains("is-collapsed");

  if (isOpen) {
    closeSidebarTarget(targetId);
    return;
  }

  closeOtherSidebarTargets(targetId);

  if (target.tagName === "DETAILS") {
    target.classList.remove("hidden");
    target.open = true;
  }
  if (target.classList.contains("collapsible-panel")) {
    target.classList.remove("hidden");
    openPanel(targetId);
  }
  setSidebarTargetButtonState(targetId, true);
  syncCalendarFocusState();
}

function closeAllSidebarTargets() {
  document.querySelectorAll("[data-open-target]").forEach((button) => {
    closeSidebarTarget(button.dataset.openTarget);
  });
}

function closeOtherSidebarTargets(activeTargetId) {
  document.querySelectorAll("[data-open-target]").forEach((button) => {
    if (button.dataset.openTarget !== activeTargetId) {
      closeSidebarTarget(button.dataset.openTarget);
    }
  });
}

function syncCalendarFocusState() {
  const calendarOpen = Boolean(
    document.getElementById("pmCalendarPanel") &&
    !document.getElementById("pmCalendarPanel").classList.contains("hidden") &&
    !document.getElementById("pmCalendarPanel").classList.contains("is-collapsed")
  );
  els.appShell?.classList.toggle("calendar-focus", calendarOpen);
}

function openMobileTab(targetId) {
  if (targetId === "dashboardPanel") {
    closeAllSidebarTargets();
    closeSidebarTarget("adminToolsDrawer");
    document.getElementById("dashboardPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileTabState(targetId);
    return;
  }

  if (targetId !== "adminToolsDrawer") closeSidebarTarget("adminToolsDrawer");
  const target = document.getElementById(targetId);
  const isOpen = target?.tagName === "DETAILS"
    ? target.open && !target.classList.contains("hidden")
    : target?.classList.contains("collapsible-panel")
      && !target.classList.contains("hidden")
      && !target.classList.contains("is-collapsed");
  if (!isOpen) openSidebarTarget(targetId);
  document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  setMobileTabState(targetId);
}

function setMobileTabState(targetId) {
  document.querySelectorAll("[data-mobile-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mobileTab === targetId);
  });
}

function closeSelectedAssetDrawers() {
  document.querySelectorAll("#assetPanel .asset-sub-drawer").forEach((drawer) => {
    drawer.open = false;
  });
}

function syncWorkDrawerBackdrop() {
  const hasOpenWorkDrawer = Boolean(
    focusedWorkOrderId ||
    focusedServiceRequestId ||
    document.querySelector(".work-order-drawer[open]:not(.completed-pm-item)")
  );
  els.workDrawerBackdrop?.classList.toggle("hidden", !hasOpenWorkDrawer);
}

function closeFocusedWorkDrawer(drawer = null) {
  if (drawer) drawer.open = false;
  focusedWorkOrderId = "";
  focusedServiceRequestId = "";
  focusedCompletedRecordId = "";
  serviceRequestDrawerTab = "notes";
  els.workDrawerBackdrop?.classList.add("hidden");
  closePhotoSideBay();
  render();
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
  const hasReportContext = hasScannedReportContext();
  if (isReport || !loginIsVisible || !hasReportContext) {
    els.loginQrReportPrompt.classList.add("hidden");
    return;
  }
  const asset = getScannedReportAsset();
  setLoginQrReportStatus(isScannedReportLinkReady(asset));
  els.loginQrReportPrompt.classList.remove("hidden");
}

function hasScannedReportContext() {
  const params = new URLSearchParams(location.search);
  return Boolean(
    getAssetIdFromUrl() ||
    params.get("lid") ||
    (params.get("c") && params.get("l"))
  );
}

function isScannedReportLinkReady(asset = getScannedReportAsset()) {
  if (asset) return true;
  if (getAssetIdFromUrl()) return true;
  const params = new URLSearchParams(location.search);
  return Boolean(
    (params.get("a") && params.get("n") && params.get("c") && params.get("l")) ||
    params.get("lid") ||
    (params.get("c") && params.get("l"))
  );
}

function getScannedIssueReportUrl() {
  const asset = getScannedReportAsset();
  if (asset) return getReportAssetUrl(asset.id);

  const params = new URLSearchParams(location.search);
  if (params.get("a") || (params.get("n") && params.get("c") && params.get("l"))) {
    return getScannedEquipmentReportUrl();
  }
  return getScannedAreaReportUrl();
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
  const hasAssetId = Boolean(getAssetIdFromUrl());
  const canReport = isReady || hasAssetId;
  els.loginQrReportMessage.textContent = isReady
    ? "Send a photo and quick note without logging in."
    : "This scanned link is missing report details. Please scan a printed SiteWorks QR label.";
  if (els.loginQrReportBtn) {
    els.loginQrReportBtn.textContent = "Report Issue";
    els.loginQrReportBtn.classList.toggle("disabled-link", !canReport);
    els.loginQrReportBtn.setAttribute("aria-disabled", String(!canReport));
    els.loginQrReportBtn.setAttribute("href", canReport ? getScannedIssueReportUrl() : "#");
  }
  if (els.loginQrAreaReportBtn) {
    els.loginQrAreaReportBtn.classList.add("hidden");
    els.loginQrAreaReportBtn.setAttribute("aria-disabled", "true");
    els.loginQrAreaReportBtn.setAttribute("href", "#");
  }
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

function createLocalUser(username, password, name, role, customerId, locationId = "") {
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
    locationId: role === "Admin" ? "" : locationId || "",
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

function isManagerRole(role = currentRole) {
  return MANAGER_ROLES.includes(role);
}

function renderRole() {
  const setupDisabled = !canManageSetup();
  const userManagementAllowed = canManageUsers();
  const contractorManagementAllowed = canManageContractors();
  const isAdmin = currentRole === "Admin";
  const canCreateCustomerRecords = canCreateCustomers();
  const canManageTemplates = canManageTemplateSetup();
  const canAddAssets = canAddEquipment();
  const canCreateTickets = canCreateWorkOrders();
  const canUseNewActions = canAddAssets || canCreateTickets || canCreateServiceRequests();
  const isCustomer = currentRole === "Customer";
  const hasAdminToolsAccess = isAdmin || setupDisabled === false || userManagementAllowed || contractorManagementAllowed;
  const canUseWorkNav = !isCustomer;
  const hasSidebarAccess = canUseWorkNav || hasAdminToolsAccess;
  els.appShell?.classList.toggle("no-sidebar", !hasSidebarAccess);
  els.appSidebar?.classList.toggle("hidden", !hasSidebarAccess);
  els.workNav?.classList.toggle("hidden", !canUseWorkNav);
  if (!canUseWorkNav) closeAllSidebarTargets();
  els.dashboardPanel.classList.toggle("hidden", isCustomer);
  els.customerFilterField?.classList.toggle("hidden", !isAdmin);
  els.workHeader?.classList.toggle("hidden", !currentUser || isCustomer);
  els.newActionBar?.classList.toggle("hidden", !canUseNewActions);
  els.createNewBtn?.classList.toggle("hidden", !canUseNewActions);
  if (!canUseNewActions) closeCreateNewMenu();
  els.newEquipmentBtn?.classList.toggle("hidden", !canAddAssets);
  els.newIssueBtn?.classList.toggle("hidden", !canCreateTickets);
  els.newServiceRequestBtn?.classList.toggle("hidden", !canCreateServiceRequests());
  if (els.createNewBtn) els.createNewBtn.disabled = !canUseNewActions;
  if (els.newEquipmentBtn) els.newEquipmentBtn.disabled = !canAddAssets;
  if (els.newIssueBtn) els.newIssueBtn.disabled = !canCreateTickets;
  if (els.newServiceRequestBtn) els.newServiceRequestBtn.disabled = !canCreateServiceRequests();
  renderMobileCreateActions();
  els.adminToolsDrawer.classList.toggle("hidden", !hasAdminToolsAccess);
  if (!hasAdminToolsAccess) els.adminToolsDrawer.open = false;
  els.quickAddDrawer.classList.toggle("hidden", !canAddAssets);
  if (!canAddAssets) els.quickAddDrawer.open = false;
  els.newIssueDrawer?.classList.toggle("hidden", !canCreateTickets);
  if (!canCreateTickets && els.newIssueDrawer) els.newIssueDrawer.open = false;
  els.serviceRequestCreateDrawer?.classList.toggle("hidden", !canCreateServiceRequests());
  if (!canCreateServiceRequests() && els.serviceRequestCreateDrawer) els.serviceRequestCreateDrawer.open = false;
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
    control.disabled = !canCreateLocations();
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
  if (els.assetImportCreateLocations) els.assetImportCreateLocations.disabled = !canAddAssets || !canCreateLocations();
  if (els.issueImportCreateLocations) els.issueImportCreateLocations.disabled = !canManageWorkOrders() || !canCreateLocations();
  els.pmForm.querySelectorAll("input, select, textarea, button").forEach((control) => {
    control.disabled = !canCompletePm();
  });
  els.assetInfoForm.querySelectorAll("input, select, textarea, button").forEach((control) => {
    control.disabled = !canEditEquipment();
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
    : `<p class="muted">No preferred contacts added yet.</p>`;
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
  els.contractorCustomerHint.textContent = `These contacts are for ${contractorCustomer}, not ${activeCustomer}.`;
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
    alert("Managers can only delete contacts for their assigned customer.");
    return;
  }
  if (!confirm(`Delete ${contractor.name} from preferred contacts?`)) return;
  state.preferredContractors = state.preferredContractors.filter((item) => item.id !== contractorId);
  addActivity("Preferred contact deleted", contractor.name);
  saveState();
  render();
}

async function deleteWorkOrder(workOrderId) {
  const workOrder = getWorkOrder(workOrderId);
  if (!workOrder || !canDeleteWorkOrders()) return;
  const ticketLabel = `${formatIssueNumber(workOrder)} - ${workOrder.title || "Ticket"}`;
  if (!confirm(`Delete ${ticketLabel}? This cannot be undone.`)) return;
  state.workOrders = state.workOrders.filter((item) => item.id !== workOrder.id);
  if (focusedWorkOrderId === workOrder.id) focusedWorkOrderId = "";
  if (focusedCompletedRecordId === workOrder.id) focusedCompletedRecordId = "";
  addActivity("Ticket deleted", ticketLabel);
  saveState();
  await deleteStructuredRows("work_orders", "id", [workOrder.id]);
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
  const locationOptions = userLocationOptions(user.customerId, user.locationId);
  const location = getLocation(user.locationId);
  const customerAssignment = user.role !== "Admin"
    ? ` | ${escapeHtml(customer?.name || "No customer assigned")}`
    : "";
  const locationAssignment = user.role !== "Admin" && user.locationId
    ? ` | ${escapeHtml(location?.name || "Unknown location")}`
    : user.role !== "Admin"
      ? " | All locations"
      : "";
  const cloudLabel = isEmailAddress(user.username) && !user.localOnly
    ? `<span class="user-cloud-label">Cloud login</span>`
    : `<span class="user-local-label">Local only</span>`;
  return `
    <details class="user-list-item user-editor">
      <summary>
        <span>
          <strong>${escapeHtml(user.name || user.username)}</strong>
          <small>${escapeHtml(user.username)} | ${escapeHtml(user.role)}${customerAssignment}${locationAssignment}</small>
        </span>
        <span class="user-summary-badges">${cloudLabel}${currentLabel}</span>
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
        <label>
          Assigned location
          <select name="locationId" ${disabled}>
            ${locationOptions}
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
    setupCustomerIds.has(locationRecord.customerId) && canManageLocationSetup(locationRecord.id, locationRecord.customerId)
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
  const disabled = canManageLocationSetup(locationRecord.id, locationRecord.customerId) ? "" : "disabled";
  const customerOptions = manageableSetupCustomers().map((customer) =>
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
    selectedContractorCustomerId = isManagerRole() && currentUser?.customerId
      ? currentUser.customerId
      : selectedCustomerId;
  }
  els.contractorCustomer.value = isManagerRole() && currentUser?.customerId
    ? currentUser.customerId
    : selectedContractorCustomerId;
  updateContractorCustomerHint();
  if (isManagerRole() && currentUser?.customerId) {
    els.newUserCustomer.value = currentUser.customerId;
  }
  if (!els.newUserCustomer.value && manageableUserCustomers()[0]) {
    els.newUserCustomer.value = manageableUserCustomers()[0].id;
  }
  renderNewUserLocationOptions();
  els.customerFilter.disabled = !canSeeAllCustomers();

  const setupAllowed = canManageSetup();
  const addEquipmentAllowed = canAddEquipment();
  els.locationForm.querySelector("button").disabled = !canCreateLocations() || !state.customers.length;
  els.assetForm.querySelector("button").disabled = !addEquipmentAllowed || !customers.length || !state.locations.length || !state.templates.length;
  if (els.assetImportBtn) els.assetImportBtn.disabled = !addEquipmentAllowed || !customers.length || !state.templates.length;
  if (els.issueImportBtn) els.issueImportBtn.disabled = !canManageWorkOrders() || !customers.length;
}

function renderNewUserLocationOptions() {
  if (!els.newUserLocation) return;
  const role = els.newUserRole?.value || "Customer";
  const customerId = role === "Admin" ? "" : els.newUserCustomer?.value || "";
  els.newUserLocation.innerHTML = userLocationOptions(customerId, "");
  els.newUserLocation.disabled = role === "Admin" || !customerId;
}

function userLocationOptions(customerId, selectedLocationId = "") {
  const locations = manageableUserLocations(customerId);
  const canAssignAllLocations = currentRole === "Admin" || !currentUser?.locationId;
  const allOption = canAssignAllLocations
    ? `<option value="" ${!selectedLocationId ? "selected" : ""}>All locations</option>`
    : "";
  const locationOptions = locations.map((locationRecord) =>
    `<option value="${escapeAttribute(locationRecord.id)}" ${selectedLocationId === locationRecord.id ? "selected" : ""}>${escapeHtml(locationRecord.name)}</option>`
  ).join("");
  return `${allOption}${locationOptions}`;
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
  const canUseAllLocations = !isLocationScopedUser();
  els.locationFilter.innerHTML = [
    ...(canUseAllLocations ? [`<option value="all">All locations</option>`] : []),
    ...locations.map((locationRecord) => `<option value="${locationRecord.id}">${escapeHtml(locationRecord.name)}</option>`)
  ].join("");
  els.locationFilter.value = locations.some((locationRecord) => locationRecord.id === selectedLocationId)
    ? selectedLocationId
    : canUseAllLocations
      ? "all"
      : locations[0]?.id || "";
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
    alert("Choose a CSV file first.");
    return;
  }

  const importButton = els.assetImportBtn;
  if (importButton) {
    importButton.disabled = true;
    importButton.textContent = "Importing...";
  }

  try {
    setAssetImportStatus("Reading CSV...");
    const text = await file.text();
    const rows = parseCsvRows(text);
    if (!rows.length) {
      setAssetImportStatus("No equipment rows were found in that CSV.");
      alert("No equipment rows were found in that CSV.");
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

      const equipmentId = findCsvValue(row, ["equipment id", "equipment #", "equipment number"]);
      const serial = findCsvValue(row, ["serial", "serial number", "serial no", "serial #"]);
      if (isDuplicateImportAsset(customer.id, locationRecord.id, equipmentName, equipmentId || serial)) {
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
        equipmentId,
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
      const message = `No equipment imported. ${stats.skipped} row(s) skipped.`;
      setAssetImportStatus(message);
      renderAssetImportPreview(stats);
      alert(message);
      return;
    }

    const firstAsset = importedAssets[0];
    selectedId = firstAsset.id;
    selectedCustomerId = firstAsset.customerId;
    selectedLocationId = defaultLocationSelection();
    addActivity(
      "Equipment imported",
      `${stats.imported} equipment record(s) from ${file.name}`
    );
    saveState();
    if (els.assetImportFile) els.assetImportFile.value = "";
    const message = `Imported ${stats.imported} equipment record(s). ${stats.skipped} skipped. ${stats.locationsCreated} location(s) created.`;
    setAssetImportStatus(message);
    renderAssetImportPreview(stats);
    alert(message);
    location.hash = `asset/${firstAsset.id}`;
    render();
  } catch (error) {
    console.warn("Equipment import failed.", error);
    setAssetImportStatus("Import failed. Check that this is a valid CSV file.");
    alert("Import failed. Check that this is a valid CSV file.");
  } finally {
    if (importButton) {
      importButton.disabled = !canAddEquipment();
      importButton.textContent = "Import Equipment";
    }
  }
}

async function importTicketsCsv() {
  if (!canManageWorkOrders()) return;
  const file = els.issueImportFile?.files?.[0];
  if (!file) {
    setIssueImportStatus("Choose a CSV file first.");
    alert("Choose a CSV file first.");
    return;
  }

  const importButton = els.issueImportBtn;
  if (importButton) {
    importButton.disabled = true;
    importButton.textContent = "Importing...";
  }

  try {
    setIssueImportStatus("Reading CSV...");
    const text = await file.text();
    const rows = parseCsvRows(text);
    if (!rows.length) {
      setIssueImportStatus("No ticket rows were found in that CSV.");
      alert("No ticket rows were found in that CSV.");
      return;
    }

    const stats = {
      imported: 0,
      skipped: 0,
      locationsCreated: 0,
      areaTickets: 0,
      equipmentTickets: 0,
      closed: 0,
      errors: []
    };
    const importedTickets = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const customerName = findCsvValue(row, ["customer", "customer name", "client", "company", "account"]);
      const locationName = findCsvValue(row, ["location", "location name", "site", "building", "facility"]);
      const equipmentName = findCsvValue(row, ["equipment name", "asset name", "equipment", "asset"]);
      const areaName = findCsvValue(row, ["area", "area name", "room", "zone"]);
      const appliesTo = findCsvValue(row, ["applies to", "type", "ticket applies to"]);
      const title = findCsvValue(row, ["ticket title", "title", "problem", "summary", "request"]);

      if (!title) {
        skipImportRow(stats, rowNumber, "missing ticket title");
        return;
      }

      const customer = findOrCreateImportCustomer(customerName, stats);
      if (!customer) {
        skipImportRow(stats, rowNumber, "customer is missing or not assigned to this user");
        return;
      }

      const locationRecord = findOrCreateIssueImportLocation(locationName, customer.id, stats);
      if (!locationRecord) {
        skipImportRow(stats, rowNumber, "location is missing");
        return;
      }

      const isAreaTicket = sameText(appliesTo, "area") || (!equipmentName && Boolean(areaName));
      const asset = isAreaTicket ? null : findImportAsset(customer.id, locationRecord.id, equipmentName);
      if (!isAreaTicket && !asset) {
        skipImportRow(stats, rowNumber, "equipment was not found");
        return;
      }

      const status = normalizeIssueStatus(findCsvValue(row, ["status", "ticket status", "state"]));
      const assignedUser = findImportUser(findCsvValue(row, ["assigned to", "assignee", "technician", "manager"]), customer.id);
      const createdAt = new Date().toISOString();
      const resolvedAt = status === "Closed" ? createdAt : "";
      const ticket = {
        id: crypto.randomUUID(),
        issueNumber: nextImportedIssueNumber(findCsvValue(row, ["sw number", "ticket number", "ticket number", "work order number"])),
        assetId: asset?.id || "",
        customerId: customer.id,
        locationId: locationRecord.id,
        areaName: isAreaTicket ? (areaName || locationRecord.name) : "",
        source: isAreaTicket ? "Imported area ticket" : "Imported ticket",
        title: title.trim(),
        priority: normalizePriority(findCsvValue(row, ["priority", "criticality", "risk"])),
        status,
        assignedUserId: assignedUser?.id || "",
        assignedUserName: assignedUser?.name || findCsvValue(row, ["assigned to", "assignee", "technician", "manager"]),
        dueAt: normalizeImportedTicketDueDate(findCsvValue(row, ["due date", "due", "required by", "target date"]), status),
        notes: findCsvValue(row, ["notes", "description", "comments", "details"]) || "Imported from ticket CSV.",
        photo: null,
        history: [],
        createdAt,
        updatedAt: createdAt,
        resolvedAt
      };

      addWorkOrderHistory(ticket, "Imported", `${formatIssueNumber(ticket)} - ${ticket.title}`);
      state.workOrders.unshift(ticket);
      importedTickets.push(ticket);
      stats.imported += 1;
      if (isAreaTicket) stats.areaTickets += 1;
      else stats.equipmentTickets += 1;
      if (status === "Closed") stats.closed += 1;
    });

    if (!stats.imported) {
      const message = `No tickets imported. ${stats.skipped} row(s) skipped.`;
      setIssueImportStatus(message);
      renderIssueImportPreview(stats);
      alert(message);
      return;
    }

    const firstTicket = importedTickets[0];
    selectedCustomerId = firstTicket.customerId;
    selectedLocationId = defaultLocationSelection();
    selectedId = firstTicket.assetId || selectedId;
    workOrderViewFilter = "active";
    addActivity("Tickets imported", `${stats.imported} ticket record(s) from ${file.name}`);
    saveState();
    if (els.issueImportFile) els.issueImportFile.value = "";
    const message = `Imported ${stats.imported} ticket record(s). ${stats.skipped} skipped. ${stats.equipmentTickets} equipment ticket(s), ${stats.areaTickets} area ticket(s), ${stats.closed} closed.`;
    setIssueImportStatus(message);
    renderIssueImportPreview(stats);
    alert(message);
    openPanel("workOrdersPanel");
    render();
  } catch (error) {
    console.warn("Ticket import failed.", error);
    setIssueImportStatus("Import failed. Check that this is a valid CSV file.");
    alert("Import failed. Check that this is a valid CSV file.");
  } finally {
    if (importButton) {
      importButton.disabled = !canManageWorkOrders();
      importButton.textContent = "Import Tickets";
    }
  }
}

function setAssetImportStatus(message) {
  if (els.assetImportStatus) els.assetImportStatus.textContent = message;
}

function setIssueImportStatus(message) {
  if (els.issueImportStatus) els.issueImportStatus.textContent = message;
}

function renderAssetImportPreview(stats) {
  if (!els.assetImportPreview) return;
  const messages = stats.errors.slice(0, 8);
  els.assetImportPreview.innerHTML = messages.length
    ? messages.map((message) => `<div>${escapeHtml(message)}</div>`).join("")
    : "";
}

function renderIssueImportPreview(stats) {
  if (!els.issueImportPreview) return;
  const messages = stats.errors.slice(0, 8);
  els.issueImportPreview.innerHTML = messages.length
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
  if (existing) return canSeeLocation(existing.id, existing.customerId) ? existing : null;
  if (!els.assetImportCreateLocations?.checked || !canCreateLocations()) return null;

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

function findOrCreateIssueImportLocation(name, customerId, stats) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return null;
  const existing = state.locations.find((locationRecord) =>
    locationRecord.customerId === customerId && sameText(locationRecord.name, cleanName)
  );
  if (existing) return canSeeLocation(existing.id, existing.customerId) ? existing : null;
  if (!els.issueImportCreateLocations?.checked || !canCreateLocations()) return null;

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

function findImportAsset(customerId, locationId, equipmentName) {
  const cleanName = String(equipmentName || "").trim();
  if (!cleanName) return null;
  return state.assets.find((asset) =>
    asset.customerId === customerId &&
    asset.locationId === locationId &&
    canSeeAsset(asset) &&
    sameText(asset.name, cleanName)
  ) || state.assets.find((asset) =>
    asset.customerId === customerId &&
    canSeeAsset(asset) &&
    sameText(asset.name, cleanName)
  ) || null;
}

function findImportUser(name, customerId) {
  const cleanName = String(name || "").trim();
  if (!cleanName || sameText(cleanName, "unassigned")) return null;
  return state.users.find((user) =>
    canViewUserRecord(user) &&
    (sameText(user.name, cleanName) || sameText(user.username, cleanName))
  ) || state.users.find((user) =>
    canViewUserRecord(user) &&
    user.customerId === customerId &&
    cleanName.toLowerCase().includes(String(user.name || "").toLowerCase())
  ) || null;
}

function normalizeIssueStatus(value) {
  const clean = String(value || "").trim().toLowerCase();
  if (["closed", "complete", "completed", "done"].includes(clean)) return "Closed";
  if (["resolved"].includes(clean)) return "Resolved";
  if (["in progress", "started", "working"].includes(clean)) return "In progress";
  if (["waiting parts", "waiting for parts", "parts waiting", "awaiting parts"].includes(clean)) return "Waiting parts";
  return "Open";
}

function normalizeImportedTicketDueDate(value, status = "Open") {
  const cleanDate = normalizeCsvDate(value);
  if (cleanDate) return parseLocalDate(cleanDate).toISOString();
  return addDays(new Date(), status === "Waiting parts" ? 14 : 7).toISOString();
}

function nextImportedIssueNumber(value) {
  const numeric = Number(String(value || "").replace(/\D/g, ""));
  if (Number.isFinite(numeric) && numeric > 0 && !state.workOrders.some((item) => Number(item.issueNumber) === numeric)) {
    return numeric;
  }
  return nextIssueNumber();
}

function isDuplicateImportAsset(customerId, locationId, name, equipmentId) {
  return state.assets.some((asset) => {
    const sameCustomerLocation = asset.customerId === customerId && asset.locationId === locationId;
    const sameEquipmentId = equipmentId && sameText(getAssetEquipmentId(asset), equipmentId);
    return sameCustomerLocation && (sameText(asset.name, name) || sameEquipmentId);
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
  els.editAssetLocation.disabled = locations.length === 0 || !canEditEquipment();
}

function renderDashboard() {
  const assets = dashboardAssets();
  const dueInfos = assets.map((asset) => ({
    ...getDueInfo(asset),
    asset
  }));
  const activeIssues = filteredWorkOrders().filter((item) => item.status !== "Closed");
  const activeServiceRequests = filteredServiceRequests().filter((item) => item.status !== "Completed" && item.status !== "Declined");
  const completedIssues = completedTicketRecords();
  const currentCustomer = getCustomer(selectedCustomerId);
  const currentLocation = selectedLocationId === "all" ? null : getLocation(selectedLocationId);
  if (els.currentViewLabel) {
    els.currentViewLabel.textContent = `${currentCustomer?.name || "No customer selected"} | ${currentLocation?.name || "All locations"}`;
  }
  els.dueToday.textContent = dueInfos.filter((item) => item.daysUntil <= 0).length;
  els.overdue.textContent = dueInfos.filter((item) => item.daysUntil < 0).length;
  if (els.completed) els.completed.textContent = completedIssues.length;
  els.openWorkOrders.textContent = activeIssues.length;
  if (els.serviceRequestsMetric) els.serviceRequestsMetric.textContent = activeServiceRequests.length;
  els.highPriorityIssues.textContent = activeIssues.filter((item) => item.priority === "High").length;
  els.waitingPartsIssues.textContent = activeIssues.filter((item) => item.status === "Waiting parts").length;
  if (els.assignedToMeIssues) els.assignedToMeIssues.textContent = activeIssues.filter((item) => item.assignedUserId === currentUser?.id).length;
  if (els.reportedIssues) els.reportedIssues.textContent = activeIssues.filter((item) => item.source === "Public QR report").length;
  if (els.failedPmIssues) els.failedPmIssues.textContent = activeIssues.filter(isFailedPmIssue).length;
  if (els.activeLocations) els.activeLocations.textContent = activeAssetLocationCountForCurrentCustomer();
  if (els.globalSearch) els.globalSearch.value = globalQuery;
  renderDashboardMenus({ assets, dueInfos, activeIssues, activeServiceRequests, completedIssues });
  renderGlobalSearchResults();
}

function renderPmCalendar() {
  if (!els.pmCalendarList) return;
  const windowInfo = pmCalendarWindow();
  const records = pmCalendarRecords(windowInfo);
  if (els.pmCalendarRange) els.pmCalendarRange.value = pmCalendarRange;
  if (els.pmCalendarDate) els.pmCalendarDate.value = pmCalendarDate;
  if (els.pmCalendarCount) els.pmCalendarCount.textContent = records.length;
  const currentCustomer = getCustomer(selectedCustomerId);
  const currentLocation = selectedLocationId === "all" ? null : getLocation(selectedLocationId);
  const viewLabel = `${currentCustomer?.name || "No customer selected"} | ${currentLocation?.name || "All locations"}`;
  if (els.pmCalendarSummary) {
    els.pmCalendarSummary.innerHTML = `
      <strong>${escapeHtml(windowInfo.label)}</strong>
      <span>${escapeHtml(viewLabel)}</span>
      <span>${records.length} upcoming PM${records.length === 1 ? "" : "s"}</span>
    `;
  }
  if (!records.length) {
    if (pmCalendarRange === "month") {
      els.pmCalendarList.innerHTML = `
        ${renderPmCalendarMonthGrid(records, windowInfo)}
        <p class="muted">No PMs are scheduled in this forward month for the current view.</p>
      `;
      return;
    }
    els.pmCalendarList.innerHTML = `<p class="muted">No PMs are scheduled in this ${escapeHtml(pmCalendarRange)} for the current view.</p>`;
    return;
  }
  const schedule = pmCalendarRange === "month"
    ? renderPmCalendarMonthGrid(records, windowInfo)
    : renderPmCalendarGroups(records);
  els.pmCalendarList.innerHTML = `${schedule}${renderPmCalendarKeyEquipment(records)}`;
}

function pmCalendarWindow() {
  const baseDate = parseLocalDate(pmCalendarDate) || today;
  let start;
  let end;
  let label;

  if (pmCalendarRange === "week") {
    start = startOfWeek(baseDate);
    end = addDays(start, 6);
    label = `Week of ${formatDate(start)}`;
  } else if (pmCalendarRange === "year") {
    start = new Date(baseDate.getFullYear(), 0, 1);
    end = new Date(baseDate.getFullYear(), 11, 31);
    label = `${baseDate.getFullYear()} PM schedule`;
  } else {
    start = baseDate;
    end = addDays(start, 30);
    label = `${formatDate(start)} - ${formatDate(end)} PM schedule`;
  }

  return { start: startOfDay(start), end: startOfDay(end), label };
}

function startOfWeek(date) {
  const value = startOfDay(date);
  const mondayOffset = (value.getDay() + 6) % 7;
  return addDays(value, -mondayOffset);
}

function pmCalendarRecords(windowInfo = pmCalendarWindow()) {
  return filteredAssets()
    .map((asset) => {
      const due = getDueInfo(asset);
      return {
        asset,
        due,
        dueDate: startOfDay(due.nextDate),
        customer: getCustomer(asset.customerId),
        location: getLocation(asset.locationId),
        template: getTemplate(asset.templateId)
      };
    })
    .filter((record) => record.dueDate >= windowInfo.start && record.dueDate <= windowInfo.end)
    .sort((a, b) => a.dueDate - b.dueDate || a.asset.name.localeCompare(b.asset.name));
}

function renderPmCalendarGroups(records) {
  const groups = groupPmCalendarRecords(records);

  return [...groups.entries()].map(([dateKey, items]) => {
    const date = parseLocalDate(dateKey);
    return `
      <article class="pm-calendar-day">
        <div class="pm-calendar-day-heading">
          <h3>${escapeHtml(formatDate(date))}</h3>
          <span>${items.length} PM${items.length === 1 ? "" : "s"}</span>
        </div>
        <div class="pm-calendar-items">
          ${items.map(renderPmCalendarItem).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function groupPmCalendarRecords(records) {
  return records.reduce((map, record) => {
    const key = toDateInputValue(record.dueDate);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(record);
    return map;
  }, new Map());
}

function renderPmCalendarMonthGrid(records, windowInfo) {
  const groups = groupPmCalendarRecords(records);
  const gridStart = addDays(windowInfo.start, -windowInfo.start.getDay());
  const gridEnd = addDays(windowInfo.end, 6 - windowInfo.end.getDay());
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const cells = [];

  for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) {
    const cellDate = startOfDay(day);
    const key = toDateInputValue(cellDate);
    const items = groups.get(key) || [];
    const outsideClass = cellDate >= windowInfo.start && cellDate <= windowInfo.end ? "" : " is-outside";
    const todayClass = key === toDateInputValue(today) ? " is-today" : "";
    cells.push(`
      <div class="pm-calendar-cell${outsideClass}${todayClass}">
        <div class="pm-calendar-cell-date">${cellDate.getDate()}</div>
        <div class="pm-calendar-cell-items">
          ${items.slice(0, 4).map(renderPmCalendarTask).join("")}
          ${items.length > 4 ? `<span class="pm-calendar-more">+${items.length - 4} more</span>` : ""}
        </div>
      </div>
    `);
  }

  return `
    <section class="pm-calendar-month-wrap">
      <div class="pm-calendar-month-grid-wrap">
        <div class="pm-calendar-month-grid">
          ${weekdays.map((day) => `<div class="pm-calendar-weekday">${day}</div>`).join("")}
          ${cells.join("")}
        </div>
      </div>
    </section>
  `;
}

function renderPmCalendarTask(record) {
  const tone = pmCalendarTone(record);
  return `
    <button type="button" class="pm-calendar-task pm-calendar-task-${tone}" data-pm-calendar-asset="${escapeAttribute(record.asset.id)}">
      ${escapeHtml(record.asset.name || record.template?.name || "PM")}
    </button>
  `;
}

function pmCalendarTone(record) {
  const text = `${record.asset.name || ""} ${record.asset.type || ""} ${record.template?.name || ""}`.toLowerCase();
  const criticality = String(record.asset.criticality || "").toLowerCase();
  if (record.due.daysUntil < 0 || criticality === "high") return "danger";
  if (text.includes("fire") || text.includes("life") || text.includes("safety") || criticality === "medium") return "warning";
  if (text.includes("boiler") || text.includes("pump") || text.includes("hvac")) return "info";
  return "success";
}

function renderPmCalendarKeyEquipment(records) {
  const seen = new Set();
  const uniqueRecords = records.filter((record) => {
    if (seen.has(record.asset.id)) return false;
    seen.add(record.asset.id);
    return true;
  }).slice(0, 12);
  const rangeLabel = pmCalendarRange === "week" ? "week" : pmCalendarRange === "year" ? "year" : "month";
  return `
    <section class="pm-calendar-key-section">
      <div class="pm-calendar-key-heading">
        <h3>Key Equipment for PM Tasks this ${escapeHtml(rangeLabel)}</h3>
        <span>${uniqueRecords.length} shown</span>
      </div>
      <div class="pm-calendar-equipment-grid">
        ${uniqueRecords.map(renderPmCalendarEquipmentCard).join("")}
      </div>
    </section>
  `;
}

function renderPmCalendarEquipmentCard(record) {
  const openTickets = openWorkOrdersForAsset(record.asset.id).length;
  const thumb = record.asset.photoDataUrl
    ? `<img src="${escapeAttribute(record.asset.photoDataUrl)}" alt="">`
    : `<span>No photo</span>`;
  return `
    <button type="button" class="pm-calendar-equipment-card" data-pm-calendar-asset="${escapeAttribute(record.asset.id)}">
      <span class="pm-calendar-equipment-thumb">${thumb}</span>
      <span class="pm-calendar-equipment-main">
        <strong>${escapeHtml(record.asset.name || "Equipment")}</strong>
        <small>${escapeHtml(record.customer?.name || "Unknown customer")} | ${escapeHtml(record.location?.name || "Unknown location")}</small>
        <span class="pm-calendar-mini-row">
          <em class="pm-calendar-mini-chip">${escapeHtml(formatDate(record.dueDate))}</em>
          <em class="pm-calendar-mini-chip">${openTickets ? `${openTickets} ticket${openTickets === 1 ? "" : "s"}` : "No tickets"}</em>
        </span>
      </span>
      <span class="pm-calendar-card-action">&rsaquo;</span>
    </button>
  `;
}

function renderPmCalendarItem(record) {
  const openTickets = openWorkOrdersForAsset(record.asset.id).length;
  const lastPm = record.asset.history?.[0]?.completedAt ? formatDate(new Date(record.asset.history[0].completedAt)) : "No completed PM";
  return `
    <button type="button" class="pm-calendar-item" data-pm-calendar-asset="${escapeAttribute(record.asset.id)}">
      <span>
        <strong>${escapeHtml(record.asset.name)}</strong>
        <small>${escapeHtml(record.customer?.name || "Unknown customer")} | ${escapeHtml(record.location?.name || "Unknown location")}</small>
      </span>
      <span>
        <small>${escapeHtml(record.template?.name || "PM template")}</small>
        <small>${escapeHtml(record.asset.criticality || "Low")} criticality | Last PM: ${escapeHtml(lastPm)}</small>
      </span>
      <em>${openTickets ? `${openTickets} open ticket${openTickets === 1 ? "" : "s"}` : "No open tickets"}</em>
    </button>
  `;
}

function printPmCalendar() {
  const windowInfo = pmCalendarWindow();
  const records = pmCalendarRecords(windowInfo);
  if (!records.length) {
    alert("No PMs are scheduled for this view.");
    return;
  }
  const currentCustomer = getCustomer(selectedCustomerId);
  const currentLocation = selectedLocationId === "all" ? null : getLocation(selectedLocationId);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("The print window was blocked. Allow pop-ups for SiteWorks and try again.");
    return;
  }
  const rows = records.map((record) => `
    <tr>
      <td>${escapeHtml(formatDate(record.dueDate))}</td>
      <td>${escapeHtml(record.asset.name)}</td>
      <td>${escapeHtml(record.customer?.name || "")}</td>
      <td>${escapeHtml(record.location?.name || "")}</td>
      <td>${escapeHtml(record.template?.name || "")}</td>
      <td>${escapeHtml(record.asset.criticality || "Low")}</td>
      <td>${escapeHtml(openWorkOrdersForAsset(record.asset.id).length ? "Open ticket" : "Clear")}</td>
    </tr>
  `).join("");
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>SiteWorks PM Calendar</title>
        <style>
          body { font-family: Arial, sans-serif; color: #142023; padding: 32px; }
          h1 { margin: 0 0 8px; font-size: 28px; }
          .meta { color: #5c6c70; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #d8e4e1; padding: 8px; text-align: left; vertical-align: top; }
          th { background: #eef7f4; }
        </style>
      </head>
      <body>
        <h1>SiteWorks PM Calendar</h1>
        <div class="meta">
          ${escapeHtml(windowInfo.label)}<br>
          ${escapeHtml(currentCustomer?.name || "No customer selected")} | ${escapeHtml(currentLocation?.name || "All locations")}<br>
          Generated ${escapeHtml(formatDateTime(new Date()))}
        </div>
        <table>
          <thead>
            <tr>
              <th>PM Date</th>
              <th>Equipment</th>
              <th>Customer</th>
              <th>Location</th>
              <th>Template</th>
              <th>Criticality</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function emailPmCalendarList() {
  const windowInfo = pmCalendarWindow();
  const records = pmCalendarRecords(windowInfo);
  if (!records.length) {
    alert("No PMs are scheduled for this view.");
    return;
  }
  const currentCustomer = getCustomer(selectedCustomerId);
  const currentLocation = selectedLocationId === "all" ? null : getLocation(selectedLocationId);
  const subject = `SiteWorks PM Calendar - ${windowInfo.label}`;
  const lines = [
    "SiteWorks PM Calendar",
    windowInfo.label,
    `${currentCustomer?.name || "No customer selected"} | ${currentLocation?.name || "All locations"}`,
    `${records.length} upcoming PM${records.length === 1 ? "" : "s"}`,
    "",
    ...records.map((record) => {
      const openTicketCount = openWorkOrdersForAsset(record.asset.id).length;
      const ticketText = openTicketCount ? ` | ${openTicketCount} open ticket${openTicketCount === 1 ? "" : "s"}` : "";
      return `${toDateInputValue(record.dueDate)} - ${record.asset.name} - ${record.location?.name || "No location"} - ${record.template?.name || "No template"} - ${record.asset.criticality || "Low"} criticality${ticketText}`;
    })
  ];
  addActivity("PM calendar email draft opened", `${windowInfo.label} | ${records.length} PMs`);
  saveState();
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

function exportPmCalendarCsv() {
  const windowInfo = pmCalendarWindow();
  const records = pmCalendarRecords(windowInfo);
  const rows = [
    ["PM Date", "Customer", "Location", "Equipment", "Template", "Criticality", "Frequency Days", "Last Completed PM", "Open Tickets"],
    ...records.map((record) => [
      toDateInputValue(record.dueDate),
      record.customer?.name || "",
      record.location?.name || "",
      record.asset.name,
      record.template?.name || "",
      record.asset.criticality || "",
      record.asset.frequencyDays,
      record.asset.history?.[0]?.completedAt || "",
      openWorkOrdersForAsset(record.asset.id).length
    ])
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pm-calendar-${pmCalendarRange}-${timestampForFile()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function renderDashboardMenus({ assets, dueInfos, activeIssues, activeServiceRequests, completedIssues }) {
  const scopedDueInfos = dueInfos.filter((item) => item?.asset && isCurrentViewAsset(item.asset));
  const scopedActiveIssues = activeIssues.filter(isCurrentViewWorkOrder);
  const scopedServiceRequests = activeServiceRequests.filter(isCurrentViewServiceRequest);
  const dueNowAssets = scopedDueInfos
    .filter((item) => item.daysUntil <= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .map((item) => item.asset);
  const overdueAssets = scopedDueInfos
    .filter((item) => item.daysUntil < 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .map((item) => item.asset);
  const highPriorityIssues = scopedActiveIssues.filter((item) => item.priority === "High");
  const waitingPartsIssues = scopedActiveIssues.filter((item) => item.status === "Waiting parts");
  const customerReports = scopedActiveIssues.filter(isCustomerReportedIssue);
  const failedPmIssues = scopedActiveIssues.filter(isFailedPmIssue);
  const assignedTickets = scopedActiveIssues.filter((item) => item.assignedUserId === currentUser?.id);
  const menuData = {
    dueNow: dashboardAssetItems(dueNowAssets, "No equipment is due now."),
    overdue: dashboardAssetItems(overdueAssets, "No equipment is overdue."),
    workOrders: dashboardIssueItems(scopedActiveIssues, "No open tickets for this view."),
    reportedIssues: dashboardIssueItems(customerReports, "No customer reports for this view."),
    failedPmIssues: dashboardIssueItems(failedPmIssues, "No failed PM follow-ups for this view."),
    serviceRequests: dashboardServiceRequestItems(scopedServiceRequests, "No service requests for this view."),
    highPriority: dashboardIssueItems(highPriorityIssues, "No high priority tickets for this view."),
    waitingParts: dashboardIssueItems(waitingPartsIssues, "No waiting parts tickets for this view."),
    assignedToMe: dashboardIssueItems(assignedTickets, "No tickets assigned to you for this view.")
  };

  Object.entries(menuData).forEach(([filter, html]) => {
    document.querySelectorAll(`[data-dashboard-menu="${filter}"]`).forEach((menu) => {
      menu.innerHTML = html;
    });
  });
}

function dashboardAssetItems(assets, emptyText) {
  const scopedAssets = assets.filter(isCurrentViewAsset);
  return scopedAssets.length
    ? scopedAssets.slice(0, 6).map((asset) => {
        const due = getDueInfo(asset);
        return renderDashboardMenuItem({
          type: "asset",
          id: asset.id,
          label: asset.name,
          meta: `${getCustomer(asset.customerId)?.name || "Unknown customer"} | ${getLocation(asset.locationId)?.name || "Unknown location"} | ${due.label}`,
          badge: "Equipment"
        });
      }).join("") + renderDashboardMoreCount(scopedAssets.length)
    : renderDashboardEmpty(emptyText);
}

function dashboardIssueItems(tickets, emptyText) {
  const scopedTickets = tickets.filter(isCurrentViewWorkOrder);
  return scopedTickets.length
    ? scopedTickets.slice(0, 6).map((ticket) => {
        const ageLabel = formatOpenTicketAge(ticket);
        return renderDashboardMenuItem({
          type: ticket.status === "Closed" ? "completed" : "ticket",
          id: ticket.id,
          label: `${formatIssueNumber(ticket)} - ${ticket.title || "Ticket"}`,
          meta: [
            getCustomer(ticket.customerId)?.name || "Unknown customer",
            getLocation(ticket.locationId)?.name || "Unknown location",
            ticket.status || "Open",
            ageLabel
          ].filter(Boolean).join(" | "),
          badge: ticket.priority || "Ticket"
        });
      }).join("") + renderDashboardMoreCount(scopedTickets.length)
    : renderDashboardEmpty(emptyText);
}

function dashboardServiceRequestItems(requests, emptyText) {
  const scopedRequests = requests.filter(isCurrentViewServiceRequest);
  return scopedRequests.length
    ? scopedRequests.slice(0, 6).map((request) => renderDashboardMenuItem({
        type: "service",
        id: request.id,
        label: `${formatServiceRequestNumber(request)} - ${request.title || "Service request"}`,
        meta: `${getCustomer(request.customerId)?.name || "Unknown customer"} | ${getLocation(request.locationId)?.name || "Unknown location"} | ${request.status || "New"}`,
        badge: "Service"
      })).join("") + renderDashboardMoreCount(scopedRequests.length)
    : renderDashboardEmpty(emptyText);
}

function dashboardCompletedItems(records, emptyText) {
  return records.length
    ? records.slice(0, 6).map((record) => {
        const isTicket = record.type === "workOrder";
        return renderDashboardMenuItem({
          type: "completed",
          id: isTicket ? record.workOrder.id : record.history?.id || record.asset.id,
          label: isTicket
            ? `${formatIssueNumber(record.workOrder)} - ${record.workOrder.title || "Completed ticket"}`
            : `${formatPmNumber(record.history)} - ${record.asset.name}`,
          meta: `${record.customer?.name || "Unknown customer"} | ${record.location?.name || "Unknown location"}`,
          badge: isTicket ? "Ticket" : "PM"
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

function isCurrentViewAsset(asset) {
  if (!asset || !canSeeAsset(asset)) return false;
  if (asset.customerId !== selectedCustomerId) return false;
  return selectedLocationId === "all" || asset.locationId === selectedLocationId;
}

function isCurrentViewWorkOrder(ticket) {
  if (!ticket || !canSeeWorkOrder(ticket) || !canSeeCustomer(ticket.customerId)) return false;
  if (ticket.customerId !== selectedCustomerId) return false;
  return selectedLocationId === "all" || ticket.locationId === selectedLocationId;
}

function isCurrentViewServiceRequest(request) {
  if (!request || !canSeeServiceRequest(request) || !canSeeCustomer(request.customerId)) return false;
  if (request.customerId !== selectedCustomerId) return false;
  return selectedLocationId === "all" || request.locationId === selectedLocationId;
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
    ...filteredWorkOrders().slice(0, 5).map((ticket) => ({
      type: ticket.status === "Closed" ? "completed" : "ticket",
      id: ticket.id,
      label: `${formatIssueNumber(ticket)} - ${ticket.title || "Ticket"}`,
      meta: `${getCustomer(ticket.customerId)?.name || "Unknown customer"} | ${getLocation(ticket.locationId)?.name || "Unknown location"} | ${ticket.status || "Open"}`,
      badge: ticket.status === "Closed" ? "Completed" : "Ticket"
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

function openCommandPalette() {
  if (!currentUser || isPublicReportUrl() || !els.commandPalette) return;
  commandPaletteQuery = "";
  els.commandPalette.classList.remove("hidden");
  if (els.commandPaletteInput) {
    els.commandPaletteInput.value = "";
    requestAnimationFrame(() => els.commandPaletteInput.focus());
  }
  renderCommandPaletteResults();
}

function closeCommandPalette() {
  els.commandPalette?.classList.add("hidden");
  commandPaletteQuery = "";
}

function renderCommandPaletteResults() {
  if (!els.commandPaletteResults) return;
  const results = commandPaletteResults(commandPaletteQuery).slice(0, 10);
  els.commandPaletteResults.innerHTML = results.length
    ? results.map(renderCommandPaletteResult).join("")
    : `<p class="command-palette-empty">No matches found.</p>`;
}

function renderCommandPaletteResult(result) {
  return `
    <button type="button" class="command-palette-result" data-command-result-type="${escapeAttribute(result.type)}" data-command-result-id="${escapeAttribute(result.id)}">
      <span>
        <strong>${escapeHtml(result.label)}</strong>
        <small>${escapeHtml(result.meta)}</small>
      </span>
      <em>${escapeHtml(result.badge)}</em>
    </button>
  `;
}

function commandPaletteResults(query) {
  const items = [
    ...commandPaletteCommands(),
    ...visibleCommandAssets(),
    ...visibleCommandTickets(),
    ...visibleCommandServiceRequests(),
    ...visibleCommandCompletedPms()
  ];
  if (!query) return items;
  return items.filter((item) => item.search.includes(query));
}

function commandPaletteCommands() {
  const commands = [];
  if (currentRole !== "Customer") {
    commands.push(
      commandPaletteItem("command", "pmCalendarPanel", "Open PM Calendar", "Jump to monthly preventative maintenance schedule.", "Go"),
      commandPaletteItem("command", "assetRegisterDrawer", "Open Equipment Register", "Browse and select equipment.", "Go"),
      commandPaletteItem("command", "workOrdersPanel", "Open Tickets", "Review active ticket work.", "Go"),
      commandPaletteItem("command", "serviceRequestsPanel", "Service Requests", "Review customer service requests.", "Go"),
      commandPaletteItem("command", "completedPmPanel", "Completed Tickets", "Review closed tickets and completed maintenance.", "Go")
    );
  }
  if (canAddEquipment()) commands.push(commandPaletteItem("command", "newEquipment", "New Equipment", "Create an equipment record.", "Create"));
  if (canCreateWorkOrders()) commands.push(commandPaletteItem("command", "newTicket", "New Ticket", "Create a maintenance ticket.", "Create"));
  if (canCreateServiceRequests()) commands.push(commandPaletteItem("command", "newServiceRequest", "New Service Request", "Create a service request.", "Create"));
  return commands;
}

function visibleCommandAssets() {
  return commandVisibleAssets().map((asset) => {
    const customer = getCustomer(asset.customerId);
    const locationRecord = getLocation(asset.locationId);
    const meta = `${customer?.name || "Unknown customer"} | ${locationRecord?.name || "Unknown location"}`;
    return commandPaletteItem("asset", asset.id, `Go to ${asset.name}`, meta, "Equipment", assetSearchText(asset));
  });
}

function visibleCommandTickets() {
  return commandVisibleWorkOrders().map((ticket) => {
    const meta = `${getCustomer(ticket.customerId)?.name || "Unknown customer"} | ${getLocation(ticket.locationId)?.name || "Unknown location"} | ${ticket.status || "Open"}`;
    const label = `Open ${formatIssueNumber(ticket)} - ${ticket.title || "Ticket"}`;
    return commandPaletteItem(ticket.status === "Closed" ? "completed" : "ticket", ticket.id, label, meta, ticket.status === "Closed" ? "Completed" : "Ticket", [
      label,
      ticket.issueNumber,
      ticket.title,
      ticket.notes,
      ticket.status,
      ticket.priority,
      meta
    ].join(" "));
  });
}

function visibleCommandServiceRequests() {
  return commandVisibleServiceRequests().map((request) => {
    const meta = `${getCustomer(request.customerId)?.name || "Unknown customer"} | ${getLocation(request.locationId)?.name || "Unknown location"} | ${request.status || "New"}`;
    const label = `Open ${formatServiceRequestNumber(request)} - ${request.title || "Service request"}`;
    return commandPaletteItem("service", request.id, label, meta, "Service", [label, request.title, request.notes, request.status, meta].join(" "));
  });
}

function visibleCommandCompletedPms() {
  return commandVisibleCompletedPms().map((record) => {
    const label = `${formatPmNumber(record.history)} - ${record.asset.name}`;
    const meta = `${record.customer?.name || "Unknown customer"} | ${record.location?.name || "Unknown location"} | ${record.history.result || "Completed"}`;
    return commandPaletteItem("completed", record.history?.id || record.asset.id, label, meta, "PM", [label, meta].join(" "));
  });
}

function commandVisibleAssets() {
  return state.assets.filter(canSeeAsset);
}

function commandVisibleWorkOrders() {
  return state.workOrders.filter(canSeeWorkOrder);
}

function commandVisibleServiceRequests() {
  return state.serviceRequests.filter(canSeeServiceRequest);
}

function commandVisibleCompletedPms() {
  return commandVisibleAssets()
    .flatMap((asset) => (asset.history || []).map((history) => ({
      type: "pm",
      asset,
      history,
      customer: getCustomer(asset.customerId),
      location: getLocation(asset.locationId)
    })))
    .sort((a, b) => new Date(b.history.completedAt || 0) - new Date(a.history.completedAt || 0));
}

function commandPaletteItem(type, id, label, meta, badge, searchText = "") {
  return {
    type,
    id,
    label,
    meta,
    badge,
    search: [label, meta, badge, searchText].join(" ").toLowerCase()
  };
}

function openCommandPaletteResult(type, id) {
  closeCommandPalette();
  if (type === "command") {
    runCommandPaletteAction(id);
    return;
  }
  openDashboardResult(type, id);
}

function runCommandPaletteAction(id) {
  if (id === "newEquipment" && canAddEquipment()) {
    closeCreateNewMenu();
    openTopActionDrawer(els.quickAddDrawer);
    return;
  }
  if (id === "newTicket" && canCreateWorkOrders()) {
    closeCreateNewMenu();
    renderNewIssueFormOptions();
    openTopActionDrawer(els.newIssueDrawer);
    return;
  }
  if (id === "newServiceRequest" && canCreateServiceRequests()) {
    closeCreateNewMenu();
    renderServiceRequestFormOptions();
    openTopActionDrawer(els.serviceRequestCreateDrawer);
    return;
  }
  if (id === "assetRegisterDrawer") {
    openAssetRegisterDrawer();
    render();
    els.assetRegisterDrawer?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  openPanel(id);
  render();
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderAssetTableControls() {
  els.assetSearch.value = assetQuery;
  els.statusFilter.value = assetStatusFilter;
  els.assetSort.value = assetSort;
  els.assetPageSize.value = String(assetPageSize);
  els.assetRegisterTabs?.forEach((button) => {
    const isActive = (button.dataset.assetRegisterTab || "active") === assetRegisterTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
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
    : `<tr><td colspan="8" class="empty-cell">${escapeHtml(emptyAssetTableMessage())}</td></tr>`;

  els.assetTableBody.querySelectorAll("tr[data-id]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("[data-edit-asset], [data-delete-asset], [data-print-select]")) return;
      if (selectedId === row.dataset.id && !els.assetPanel.classList.contains("hidden")) {
        closeSelectedAssetPanel();
        return;
      }
      selectedId = row.dataset.id;
      syncFiltersToSelectedAsset();
      location.hash = `asset/${selectedId}`;
      openPanel("assetPanel");
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

  els.assetTableBody.querySelectorAll("[data-delete-asset]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      selectedId = button.dataset.deleteAsset;
      await deleteSelectedEquipment();
    });
  });

  const showingStart = assets.length ? start + 1 : 0;
  const showingEnd = Math.min(start + pageAssets.length, assets.length);
  els.assetPageInfo.textContent = `Showing ${showingStart}-${showingEnd} of ${assets.length}`;
  els.prevAssetPageBtn.disabled = assetPage <= 1;
  els.nextAssetPageBtn.disabled = assetPage >= totalPages;
}

function emptyAssetTableMessage() {
  const currentCustomer = getCustomer(selectedCustomerId);
  const scopedAssets = filteredAssets();
  if (state.assets.length && currentCustomer && !scopedAssets.length) {
    return `No equipment is linked to ${currentCustomer.name} in this view. Try another customer/location or clear search filters.`;
  }
  if (scopedAssets.length && !assetTableAssets().length) {
    return "Equipment exists for this view, but the current search/status/tab filters are hiding it.";
  }
  return "No equipment matches these filters.";
}

function renderAssetTableRow(asset) {
  const due = getDueInfo(asset);
  const locationRecord = getLocation(asset.locationId);
  const active = asset.id === selectedId ? " selected-row" : "";
  const equipmentId = getAssetEquipmentId(asset);
  const deleteButton = canDeleteEquipment()
    ? `<button type="button" class="secondary mini danger-action table-delete-btn" data-delete-asset="${escapeAttribute(asset.id)}">Delete</button>`
    : "";
  return `
    <tr class="${active}" data-id="${asset.id}">
      <td class="equipment-id-cell">
        <div class="equipment-id-wrap">
          <input type="checkbox" data-print-select value="${escapeAttribute(asset.id)}" ${selectedPrintAssetIds.has(asset.id) ? "checked" : ""} aria-label="Select ${escapeAttribute(asset.name)} for QR printing">
          <strong>${escapeHtml(equipmentId)}</strong>
        </div>
      </td>
      <td>
        <strong>${escapeHtml(asset.name)}</strong>
        <span>${escapeHtml(asset.type || "Facility equipment")}</span>
      </td>
      <td>${escapeHtml(locationRecord?.name || "No location")}</td>
      <td>${escapeHtml(asset.model || "-")}</td>
      <td>${escapeHtml(asset.manufacturer || "-")}</td>
      <td>${renderAssetConditionBadge(asset, due)}</td>
      <td>${renderAssetOperationalBadge(asset, due)}</td>
      <td>
        <div class="table-row-actions">
          <button type="button" class="secondary mini table-edit-btn" data-edit-asset="${escapeAttribute(asset.id)}">Edit</button>
          ${deleteButton}
        </div>
      </td>
    </tr>
  `;
}

function renderAssetBadges(asset, due = getDueInfo(asset)) {
  const badges = [
    renderStatusBadge(due.label, due.className)
  ];
  const openCount = openWorkOrdersForAsset(asset.id).length;
  const failedPmCount = openFailedPmTicketsForAsset(asset.id).length;
  if (failedPmCount) badges.push(`<span class="status-badge badge-danger">Failed PM open</span>`);
  if (openCount) badges.push(`<span class="status-badge badge-warn">${openCount} open ticket${openCount === 1 ? "" : "s"}</span>`);
  if (asset.criticality) badges.push(`<span class="status-badge ${criticalityBadgeClass(asset.criticality)}">${escapeHtml(asset.criticality)} criticality</span>`);
  if (hasMedia(asset.manualFile) || asset.documentUrl) badges.push(`<span class="status-badge badge-muted">Manual ready</span>`);
  return badges.join("");
}

function renderStatusBadge(label, className) {
  return `<span class="status-badge ${badgeClassForStatus(className)}">${escapeHtml(label)}</span>`;
}

function getAssetEquipmentId(asset) {
  return asset?.equipmentId || (asset?.id ? asset.id.slice(0, 8).toUpperCase() : "");
}

function renderAssetConditionBadge(asset, due = getDueInfo(asset)) {
  const openCount = openWorkOrdersForAsset(asset.id).length;
  if (isAssetMaintenanceRequired(asset, due)) {
    return `<span class="status-badge badge-warn">Needs attention</span>`;
  }
  if (openCount) return `<span class="status-badge badge-muted">Monitor</span>`;
  return `<span class="status-badge badge-ok">Good</span>`;
}

function renderAssetOperationalBadge(asset, due = getDueInfo(asset)) {
  if (isAssetMaintenanceRequired(asset, due)) {
    return `<span class="status-badge badge-maintenance">Maintenance Required</span>`;
  }
  return `<span class="status-badge badge-operational">Operational</span>`;
}

function isAssetMaintenanceRequired(asset, due = getDueInfo(asset)) {
  return due.daysUntil <= 0 || openWorkOrdersForAsset(asset.id).some((item) =>
    item.status !== "Closed" && (item.priority === "High" || item.status === "Waiting parts" || isFailedPmIssue(item))
  );
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
  const storageHealth = getStoredFileHealth();
  const cleanupWorking = els.cloudCleanupBlock?.classList.contains("is-working");
  if (els.migrateLocalFilesBtn && !cleanupWorking) {
    els.migrateLocalFilesBtn.disabled = !canManageWorkOrders() || !storageHealth.localOnly;
  }
  if (els.removeLocalCopiesBtn && !cleanupWorking) {
    els.removeLocalCopiesBtn.disabled = !canManageWorkOrders() || !storageHealth.removableLocalCopies;
  }
  if (!els.cloudCleanupStatus?.dataset.manualMessage) {
    updateCloudCleanupStatus(buildStorageHealthSummaryText(storageHealth), false);
  }
}

function renderSyncHealth() {
  if (!els.syncHealthGrid) return;
  const hasError = Boolean(syncHealth.lastError);
  const storageHealth = getStoredFileHealth();
  const loadStatus = structuredDataLoading || sharedStateLoading ? "Loading..." : formatSyncTimestamp(syncHealth.lastCloudLoadAt);
  const saveStatus = structuredSyncActive ? "Saving..." : formatSyncTimestamp(syncHealth.lastCloudSaveAt);
  const publicReportStatus = remoteReportsLoading ? "Checking..." : formatSyncTimestamp(syncHealth.lastPublicReportSyncAt);
  els.syncHealthSummary.textContent = hasError
    ? `Last issue: ${syncHealth.lastError}`
    : storageHealth.localOnly
      ? `Cloud sync is working. ${storageHealth.localOnly} old browser file${storageHealth.localOnly === 1 ? "" : "s"} should be moved to cloud.`
      : "Cloud sync looks healthy.";
  els.syncHealthPanel?.classList.toggle("has-sync-error", hasError);
  els.syncHealthGrid.innerHTML = [
    ["Backend mode", siteworksApi.backendLabel()],
    ["Cloud load", loadStatus],
    ["Cloud save", saveStatus],
    ["Public reports", publicReportStatus],
    ["Old browser files", storageHealth.localOnly ? `${storageHealth.localOnly} (${formatBytes(storageHealth.localBytes)})` : "None"],
    ["Cloud files", `${storageHealth.cloudBacked}`],
    ["Removable local copies", storageHealth.removableLocalCopies ? `${storageHealth.removableLocalCopies} (${formatBytes(storageHealth.removableLocalBytes)})` : "None"],
    ["Broken file references", storageHealth.brokenReferences ? `${storageHealth.brokenReferences}` : "None"],
    ["Last error", hasError ? `${formatSyncTimestamp(syncHealth.lastErrorAt)} - ${syncHealth.lastError}` : "None"]
  ].map(([label, value]) => `
    <div class="sync-health-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join("");
}

function formatSyncTimestamp(value) {
  if (!value) return "Not yet";
  return formatDateTime(new Date(value));
}

function markSyncSuccess(type) {
  const now = new Date().toISOString();
  if (type === "load") syncHealth.lastCloudLoadAt = now;
  if (type === "save") syncHealth.lastCloudSaveAt = now;
  if (type === "publicReports") syncHealth.lastPublicReportSyncAt = now;
  syncHealth.lastError = "";
  syncHealth.lastErrorAt = "";
}

function markSyncError(message) {
  syncHealth.lastError = message || "Cloud sync failed.";
  syncHealth.lastErrorAt = new Date().toISOString();
}

function renderQrSettings() {
  const repairedUrl = getQrBaseUrl();
  if (state.qrBaseUrl !== repairedUrl) {
    state.qrBaseUrl = repairedUrl;
    saveStateQuietly();
  }
  els.qrBaseUrl.value = repairedUrl;
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
  els.reportTitle.textContent = "Report Issue";
  els.reportContext.textContent = [
    report.customer?.name,
    report.location?.name,
    report.asset?.name
  ].filter(Boolean).join(" | ");
}

function renderWorkOrders() {
  const visibleWorkOrders = filterWorkOrdersForView(filteredWorkOrders());
  const visibleServiceRequests = filteredServiceRequests()
    .filter((item) => item.status !== "Completed" && item.status !== "Declined");
  const visiblePmRecords = completedPmRecords();
  const standardTickets = visibleWorkOrders.filter((item) => !isCustomerReportedIssue(item));
  const customerTickets = visibleWorkOrders.filter(isCustomerReportedIssue);
  const groups = {
    all: [
      ...visibleWorkOrders.map((item) => ({ type: "ticket", item })),
      ...visibleServiceRequests.map((item) => ({ type: "service", item })),
      ...visiblePmRecords.map((item) => ({ type: "pm", item }))
    ],
    sw: standardTickets.map((item) => ({ type: "ticket", item })),
    "sw-cu": customerTickets.map((item) => ({ type: "ticket", item })),
    "sw-pm": visiblePmRecords.map((item) => ({ type: "pm", item })),
    "sw-sr": visibleServiceRequests.map((item) => ({ type: "service", item }))
  };
  if (!groups[workOrderNumberFilter]) workOrderNumberFilter = "all";
  const focusedWorkOrder = focusedWorkOrderId
    ? visibleWorkOrders.find((item) => item.id === focusedWorkOrderId)
    : null;
  if (focusedWorkOrderId && !focusedWorkOrder) {
    focusedWorkOrderId = "";
  }
  const records = focusedWorkOrder
    ? [{ type: "ticket", item: focusedWorkOrder }]
    : groups[workOrderNumberFilter];
  els.workOrderCount.textContent = records.length;
  renderWorkOrderNumberFilter({
    all: groups.all.length,
    sw: groups.sw.length,
    swCu: groups["sw-cu"].length,
    swPm: groups["sw-pm"].length,
    swSr: groups["sw-sr"].length
  });
  els.workOrderList.innerHTML = records.length
    ? records.map(renderSwNumberRecord).join("")
    : `<p class="muted">${emptySwNumberFilterMessage()}</p>`;
}

function renderSwNumberRecord(record) {
  if (record.type === "service") return renderServiceRequestItem(record.item);
  if (record.type === "pm") return renderCompletedTicketItem(record.item);
  return renderWorkOrderItem(record.item);
}

function emptySwNumberFilterMessage() {
  if (workOrderNumberFilter === "sw") return "No SW tickets for this view.";
  if (workOrderNumberFilter === "sw-cu") return "No SW-CU customer tickets for this view.";
  if (workOrderNumberFilter === "sw-pm") return "No SW-PM maintenance records for this view.";
  if (workOrderNumberFilter === "sw-sr") return "No SW-SR service requests for this view.";
  return currentRole === "Technician"
    ? "No SW records assigned to you for this view."
    : "No SW records for this view.";
}

function renderWorkOrderNumberFilter(counts) {
  if (!els.workOrderNumberFilter) return;
  const currentValue = ["all", "sw", "sw-cu", "sw-pm", "sw-sr"].includes(workOrderNumberFilter)
    ? workOrderNumberFilter
    : "all";
  workOrderNumberFilter = currentValue;
  els.workOrderNumberFilter.innerHTML = [
    `<option value="all">All SW records (${counts.all})</option>`,
    `<option value="sw">SW tickets (${counts.sw})</option>`,
    `<option value="sw-cu">SW-CU customer tickets (${counts.swCu})</option>`,
    `<option value="sw-pm">SW-PM maintenance records (${counts.swPm})</option>`,
    `<option value="sw-sr">SW-SR service requests (${counts.swSr})</option>`
  ].join("");
  els.workOrderNumberFilter.value = currentValue;
}

function renderCompletedPms() {
  const visibleRecords = completedTicketRecords();
  const focusedRecord = focusedCompletedRecordId
    ? visibleRecords.find((record) => completedRecordMatchesId(record, focusedCompletedRecordId))
    : null;
  if (focusedCompletedRecordId && !focusedRecord) focusedCompletedRecordId = "";
  const records = focusedRecord ? [focusedRecord] : visibleRecords;
  if (els.completedPmCount) els.completedPmCount.textContent = visibleRecords.length;
  if (!els.completedPmList) return;
  els.completedPmList.innerHTML = records.length
    ? records.map((record) => {
        try {
          return renderCompletedTicketItem(record);
        } catch {
          return `<article class="work-order-item"><p class="muted">A completed record could not be displayed.</p></article>`;
        }
      }).join("")
    : `<p class="muted">No completed tickets for this view.</p>`;
}

function completedRecordMatchesId(record, id) {
  if (!record || !id) return false;
  if (record.type === "workOrder") return record.workOrder?.id === id;
  return record.history?.id === id || record.asset?.id === id;
}

function renderCompletedTicketItem(record) {
  if (record.type === "workOrder") {
    const isFocused = completedRecordMatchesId(record, focusedCompletedRecordId);
    return `
      <details class="work-order-item work-order-drawer completed-pm-item" ${isFocused ? "open" : ""}>
        <summary>
          <div>
            <strong>${escapeHtml(formatIssueNumber(record.workOrder))} - ${escapeHtml(record.workOrder.title || "Completed ticket")}</strong>
            <span>${escapeHtml(record.customer?.name || "Unknown customer")} | ${escapeHtml(record.location?.name || "Unknown location")}</span>
          </div>
          <span class="history-open-label">Open</span>
        </summary>
        <p><strong>${escapeHtml(record.workOrder.status || "Closed")}</strong> ${escapeHtml(record.workOrder.priority || "Medium")} priority | Completed ${escapeHtml(formatDateTime(new Date(record.completedAt)))}</p>
        <p>${escapeHtml(record.workOrder.notes || "No notes entered.")}</p>
        ${record.asset ? `<button type="button" class="secondary mini" data-completed-pm-asset="${escapeAttribute(record.asset.id)}">View Equipment</button>` : ""}
      </details>
    `;
  }

  const isFocused = completedRecordMatchesId(record, focusedCompletedRecordId);
  return `
    <details class="work-order-item work-order-drawer completed-pm-item" ${isFocused ? "open" : ""}>
      <summary>
        <div>
          <strong>${escapeHtml(formatPmNumber(record.history))} - ${escapeHtml(record.asset.name)}</strong>
          <span>${escapeHtml(record.customer?.name || "Unknown customer")} | ${escapeHtml(record.location?.name || "Unknown location")}</span>
        </div>
        <span class="history-open-label">Open</span>
      </summary>
      <p><strong>${escapeHtml(record.history.result || "Completed")}</strong> by ${escapeHtml(record.history.technician || "No technician entered")} on ${escapeHtml(formatDateTime(new Date(record.history.completedAt)))}</p>
      <p>${escapeHtml(record.history.notes || "No notes entered.")}</p>
      <button type="button" class="secondary mini" data-completed-pm-asset="${escapeAttribute(record.asset.id)}">View Equipment</button>
    </details>
  `;
}

function moveTopActionDrawers() {
  if (!els.newActionBar) return;
  [els.quickAddDrawer, els.newIssueDrawer, els.serviceRequestCreateDrawer].filter(Boolean).forEach((drawer) => {
    els.newActionBar.appendChild(drawer);
  });
}

function getTopActionDrawers() {
  return [els.quickAddDrawer, els.newIssueDrawer, els.serviceRequestCreateDrawer].filter(Boolean);
}

function closeTopActionDrawers(except = null) {
  getTopActionDrawers().forEach((drawer) => {
    if (drawer !== except) drawer.open = false;
  });
}

function toggleCreateNewMenu() {
  if (!els.createNewMenu || !els.createNewBtn) return;
  const shouldOpen = els.createNewMenu.classList.contains("hidden");
  closeMetricMenus();
  closeTopActionDrawers();
  els.createNewMenu.classList.toggle("hidden", !shouldOpen);
  els.createNewBtn.setAttribute("aria-expanded", String(shouldOpen));
}

function closeCreateNewMenu() {
  els.createNewMenu?.classList.add("hidden");
  els.createNewBtn?.setAttribute("aria-expanded", "false");
}

function toggleMobileCreateMenu() {
  if (!els.mobileCreateMenu || !els.mobileCreateBtn) return;
  const shouldOpen = els.mobileCreateMenu.classList.contains("hidden");
  renderMobileCreateActions();
  closeMetricMenus();
  closeTopActionDrawers();
  els.mobileCreateMenu.classList.toggle("hidden", !shouldOpen);
  els.mobileCreateBtn.classList.toggle("is-active", shouldOpen);
  els.mobileCreateBtn.setAttribute("aria-expanded", String(shouldOpen));
}

function closeMobileCreateMenu() {
  els.mobileCreateMenu?.classList.add("hidden");
  els.mobileCreateBtn?.classList.remove("is-active");
  els.mobileCreateBtn?.setAttribute("aria-expanded", "false");
}

function renderMobileCreateActions() {
  els.mobileCreateMenu?.querySelector("[data-mobile-create-action='newEquipment']")
    ?.classList.toggle("hidden", !canAddEquipment());
  els.mobileCreateMenu?.querySelector("[data-mobile-create-action='newTicket']")
    ?.classList.toggle("hidden", !canCreateWorkOrders());
  els.mobileCreateMenu?.querySelector("[data-mobile-create-action='newServiceRequest']")
    ?.classList.toggle("hidden", !canCreateServiceRequests());
  els.mobileCreateBtn?.classList.toggle("hidden", !(canAddEquipment() || canCreateWorkOrders() || canCreateServiceRequests()));
}

function toggleTopActionDrawer(drawer) {
  if (!drawer) return;
  const shouldOpen = !drawer.open;
  closeTopActionDrawers(drawer);
  drawer.open = shouldOpen;
  if (shouldOpen) scrollToTopActionDrawer(drawer);
}

function openTopActionDrawer(drawer) {
  if (!drawer) return;
  closeTopActionDrawers(drawer);
  drawer.open = true;
  scrollToTopActionDrawer(drawer);
}

function scrollToTopActionDrawer(drawer) {
  requestAnimationFrame(() => {
    drawer.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function closeMetricMenus(except = null) {
  document.querySelectorAll("[data-dashboard-menu]").forEach((menu) => {
    if (menu !== except) {
      menu.classList.add("hidden");
      menu.classList.remove("is-right-aligned");
    }
  });
}

function positionMetricMenu(menu) {
  menu.classList.remove("is-right-aligned");
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth - 12) {
    menu.classList.add("is-right-aligned");
  }
}

function toggleMetricMenu(filter) {
  const menu = document.querySelector(`[data-dashboard-menu="${filter}"]`);
  if (!menu) return;
  const shouldOpen = menu.classList.contains("hidden");
  closeTopActionDrawers();
  closeMetricMenus(menu);
  menu.classList.toggle("hidden", !shouldOpen);
  if (shouldOpen) requestAnimationFrame(() => positionMetricMenu(menu));
}

function runDashboardAction(filter) {
  const ticketFilters = {
    workOrders: "active",
    highPriority: "highPriority",
    waitingParts: "waitingParts",
    reportedIssues: "reported",
    failedPmIssues: "failedPm",
    assignedToMe: "assignedToMe"
  };

  if (filter === "completedPm") {
    focusedWorkOrderId = "";
    focusedServiceRequestId = "";
    focusedCompletedRecordId = "";
    workOrderNumberFilter = "all";
    const panel = document.getElementById("completedPmPanel");
    const willOpen = panel?.classList.contains("is-collapsed");
    togglePanel("completedPmPanel");
    render();
    panel?.scrollIntoView({ behavior: "smooth", block: willOpen ? "start" : "nearest" });
    return;
  }

  if (filter === "serviceRequests") {
    focusedWorkOrderId = "";
    focusedServiceRequestId = "";
    focusedCompletedRecordId = "";
    workOrderNumberFilter = "all";
    const panel = document.getElementById("serviceRequestsPanel");
    const willOpen = panel?.classList.contains("is-collapsed");
    togglePanel("serviceRequestsPanel");
    render();
    panel?.scrollIntoView({ behavior: "smooth", block: willOpen ? "start" : "nearest" });
    return;
  }

  if (ticketFilters[filter]) {
    focusedWorkOrderId = "";
    focusedServiceRequestId = "";
    focusedCompletedRecordId = "";
    workOrderNumberFilter = "all";
    workOrderViewFilter = ticketFilters[filter];
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

  assetQuery = "";
  globalQuery = "";
  assetTemplateFilter = "all";
  assetRegisterTab = filter === "overdue" ? "overdue" : "active";
  assetStatusFilter = filter;
  assetSort = filter === "all" ? "due" : assetSort;
  assetPage = 1;
  if (els.assetSearch) els.assetSearch.value = "";
  if (els.globalSearch) els.globalSearch.value = "";
  if (els.globalSearchResults) els.globalSearchResults.classList.add("hidden");
  const willOpen = !els.assetRegisterDrawer?.open;
  openAssetRegisterDrawer(filter);
  render();
  if (willOpen) els.assetRegisterDrawer?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openDashboardResult(type, id) {
  if (type === "asset") {
    const asset = getAsset(id);
    if (!isCurrentViewAsset(asset)) return;
    focusedWorkOrderId = "";
    focusedServiceRequestId = "";
    focusedCompletedRecordId = "";
    workOrderNumberFilter = "all";
    selectedId = id;
    syncFiltersToSelectedAsset();
    location.hash = `asset/${selectedId}`;
    if (currentRole !== "Customer") openAssetRegisterDrawer();
    openPanel("assetPanel");
  } else if (type === "ticket") {
    const ticket = state.workOrders.find((item) => item.id === id);
    if (!isCurrentViewWorkOrder(ticket)) return;
    focusedWorkOrderId = id;
    workOrderNumberFilter = getWorkOrderNumberFilterForTicket(ticket);
    focusedServiceRequestId = "";
    focusedCompletedRecordId = "";
    workOrderViewFilter = "active";
    openPanel("workOrdersPanel");
  } else if (type === "service") {
    const request = state.serviceRequests.find((item) => item.id === id);
    if (!isCurrentViewServiceRequest(request)) return;
    focusedWorkOrderId = "";
    workOrderNumberFilter = "all";
    focusedServiceRequestId = id;
    focusedCompletedRecordId = "";
    serviceRequestDrawerTab = "notes";
    openPanel("serviceRequestsPanel");
  } else if (type === "completed") {
    const completedTicket = state.workOrders.find((item) => item.id === id);
    const completedPm = completedPmRecords().find((record) => record.history?.id === id || record.asset?.id === id);
    if (completedTicket && !isCurrentViewWorkOrder(completedTicket)) return;
    if (!completedTicket && completedPm && !isCurrentViewAsset(completedPm.asset)) return;
    if (!completedTicket && !completedPm) return;
    focusedWorkOrderId = "";
    focusedServiceRequestId = "";
    focusedCompletedRecordId = id;
    workOrderNumberFilter = "all";
    openPanel("completedPmPanel");
  }
  render();
  const target = type === "asset"
    ? document.getElementById("assetPanel")
    : type === "ticket"
      ? document.getElementById("workOrdersPanel")
      : type === "service"
        ? document.getElementById("serviceRequestsPanel")
        : document.getElementById("completedPmPanel");
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getWorkOrderNumberFilterForTicket(ticket) {
  if (isCustomerReportedIssue(ticket)) return "sw-cu";
  return "sw";
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
    ? "Choose the customer for this ticket."
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
  const isAreaTicket = Boolean(els.newIssueTargetArea?.checked);
  els.newIssueAsset.disabled = isAreaTicket || !assets.length;
  els.newIssueArea.disabled = !isAreaTicket || !locations.length;
  if (!isAreaTicket) els.newIssueArea.value = "";
  syncNewIssueTitle();
  updateNewIssueSubmitState();
}

function updateNewIssueSubmitState() {
  if (!els.newIssueForm) return;
  const submitButton = els.newIssueForm.querySelector("button[type='submit']");
  if (!submitButton) return;
  const isAreaTicket = Boolean(els.newIssueTargetArea?.checked);
  const hasCustomer = Boolean(els.newIssueCustomer?.value);
  const hasLocation = Boolean(els.newIssueLocation?.value);
  const hasValidTarget = isAreaTicket
    ? Boolean(els.newIssueArea?.value.trim())
    : Boolean(els.newIssueAsset?.value);
  submitButton.disabled = !hasCustomer || !hasLocation || !hasValidTarget || !canCreateWorkOrders();
}

function syncNewIssueTitle() {
  if (!els.newIssueTitle || !els.newIssueAsset) return;
  const isAreaTicket = Boolean(els.newIssueTargetArea?.checked);
  const asset = getAsset(els.newIssueAsset.value);
  const areaName = String(els.newIssueArea?.value || "").trim();
  const label = isAreaTicket
    ? areaName || "Area"
    : asset?.name || "";
  if (!label) return;
  if (!els.newIssueTitle.value.trim() || els.newIssueTitle.value.startsWith("Ticket: ")) {
    els.newIssueTitle.value = `Ticket: ${label}`;
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
  const visibleRequests = filteredServiceRequests();
  const focusedRequest = focusedServiceRequestId
    ? visibleRequests.find((item) => item.id === focusedServiceRequestId)
    : null;
  if (focusedServiceRequestId && !focusedRequest) {
    focusedServiceRequestId = "";
    serviceRequestDrawerTab = "notes";
  }
  const requests = focusedRequest ? [focusedRequest] : visibleRequests;
  if (els.serviceRequestCount) els.serviceRequestCount.textContent = visibleRequests.filter((item) => item.status !== "Completed" && item.status !== "Declined").length;
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

function renderWorkDrawerProfile({ title, systemId, context = "", imageSrc = "", fallback = "SW", badges = "" }) {
  return `
    <div class="work-drawer-profile">
      <div class="work-drawer-thumb">
        ${imageSrc
          ? `<img alt="${escapeAttribute(title)}" src="${escapeAttribute(imageSrc)}">`
          : `<span>${escapeHtml(fallback)}</span>`}
      </div>
      <div class="work-drawer-profile-text">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(systemId)}</span>
        ${context ? `<span class="work-drawer-context">${escapeHtml(context)}</span>` : ""}
        ${badges ? `<div class="work-drawer-badges">${badges}</div>` : ""}
      </div>
    </div>
  `;
}

function getDrawerItemUrl(type, id) {
  const base = getQrBaseUrl();
  return `${base}#${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
}

function renderServiceRequestItem(request) {
  const customer = getCustomer(request.customerId);
  const locationRecord = getLocation(request.locationId);
  const asset = getAsset(request.assetId);
  const assignedLabel = request.assignedUserName || "Unassigned";
  const createdLabel = request.createdAt ? formatDate(new Date(request.createdAt)) : "Not recorded";
  const ageLabel = formatOpenServiceRequestAge(request);
  const requestNumber = formatServiceRequestNumber(request);
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
  const compactServiceAssignmentControl = canEdit
    ? `<select class="compact-assignee-select" data-service-request-assignee="${escapeAttribute(request.id)}" aria-label="Assigned to">${assigneeOptions}</select>`
    : "";
  const requestPhotoSrc = mediaSource(request.photo);
  const requestPhoto = requestPhotoSrc
    ? `<button type="button" class="history-photo-button ticket-photo-card" data-view-photo data-photo-src="${escapeAttribute(requestPhotoSrc)}" data-photo-caption="${escapeAttribute(request.photo.name || "Service request photo")}">
        <img class="history-photo" alt="Service request photo" src="${escapeAttribute(requestPhotoSrc)}">
        <span>Submitted photo</span>
      </button>`
    : "";
  const profileBadges = [
    `<span class="drawer-param-badge badge-warn">${escapeHtml(request.priority || "Medium")} priority</span>`,
    `<span class="drawer-param-badge ${statusClass}">${escapeHtml(request.status || "New")}</span>`,
    `<span class="drawer-param-badge badge-muted">Created ${escapeHtml(createdLabel)}</span>`,
    `<span class="drawer-param-badge badge-muted">Preferred ${request.preferredDate ? escapeHtml(formatDate(parseLocalDate(request.preferredDate))) : "Not set"}</span>`
  ].join("");
  const drawerProfile = renderWorkDrawerProfile({
    title: asset?.name || request.title || "Service request",
    systemId: `${requestNumber} | ${request.title || "Service request"}`,
    imageSrc: mediaSource(request.photo) || mediaSource(asset?.photo) || "",
    fallback: "SR",
    badges: profileBadges
  });
  const requestNotesPanel = renderServiceRequestNotesPanel(request, requestPhoto);
  const requestHistoryPanel = renderServiceRequestHistoryPanel(request);
  const primaryActions = canEdit ? `
    <button class="secondary mini" type="button" data-open-ticket-edit>Edit</button>
    ${request.status !== "Reviewed" ? `<button class="secondary mini" data-service-request-id="${escapeAttribute(request.id)}" data-service-request-action="Reviewed">Review</button>` : ""}
    ${request.status !== "Completed" ? `<button class="secondary mini" data-service-request-id="${escapeAttribute(request.id)}" data-service-request-action="Completed">Complete</button>` : ""}
  ` : "";
  const editAction = canEdit ? `
    <details class="ticket-sub-drawer" data-ticket-edit-drawer>
      <summary>
        <h3>Edit Request</h3>
        <span>Update</span>
      </summary>
      ${renderServiceRequestEditForm(request)}
    </details>
  ` : "";
  const moreActions = canEdit ? `
    <button class="secondary mini" data-service-request-pdf="${escapeAttribute(request.id)}">PDF Form</button>
    <button class="secondary mini" data-service-request-email="${escapeAttribute(request.id)}">Email Request</button>
    <button class="secondary mini" data-service-request-send-pdf="${escapeAttribute(request.id)}">Send PDF Email</button>
    ${request.status !== "Scheduled" ? `<button class="secondary mini" data-service-request-id="${escapeAttribute(request.id)}" data-service-request-action="Scheduled">Schedule</button>` : ""}
    ${request.status !== "Declined" ? `<button class="secondary mini" data-service-request-id="${escapeAttribute(request.id)}" data-service-request-action="Declined">Decline</button>` : ""}
    ${!request.convertedWorkOrderId ? `<button class="secondary mini" data-service-request-convert="${escapeAttribute(request.id)}">Convert to Ticket</button>` : `<span class="status-badge badge-ok">Converted</span>`}
  ` : "";
  return `
    <details class="work-order-item work-order-drawer service-request-item" ${request.id === focusedServiceRequestId ? "open" : ""}>
      <summary>
        <div class="ticket-list-summary">
          <strong>${escapeHtml(requestNumber)} - ${escapeHtml(request.title || "Service request")}</strong>
          <span>${escapeHtml(asset?.name || "No equipment selected")} | ${escapeHtml(customer?.name || "Unknown customer")} | ${escapeHtml(locationRecord?.name || "Unknown location")}</span>
          <div class="ticket-list-badges">${profileBadges}</div>
        </div>
        <div class="ticket-summary-tools">
          ${ageLabel ? `<span class="history-open-label">${escapeHtml(ageLabel)}</span>` : ""}
          ${primaryActions}
          ${moreActions.trim() ? `
            <details class="ticket-action-menu">
              <summary>More</summary>
              <div class="ticket-action-menu-list">
                ${moreActions}
              </div>
            </details>
          ` : ""}
          <button type="button" class="secondary mini ticket-drawer-close" data-close-work-drawer aria-label="Close service request drawer">X</button>
        </div>
      </summary>
      <div class="ticket-drawer-body">
        <section class="ticket-profile-card">
          ${drawerProfile}
        </section>
        <details class="ticket-sub-drawer" open>
          <summary>
            <h3>Description</h3>
            <span>${escapeHtml(requestNumber)}</span>
          </summary>
          <section class="ticket-open-description">
            <p>${escapeHtml(request.title || "No description entered.")}</p>
          </section>
        </details>
        <details class="ticket-sub-drawer" open>
          <summary>
            <h3>Activity & Notes</h3>
            <span>${serviceRequestHistoryEntries(request).length + (request.notes ? 1 : 0) + (hasMedia(request.photo) ? 1 : 0)}</span>
          </summary>
          <div class="service-request-activity-stack">
            ${requestNotesPanel}
            ${requestHistoryPanel}
          </div>
        </details>
        <details class="ticket-sub-drawer">
          <summary>
            <h3>Request Meta</h3>
            <span>${escapeHtml(assignedLabel)}</span>
          </summary>
          <div class="ticket-meta-list ticket-spec-grid">
            <div class="ticket-spec-row ticket-assignment-panel compact-panel">
              <span>Assigned to</span>
              <div>
                <strong>${escapeHtml(assignedLabel)}</strong>
                ${compactServiceAssignmentControl}
              </div>
            </div>
            <div class="service-request-meta-row">
              <span>Customer</span>
              <strong>${escapeHtml(customer?.name || "Unknown customer")}</strong>
            </div>
            <div class="service-request-meta-row">
              <span>Location</span>
              <strong>${escapeHtml(locationRecord?.name || "Unknown location")}</strong>
            </div>
            <div class="service-request-meta-row">
              <span>Equipment</span>
              <strong>${escapeHtml(asset?.name || "No equipment selected")}</strong>
            </div>
          </div>
        </details>
        ${editAction}
      </div>
    </details>
  `;
}

function renderServiceRequestNotesPanel(request, requestPhoto) {
  return `
    <div class="service-request-notes-timeline">
      <article class="service-request-note-entry">
        <strong>Request summary</strong>
        <span>Requested by ${escapeHtml(request.requestedBy || "Not entered")}</span>
        <p>${escapeHtml(request.notes || "No details entered.")}</p>
      </article>
      <article class="service-request-note-entry">
        <strong>Description</strong>
        <p>${escapeHtml(request.title || "Service request")}</p>
      </article>
      ${requestPhoto ? `<div class="ticket-photo-gallery">${requestPhoto}</div>` : ""}
    </div>
  `;
}

function renderServiceRequestHistoryPanel(request) {
  const entries = serviceRequestHistoryEntries(request);
  return `
    <div class="service-request-audit-list service-request-tab-history">
      ${entries.map((entry) => `
        <article class="service-request-audit-entry">
          <strong>${escapeHtml(entry.action || "Updated")}</strong>
          <span>${escapeHtml(formatDateTime(new Date(entry.createdAt || request.createdAt || new Date().toISOString())))} | ${escapeHtml(entry.userName || "System")}${entry.userRole ? ` | ${escapeHtml(entry.userRole)}` : ""}</span>
          ${entry.details ? `<p>${escapeHtml(entry.details)}</p>` : ""}
        </article>
      `).join("")}
    </div>
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
    details: `${formatIssueNumber(item)} - ${item.title || "Open ticket"}`,
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
    : `<p class="muted">${currentRole === "Technician" ? "No tickets assigned to you for this equipment." : "No tickets for this equipment."}</p>`;
}

function filterWorkOrdersForView(workOrders) {
  const active = workOrders.filter((item) => item.status !== "Closed");
  if (workOrderViewFilter === "highPriority") return active.filter((item) => item.priority === "High");
  if (workOrderViewFilter === "waitingParts") return active.filter((item) => item.status === "Waiting parts");
  if (workOrderViewFilter === "reported") return active.filter(isCustomerReportedIssue);
  if (workOrderViewFilter === "failedPm") return active.filter(isFailedPmIssue);
  if (workOrderViewFilter === "assignedToMe") return active.filter((item) => item.assignedUserId === currentUser?.id);
  return active;
}

function isCustomerReportedIssue(item) {
  return item?.source === "Public QR report";
}

function isFailedPmIssue(item) {
  if (!item) return false;
  if (item.source === "Failed PM") return true;
  if (item.source === "PM result" && item.priority === "High" && /failed/i.test(item.title || "")) return true;
  return Boolean(item.sourceHistoryId) && item.priority === "High" && /failed/i.test(item.title || "");
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
      <h2>No assigned equipment tickets</h2>
      <p>Equipment will appear here when an open ticket is assigned to you.</p>
    `;
  }
  const addEquipmentButton = canAddEquipment()
    ? `<button type="button" data-empty-add-equipment>Add Equipment</button>`
    : "";
  return `
    <h2>Selected Equipment</h2>
    <p>Select equipment to view details.</p>
    <div class="empty-state-actions">
      ${addEquipmentButton}
      <button type="button" class="link-action" data-empty-clear-filters>Clear all filters</button>
    </div>
  `;
}

function positionAssetPanelNearSelection(asset) {
  if (!els.assetPanel) return;
  document.querySelectorAll(".asset-detail-table-row").forEach((row) => row.remove());
  els.assetPanel.classList.remove("floating-asset-panel", "inline-asset-panel");
  els.assetPanel.classList.toggle("asset-side-sheet", Boolean(asset));
  els.assetPanel.classList.remove("is-collapsed");
  els.assetPanel.classList.toggle("hidden", !asset);
  els.assetPanelBackdrop?.classList.toggle("hidden", !asset);
  els.assetPanel.querySelector("[data-panel-body]")?.classList.remove("hidden");
  els.assetPanel.style.top = "";
  if (asset && els.assetPanel.parentElement !== document.body) {
    document.body.appendChild(els.assetPanel);
  }
}

function closeSelectedAssetPanel() {
  selectedId = null;
  clearSelectedAssetUrl();
  if (els.assetPanel) {
    els.assetPanel.classList.add("hidden");
    els.assetPanel.classList.remove("asset-side-sheet", "floating-asset-panel", "inline-asset-panel", "is-collapsed");
    els.assetPanel.style.top = "";
  }
  els.assetPanelBackdrop?.classList.add("hidden");
  closePanelScheduleSheet();
  closePhotoSideBay();
  render();
}

function openEmptyStateEquipmentForm() {
  if (!canAddEquipment()) return;
  closeMetricMenus();
  closeTopActionDrawers(els.quickAddDrawer);
  if (els.quickAddDrawer) {
    els.quickAddDrawer.classList.remove("hidden");
    els.quickAddDrawer.open = true;
    els.quickAddDrawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  els.assetName?.focus({ preventScroll: true });
}

function clearWorkspaceFilters() {
  assetQuery = "";
  globalQuery = "";
  assetStatusFilter = "all";
  assetTemplateFilter = "all";
  assetRegisterTab = "active";
  workOrderViewFilter = "active";
  workOrderNumberFilter = "all";
  focusedWorkOrderId = "";
  focusedServiceRequestId = "";
  focusedCompletedRecordId = "";
  assetPage = 1;
  if (els.assetSearch) els.assetSearch.value = "";
  if (els.globalSearch) els.globalSearch.value = "";
  if (els.globalSearchResults) els.globalSearchResults.classList.add("hidden");
  render();
}

function assetTableAssets() {
  return filteredAssets()
    .filter(matchesAssetSearch)
    .filter(matchesAssetRegisterTab)
    .filter(matchesStatusFilter)
    .filter(matchesTemplateFilter)
    .sort(sortAssetsForTable);
}

function matchesAssetRegisterTab(asset) {
  if (assetRegisterTab === "overdue") return getDueInfo(asset).daysUntil < 0;
  if (assetRegisterTab === "upcoming") return getDueInfo(asset).daysUntil >= 0;
  return true;
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
    getAssetEquipmentId(asset),
    asset.equipmentId,
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

function renderChecklist(template, asset = getSelectedAsset()) {
  const templateItems = template?.items?.length ? template.items : DEFAULT_TEMPLATE_ITEMS;
  const customItems = Array.isArray(asset?.extraChecklistItems) ? asset.extraChecklistItems : [];
  const customStart = templateItems.length;
  const items = [...templateItems, ...customItems];
  const checklistRows = items.map((item, index) => `
    <label class="check-row">
      <input type="checkbox" name="checklist" value="${escapeHtml(item)}">
      <span>${escapeHtml(item)}</span>
      ${index >= customStart ? `<button class="secondary mini danger-action" type="button" data-checklist-remove="${index - customStart}">Remove</button>` : ""}
    </label>
  `).join("");

  els.checklistFields.innerHTML = `
    ${checklistRows}
    <div class="checklist-add-row">
      <input type="text" data-checklist-new-item placeholder="Add checklist item">
      <button class="secondary mini" type="button" data-checklist-add>Add Item</button>
    </div>
  `;
}

function addCustomChecklistItem() {
  if (!canEditEquipment()) return;
  const asset = getSelectedAsset();
  const input = els.pmForm.querySelector("[data-checklist-new-item]");
  const item = input?.value.trim();
  if (!asset || !item) return;

  const template = getTemplate(asset.templateId);
  const existingItems = [
    ...(template?.items?.length ? template.items : DEFAULT_TEMPLATE_ITEMS),
    ...(Array.isArray(asset.extraChecklistItems) ? asset.extraChecklistItems : [])
  ];
  if (existingItems.some((existing) => sameText(existing, item))) {
    input.value = "";
    return;
  }

  asset.extraChecklistItems = [...(Array.isArray(asset.extraChecklistItems) ? asset.extraChecklistItems : []), item];
  asset.updatedAt = new Date().toISOString();
  addActivity("Checklist item added", `${asset.name} - ${item}`);
  saveState();
  renderChecklist(template, asset);
}

function removeCustomChecklistItem(index) {
  if (!canEditEquipment()) return;
  const asset = getSelectedAsset();
  if (!asset || !Array.isArray(asset.extraChecklistItems) || !Number.isInteger(index)) return;
  const removed = asset.extraChecklistItems[index];
  asset.extraChecklistItems.splice(index, 1);
  asset.updatedAt = new Date().toISOString();
  if (removed) addActivity("Checklist item removed", `${asset.name} - ${removed}`);
  saveState();
  renderChecklist(getTemplate(asset.templateId), asset);
}

function renderAssetDetails(asset) {
  const editable = canEditEquipment();
  return ASSET_DETAIL_FIELDS.map((config) => {
    const value = config.field === "equipmentId"
      ? getAssetEquipmentId(asset)
      : String(asset[config.field] || "");
    if (editable && editingAssetDetailField === config.field) {
      return renderInlineAssetDetailEditor(config, value);
    }

    const tag = editable ? "button" : "div";
    const openAttr = editable ? ` type="button" data-asset-detail-open="${escapeAttribute(config.field)}"` : "";
    return `
      <${tag}${openAttr} class="asset-detail-card${editable ? " is-editable" : ""}">
        <span class="label">${escapeHtml(config.label)}</span>
        <strong>${escapeHtml(value || "Not entered")}</strong>
        ${editable ? `<small>Tap to edit</small>` : ""}
      </${tag}>
    `;
  }).join("");
}

function renderElectricalPanelSchedule(asset) {
  if (!els.electricalPanelScheduleDrawer || !els.electricalPanelScheduleContent) return;
  const visible = isElectricalPanelAsset(asset);
  els.electricalPanelScheduleDrawer.classList.toggle("hidden", !visible);
  if (!visible) {
    els.electricalPanelScheduleContent.innerHTML = "";
    if (els.electricalPanelScheduleCount) els.electricalPanelScheduleCount.textContent = "0 circuits";
    return;
  }

  const schedule = getElectricalPanelSchedule(asset);
  if (els.electricalPanelScheduleCount) {
    els.electricalPanelScheduleCount.textContent = `${schedule.circuitCount || 42} circuits`;
  }
  els.electricalPanelScheduleContent.innerHTML = `
    <div class="panel-schedule-preview-actions">
      <p>Open the full panel schedule to edit circuit labels, breaker sizes, and panel specs.</p>
      <div>
        <button type="button" class="secondary mini" data-print-panel-schedule>Print</button>
        <button type="button" class="secondary mini" data-open-panel-schedule>Open Schedule</button>
      </div>
    </div>
    <div class="panel-schedule-overview">
      ${panelScheduleInfoTile("Panel", schedule.panelName)}
      ${panelScheduleInfoTile("Voltage", schedule.voltage)}
      ${panelScheduleInfoTile("Phase", schedule.phase)}
      ${panelScheduleInfoTile("Main breaker", schedule.mainBreaker)}
      ${panelScheduleInfoTile("Circuits", String(schedule.circuitCount || 42))}
    </div>
    <div class="panel-schedule-table-wrap">
      <table class="panel-schedule-table">
        <thead>
          <tr>
            <th>CCT</th>
            <th>Breaker</th>
            <th>Load served</th>
          </tr>
        </thead>
        <tbody>
          ${schedule.circuits.map((circuit) => `
            <tr>
              <td>${escapeHtml(circuit.number)}</td>
              <td>${escapeHtml(circuit.breaker)}</td>
              <td>${escapeHtml(panelCircuitLoadText(circuit) || "-")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function isElectricalPanelAsset(asset) {
  const text = [asset?.type, asset?.name, asset?.model].filter(Boolean).join(" ").toLowerCase();
  return text.includes("electrical panel") || text.includes("panel");
}

function getElectricalPanelSchedule(asset) {
  const savedSchedule = asset?.electricalPanelSchedule;
  if (savedSchedule?.circuits?.length) {
    return {
      panelName: savedSchedule.panelName || asset.name || "Electrical Panel",
      voltage: savedSchedule.voltage || "Not entered",
      phase: savedSchedule.phase || "Not entered",
      mainBreaker: savedSchedule.mainBreaker || "Not entered",
      circuitCount: normalizePanelCircuitCount(savedSchedule.circuitCount || savedSchedule.circuits?.length || 42),
      logo: savedSchedule.logo || null,
      circuits: savedSchedule.circuits
    };
  }

  return {
    panelName: asset?.name || "Electrical Panel",
    voltage: "120/208V",
    phase: "3 phase",
    mainBreaker: "Not entered",
    circuitCount: 42,
    logo: null,
    circuits: [
      { number: "1", load: "Lighting", breaker: "15A", notes: "Confirm label" },
      { number: "2", load: "Receptacles", breaker: "20A", notes: "Confirm label" },
      { number: "3", load: "Mechanical / HVAC", breaker: "30A", notes: "Spare if not used" },
      { number: "4", load: "Spare", breaker: "-", notes: "Available" }
    ]
  };
}

function panelScheduleInfoTile(label, value) {
  return `
    <div class="panel-schedule-info-tile">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "Not entered")}</strong>
    </div>
  `;
}

function openPanelScheduleSheet() {
  const asset = getSelectedAsset();
  if (!asset || !isElectricalPanelAsset(asset) || !els.panelScheduleSheet || !els.panelScheduleForm) return;
  const schedule = getElectricalPanelSchedule(asset);
  els.panelScheduleSheetTitle.textContent = schedule.panelName || asset.name || "Panel Schedule";
  els.panelScheduleSheetMeta.textContent = `${getAssetEquipmentId(asset)} | ${getLocation(asset.locationId)?.name || "Unknown location"}`;
  els.panelScheduleForm.elements.panelName.value = schedule.panelName || "";
  els.panelScheduleForm.elements.voltage.value = schedule.voltage || "";
  els.panelScheduleForm.elements.phase.value = schedule.phase || "";
  els.panelScheduleForm.elements.mainBreaker.value = schedule.mainBreaker || "";
  els.panelScheduleForm.elements.circuitCount.value = schedule.circuitCount || 42;
  els.panelScheduleForm.dataset.logoUrl = mediaSource(schedule.logo) || "";
  els.panelScheduleForm.dataset.logoName = schedule.logo?.name || "";
  if (els.panelScheduleLogoInput) els.panelScheduleLogoInput.value = "";
  renderPanelScheduleLogoPreview(schedule.logo || null);
  els.panelScheduleCircuitRows.innerHTML = "";
  schedule.circuits.forEach((circuit) => addPanelScheduleEditorRow(circuit));
  els.panelScheduleForm.querySelectorAll("input, button").forEach((control) => {
    if (control.matches("[data-close-panel-schedule]")) return;
    if (control.id === "printPanelScheduleBtn") return;
    if (control.id === "removePanelScheduleLogoBtn") return;
    control.disabled = !canEditEquipment();
  });
  els.panelScheduleBackdrop?.classList.remove("hidden");
  els.panelScheduleSheet.classList.remove("hidden");
}

function closePanelScheduleSheet() {
  els.panelScheduleBackdrop?.classList.add("hidden");
  els.panelScheduleSheet?.classList.add("hidden");
}

function addPanelScheduleEditorRow(circuit = {}) {
  if (!els.panelScheduleCircuitRows) return;
  const row = document.createElement("div");
  row.className = "panel-schedule-editor-row";
  row.dataset.panelCircuitRow = "true";
  row.innerHTML = `
    <label>
      CCT
      <input name="circuitNumber" value="${escapeAttribute(circuit.number || "")}" placeholder="1">
    </label>
    <label>
      Breaker
      <input name="circuitBreaker" value="${escapeAttribute(circuit.breaker || "")}" placeholder="20A">
    </label>
    <label>
      Load served
      <input name="circuitLoad" value="${escapeAttribute(panelCircuitLoadText(circuit))}" placeholder="Lighting">
    </label>
    <button type="button" class="secondary mini danger-action" data-remove-panel-circuit>Remove</button>
  `;
  els.panelScheduleCircuitRows.appendChild(row);
}

function removePanelScheduleEditorRow(row) {
  if (!row) return;
  row.remove();
}

async function importPanelScheduleCsv() {
  if (!canEditEquipment() || !els.panelScheduleCsvInput || !els.panelScheduleCircuitRows) return;
  const file = els.panelScheduleCsvInput.files?.[0];
  if (!file) {
    setPanelScheduleImportStatus("Choose a CSV file first.");
    alert("Choose a CSV file first.");
    return;
  }

  const importButton = els.importPanelScheduleCsvBtn;
  if (importButton) {
    importButton.disabled = true;
    importButton.textContent = "Importing...";
  }

  try {
    setPanelScheduleImportStatus("Reading CSV...");
    const text = await file.text();
    const circuits = parsePanelScheduleCsvCircuits(text);

    if (!circuits.length) {
      setPanelScheduleImportStatus("No circuit rows were found in that CSV.");
      alert("No circuit rows were found in that CSV.");
      return;
    }

    els.panelScheduleCircuitRows.innerHTML = "";
    circuits.forEach((circuit) => addPanelScheduleEditorRow(circuit));
    const maxCircuit = circuits.reduce((max, circuit) => {
      const numeric = Number(String(circuit.number || "").replace(/\D/g, ""));
      return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
    }, circuits.length);
    if (els.panelScheduleForm?.elements.circuitCount) {
      els.panelScheduleForm.elements.circuitCount.value = normalizePanelCircuitCount(maxCircuit);
    }
    setPanelScheduleImportStatus(`Imported ${circuits.length} circuit row${circuits.length === 1 ? "" : "s"}. Save the schedule to keep them.`);
    els.panelScheduleCsvInput.value = "";
  } catch (error) {
    console.warn("Panel schedule CSV import failed.", error);
    setPanelScheduleImportStatus("Import failed. Check that this is a valid CSV file.");
    alert("Import failed. Check that this is a valid CSV file.");
  } finally {
    if (importButton) {
      importButton.disabled = false;
      importButton.textContent = "Import CSV";
    }
  }
}

function setPanelScheduleImportStatus(message) {
  if (els.panelScheduleImportStatus) els.panelScheduleImportStatus.textContent = message;
}

function parsePanelScheduleCsvCircuits(text) {
  const records = parseCsvRecords(text);
  if (!records.length) return [];
  const firstRecord = records[0] || [];
  const normalizedHeaders = firstRecord.map(normalizeCsvHeader);
  const hasHeader = normalizedHeaders.some((header) => [
    "circuit",
    "cct",
    "circuit number",
    "circuit no",
    "breaker",
    "breaker size",
    "load",
    "load served",
    "description",
    "notes"
  ].includes(header));
  return hasHeader
    ? parsePanelScheduleNamedCsvRows(records, normalizedHeaders)
    : parsePanelSchedulePlainCsvRows(records);
}

function parsePanelScheduleNamedCsvRows(records, headers) {
  return records.slice(1)
    .map((record, index) => {
      const row = {};
      headers.forEach((header, columnIndex) => {
        if (!header) return;
        row[header] = String(record[columnIndex] || "").trim();
      });
      const number = findCsvValue(row, ["circuit", "cct", "circuit number", "circuit no", "breaker number", "breaker no", "#"]) || String(index + 1);
      const load = findCsvValue(row, ["load", "load served", "description", "circuit description", "label", "name"]);
      const notes = findCsvValue(row, ["notes", "note", "remarks", "comments"]);
      return {
        number,
        load: mergePanelCircuitLoad(load, notes),
        breaker: findCsvValue(row, ["breaker", "breaker size", "amps", "amp", "amperage", "rating"]),
        notes: ""
      };
    })
    .filter((circuit) => circuit.number || circuit.load || circuit.breaker);
}

function parsePanelSchedulePlainCsvRows(records) {
  return records
    .map((record, index) => {
      const cells = record.map((cell) => String(cell || "").trim());
      return {
        number: cells[0] || String(index + 1),
        breaker: cells[1] || "",
        load: cells.slice(2).filter(Boolean).join(" - "),
        notes: ""
      };
    })
    .filter((circuit) => circuit.number || circuit.load || circuit.breaker);
}

function getNextPanelCircuitNumber() {
  if (!els.panelScheduleCircuitRows) return "1";
  const usedNumbers = [...els.panelScheduleCircuitRows.querySelectorAll('[name="circuitNumber"]')]
    .map((input) => Number(input.value))
    .filter((value) => Number.isFinite(value) && value > 0);
  const maxNumber = usedNumbers.length ? Math.max(...usedNumbers) : 0;
  return String(maxNumber + 1);
}

function normalizePanelCircuitCount(value) {
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) && numeric > 0 ? Math.ceil(numeric) : 42;
  const even = safe % 2 === 0 ? safe : safe + 1;
  return Math.min(132, Math.max(2, even));
}

function panelCircuitLoadText(circuit = {}) {
  return mergePanelCircuitLoad(circuit.load, circuit.notes);
}

function mergePanelCircuitLoad(load, notes) {
  const cleanLoad = String(load || "").trim();
  const cleanNotes = String(notes || "").trim();
  if (cleanLoad && cleanNotes && !cleanLoad.includes(cleanNotes)) return `${cleanLoad} - ${cleanNotes}`;
  return cleanLoad || cleanNotes;
}

function savePanelScheduleEditor() {
  const asset = getSelectedAsset();
  if (!asset || !els.panelScheduleForm || !canEditEquipment()) return;
  const form = els.panelScheduleForm;
  const circuits = [...els.panelScheduleCircuitRows.querySelectorAll("[data-panel-circuit-row]")]
    .map((row) => ({
      number: row.querySelector('[name="circuitNumber"]')?.value.trim() || "",
      load: row.querySelector('[name="circuitLoad"]')?.value.trim() || "",
      breaker: row.querySelector('[name="circuitBreaker"]')?.value.trim() || "",
      notes: ""
    }))
    .filter((circuit) => circuit.number || circuit.load || circuit.breaker || circuit.notes);

  asset.electricalPanelSchedule = {
    panelName: form.elements.panelName.value.trim() || asset.name,
    voltage: form.elements.voltage.value.trim(),
    phase: form.elements.phase.value.trim(),
    mainBreaker: form.elements.mainBreaker.value.trim(),
    circuitCount: normalizePanelCircuitCount(form.elements.circuitCount.value),
    logo: form.dataset.logoUrl ? {
      url: form.dataset.logoUrl,
      name: form.dataset.logoName || "Company logo"
    } : null,
    circuits
  };
  asset.updatedAt = new Date().toISOString();
  addActivity("Electrical panel schedule updated", asset.name);
  saveState();
  closePanelScheduleSheet();
  render();
}

function renderPanelScheduleLogoPreview(logo) {
  if (!els.panelScheduleLogoPreview) return;
  const logoSrc = mediaSource(logo);
  els.panelScheduleLogoPreview.innerHTML = logoSrc
    ? `<img alt="${escapeAttribute(logo.name || "Company logo")}" src="${escapeAttribute(logoSrc)}"><span>${escapeHtml(logo.name || "Company logo")}</span>`
    : "No logo uploaded";
}

function printPanelSchedule() {
  const asset = getSelectedAsset();
  if (!asset || !isElectricalPanelAsset(asset)) return;
  const schedule = getCurrentPanelScheduleForPrint(asset);
  const customer = getCustomer(asset.customerId);
  const locationRecord = getLocation(asset.locationId);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("The print window was blocked. Allow pop-ups for SiteWorks and try again.");
    return;
  }
  const rows = buildPanelSchedulePrintRows(schedule.circuits, schedule.circuitCount).map(({ left, right }) => `
    <tr>
      ${printPanelCircuitCells(left)}
      ${printPanelCircuitCells(right)}
    </tr>
  `).join("");
  const logoSrc = mediaSource(schedule.logo);
  const logoHtml = logoSrc
    ? `<div class="print-logo"><img alt="${escapeAttribute(schedule.logo.name || "Company logo")}" src="${escapeAttribute(logoSrc)}"></div>`
    : `<div class="print-logo print-logo-empty">Company<br>Logo</div>`;
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(schedule.panelName)} Panel Schedule</title>
        <style>
          @page { size: letter portrait; margin: 0.35in; }
          * { box-sizing: border-box; }
          body { margin: 0; color: #111; font-family: Arial, Helvetica, sans-serif; }
          .sheet { width: 100%; border: 2px solid #111; }
          .title { display: grid; grid-template-columns: 128px 1fr auto; align-items: stretch; border-bottom: 2px solid #111; }
          .print-logo { display: flex; align-items: center; justify-content: center; min-height: 96px; padding: 8px; border-right: 2px solid #111; }
          .print-logo img { max-width: 108px; max-height: 78px; object-fit: contain; }
          .print-logo-empty { color: #666; font-size: 11px; font-weight: 800; line-height: 1.2; text-align: center; text-transform: uppercase; }
          .title-main { padding: 10px 12px; text-align: center; }
          .title-main h1 { margin: 0; font-size: 24px; letter-spacing: 0.08em; text-transform: uppercase; }
          .title-main p { margin: 4px 0 0; font-size: 11px; font-weight: 700; text-transform: uppercase; }
          .qr { width: 92px; padding: 7px; border-left: 2px solid #111; text-align: center; }
          .qr img { width: 74px; height: 74px; display: block; margin: 0 auto 4px; }
          .qr span { display: block; font-size: 8px; font-weight: 700; }
          .meta { display: grid; grid-template-columns: repeat(3, 1fr); border-bottom: 2px solid #111; }
          .meta div { min-height: 44px; padding: 6px 8px; border-right: 1px solid #111; }
          .meta div:nth-child(3n) { border-right: 0; }
          .meta span { display: block; font-size: 8px; font-weight: 800; text-transform: uppercase; }
          .meta strong { display: block; margin-top: 4px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          col.circuit-col, col.breaker-col { width: 6%; }
          col.load-col { width: 38%; }
          th, td { border: 1px solid #111; padding: 3px 4px; vertical-align: middle; }
          th { background: #e7e7e7; font-size: 9px; letter-spacing: 0.04em; text-transform: uppercase; }
          td { height: 24px; font-size: 10px; }
          .circuit-no, .breaker { text-align: center; font-weight: 800; }
          .load { font-weight: 700; }
          .footer { display: grid; grid-template-columns: 1fr 1fr 1fr; border-top: 2px solid #111; }
          .footer div { min-height: 34px; padding: 6px 8px; border-right: 1px solid #111; font-size: 9px; }
          .footer div:last-child { border-right: 0; }
          .footer span { display: block; font-weight: 800; text-transform: uppercase; }
          .no-print { margin: 0 0 10px; }
          .no-print button { padding: 9px 12px; border: 1px solid #111; background: #fff; font-weight: 800; cursor: pointer; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print"><button onclick="window.print()">Print / Save PDF</button></div>
        <section class="sheet">
          <div class="title">
            ${logoHtml}
            <div class="title-main">
              <h1>Panel Schedule</h1>
              <p>${escapeHtml(schedule.panelName || asset.name)}</p>
            </div>
            <div class="qr">
              <img alt="Equipment QR code" src="${qrUrl(getAssetUrl(asset.id))}">
              <span>Scan for SiteWorks record</span>
            </div>
          </div>
          <div class="meta">
            ${printPanelMetaCell("Customer", customer?.name || "Not entered")}
            ${printPanelMetaCell("Location", locationRecord?.name || "Not entered")}
            ${printPanelMetaCell("Equipment ID", getAssetEquipmentId(asset))}
            ${printPanelMetaCell("Panel", schedule.panelName || asset.name)}
            ${printPanelMetaCell("Voltage", schedule.voltage || "Not entered")}
            ${printPanelMetaCell("Phase", schedule.phase || "Not entered")}
            ${printPanelMetaCell("Main breaker", schedule.mainBreaker || "Not entered")}
            ${printPanelMetaCell("Circuits", String(schedule.circuitCount || 42))}
            ${printPanelMetaCell("Generated", formatDate(new Date()))}
          </div>
          <table>
            <colgroup>
              <col class="circuit-col"><col class="breaker-col"><col class="load-col">
              <col class="circuit-col"><col class="breaker-col"><col class="load-col">
            </colgroup>
            <thead>
              <tr>
                <th>CCT</th><th>Breaker</th><th>Load Served</th>
                <th>CCT</th><th>Breaker</th><th>Load Served</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="footer">
            <div><span>Prepared by</span> SiteWorks</div>
            <div><span>Checked by</span></div>
            <div><span>Revision / date</span></div>
          </div>
        </section>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function getCurrentPanelScheduleForPrint(asset) {
  const schedule = getElectricalPanelSchedule(asset);
  if (!els.panelScheduleSheet || els.panelScheduleSheet.classList.contains("hidden") || !els.panelScheduleForm) return schedule;
  const form = els.panelScheduleForm;
  return {
    panelName: form.elements.panelName.value.trim() || schedule.panelName,
    voltage: form.elements.voltage.value.trim() || schedule.voltage,
    phase: form.elements.phase.value.trim() || schedule.phase,
    mainBreaker: form.elements.mainBreaker.value.trim() || schedule.mainBreaker,
    circuitCount: normalizePanelCircuitCount(form.elements.circuitCount.value || schedule.circuitCount),
    logo: form.dataset.logoUrl ? {
      url: form.dataset.logoUrl,
      name: form.dataset.logoName || "Company logo"
    } : null,
    circuits: [...els.panelScheduleCircuitRows.querySelectorAll("[data-panel-circuit-row]")]
      .map((row) => ({
        number: row.querySelector('[name="circuitNumber"]')?.value.trim() || "",
        load: row.querySelector('[name="circuitLoad"]')?.value.trim() || "",
        breaker: row.querySelector('[name="circuitBreaker"]')?.value.trim() || "",
        notes: ""
      }))
      .filter((circuit) => circuit.number || circuit.load || circuit.breaker || circuit.notes)
  };
}

function buildPanelSchedulePrintRows(circuits = [], circuitCount = 42) {
  const byNumber = new Map(circuits.map((circuit) => [String(circuit.number || "").trim(), circuit]));
  const rowCount = normalizePanelCircuitCount(circuitCount) / 2;
  return Array.from({ length: rowCount }, (_, index) => {
    const leftNumber = String(index * 2 + 1);
    const rightNumber = String(index * 2 + 2);
    return {
      left: byNumber.get(leftNumber) || { number: leftNumber, load: "", breaker: "", notes: "" },
      right: byNumber.get(rightNumber) || { number: rightNumber, load: "", breaker: "", notes: "" }
    };
  });
}

function printPanelCircuitCells(circuit) {
  return `
    <td class="circuit-no">${escapeHtml(circuit.number || "")}</td>
    <td class="breaker">${escapeHtml(circuit.breaker || "")}</td>
    <td class="load">${escapeHtml(panelCircuitLoadText(circuit))}</td>
  `;
}

function printPanelMetaCell(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "")}</strong></div>`;
}

function renderInlineAssetDetailEditor(config, value) {
  const control = config.kind === "select"
    ? `<select name="value" autofocus>
        ${(config.options || []).map((option) => `
          <option value="${escapeAttribute(option)}" ${value === option ? "selected" : ""}>${escapeHtml(option || "Not set")}</option>
        `).join("")}
      </select>`
    : config.kind === "textarea"
      ? `<textarea name="value" rows="3" autofocus placeholder="${escapeAttribute(config.placeholder || "")}">${escapeHtml(value)}</textarea>`
      : `<input name="value" type="${config.kind === "date" ? "date" : "text"}" value="${escapeAttribute(value)}" autofocus placeholder="${escapeAttribute(config.placeholder || "")}">`;

  return `
    <form class="asset-detail-card asset-detail-card-editor" data-asset-detail-edit="${escapeAttribute(config.field)}">
      <span class="label">${escapeHtml(config.label)}</span>
      ${control}
      <div class="asset-detail-edit-actions">
        <button type="submit" class="primary mini">Save</button>
        <button type="button" class="secondary mini" data-asset-detail-cancel>Cancel</button>
      </div>
    </form>
  `;
}

function saveInlineAssetDetail(field, value) {
  const asset = getSelectedAsset();
  const config = ASSET_DETAIL_FIELDS.find((item) => item.field === field);
  if (!asset || !config || !canEditEquipment()) return;

  const nextValue = String(value || "").trim();
  if (config.kind === "select" && nextValue && !(config.options || []).includes(nextValue)) return;

  asset[field] = nextValue;
  asset.updatedAt = new Date().toISOString();
  editingAssetDetailField = "";
  addActivity("Equipment detail updated", `${asset.name} - ${config.label}`);
  saveState();
  render();
}

function closeInlineAssetDetailEditor() {
  if (!editingAssetDetailField) return;
  editingAssetDetailField = "";
  render();
}

function openInlineAssetDetailEditor(field) {
  if (!canEditEquipment()) return;
  if (!ASSET_DETAIL_FIELDS.some((item) => item.field === field)) return;
  editingAssetDetailField = field;
  render();
  requestAnimationFrame(() => {
    const editor = document.querySelector(`[data-asset-detail-edit="${CSS.escape(field)}"]`);
    const input = editor?.querySelector("input, select, textarea");
    input?.focus();
    if (input?.select && input.tagName !== "SELECT") input.select();
  });
}

function renderAssetManual(asset) {
  const manualSrc = mediaSource(asset.manualFile);
  const uploadedManual = manualSrc ? `
    <a class="manual-link" href="${escapeAttribute(manualSrc)}" target="_blank" rel="noopener">
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
  const photoSrc = mediaSource(asset.photo);
  if (!photoSrc) {
    return `<div class="asset-photo-empty">No equipment photo uploaded.</div>`;
  }
  return `
    <figure class="asset-photo-card">
      <button type="button" class="photo-open-button" data-view-photo data-photo-src="${escapeAttribute(photoSrc)}" data-photo-caption="${escapeAttribute(asset.photo.name || "Primary equipment photo")}">
        <img alt="Photo of ${escapeHtml(asset.name)}" src="${escapeAttribute(photoSrc)}">
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
  const photoSrc = mediaSource(photo);
  if (!photoSrc) return "";
  return `
    <button type="button" class="asset-gallery-item" data-view-photo data-photo-src="${escapeAttribute(photoSrc)}" data-photo-caption="${escapeAttribute(photo.name || `Equipment photo ${index + 1}`)}">
      <img alt="Equipment gallery photo ${index + 1}" src="${escapeAttribute(photoSrc)}">
      <span>${escapeHtml(photo.name || `Photo ${index + 1}`)}</span>
    </button>
  `;
}

function renderAssetThumbnail(asset) {
  const photoSrc = mediaSource(asset.photo);
  if (!photoSrc) {
    return `<span>No photo</span>`;
  }
  return `<img alt="Photo of ${escapeHtml(asset.name)}" src="${escapeAttribute(photoSrc)}">`;
}

function openPhotoViewer(src, caption) {
  if (!src) return;
  const activeDrawer = getActivePhotoDrawer();
  if (activeDrawer) {
    openPhotoSideBay(src, activeDrawer);
    closePhotoViewer();
    return;
  }
  els.photoViewerImage.src = src;
  els.photoViewerCaption.textContent = caption || "Equipment photo";
  els.photoViewer.classList.remove("hidden");
}

function closePhotoViewer() {
  els.photoViewer.classList.add("hidden");
  els.photoViewerImage.removeAttribute("src");
  els.photoViewerCaption.textContent = "";
}

function getActivePhotoDrawer() {
  const workDrawer = document.querySelector(".work-order-drawer[open]:not(.completed-pm-item)");
  if (workDrawer) return workDrawer;
  if (els.assetPanel && !els.assetPanel.classList.contains("hidden") && els.assetPanel.classList.contains("asset-side-sheet")) {
    return els.assetPanel;
  }
  return null;
}

function openPhotoSideBay(src, drawer) {
  if (!els.photoSideBay || !els.photoSideBayImage || !drawer) return;
  positionPhotoSideBay(drawer);
  els.photoSideBayImage.src = src;
  els.photoSideBay.classList.remove("hidden");
}

function positionPhotoSideBay(drawer) {
  if (!els.photoSideBay || !drawer) return;
  const rect = drawer.getBoundingClientRect();
  const rightOffset = Math.max(0, window.innerWidth - rect.left);
  els.photoSideBay.style.setProperty("--photo-bay-right", `${Math.round(rightOffset)}px`);
}

function closePhotoSideBay() {
  if (!els.photoSideBay || !els.photoSideBayImage) return;
  els.photoSideBay.classList.add("hidden");
  els.photoSideBayImage.removeAttribute("src");
  els.photoSideBay.style.removeProperty("--photo-bay-right");
}

function renderAssetInfoForm(asset) {
  els.editAssetName.value = asset.name || "";
  els.editAssetEquipmentId.value = asset.equipmentId || "";
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
  const itemPhotoSrc = mediaSource(item.photo);
  const photo = itemPhotoSrc ? `
    <button type="button" class="history-photo-button" data-view-photo data-photo-src="${escapeAttribute(itemPhotoSrc)}" data-photo-caption="${escapeAttribute(item.photo.name || "PM evidence photo")}">
      <img class="history-photo" alt="PM evidence photo" src="${escapeAttribute(itemPhotoSrc)}">
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
  const ageLabel = formatOpenTicketAge(item);
  const createdLabel = item.createdAt ? formatDate(new Date(item.createdAt)) : "Not recorded";
  const issueNumber = formatIssueNumber(item);
  const canManage = canManageWorkOrders();
  const canDelete = canDeleteWorkOrders();
  const canWork = canWorkOnTicket(item);
  const assignmentControl = renderWorkOrderAssignmentControl(item);
  const compactAssignmentControl = renderCompactWorkOrderAssignmentControl(item);
  const targetLabel = asset?.name || item.areaName || "Area report";
  const targetKind = asset ? "Equipment" : "Area";
  const assetAction = asset
    ? `<button class="secondary mini" type="button" data-asset-link="${item.assetId}">View Equipment</button>`
    : "";
  const canEditTicket = canManageWorkOrders();
  const editAction = canWork ? `
    <details class="inline-edit-drawer" data-ticket-edit-drawer>
      <summary>${canEditTicket ? "Edit Ticket" : "Add Note"}</summary>
      ${renderWorkOrderEditForm(item)}
    </details>
  ` : "";
  const secondaryActions = canWork ? `
    <button class="secondary mini" type="button" data-work-order-pdf="${escapeAttribute(item.id)}">PDF Form</button>
    <button class="secondary mini" type="button" data-work-order-email="${escapeAttribute(item.id)}">Email Ticket</button>
    <button class="secondary mini" type="button" data-work-order-send-pdf="${escapeAttribute(item.id)}">Send PDF Email</button>
  ` : "";
  const primaryActions = item.status === "Closed" ? `
    ${canEditTicket ? `<button class="secondary mini" type="button" data-open-ticket-edit>Edit</button>` : ""}
    ${canManage ? `<button class="secondary mini" data-work-order-id="${item.id}" data-work-order-action="Open">Reopen</button>` : ""}
  ` : `
    ${canEditTicket ? `<button class="secondary mini" type="button" data-open-ticket-edit>Edit</button>` : ""}
    ${canWork && item.status === "Open" ? `<button class="secondary mini" data-work-order-id="${item.id}" data-work-order-action="In progress">Start</button>` : ""}
    ${canWork && item.status !== "Resolved" ? `<button class="secondary mini" data-work-order-id="${item.id}" data-work-order-action="Resolved">Resolve</button>` : ""}
    ${canManage ? `<button class="secondary mini" data-work-order-id="${item.id}" data-work-order-action="Closed">Close</button>` : ""}
  `;
  const moreActions = `
    ${secondaryActions}
    ${canWork && item.status !== "Waiting parts" && item.status !== "Closed" ? `<button class="secondary mini" data-work-order-id="${item.id}" data-work-order-action="Waiting parts">Waiting Parts</button>` : ""}
    ${canManage && item.status !== "Closed" ? `<button class="secondary mini" data-work-order-convert-service="${escapeAttribute(item.id)}">Convert to Service Request</button>` : ""}
    ${canDelete ? `<button class="secondary mini danger-action" data-work-order-delete="${escapeAttribute(item.id)}">Delete</button>` : ""}
  `;
  const headerActions = primaryActions.trim() || moreActions.trim() ? `
    <div class="ticket-header-actions">
      ${primaryActions}
      ${moreActions.trim() ? `
        <details class="ticket-action-menu">
          <summary>More</summary>
          <div class="ticket-action-menu-list">
            ${moreActions}
          </div>
        </details>
      ` : ""}
    </div>
  ` : "";
  const statusClass = item.status === "Closed"
    ? "badge-muted"
    : item.status === "Waiting parts"
      ? "badge-warn"
      : item.status === "Resolved"
        ? "badge-ok"
        : item.priority === "High"
          ? "badge-danger"
        : "badge-warn";
  const firstPhoto = mediaSource(getWorkOrderPhotos(item)[0]) || mediaSource(asset?.photo) || "";
  const profileBadges = [
    `<span class="drawer-param-badge ${statusClass}">${escapeHtml(item.status)}</span>`,
    `<span class="drawer-param-badge ${item.priority === "High" ? "badge-danger" : "badge-warn"}">${escapeHtml(item.priority)} priority</span>`,
    `<span class="drawer-param-badge badge-muted">Created ${escapeHtml(createdLabel)}</span>`,
    `<span class="drawer-param-badge badge-muted">Due ${escapeHtml(formatDate(new Date(item.dueAt)))}</span>`
  ].join("");
  const drawerProfile = renderWorkDrawerProfile({
    title: `${issueNumber} - ${item.title || "Open ticket"}`,
    systemId: `${targetKind}: ${targetLabel}`,
    context: `${targetLabel} | ${customer?.name || "Unknown customer"} | ${locationRecord?.name || "Unknown location"}`,
    imageSrc: firstPhoto,
    fallback: "SW",
    badges: profileBadges
  });
  return `
    <details class="work-order-item work-order-drawer ticket-drawer-item" ${item.id === focusedWorkOrderId ? "open" : ""}>
      <summary>
        <div class="ticket-list-summary">
          <strong>${escapeHtml(issueNumber)} - ${escapeHtml(item.title || "Open ticket")}</strong>
          <span>${escapeHtml(targetLabel)} | ${escapeHtml(customer?.name || "Unknown customer")} | ${escapeHtml(locationRecord?.name || "Unknown location")}</span>
          <div class="ticket-list-badges">${profileBadges}</div>
        </div>
        <div class="ticket-summary-tools">
          ${ageLabel ? `<span class="history-open-label">${escapeHtml(ageLabel)}</span>` : ""}
          ${headerActions}
          <button type="button" class="secondary mini ticket-drawer-close" data-close-work-drawer aria-label="Close ticket drawer">X</button>
        </div>
      </summary>
      <div class="ticket-drawer-body">
        <section class="ticket-profile-card">
          ${drawerProfile}
        </section>
        <details class="ticket-sub-drawer" open>
          <summary>
            <h3>Description</h3>
            <span>${escapeHtml(issueNumber)}</span>
          </summary>
          <section class="ticket-open-description">
            <p>${escapeHtml(item.title || "No description entered.")}</p>
          </section>
        </details>
        <details class="ticket-sub-drawer" open>
          <summary>
            <h3>Activity & Notes</h3>
            <span>${workOrderHistoryEntries(item).length + (String(item.notes || "").trim() ? 1 : 0) + getWorkOrderPhotos(item).length}</span>
          </summary>
          ${renderTicketActivityTimeline(item, false)}
        </details>
        <details class="ticket-sub-drawer">
          <summary>
            <h3>Ticket Meta</h3>
            <span>${escapeHtml(assignedLabel)}</span>
          </summary>
          <div class="ticket-meta-list ticket-spec-grid">
            <div class="ticket-spec-row ticket-assignment-panel compact-panel">
              <span>Assigned to</span>
              <div>
                <strong>${escapeHtml(assignedLabel)}</strong>
                ${compactAssignmentControl}
              </div>
            </div>
            <div class="service-request-meta-row">
              <span>Customer</span>
              <strong>${escapeHtml(customer?.name || "Unknown customer")}</strong>
            </div>
            <div class="service-request-meta-row">
              <span>Location</span>
              <strong>${escapeHtml(locationRecord?.name || "Unknown location")}</strong>
            </div>
            <div class="service-request-meta-row">
              <span>${escapeHtml(targetKind)}</span>
              <strong>${escapeHtml(targetLabel)}</strong>
            </div>
          </div>
          ${assetAction ? `<div class="work-order-header-actions">${assetAction}</div>` : ""}
        </details>
        ${editAction}
      </div>
    </details>
  `;
}

function getWorkOrderPhotos(item) {
  const photos = [];
  if (hasMedia(item.photo)) {
    photos.push({
      ...item.photo,
      label: "Submitted photo",
      caption: item.photo.name || "Submitted ticket photo"
    });
  }
  if (Array.isArray(item.photos)) {
    item.photos.forEach((photo, index) => {
      if (!hasMedia(photo)) return;
      const addedLabel = photo.addedAt ? ` - ${formatDateTime(new Date(photo.addedAt))}` : "";
      photos.push({
        ...photo,
        label: `Work photo ${index + 1}`,
        caption: `${photo.name || `Work photo ${index + 1}`}${addedLabel}`
      });
    });
  }
  return photos;
}

function renderTicketActivityTimeline(item, showHeading = true) {
  const entries = workOrderHistoryEntries(item);
  const photos = getWorkOrderPhotos(item);
  const notes = String(item.notes || "").trim();
  const createdAt = item.createdAt || new Date().toISOString();
  const createdBy = item.source || item.assignedUserName || "System";
  return `
    <section class="ticket-activity-stream">
      ${showHeading ? `<div class="ticket-stream-heading">
        <span>Activity & Notes</span>
        <strong>${entries.length + (notes ? 1 : 0) + photos.length}</strong>
      </div>` : ""}
      ${renderQuickAddNoteBox(item)}
      <div class="ticket-timeline">
        ${notes ? `
          <article class="ticket-timeline-entry">
            <div class="ticket-timeline-avatar">${escapeHtml(getInitials(createdBy))}</div>
            <div class="ticket-timeline-bubble">
              <header>
                <strong>Work notes</strong>
                <span>${escapeHtml(formatDateTime(new Date(createdAt)))}</span>
              </header>
              <p>${escapeHtml(notes)}</p>
            </div>
          </article>
        ` : `
          <article class="ticket-timeline-entry">
            <div class="ticket-timeline-avatar">SW</div>
            <div class="ticket-timeline-bubble">
              <header>
                <strong>Work notes</strong>
                <span>${escapeHtml(formatDateTime(new Date(createdAt)))}</span>
              </header>
              <p>No notes entered.</p>
            </div>
          </article>
        `}
        ${photos.map((photo, index) => `
          <article class="ticket-timeline-entry">
            <div class="ticket-timeline-avatar">P${index + 1}</div>
            <div class="ticket-timeline-bubble">
              <header>
                <strong>${escapeHtml(photo.label || "Submitted photo")}</strong>
                <span>${escapeHtml(photo.addedAt ? formatDateTime(new Date(photo.addedAt)) : formatDateTime(new Date(createdAt)))}</span>
              </header>
              <button type="button" class="history-photo-button ticket-photo-card timeline-photo-card" data-view-photo data-photo-src="${escapeAttribute(mediaSource(photo))}" data-photo-caption="${escapeAttribute(photo.caption || photo.name || "Ticket photo")}">
                <img class="history-photo" alt="${escapeAttribute(photo.label || "Ticket photo")}" src="${escapeAttribute(mediaSource(photo))}">
                <span>${escapeHtml(photo.name || photo.label || "Submitted photo")}</span>
              </button>
            </div>
          </article>
        `).join("")}
        ${entries.map((entry) => `
          <article class="ticket-timeline-entry ticket-system-entry">
            <div class="ticket-system-icon" aria-hidden="true"></div>
            <div class="ticket-system-line">
              <strong>${escapeHtml(entry.action || "Updated")}</strong>
              <span>${escapeHtml(formatDateTime(new Date(entry.createdAt || createdAt)))}</span>
              ${entry.details ? `<p>${escapeHtml(entry.details)}</p>` : ""}
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderQuickAddNoteBox(item) {
  if (!canWorkOnTicket(item)) return "";
  const inputId = `quick-note-photo-${escapeAttribute(item.id)}`;
  return `
    <form class="quick-note-box" data-work-order-quick-note-form="${escapeAttribute(item.id)}">
      <textarea name="note" rows="3" placeholder="Type a work note or update..."></textarea>
      <input id="${inputId}" class="hidden-input" type="file" name="photo" accept="image/*">
      <div class="quick-note-tools">
        <div class="quick-note-icons" aria-label="Note attachments">
          <label class="quick-note-icon" for="${inputId}" title="Attach file" aria-label="Attach file">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.4 11.6 12 21a6 6 0 0 1-8.5-8.5l9.8-9.8a4.2 4.2 0 0 1 6 6L9.6 18.4a2.4 2.4 0 1 1-3.4-3.4l8.9-8.9"/></svg>
          </label>
          <label class="quick-note-icon" for="${inputId}" title="Upload photo" aria-label="Upload photo">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l1.4-2h7.2L17 7h3v13H4z"/><circle cx="12" cy="13.5" r="3.5"/></svg>
          </label>
        </div>
        <button class="primary mini" type="submit">Post Note</button>
      </div>
    </form>
  `;
}

function getInitials(value) {
  const parts = String(value || "SW").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "SW";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function renderWorkOrderPhotos(item) {
  const photos = getWorkOrderPhotos(item);
  if (!photos.length) {
    return `
      <div class="ticket-photo-gallery ticket-photo-empty" aria-label="Ticket photos">
        <span>Submitted photos</span>
        <p class="muted">No submitted photos.</p>
      </div>
    `;
  }
  return `
    <div class="ticket-photo-gallery" aria-label="Ticket photos">
      ${photos.map((photo) => `
        <button type="button" class="history-photo-button ticket-photo-card" data-view-photo data-photo-src="${escapeAttribute(mediaSource(photo))}" data-photo-caption="${escapeAttribute(photo.caption)}">
          <img class="history-photo" alt="${escapeAttribute(photo.label)}" src="${escapeAttribute(mediaSource(photo))}">
          <span>${escapeHtml(photo.label)}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderWorkOrderEditForm(item) {
  const canEditTicket = canManageWorkOrders();
  const priorities = ["Low", "Medium", "High"];
  const statuses = ["Open", "In progress", "Waiting parts", "Resolved", "Closed"];
  const dueValue = item.dueAt ? toDateInputValue(new Date(item.dueAt)) : "";
  return `
    <form class="inline-edit-form compact-form" data-work-order-edit-form="${escapeAttribute(item.id)}">
      ${canEditTicket ? `
        <div class="form-grid">
          <label>
            Ticket title
            <input name="title" value="${escapeAttribute(item.title || "")}" required>
          </label>
          <label>
            Priority
            <select name="priority">
              ${priorities.map((priority) => `<option value="${priority}" ${item.priority === priority ? "selected" : ""}>${priority}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="form-grid">
          <label>
            Status
            <select name="status">
              ${statuses.map((status) => `<option value="${status}" ${item.status === status ? "selected" : ""}>${status}</option>`).join("")}
            </select>
          </label>
          <label>
            Due date
            <input name="dueDate" type="date" value="${escapeAttribute(dueValue)}">
          </label>
        </div>
      ` : ""}
      <label>
        Add work note
        <textarea name="notes" rows="3" placeholder="Add a progress update. Date and user will be added automatically."></textarea>
      </label>
      <label>
        Add work photo
        <input name="photo" type="file" accept="image/*">
      </label>
      <div class="work-order-actions">
        <button class="primary" type="submit">${canEditTicket ? "Save Ticket" : "Save Note / Photo"}</button>
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

function renderCompactWorkOrderAssignmentControl(item) {
  if (!canManageWorkOrders()) return "";
  const users = getAssignableUsersForWorkOrder(item);
  const selectedAssigneeId = getSelectedAssigneeId(item, users);
  const options = [
    `<option value="">Unassigned</option>`,
    ...users.map((user) =>
      `<option value="${escapeAttribute(user.id)}" ${selectedAssigneeId === user.id ? "selected" : ""}>${escapeHtml(user.name || user.username)} (${escapeHtml(user.role)})</option>`
    )
  ].join("");
  return `
    <select class="compact-assignee-select" data-work-order-assignee="${escapeAttribute(item.id)}" aria-label="Assigned to">
      ${options}
    </select>
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
    reportTitle: "Ticket Report",
    numberLabel: "Ticket Number",
    footerLabel: "Preventative Maintenance Ticket Form",
    title: item.title || "Open ticket",
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
    photoDataUrl: mediaSource(item.photo) || "",
    photos: getWorkOrderPhotos(item)
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
      console.warn("Ticket report print skipped.", error);
    }
  }, 500);
  addWorkOrderHistory(item, "PDF opened", `${details.issueNumber} PDF form opened`);
  addActivity("Ticket PDF opened", `${details.issueNumber} - ${details.title}`);
  saveState();
  render();
}

async function emailIssueReport(item) {
  const details = getIssueReportDetails(item);
  const recipient = await choosePreferredContractorEmail("Email this ticket to a preferred contact:", details.customerId);
  if (recipient === null) return;
  addWorkOrderHistory(item, "Email draft opened", `Draft to ${recipient.trim()}`);
  addActivity("Ticket email draft opened", `${details.title} to ${recipient.trim()}`);
  saveState();
  render();
  openIssueEmailDraft(details, recipient);
}

function openIssueEmailDraft(details, recipient) {
  const subject = `SiteWorks Ticket: ${details.priority} - ${details.equipment}`;
  const body = [
    "SiteWorks Ticket Report",
    "",
    `Ticket Number: ${details.issueNumber}`,
    `Ticket: ${details.title}`,
    `Status: ${details.status}`,
    `Priority: ${details.priority}`,
    `Assigned to: ${details.assignedTo}`,
    `Customer: ${details.customer}`,
    `Location: ${details.location}`,
    `Equipment / Area: ${details.equipment}`,
    `Due: ${details.dueAt}`,
    `Created: ${details.createdAt}`,
    `Ticket ID: ${details.id}`,
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
  const recipient = await choosePreferredContractorEmail("Email this ticket PDF to a preferred contact:", details.customerId);
  if (!recipient) return;
  const reportDetails = getEmailFunctionReportDetails(details);

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Sending...";
  try {
    const response = await sendSiteWorksEmail("ticket", {
      to: recipient.trim(),
      ticket: reportDetails,
      issue: reportDetails,
      serviceRequest: reportDetails
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(getEmailFunctionError(result, "The ticket email could not be sent."));
    }
    addWorkOrderHistory(item, "PDF email sent", buildEmailHistoryDetails(recipient.trim(), result));
    addActivity("Ticket PDF emailed", `${details.title} to ${recipient.trim()}`);
    saveState();
    render();
    alert(buildEmailSuccessAlert("Ticket PDF email", result));
  } catch (error) {
    console.warn("Ticket PDF email failed.", error);
    addWorkOrderHistory(item, "PDF email failed", error.message || "Automatic PDF email could not be sent.");
    addActivity("Ticket PDF email failed", `${details.title} to ${recipient.trim()}`);
    saveState();
    restoreEmailActionButton(button, originalText);
    const useDraft = confirm(buildEmailFailurePrompt(error));
    if (useDraft) {
      addWorkOrderHistory(item, "Fallback email draft opened", `Draft to ${recipient.trim()}`);
      addActivity("Ticket fallback email draft", `${details.title} to ${recipient.trim()}`);
      saveState();
      openIssueEmailDraft(details, recipient.trim());
    }
    render();
  } finally {
    restoreEmailActionButton(button, originalText);
  }
}

function restoreEmailActionButton(button, label) {
  if (!button) return;
  button.disabled = false;
  button.textContent = label;
}

function supabaseFunctionHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
  };
}

function sendSiteWorksEmail(kind, payload) {
  return siteworksApi.sendEmail(kind, payload);
}

function getEmailFunctionReportDetails(details) {
  const issueNumber = details.issueNumber || details.ticketNumber || details.serviceRequestNumber || details.id || "not-recorded";
  return {
    ...details,
    id: details.id || issueNumber,
    issueNumber,
    ticketNumber: issueNumber,
    serviceRequestNumber: issueNumber,
    reportTitle: details.reportTitle || "Issue Report",
    numberLabel: details.numberLabel || "Issue Number",
    footerLabel: details.footerLabel || "SiteWorks Form",
    title: details.title || "Open issue",
    customer: details.customer || "Unknown customer",
    location: details.location || "Unknown location",
    equipment: details.equipment || details.area || "Area report",
    area: details.area || details.equipment || "Area report",
    status: details.status || "Open",
    priority: details.priority || "Medium",
    assignedTo: details.assignedTo || "Unassigned",
    source: details.source || "SiteWorks",
    dueAt: details.dueAt || "Not set",
    createdAt: details.createdAt || "Not recorded",
    updatedAt: details.updatedAt || "Not recorded",
    resolvedAt: details.resolvedAt || "",
    notes: details.notes || "No notes provided.",
    photoDataUrl: details.photoDataUrl || "",
    photos: Array.isArray(details.photos) ? details.photos : []
  };
}

function getEmailReceiptId(result) {
  return String(result?.id || result?.data?.id || result?.emailId || "").trim();
}

function buildEmailHistoryDetails(recipient, result) {
  const receiptId = getEmailReceiptId(result);
  return receiptId
    ? `Sent to ${recipient}. Resend ID: ${receiptId}`
    : `Sent to ${recipient}. Email service accepted the request, but no Resend receipt ID was returned. Check the Supabase Edge Function logs before assuming it delivered.`;
}

function buildEmailSuccessAlert(label, result) {
  const receiptId = getEmailReceiptId(result);
  return receiptId
    ? `${label} sent.\n\nResend ID: ${receiptId}`
    : `${label} was accepted by the email function, but no Resend receipt ID came back. Check the Supabase Edge Function logs before assuming it delivered.`;
}

function getEmailFunctionError(result, fallback) {
  const base = String(result?.error || fallback || "The email could not be sent.").trim();
  const detailMessage = String(result?.details?.message || result?.details?.error || "").trim();
  return detailMessage && detailMessage !== base ? `${base} ${detailMessage}` : base;
}

function buildEmailFailurePrompt(error, contactLabel = "contact") {
  const message = String(error?.message || "No error detail was returned.").trim();
  return [
    "The automatic PDF email could not be sent.",
    "",
    `Reason: ${message}`,
    "",
    "This usually means the Supabase email function is not deployed, the Resend API key is missing, the sender address is not allowed by Resend, the sender domain is not verified, or the photo/PDF was rejected.",
    "",
    `Open a regular email draft to this ${contactLabel} instead?`
  ].join("\n");
}

function getUserNotificationEmail(user) {
  const candidates = [
    user?.email,
    user?.contactEmail,
    user?.username
  ];
  return candidates
    .map((value) => String(value || "").trim())
    .find((value) => isEmailAddress(value)) || "";
}

async function sendIssueAssignmentEmail(item, user) {
  const recipient = getUserNotificationEmail(user);
  const details = getIssueReportDetails(item);
  const assigneeName = user?.name || user?.username || "Assigned technician";
  if (!recipient) {
    addWorkOrderHistory(item, "Assignment email skipped", `${assigneeName} does not have an email login saved.`);
    addActivity("Assignment email skipped", `${details.issueNumber} - no email for ${assigneeName}`);
    saveState();
    render();
    return;
  }

  try {
    const reportDetails = getEmailFunctionReportDetails({
      ...details,
      reportTitle: "Ticket Assignment",
      footerLabel: "Assigned Maintenance Ticket",
      notes: [`Assigned to: ${assigneeName}`, "", details.notes].join("\n")
    });
    const response = await sendSiteWorksEmail("assignment", {
      to: recipient,
      ticket: reportDetails,
      issue: reportDetails,
      serviceRequest: reportDetails
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(getEmailFunctionError(result, "The assignment email could not be sent."));
    }
    addWorkOrderHistory(item, "Assignment email sent", buildEmailHistoryDetails(recipient, result));
    addActivity("Assignment email sent", `${details.issueNumber} to ${assigneeName}`);
  } catch (error) {
    console.warn("Ticket assignment email failed.", error);
    addWorkOrderHistory(item, "Assignment email failed", error.message || "Automatic assignment email could not be sent.");
    addActivity("Assignment email failed", `${details.issueNumber} to ${recipient}`);
  }
  saveState();
  render();
}

async function sendServiceRequestAssignmentEmail(request, user) {
  const recipient = getUserNotificationEmail(user);
  const details = getServiceRequestReportDetails(request);
  const assigneeName = user?.name || user?.username || "Assigned technician";
  if (!recipient) {
    addServiceRequestHistory(request, "Assignment email skipped", `${assigneeName} does not have an email login saved.`);
    addActivity("Service assignment email skipped", `${details.issueNumber} - no email for ${assigneeName}`);
    saveState();
    render();
    return;
  }

  try {
    const reportDetails = getEmailFunctionReportDetails({
      ...details,
      reportTitle: "Service Request Assignment",
      footerLabel: "Assigned Service Request",
      notes: [`Assigned to: ${assigneeName}`, "", details.notes].join("\n")
    });
    const response = await sendSiteWorksEmail("assignment", {
      to: recipient,
      ticket: reportDetails,
      issue: reportDetails,
      serviceRequest: reportDetails
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(getEmailFunctionError(result, "The assignment email could not be sent."));
    }
    addServiceRequestHistory(request, "Assignment email sent", buildEmailHistoryDetails(recipient, result));
    addActivity("Service assignment email sent", `${details.issueNumber} to ${assigneeName}`);
  } catch (error) {
    console.warn("Service request assignment email failed.", error);
    addServiceRequestHistory(request, "Assignment email failed", error.message || "Automatic assignment email could not be sent.");
    addActivity("Service assignment email failed", `${details.issueNumber} to ${recipient}`);
  }
  saveState();
  render();
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
    photoDataUrl: mediaSource(request.photo) || ""
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
  const recipient = await choosePreferredContractorEmail("Email this service request to a preferred contact:", details.customerId);
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
  const recipient = await choosePreferredContractorEmail("Email this service request PDF to a preferred contact:", details.customerId);
  if (!recipient) return;
  const reportDetails = getEmailFunctionReportDetails(details);

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Sending...";
  try {
    const response = await sendSiteWorksEmail("service-request", {
      to: recipient.trim(),
      ticket: reportDetails,
      issue: reportDetails,
      serviceRequest: reportDetails
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(getEmailFunctionError(result, "The service request email could not be sent."));
    }
    addServiceRequestHistory(request, "PDF email sent", buildEmailHistoryDetails(recipient.trim(), result));
    addActivity("Service request PDF emailed", `${details.title} to ${recipient.trim()}`);
    saveState();
    render();
    alert(buildEmailSuccessAlert("Service request PDF email", result));
  } catch (error) {
    console.warn("Service request PDF email failed.", error);
    addServiceRequestHistory(request, "PDF email failed", error.message || "Automatic PDF email could not be sent.");
    addActivity("Service request PDF email failed", `${details.title} to ${recipient.trim()}`);
    saveState();
    restoreEmailActionButton(button, originalText);
    const useDraft = confirm(buildEmailFailurePrompt(error));
    if (useDraft) {
      addServiceRequestHistory(request, "Fallback email draft opened", `Draft to ${recipient.trim()}`);
      addActivity("Service request fallback email draft", `${details.title} to ${recipient.trim()}`);
      saveState();
      openServiceRequestEmailDraft(details, recipient.trim());
    }
    render();
  } finally {
    restoreEmailActionButton(button, originalText);
  }
}

function choosePreferredContractorEmail(promptTitle, customerId = "") {
  const contacts = visiblePreferredContractors();
  const currentCustomer = customerId ? getCustomer(customerId) : null;
  const emptyContactMessage = currentCustomer
    ? `No preferred contacts are available for ${currentCustomer.name} yet.`
    : "No preferred contacts have been added yet.";
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
          ${contacts.length
            ? contacts.map((contractor) => `
              <button type="button" class="contractor-choice" data-contractor-email="${escapeAttribute(contractor.email)}">
                <strong>${escapeHtml(contractor.name)}</strong>
                <span>${escapeHtml(contractor.email)}${contractor.trade ? ` | ${escapeHtml(contractor.trade)}` : ""}</span>
              </button>
            `).join("")
            : `<p class="muted">${escapeHtml(emptyContactMessage)}</p>`}
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
  const reportPhotos = Array.isArray(details.photos) && details.photos.length
    ? details.photos
    : details.photoDataUrl
      ? [{ label: "Submitted photo", url: details.photoDataUrl }]
      : [];
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
    [details.numberLabel || "Ticket Number", details.issueNumber],
    ["Record ID", details.id]
  ];
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>SiteWorks Ticket Report</title>
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
    .photo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.12in; }
    .photo-card { break-inside: avoid; }
    .photo-card span { display: block; color: #627179; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 0.04in; }
    .photo img { width: 100%; max-height: 2.5in; border: 1px solid #dbe4e1; object-fit: contain; }
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
        <h1>${escapeHtml(details.reportTitle || "Ticket Report")}</h1>
        <div class="status">${escapeHtml(details.status)} | ${escapeHtml(details.priority)} Priority</div>
      </div>
      <div class="meta">
        <strong>Generated</strong><br>
        ${escapeHtml(formatDateTime(new Date()))}<br><br>
        <strong>${escapeHtml(details.numberLabel || "Ticket Number")}</strong><br>
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
    ${reportPhotos.length ? `
      <section class="photo">
        <strong>Photos</strong>
        <div class="photo-grid">
          ${reportPhotos.map((photo) => `
            <div class="photo-card">
              <span>${escapeHtml(photo.label || "Ticket photo")}</span>
              <img alt="${escapeAttribute(photo.label || "Ticket photo")}" src="${escapeAttribute(mediaSource(photo))}">
            </div>
          `).join("")}
        </div>
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
      <span>${escapeHtml(details.footerLabel || "Preventative Maintenance Ticket Form")}</span>
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
          <span>Scan to report an issue</span>
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
          <span>Scan to report an issue</span>
        </div>
      </div>
    `;
  });
  els.labelSheet.innerHTML = [...assetLabels, ...locationLabels].join("");
}

function visibleLocationsForReportLabels() {
  const visibleCustomerIds = new Set(visibleCustomers().map((customer) => customer.id));
  return state.locations.filter((locationRecord) =>
    visibleCustomerIds.has(locationRecord.customerId) &&
    canSeeLocation(locationRecord.id, locationRecord.customerId)
  );
}

function isLocationScopedUser() {
  return Boolean(
    currentUser?.locationId &&
    (isManagerRole() || currentRole === "Customer")
  );
}

function defaultLocationSelection() {
  return isLocationScopedUser() ? currentUser.locationId : "all";
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

  repairSelectedCustomerToPopulatedDuplicate(customers);

  const visibleLocations = locationsForCustomer(selectedCustomerId);
  if (selectedLocationId !== "all" && !visibleLocations.some((locationRecord) => locationRecord.id === selectedLocationId)) {
    selectedLocationId = "all";
  }
  if (isLocationScopedUser() && visibleLocations.some((locationRecord) => locationRecord.id === currentUser.locationId)) {
    selectedLocationId = currentUser.locationId;
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
  if (!canSeeAsset(asset)) return;
  selectedCustomerId = asset.customerId;
  selectedLocationId = defaultLocationSelection();
}

function restoreScannedAssetSelection() {
  const scannedAssetId = getAssetIdFromUrl();
  if (!scannedAssetId) return;
  hydrateAssetFromHash();
  const asset = getRawAsset(scannedAssetId);
  if (!asset) return;
  if (!canSeeAsset(asset) && !isQrAccessUrl()) return;
  selectedId = asset.id;
  selectedCustomerId = asset.customerId;
  selectedLocationId = defaultLocationSelection();
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

function dashboardAssets() {
  if (currentRole !== "Technician") return filteredAssets();
  const assignedAssetIds = new Set([
    ...filteredWorkOrders().map((item) => item.assetId).filter(Boolean),
    ...filteredServiceRequests().map((item) => item.assetId).filter(Boolean)
  ]);
  return filteredAssets().filter((asset) => assignedAssetIds.has(asset.id));
}

function openWorkOrdersForAsset(assetId) {
  return state.workOrders.filter((item) => item.assetId === assetId && item.status !== "Closed" && canSeeWorkOrder(item));
}

function openFailedPmTicketsForAsset(assetId) {
  return openWorkOrdersForAsset(assetId).filter(isFailedPmIssue);
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

function completedTicketRecords() {
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
  return state.locations.filter((locationRecord) => {
    if (locationRecord.customerId !== customerId) return false;
    if (currentRole === "Technician") return canSeeCustomer(locationRecord.customerId);
    return canSeeLocation(locationRecord.id, locationRecord.customerId);
  });
}

async function deleteLocation(locationId) {
  const locationRecord = getLocation(locationId);
  if (!locationRecord) return;
  if (!canManageLocationSetup(locationRecord.id, locationRecord.customerId)) return;
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
    `${locationRecord.name}: ${removedAssetCount} equipment record(s), ${removedWorkOrderCount} ticket(s)`
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

async function deleteSelectedEquipment() {
  const asset = getSelectedAsset();
  if (!asset || !canDeleteEquipment()) return;
  const relatedWorkOrders = state.workOrders.filter((item) => item.assetId === asset.id);
  const relatedServiceRequests = state.serviceRequests.filter((item) => item.assetId === asset.id);
  const relatedPmCount = Array.isArray(asset.history) ? asset.history.length : 0;
  const message = [
    `Delete equipment "${asset.name}"?`,
    "",
    `This will also remove ${relatedWorkOrders.length} ticket(s), ${relatedServiceRequests.length} service request(s), and ${relatedPmCount} maintenance history record(s) tied to it.`
  ].join("\n");
  if (!confirm(message)) return;

  state.assets = state.assets.filter((item) => item.id !== asset.id);
  state.workOrders = state.workOrders.filter((item) => item.assetId !== asset.id);
  state.serviceRequests = state.serviceRequests.filter((item) => item.assetId !== asset.id);
  selectedPrintAssetIds.delete(asset.id);
  if (selectedId === asset.id) selectedId = null;
  addActivity("Equipment deleted", `${asset.name}: ${relatedWorkOrders.length} ticket(s), ${relatedServiceRequests.length} service request(s)`);
  saveState();
  await Promise.all([
    deleteStructuredRows("assets", "id", [asset.id]),
    deleteStructuredRows("work_orders", "asset_id", [asset.id]),
    deleteStructuredRows("service_requests", "asset_id", [asset.id]),
    deleteStructuredRows("pm_history", "asset_id", [asset.id])
  ]);
  clearSelectedAssetUrl();
  closeSelectedAssetPanel();
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
  const failedPm = historyItem.result === "Failed";
  const priority = failedPm ? "High" : "Medium";
  const ticket = {
    id: crypto.randomUUID(),
    issueNumber: nextIssueNumber(),
    assetId: asset.id,
    customerId: asset.customerId,
    locationId: asset.locationId,
    source: failedPm ? "Failed PM" : "PM result",
    sourceHistoryId: historyItem.id,
    title: failedPm ? `Failed PM follow-up: ${asset.name}` : `${historyItem.result}: ${asset.name}`,
    priority,
    status: "Open",
    assignedUserId: "",
    assignedUserName: "",
    dueAt: addDays(new Date(), failedPm ? 2 : 7).toISOString(),
    notes: historyItem.notes || (failedPm
      ? "Failed PM needs follow-up before it gets lost."
      : "Created automatically from PM result."),
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  addWorkOrderHistory(ticket, failedPm ? "Failed PM follow-up created" : "Created from PM", `${formatIssueNumber(ticket)} - ${ticket.title}`);
  return ticket;
}

function createManualIssueForAsset(asset, ticketData = {}) {
  if (!canCreateWorkOrders() || !canSeeAsset(asset)) return;
  const title = ticketData.title || `Ticket: ${asset.name}`;
  if (!title.trim()) return;
  const priority = normalizePriority(ticketData.priority);
  const ticket = {
    id: crypto.randomUUID(),
    issueNumber: nextIssueNumber(),
    assetId: asset.id,
    customerId: asset.customerId,
    locationId: asset.locationId,
    source: "Manual ticket",
    title: title.trim(),
    priority,
    status: "Open",
    assignedUserId: "",
    assignedUserName: "",
    dueAt: addDays(new Date(), priority === "High" ? 2 : 7).toISOString(),
    notes: ticketData.notes || "No notes entered.",
    photo: ticketData.photo || null,
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  addWorkOrderHistory(ticket, "Created", `${formatIssueNumber(ticket)} - ${ticket.title}`);
  state.workOrders.unshift(ticket);
  workOrderViewFilter = "active";
  addActivity("Ticket created", `${formatIssueNumber(ticket)} - ${ticket.title}`);
  saveState();
  openPanel("workOrdersPanel");
  render();
  document.getElementById("workOrdersPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function createManualIssueForArea(customerId, locationId, areaName, ticketData = {}) {
  if (!canCreateWorkOrders() || !canSeeLocation(locationId, customerId)) return;
  const locationRecord = getLocation(locationId);
  if (!locationRecord || locationRecord.customerId !== customerId) return;
  const title = ticketData.title || `Ticket: ${areaName || locationRecord.name}`;
  if (!title.trim()) return;
  const priority = normalizePriority(ticketData.priority);
  const ticket = {
    id: crypto.randomUUID(),
    issueNumber: nextIssueNumber(),
    assetId: "",
    customerId,
    locationId,
    areaName: areaName || locationRecord.name,
    source: "Manual area ticket",
    title: title.trim(),
    priority,
    status: "Open",
    assignedUserId: "",
    assignedUserName: "",
    dueAt: addDays(new Date(), priority === "High" ? 2 : 7).toISOString(),
    notes: ticketData.notes || "No notes entered.",
    photo: ticketData.photo || null,
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  addWorkOrderHistory(ticket, "Created", `${formatIssueNumber(ticket)} - ${ticket.title}`);
  state.workOrders.unshift(ticket);
  workOrderViewFilter = "active";
  addActivity("Area ticket created", `${formatIssueNumber(ticket)} - ${ticket.title}`);
  saveState();
  openPanel("workOrdersPanel");
  render();
  document.getElementById("workOrdersPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function createIssueFromTopAction() {
  if (!els.newIssueForm || !canCreateWorkOrders()) return;
  const isAreaTicket = Boolean(els.newIssueTargetArea?.checked);
  const asset = getAsset(els.newIssueAsset?.value);
  const customerId = els.newIssueCustomer?.value || "";
  const locationId = els.newIssueLocation?.value || "";
  const areaName = String(els.newIssueArea?.value || "").trim();
  const locationRecord = getLocation(locationId);
  if (!isAreaTicket && !asset) {
    if (els.newIssueStatus) els.newIssueStatus.textContent = "Choose equipment or select Area first.";
    return;
  }
  if (isAreaTicket && (!customerId || !locationRecord || !areaName)) {
    if (els.newIssueStatus) els.newIssueStatus.textContent = "Choose a location and enter the area first.";
    return;
  }
  const submitButton = els.newIssueForm.querySelector("button[type='submit']");
  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Creating...";
    }
    const photo = await readIssuePhoto(els.newIssuePhoto?.files?.[0]);
    const ticketData = {
      title: els.newIssueTitle?.value.trim() || `Ticket: ${isAreaTicket ? areaName : asset.name}`,
      priority: els.newIssuePriority?.value || "Medium",
      notes: els.newIssueNotes?.value.trim(),
      photo
    };
    els.newIssueDrawer.open = false;
    els.newIssueForm.reset();
    if (isAreaTicket) {
      createManualIssueForArea(customerId, locationId, areaName, ticketData);
    } else {
      createManualIssueForAsset(asset, ticketData);
    }
  } catch (error) {
    console.warn("Top action ticket creation failed.", error);
    if (els.newIssueStatus) els.newIssueStatus.textContent = "Ticket was not created. Try again with no photo or a smaller photo.";
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Create Ticket";
    }
  }
}

async function createServiceRequest() {
  if (!els.serviceRequestForm) return;
  if (!canCreateServiceRequests()) {
    setServiceRequestStatus("This login cannot create service requests.");
    return;
  }
  let photo = null;
  try {
    photo = await readServiceRequestPhoto(els.serviceRequestPhoto?.files?.[0]);
  } catch (error) {
    console.warn("Service request photo could not be read.", error);
    setServiceRequestStatus("That photo could not be attached. Try one smaller photo, or create the request with no photo first.");
    return;
  }
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
  if (!canSeeLocation(request.locationId, request.customerId)) {
    setServiceRequestStatus("Choose a location this login can access.");
    return;
  }
  if (!request.title) {
    setServiceRequestStatus("Enter a short service request.");
    return;
  }
  addServiceRequestHistory(request, "Created", `${formatServiceRequestNumber(request)} - ${request.title}`);
  state.serviceRequests.unshift(request);
  const activityDetails = `${formatServiceRequestNumber(request)} - ${request.title}`;
  addActivity("Service request created", activityDetails);
  try {
    saveState();
  } catch (error) {
    state.serviceRequests = state.serviceRequests.filter((item) => item.id !== request.id);
    state.activityLog = state.activityLog.filter((item) =>
      !(item.action === "Service request created" && item.details === activityDetails)
    );
    setServiceRequestStatus("The request was not saved. Try again with a smaller photo or no photo.");
    render();
    return;
  }
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
  const ticket = {
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
  addWorkOrderHistory(ticket, "Created from service request", `${formatServiceRequestNumber(request)} -> ${formatIssueNumber(ticket)}`);
  state.workOrders.unshift(ticket);
  request.convertedWorkOrderId = ticket.id;
  request.status = "Reviewed";
  request.updatedAt = new Date().toISOString();
  addServiceRequestHistory(request, "Converted to ticket", `${formatServiceRequestNumber(request)} -> ${formatIssueNumber(ticket)}`);
  workOrderViewFilter = "active";
  addActivity("Service request converted", `${formatServiceRequestNumber(request)} to ${formatIssueNumber(ticket)}`);
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
    requestedBy: workOrder.source || "Converted from open ticket",
    preferredDate: "",
    assignedUserId: workOrder.assignedUserId || "",
    assignedUserName: workOrder.assignedUserName || "",
    notes: [
      `Converted from open ticket ${formatIssueNumber(workOrder)}.`,
      workOrder.notes || "No details entered."
    ].join("\n"),
    photo: workOrder.photo || null,
    convertedWorkOrderId: workOrder.id,
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  addServiceRequestHistory(serviceRequest, "Created from ticket", `${formatIssueNumber(workOrder)} -> ${formatServiceRequestNumber(serviceRequest)}`);
  state.serviceRequests.unshift(serviceRequest);
  workOrder.status = "Closed";
  workOrder.resolvedAt = new Date().toISOString();
  workOrder.updatedAt = new Date().toISOString();
  workOrder.notes = [
    workOrder.notes || "",
    `Converted to service request ${formatServiceRequestNumber(serviceRequest)}.`
  ].filter(Boolean).join("\n");
  addWorkOrderHistory(workOrder, "Converted to service request", `${formatIssueNumber(workOrder)} -> ${formatServiceRequestNumber(serviceRequest)}`);
  addActivity("Open ticket converted", `${formatIssueNumber(workOrder)} to ${formatServiceRequestNumber(serviceRequest)}`);
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
  const prefix = isCustomerReportedIssue(item) ? "SW-CU" : "SW";
  return numeric ? `${prefix}-${String(numeric).padStart(4, "0")}` : `${prefix}-0000`;
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
  return currentRole === "Admin" || (isManagerRole() && Boolean(currentUser?.customerId) && !currentUser.locationId);
}

function canCreateCustomers() {
  return currentRole === "Admin";
}

function canCreateLocations() {
  return currentRole === "Admin" || (isManagerRole() && Boolean(currentUser?.customerId) && !currentUser.locationId);
}

function canManageTemplateSetup() {
  return currentRole === "Admin";
}

function canManageCustomerSetup(customerId) {
  if (currentRole === "Admin") return true;
  return isManagerRole() && Boolean(currentUser?.customerId) && !currentUser.locationId && customerId === currentUser.customerId;
}

function canManageLocationSetup(locationId, customerId = "") {
  if (currentRole === "Admin") return true;
  if (!canManageCustomerSetup(customerId || getLocation(locationId)?.customerId || "")) return false;
  return canSeeLocation(locationId, customerId);
}

function manageableSetupCustomers() {
  if (currentRole === "Admin") {
    const selectedCustomer = getCustomer(selectedCustomerId);
    return selectedCustomer ? [selectedCustomer] : [...state.customers];
  }
  if (isManagerRole() && currentUser?.customerId) {
    return state.customers.filter((customer) => customer.id === currentUser.customerId);
  }
  return [];
}

function canManageUsers() {
  return currentRole === "Admin" || (isManagerRole() && Boolean(currentUser?.customerId) && !currentUser.locationId);
}

function canManageContractors() {
  return currentRole === "Admin" || (isManagerRole() && Boolean(currentUser?.customerId) && !currentUser.locationId);
}

function canManageContractorCustomer(customerId) {
  if (currentRole === "Admin") return true;
  return isManagerRole() && Boolean(currentUser?.customerId) && !currentUser.locationId && customerId === currentUser.customerId;
}

function canManageContractorRecord(contractor) {
  return canManageContractorCustomer(contractor.customerId);
}

function visiblePreferredContractors(customerId = "") {
  if (currentRole === "Admin") {
    return state.preferredContractors.filter((contractor) => !customerId || contractor.customerId === customerId);
  }
  if (isManagerRole() && currentUser?.customerId) {
    return state.preferredContractors.filter((contractor) => contractor.customerId === currentUser.customerId);
  }
  if (customerId) return state.preferredContractors.filter((contractor) => contractor.customerId === customerId);
  return [];
}

function manageableUserCustomers() {
  if (currentRole === "Admin") return state.customers;
  if (isManagerRole() && currentUser?.customerId) {
    return state.customers.filter((customer) => customer.id === currentUser.customerId);
  }
  return [];
}

function manageableUserLocations(customerId) {
  if (!customerId) return [];
  if (currentRole === "Admin") {
    return state.locations.filter((locationRecord) => locationRecord.customerId === customerId);
  }
  if (isManagerRole() && currentUser?.customerId === customerId) {
    const managerLocationId = currentUser.locationId || "";
    return state.locations.filter((locationRecord) =>
      locationRecord.customerId === customerId &&
      (!managerLocationId || locationRecord.id === managerLocationId)
    );
  }
  return [];
}

function userRoleOptionsForEditor(existingRole = "") {
  if (currentRole === "Admin") return ["Customer", "Technician", "Manager", "Facility Manager", "Admin"];
  const roles = currentRole === "Facility Manager"
    ? ["Customer", "Technician", "Manager"]
    : ["Customer", "Technician"];
  return roles.includes(existingRole) || !existingRole ? roles : [existingRole];
}

function canCreateUserRole(role) {
  if (currentRole === "Admin") return true;
  if (currentRole === "Facility Manager") return ["Customer", "Technician", "Manager"].includes(role);
  return currentRole === "Manager" && ["Customer", "Technician"].includes(role);
}

function userRolePermissionMessage() {
  return currentRole === "Facility Manager"
    ? "Facility Managers can add Customer, Technician, or Manager users for their assigned customer."
    : "Managers can only add Customer or Technician users for their assigned customer.";
}

function canManageUserCustomer(customerId, role) {
  if (currentRole === "Admin") return true;
  if (!isManagerRole()) return false;
  if (role === "Admin" || role === "Facility Manager") return false;
  if (role === "Manager" && currentRole !== "Facility Manager") return false;
  return Boolean(currentUser?.customerId && customerId === currentUser.customerId);
}

function canManageUserLocation(customerId, locationId) {
  if (!locationId) return currentRole === "Admin" || !currentUser?.locationId;
  return manageableUserLocations(customerId).some((locationRecord) => locationRecord.id === locationId);
}

function canViewUserRecord(user) {
  if (currentRole === "Admin") return true;
  if (!isManagerRole()) return false;
  if (user.customerId !== currentUser?.customerId || user.role === "Admin") return false;
  const managerLocationId = currentUser.locationId || "";
  if (!managerLocationId) return true;
  return user.locationId === managerLocationId;
}

function canEditUserRecord(user) {
  if (currentRole === "Admin") return true;
  if (!isManagerRole()) return false;
  if (currentUser?.id === user.id) return false;
  const manageableRoles = currentRole === "Facility Manager"
    ? ["Customer", "Technician", "Manager"]
    : ["Customer", "Technician"];
  if (user.customerId !== currentUser?.customerId || !manageableRoles.includes(user.role)) return false;
  const managerLocationId = currentUser.locationId || "";
  if (!managerLocationId) return true;
  return user.locationId === managerLocationId;
}

function visibleManagedUsers() {
  return state.users.filter(canViewUserRecord);
}

function canAddEquipment() {
  return currentRole === "Admin" || (isManagerRole() && !currentUser?.locationId);
}

function canEditEquipment() {
  return currentRole === "Admin" || isManagerRole();
}

function canDeleteEquipment() {
  return currentRole === "Admin";
}

function canCompletePm() {
  return currentRole === "Admin" ||
    isManagerRole() ||
    currentRole === "Technician";
}

function canManageWorkOrders() {
  return currentRole === "Admin" || isManagerRole();
}

function canDeleteWorkOrders() {
  return currentRole === "Admin";
}

function canWorkOnTicket(item = null) {
  if (canManageWorkOrders()) return true;
  if (currentRole !== "Technician" || !currentUser) return false;
  if (!item) return true;
  const assignedUserId = String(item.assignedUserId || "");
  const assignedName = String(item.assignedUserName || "").trim().toLowerCase();
  const currentNames = [
    currentUser.name,
    currentUser.username
  ].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
  if (!assignedUserId && !assignedName) return true;
  return assignedUserId === currentUser.id || currentNames.includes(assignedName);
}

function canCreateWorkOrders() {
  return currentRole === "Admin" || isManagerRole();
}

function canCreateServiceRequests() {
  if (!currentUser || !visibleCustomers().length) return false;
  if (isManagerRole() && currentUser.locationId) return false;
  return currentRole === "Admin" || isManagerRole();
}

function canSeeWorkOrder(item) {
  if (currentRole === "Technician") {
    return canSeeCustomer(item.customerId) && item.assignedUserId === currentUser?.id;
  }
  if (!canSeeLocation(item.locationId, item.customerId)) return false;
  if (currentRole === "Admin" || isManagerRole()) return canSeeCustomer(item.customerId);
  return canSeeCustomer(item.customerId);
}

function canSeeServiceRequest(item) {
  if (currentRole === "Technician") {
    return canSeeCustomer(item.customerId) && item.assignedUserId === currentUser?.id;
  }
  if (!canSeeLocation(item.locationId, item.customerId)) return false;
  if (currentRole === "Admin" || isManagerRole()) return canSeeCustomer(item.customerId);
  return canSeeCustomer(item.customerId);
}

function canSeeAsset(asset) {
  if (!asset || !canSeeCustomer(asset.customerId)) return false;
  if (currentRole === "Technician") return true;
  if (!canSeeLocation(asset.locationId, asset.customerId)) return false;
  return true;
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
    canSeeAsset(asset) && asset.customerId === selectedCustomerId
  );
  return activeLocationCountForAssets(customerAssets);
}

function canSeeCustomer(customerId) {
  return canSeeAllCustomers() || currentUser?.customerId === customerId;
}

function canSeeLocation(locationId, customerId = "") {
  if (canSeeAllCustomers()) return true;
  if (!currentUser) return false;
  if (customerId && !canSeeCustomer(customerId)) return false;
  const assignedLocationId = currentUser.locationId || "";
  if (!assignedLocationId) return true;
  return locationId === assignedLocationId;
}

function canSeeAllCustomers() {
  return currentRole === "Admin";
}

function getAssetUrl(id) {
  const base = getQrBaseUrl();
  const params = getCompactAssetParams(id);
  return `${base}?qr=1&a=${encodeURIComponent(id)}${params ? `&${params}` : ""}`;
}

function getReportAssetUrl(id) {
  const base = getQrBaseUrl();
  const params = getCompactAssetParams(id);
  return `${base}?report=1&a=${encodeURIComponent(id)}${params ? `&${params}` : ""}`;
}

function getReportLocationUrl(locationId) {
  const base = getQrBaseUrl();
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
  return normalizeQrBaseUrl(trimmed);
}

function getQrBaseUrl() {
  return normalizeQrBaseUrl(state.qrBaseUrl || guessNetworkQrUrl());
}

function normalizeQrBaseUrl(value) {
  const clean = String(value || "").trim().split(/[?#]/)[0];
  if (!clean) return "";
  if (/explite182\.github\.io/i.test(clean)) return PRODUCTION_SITE_URL;
  return clean;
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
    photo_data_url: cloudMediaSource(photo),
    photo_name: photo?.name || ""
  };
  try {
    const response = await siteworksApi.submitPublicReport(payload);
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    return data?.[0]?.id || "";
  } catch (error) {
    lastPublicReportError = "Report was not sent to SiteWorks. Try again with a smaller photo or no photo.";
    console.warn("Supabase public report save skipped.", error);
    return "";
  }
}

async function syncPublicReportsFromSupabase(force = false) {
  if (remoteReportsLoading || !canManageWorkOrders()) return;
  const now = Date.now();
  if (!force && now - lastRemoteReportsSyncAt < PUBLIC_REPORT_SYNC_MIN_AGE_MS) return;
  lastRemoteReportsSyncAt = now;
  remoteReportsLoading = true;
  let data = [];
  try {
    const response = await siteworksApi.loadPublicReports();
    remoteReportsLoading = false;
    remoteReportsLoaded = true;
    if (!response.ok) {
      const errorText = await response.text();
      markSyncError(`Public report sync failed: ${errorText}`);
      console.warn("Supabase public report sync skipped.", errorText);
      return;
    }
    data = await response.json();
    markSyncSuccess("publicReports");
  } catch (error) {
    remoteReportsLoading = false;
    remoteReportsLoaded = true;
    markSyncError(error?.message || "Public report sync failed.");
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
  const session = getSavedAuthSession();
  const token = options.forceAnon ? SUPABASE_ANON_KEY : (session?.access_token || SUPABASE_ANON_KEY);
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  const { forceAnon, ...fetchOptions } = options;
  return fetch(url, { ...fetchOptions, headers });
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

function siteworksServerEnabled() {
  return Boolean(SITEWORKS_API_BASE_URL);
}

function siteworksServerUrl(path) {
  const cleanBase = SITEWORKS_API_BASE_URL.replace(/\/+$/, "");
  const cleanPath = String(path || "").replace(/^\/+/, "");
  return `${cleanBase}/${cleanPath}`;
}

function siteworksServerFetch(path, options = {}) {
  const body = options.body;
  const hasFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const session = getSavedAuthSession();
  const headers = {
    ...(hasFormData ? {} : { "Content-Type": "application/json" }),
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...(options.headers || {})
  };
  return fetch(siteworksServerUrl(path), { ...options, headers });
}

const cloudApi = {
  rest(path, options = {}) {
    return supabaseFetch(path, options);
  },
  auth(path, options = {}, session = null) {
    return supabaseAuthFetch(path, options, session);
  },
  async uploadFile(file, folder = "uploads", session = null) {
    if (!file || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    const cleanFolder = slugifyStoragePath(folder || "uploads");
    const cleanName = slugifyStoragePath(file.name || "file");
    const path = `${cleanFolder}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${cleanName}`;
    const token = session?.access_token || SUPABASE_ANON_KEY;
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${path}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false"
      },
      body: file
    });
    if (!response.ok) throw new Error(await response.text());
    return {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size || 0,
      bucket: SUPABASE_STORAGE_BUCKET,
      path,
      url: `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${encodeURI(path)}`
    };
  },
  async select(path) {
    const response = await this.rest(path);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async upsert(path, rows, prefer = "resolution=merge-duplicates") {
    if (!rows?.length) return;
    const response = await this.rest(path, {
      method: "POST",
      headers: { Prefer: prefer },
      body: JSON.stringify(rows)
    });
    if (!response.ok) throw new Error(await response.text());
  },
  async delete(path) {
    const response = await this.rest(path, { method: "DELETE" });
    if (!response.ok) throw new Error(await response.text());
  }
};

const siteworksApi = {
  mode() {
    return SITEWORKS_API_MODE;
  },
  backendLabel() {
    return siteworksServerEnabled() ? "SiteWorks server" : "Supabase prototype";
  },
  server(path, options = {}) {
    return siteworksServerFetch(path, options);
  },
  async login(email, password) {
    if (siteworksServerEnabled()) {
      return this.server("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ login: email, password })
      });
    }
    const loginEmail = await resolveSupabaseLoginEmail(email);
    return cloudApi.auth("token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: loginEmail, password })
    });
  },
  createUser(email, password, name) {
    if (siteworksServerEnabled()) {
      return this.server("/api/users", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, name })
      });
    }
    return cloudApi.auth("signup", {
      method: "POST",
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        data: { name }
      })
    });
  },
  findLoginEmail(loginName) {
    const escaped = String(loginName || "").toLowerCase().replace(/[%*_]/g, "\\$&");
    if (siteworksServerEnabled()) {
      return this.server(`/api/users/resolve-login?login=${encodeURIComponent(escaped)}`);
    }
    return cloudApi.rest(`profiles?or=(email.ilike.${encodeURIComponent(escaped)},name.ilike.${encodeURIComponent(escaped)})&select=email,name&limit=1`);
  },
  loadProfiles() {
    if (siteworksServerEnabled()) return this.server("/api/users");
    return cloudApi.rest("profiles?select=*&order=created_at.asc");
  },
  loadProfile(userId) {
    if (siteworksServerEnabled()) return this.server(`/api/users/${encodeURIComponent(userId)}`);
    return cloudApi.rest(`profiles?id=eq.${encodeURIComponent(userId)}&select=*&limit=1`);
  },
  saveProfile(payload) {
    if (siteworksServerEnabled()) {
      return this.server(`/api/users/${encodeURIComponent(payload.id)}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
    }
    return cloudApi.rest("profiles?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(payload)
    });
  },
  deleteProfile(userId) {
    if (siteworksServerEnabled()) {
      return this.server(`/api/users/${encodeURIComponent(userId)}`, {
        method: "DELETE"
      });
    }
    return cloudApi.rest(`profiles?id=eq.${encodeURIComponent(userId)}`, {
      method: "DELETE"
    });
  },
  submitPublicReport(payload) {
    if (siteworksServerEnabled()) {
      return this.server("/api/public/reports", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }
    return cloudApi.rest("public_reports?select=id", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload)
    });
  },
  loadPublicReports() {
    if (siteworksServerEnabled()) return this.server("/api/public/reports?limit=50");
    return cloudApi.rest("public_reports?select=id,equipment_id,customer_id,customer_name,location_id,location_name,equipment_name,note,contact,photo_data_url,photo_name,created_at&order=created_at.desc&limit=50");
  },
  loadSharedState(id) {
    if (siteworksServerEnabled()) return this.server(`/api/sync/shared-state/${encodeURIComponent(id)}`);
    return cloudApi.rest(`app_state?id=eq.${encodeURIComponent(id)}&select=data,updated_at`);
  },
  saveSharedState(payload) {
    if (siteworksServerEnabled()) {
      return this.server(`/api/sync/shared-state/${encodeURIComponent(payload.id)}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
    }
    return cloudApi.rest("app_state?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(payload)
    });
  },
  loadRows(table, order = "updated_at.asc") {
    if (siteworksServerEnabled()) {
      return this.server(`/api/data/${encodeURIComponent(table)}?order=${encodeURIComponent(order)}`).then((response) => {
        if (!response.ok) throw new Error("Server data load failed.");
        return response.json();
      });
    }
    return cloudApi.select(`${table}?select=*&order=${encodeURIComponent(order)}`);
  },
  peekRows(table, timestampColumn) {
    if (siteworksServerEnabled()) {
      return this.server(`/api/data/${encodeURIComponent(table)}/peek?timestampColumn=${encodeURIComponent(timestampColumn)}`).then((response) => {
        if (!response.ok) throw new Error("Server data check failed.");
        return response.json();
      });
    }
    return cloudApi.select(`${table}?select=id,${timestampColumn}&order=${encodeURIComponent(`${timestampColumn}.desc`)}&limit=1`);
  },
  saveRows(table, rows) {
    if (siteworksServerEnabled()) {
      return this.server(`/api/data/${encodeURIComponent(table)}/batch`, {
        method: "POST",
        body: JSON.stringify({ rows })
      }).then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
      });
    }
    return cloudApi.upsert(`${table}?on_conflict=id`, rows);
  },
  deleteRows(table, column, values) {
    const cleanValues = values.filter(Boolean);
    if (!cleanValues.length) return Promise.resolve();
    if (siteworksServerEnabled()) {
      return this.server(`/api/data/${encodeURIComponent(table)}/delete`, {
        method: "POST",
        body: JSON.stringify({ column, values: cleanValues })
      }).then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
      });
    }
    const filter = cleanValues.map((value) => encodeURIComponent(value)).join(",");
    return cloudApi.delete(`${table}?${column}=in.(${filter})`);
  },
  uploadFile(file, folder, session = null) {
    if (siteworksServerEnabled()) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder || "uploads");
      return this.server("/api/files", {
        method: "POST",
        body: formData
      }).then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json();
      });
    }
    return cloudApi.uploadFile(file, folder, session);
  },
  getSignedFileUrl(file) {
    if (!siteworksServerEnabled()) return Promise.resolve({ ok: false, json: async () => ({}) });
    return this.server("/api/files/signed-url", {
      method: "POST",
      body: JSON.stringify({
        bucket: file?.bucket || file?.storageBucket || "",
        path: file?.path || file?.storageKey || file?.storage_key || "",
        customerId: file?.customerId || file?.customer_id || "",
        locationId: file?.locationId || file?.location_id || ""
      })
    });
  },
  sendEmail(kind, payload) {
    if (siteworksServerEnabled()) {
      return this.server(`/api/email/${encodeURIComponent(kind)}`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }
    return fetch(ISSUE_REPORT_FUNCTION_URL, {
      method: "POST",
      headers: supabaseFunctionHeaders(),
      body: JSON.stringify(payload)
    });
  }
};

async function signInWithSupabase(email, password) {
  lastAuthError = "";
  try {
    const response = await siteworksApi.login(email, password);
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

function normalizedName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function customerVisibleAssetCount(customerId) {
  return state.assets.filter((asset) =>
    asset.customerId === customerId &&
    canSeeAsset(asset)
  ).length;
}

function repairSelectedCustomerToPopulatedDuplicate(customers = visibleCustomers()) {
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  if (!selectedCustomer || customerVisibleAssetCount(selectedCustomer.id)) return;
  const selectedName = normalizedName(selectedCustomer.name);
  if (!selectedName) return;

  const replacement = customers.find((customer) =>
    customer.id !== selectedCustomer.id &&
    normalizedName(customer.name) === selectedName &&
    customerVisibleAssetCount(customer.id) > 0
  );
  if (!replacement) return;

  selectedCustomerId = replacement.id;
  selectedLocationId = "all";
}

async function resolveSupabaseLoginEmail(identifier) {
  const clean = String(identifier || "").trim();
  const lower = clean.toLowerCase();
  if (isEmailAddress(lower)) return lower;

  const localMatch = state.users.find((user) =>
    String(user.username || "").toLowerCase() === lower ||
    String(user.name || "").toLowerCase() === lower
  );
  if (localMatch?.username && isEmailAddress(localMatch.username)) return localMatch.username.toLowerCase();

  try {
    const escaped = lower.replace(/[%*_]/g, "\\$&");
    const response = await siteworksApi.findLoginEmail(lower);
    if (response.ok) {
      const rows = await response.json();
      const email = rows?.[0]?.email || "";
      if (isEmailAddress(email)) return email.toLowerCase();
    }
  } catch (error) {
    console.warn("Supabase login name lookup skipped.", error);
  }

  return lower;
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

async function signUpSupabaseUser(email, password, name, role, customerId, locationId = "") {
  lastAuthError = "";
  try {
    const response = await siteworksApi.createUser(email, password, name);
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
      locationId: role === "Admin" ? "" : locationId || "",
      createdAt: new Date().toISOString(),
      session
    };
    await saveSupabaseProfile(profile);
    upsertLocalUser(profile);
    return profile;
  } catch (error) {
    lastAuthError = error?.message || "Supabase sign up failed.";
    console.warn("Supabase sign up failed.", error);
    return null;
  }
}

async function loadSupabaseProfiles() {
  if (authProfilesLoading) return;
  authProfilesLoading = true;
  try {
    const response = await siteworksApi.loadProfiles();
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
    location_id: profile.role === "Admin" ? "" : profile.locationId || "",
    updated_at: new Date().toISOString()
  };
  const response = await siteworksApi.saveProfile(payload);
  if (!response.ok) {
    const errorText = await response.text();
    if (errorText.includes("location_id") || errorText.includes("PGRST204")) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.location_id;
      const fallbackResponse = await siteworksApi.saveProfile(fallbackPayload);
      if (!fallbackResponse.ok) console.warn("Supabase profile save skipped.", await fallbackResponse.text());
      return;
    }
    console.warn("Supabase profile save skipped.", errorText);
  }
}

async function deleteSupabaseProfile(userId) {
  const response = await siteworksApi.deleteProfile(userId);
  if (!response.ok) console.warn("Supabase profile delete skipped.", await response.text());
}

async function getProfileForAuthUser(authUser) {
  if (!authUser?.id) return null;
  const response = await siteworksApi.loadProfile(authUser.id);
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
    locationId: profile.location_id || "",
    createdAt: profile.created_at || new Date().toISOString(),
    updatedAt: profile.updated_at || ""
  };
}

function upsertLocalUser(user) {
  const cleanUser = {
    ...user,
    password: "",
    username: user.username || user.email || "",
    customerId: user.role === "Admin" ? "" : user.customerId || "",
    locationId: user.role === "Admin" ? "" : user.locationId || ""
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
  try {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.warn("Auth session was not saved because browser storage is full.", error);
  }
}

function getSavedAuthSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

function clearAuthSession() {
  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
  } catch (error) {
    console.warn("Auth session could not be cleared.", error);
  }
}

async function bootstrapCloudData() {
  const loadedStructuredData = await loadStructuredDataFromSupabase();
  if (!loadedStructuredData) await loadSharedStateFromSupabase();
  restoreScannedAssetSelection();
  syncFiltersToSelectedAsset();
  render();
}

async function refreshCloudDataFromSupabase() {
  const loadedStructuredData = await loadStructuredDataFromSupabase();
  if (!loadedStructuredData) await loadSharedStateFromSupabase();
  restoreScannedAssetSelection();
}

async function loadStructuredDataFromSupabase() {
  if (structuredDataLoading || applyingSharedState || isPublicReportUrl() || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  structuredDataLoading = true;
  try {
    const remoteStructuredState = await peekStructuredCloudState();
    if (remoteStructuredState.hasRows && hasSharedMaintenanceData(state) && !isRemoteSharedStateNewer(remoteStructuredState.updatedAt)) {
      structuredDataLoading = false;
      structuredDataReady = true;
      scheduleStructuredDataSync(0);
      markSyncSuccess("load");
      return true;
    }
    const [
      customerRows,
      locationRows,
      templateRows,
      assetRows,
      workOrderRows,
      serviceRequestRows,
      historyRows
    ] = await Promise.all([
      fetchStructuredRows("customers", "updated_at.asc"),
      fetchStructuredRows("locations", "updated_at.asc"),
      fetchStructuredRows("pm_templates", "updated_at.asc"),
      fetchStructuredRows("assets", "updated_at.asc"),
      fetchStructuredRows("work_orders", "updated_at.asc"),
      fetchStructuredRows("service_requests", "updated_at.asc"),
      fetchStructuredRows("pm_history", "completed_at.asc")
    ]);
    structuredDataLoading = false;
    structuredDataReady = true;
    const hasRows = customerRows.length || locationRows.length || templateRows.length || assetRows.length || workOrderRows.length || serviceRequestRows.length;
    if (!hasRows) {
      if (hasSharedMaintenanceData(state)) scheduleStructuredDataSync(0);
      return false;
    }
    const structuredRows = {
      customers: customerRows,
      locations: locationRows,
      templates: templateRows,
      assets: assetRows,
      workOrders: workOrderRows,
      serviceRequests: serviceRequestRows,
      history: historyRows
    };
    if (structuredRowsMissingAssets(structuredRows)) {
      markSyncError("Structured cloud load returned related records but no equipment. Keeping/restoring the last known equipment list.");
      const restoredSharedState = await loadSharedStateFromSupabase(true);
      if (!restoredSharedState && state.assets?.length) scheduleStructuredDataSync(0);
      return Boolean(restoredSharedState || state.assets?.length);
    }
    const structuredUpdatedAt = newestStructuredUpdatedAt(structuredRows);
    if (hasSharedMaintenanceData(state) && !isRemoteSharedStateNewer(structuredUpdatedAt)) {
      scheduleStructuredDataSync(0);
      markSyncSuccess("load");
      return true;
    }
    applyStructuredState(structuredRows, structuredUpdatedAt);
    markSyncSuccess("load");
    return true;
  } catch (error) {
    structuredDataLoading = false;
    structuredDataReady = true;
    markSyncError(error?.message || "Structured cloud load failed.");
    console.warn("Structured Supabase load skipped.", error);
    return false;
  }
}

function structuredRowsMissingAssets(rows = {}) {
  if (rows.assets?.length) return false;
  if (state.assets?.length) return true;
  return Boolean(
    rows.workOrders?.some((row) => row.asset_id || row.assetId) ||
    rows.serviceRequests?.some((row) => row.asset_id || row.assetId) ||
    rows.history?.some((row) => row.asset_id || row.assetId)
  );
}

async function fetchStructuredRows(table, order = "updated_at.asc") {
  try {
    return await siteworksApi.loadRows(table, order);
  } catch (error) {
    const message = `Structured cloud load failed for ${table}: ${error?.message || error}`;
    markSyncError(message);
    console.warn(`Structured Supabase load skipped for ${table}.`, error);
    throw new Error(message);
  }
}

async function peekStructuredCloudState() {
  const tables = [
    { table: "customers", timestamp: "updated_at" },
    { table: "locations", timestamp: "updated_at" },
    { table: "pm_templates", timestamp: "updated_at" },
    { table: "assets", timestamp: "updated_at" },
    { table: "work_orders", timestamp: "updated_at" },
    { table: "service_requests", timestamp: "updated_at" },
    { table: "pm_history", timestamp: "completed_at" }
  ];
  const rows = await Promise.all(tables.map(({ table, timestamp }) => fetchStructuredTimestampRows(table, timestamp)));
  const flatRows = rows.flat();
  return {
    hasRows: flatRows.length > 0,
    updatedAt: newestTimestampFromRows(flatRows)
  };
}

async function fetchStructuredTimestampRows(table, timestampColumn) {
  try {
    return await siteworksApi.peekRows(table, timestampColumn);
  } catch (error) {
    const message = `Structured cloud change check failed for ${table}: ${error?.message || error}`;
    markSyncError(message);
    console.warn(`Structured Supabase change check skipped for ${table}.`, error);
    throw new Error(message);
  }
}

function applyStructuredState(rows, updatedAt = "") {
  const localUsers = state.users || [];
  const localAccessRequests = state.accessRequests || [];
  const localCurrentUserId = state.currentUserId || "";
  const nextAssets = rows.assets.map(assetFromStructuredRow);
  const historyByAsset = groupStructuredHistoryByAsset(rows.history);
  nextAssets.forEach((asset) => {
    if (!Array.isArray(asset.history) || !asset.history.length) {
      asset.history = historyByAsset.get(asset.id) || [];
    }
  });
  applyingSharedState = true;
  state = normalizeState({
    ...state,
    customers: rows.customers.map(customerFromStructuredRow),
    locations: rows.locations.map(locationFromStructuredRow),
    templates: rows.templates.map(templateFromStructuredRow),
    assets: nextAssets,
    workOrders: rows.workOrders.map(workOrderFromStructuredRow),
    serviceRequests: rows.serviceRequests.map(serviceRequestFromStructuredRow),
    users: localUsers,
    accessRequests: localAccessRequests,
    currentUserId: localCurrentUserId,
    sharedDataUpdatedAt: updatedAt || newestStructuredUpdatedAt(rows)
  });
  currentUser = state.users.find((user) => user.id === state.currentUserId) || currentUser;
  currentRole = currentUser?.role || "Customer";
  selectedCustomerId = selectedCustomerId || state.customers[0]?.id || "";
  selectedLocationId = "all";
  selectedId = getAssetIdFromUrl() || selectedId;
  persistLocalStateOnly(false);
  applyingSharedState = false;
  render();
  window.setTimeout(syncLoginQrReportPrompt, 0);
}

function structuredPayload(row) {
  return row?.data && typeof row.data === "object" ? row.data : {};
}

function withFileScope(file, scope = {}) {
  if (!file || typeof file !== "object") return file;
  return {
    ...file,
    customerId: file.customerId || file.customer_id || scope.customerId || scope.customer_id || "",
    locationId: file.locationId || file.location_id || scope.locationId || scope.location_id || ""
  };
}

function withRecordMediaScope(record, scope = {}) {
  if (!record || typeof record !== "object") return record;
  const next = { ...record };
  if (next.photo) next.photo = withFileScope(next.photo, scope);
  if (next.manualFile) next.manualFile = withFileScope(next.manualFile, scope);
  if (Array.isArray(next.photos)) next.photos = next.photos.map((photo) => withFileScope(photo, scope));
  if (Array.isArray(next.history)) {
    next.history = next.history.map((item) => ({
      ...item,
      photo: withFileScope(item.photo, scope)
    }));
  }
  return next;
}

function customerFromStructuredRow(row) {
  return {
    id: row.id,
    name: row.name || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    ...structuredPayload(row)
  };
}

function locationFromStructuredRow(row) {
  return {
    id: row.id,
    customerId: row.customer_id || "",
    name: row.name || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    ...structuredPayload(row)
  };
}

function templateFromStructuredRow(row) {
  return {
    id: row.id,
    name: row.name || "",
    items: Array.isArray(row.items) ? row.items : [],
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    ...structuredPayload(row)
  };
}

function assetFromStructuredRow(row) {
  const asset = {
    id: row.id,
    customerId: row.customer_id || "",
    locationId: row.location_id || "",
    templateId: row.template_id || "",
    name: row.name || "",
    frequencyDays: Number(row.frequency_days || 30),
    nextPmDate: row.next_pm_date || "",
    manufacturer: row.manufacturer || "",
    model: row.model || "",
    serial: row.serial || "",
    installDate: row.install_date || "",
    type: row.type || "",
    criticality: row.criticality || "",
    documentUrl: row.document_url || "",
    vendor: row.vendor || "",
    vendorContact: row.vendor_contact || "",
    warrantyDate: row.warranty_date || "",
    parts: row.parts || "",
    notes: row.notes || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    ...structuredPayload(row)
  };
  return withRecordMediaScope(asset, asset);
}

function workOrderFromStructuredRow(row) {
  const workOrder = {
    id: row.id,
    issueNumber: row.issue_number || row.ticket_number || null,
    assetId: row.asset_id || "",
    customerId: row.customer_id || "",
    locationId: row.location_id || "",
    title: row.title || "",
    priority: row.priority || "Medium",
    status: row.status || "Open",
    source: row.source || "",
    areaName: row.area_name || "",
    assignedUserId: row.assigned_user_id || "",
    assignedUserName: row.assigned_user_name || "",
    notes: row.notes || "",
    dueAt: row.due_at || "",
    resolvedAt: row.resolved_at || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    ...structuredPayload(row)
  };
  return withRecordMediaScope(workOrder, workOrder);
}

function serviceRequestFromStructuredRow(row) {
  const request = {
    id: row.id,
    serviceRequestNumber: row.service_request_number || null,
    assetId: row.asset_id || "",
    customerId: row.customer_id || "",
    locationId: row.location_id || "",
    title: row.title || "",
    priority: row.priority || "Medium",
    status: row.status || "New",
    requestedBy: row.requested_by || "",
    preferredDate: row.preferred_date || "",
    assignedUserId: row.assigned_user_id || "",
    assignedUserName: row.assigned_user_name || "",
    convertedWorkOrderId: row.converted_work_order_id || "",
    notes: row.notes || "",
    photo: row.photo_data_url ? { name: row.photo_name || "Service request photo", url: row.photo_data_url } : null,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    ...structuredPayload(row)
  };
  return withRecordMediaScope(request, request);
}

function groupStructuredHistoryByAsset(historyRows = []) {
  const grouped = new Map();
  historyRows.forEach((row) => {
    const history = {
      id: row.id,
      pmNumber: row.pm_number || null,
      technician: row.technician || "",
      result: row.result || "",
      reading: row.reading || "",
      notes: row.notes || "",
      completedChecks: Array.isArray(row.completed_checks) ? row.completed_checks : [],
      completedAt: row.completed_at || "",
      ...structuredPayload(row)
    };
    if (history.photo) history.photo = withFileScope(history.photo, { assetId: row.asset_id });
    const list = grouped.get(row.asset_id) || [];
    list.push(history);
    grouped.set(row.asset_id, list);
  });
  return grouped;
}

function newestStructuredUpdatedAt(rows) {
  return newestTimestampFromRows([
    ...rows.customers,
    ...rows.locations,
    ...rows.templates,
    ...rows.assets,
    ...rows.workOrders,
    ...rows.serviceRequests,
    ...rows.history
  ]);
}

function newestTimestampFromRows(rows = []) {
  return rows.map((row) => row.updated_at || row.completed_at || row.created_at || "")
    .filter(Boolean)
    .sort()
    .at(-1) || new Date().toISOString();
}

async function loadSharedStateFromSupabase(forceApplyAssets = false) {
  if (sharedStateLoading || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  sharedStateLoading = true;
  const localHadSharedData = hasSharedMaintenanceData(state);

  try {
    const response = await siteworksApi.loadSharedState(SHARED_APP_STATE_ID);
    sharedStateLoading = false;
    sharedStateReady = true;

    if (!response.ok) {
      const errorText = await response.text();
      markSyncError(`Shared cloud load failed: ${errorText}`);
      console.warn("Supabase shared data sync skipped.", errorText);
      return;
    }

    const rows = await response.json();
    const remoteRecord = rows?.[0];
    if (!remoteRecord?.data) {
      if (localHadSharedData) scheduleSharedStateSave(0);
      return false;
    }

    if (forceApplyAssets && Array.isArray(remoteRecord.data.assets) && remoteRecord.data.assets.length) {
      applySharedState(remoteRecord.data, remoteRecord.updated_at);
      markSyncSuccess("load");
      window.setTimeout(() => scheduleStructuredDataSync(0), 0);
      return true;
    }

    if (!localHadSharedData || isRemoteSharedStateNewer(remoteRecord.updated_at)) {
      applySharedState(remoteRecord.data, remoteRecord.updated_at);
      markSyncSuccess("load");
      return true;
    }
    markSyncSuccess("load");
    return false;
  } catch (error) {
    sharedStateLoading = false;
    sharedStateReady = true;
    markSyncError(error?.message || "Shared cloud load failed.");
    console.warn("Supabase shared data sync skipped.", error);
    return false;
  }
}

function applySharedState(sharedData, updatedAt = "") {
  const localUsers = state.users || [];
  const localAccessRequests = state.accessRequests || [];
  const localCurrentUserId = state.currentUserId || "";
  const nextUsers = Array.isArray(sharedData.users)
    ? mergeSharedUsers(sharedData.users, localUsers, localCurrentUserId)
    : localUsers;
  const nextAccessRequests = Array.isArray(sharedData.accessRequests)
    ? sharedData.accessRequests
    : localAccessRequests;
  applyingSharedState = true;
  state = normalizeState({
    ...state,
    ...sharedData,
    users: nextUsers,
    accessRequests: nextAccessRequests,
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
  if (!Array.isArray(sharedData.users) && nextUsers.some((user) => user.username !== "scan-customer")) {
    window.setTimeout(() => scheduleSharedStateSave(0), 0);
  }
  window.setTimeout(syncLoginQrReportPrompt, 0);
}

function mergeSharedUsers(sharedUsers = [], localUsers = [], localCurrentUserId = "") {
  const merged = [];
  const seen = new Set();
  const addUser = (user) => {
    if (!user?.id && !user?.username) return;
    const cleanUser = sanitizeSharedUser(user);
    const key = cleanUser.id || cleanUser.username.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(cleanUser);
  };
  sharedUsers.forEach(addUser);
  const currentLocalUser = localUsers.find((user) => user.id === localCurrentUserId);
  if (currentLocalUser && !merged.some((user) => user.id === currentLocalUser.id || user.username?.toLowerCase() === currentLocalUser.username?.toLowerCase())) {
    addUser(currentLocalUser);
  }
  return merged;
}

function sanitizeSharedUser(user) {
  const { session, ...rest } = user || {};
  return {
    ...rest,
    username: String(rest.username || "").trim().toLowerCase(),
    name: rest.name || rest.username || "",
    role: rest.role || "Customer",
    customerId: rest.customerId || "",
    locationId: rest.locationId || "",
    password: rest.password || "",
    localOnly: Boolean(rest.localOnly)
  };
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
    const response = await siteworksApi.saveSharedState(payload);
    if (!response.ok) {
      const errorText = await response.text();
      markSyncError(`Shared cloud save failed: ${errorText}`);
      console.warn("Supabase shared data save skipped.", errorText);
      return;
    }
    state.sharedDataUpdatedAt = uploadedAt;
    persistLocalStateOnly();
    markSyncSuccess("save");
  } catch (error) {
    markSyncError(error?.message || "Shared cloud save failed.");
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
    users: (state.users || []).map(sanitizeSharedUser),
    accessRequests: state.accessRequests || [],
    activityLog: state.activityLog || [],
    backupLocation: state.backupLocation || defaultBackupLocation(),
    qrBaseUrl: getQrBaseUrl(),
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
    candidate?.preferredContractors?.length ||
    candidate?.users?.some((user) => user.username !== "scan-customer") ||
    candidate?.accessRequests?.length
  );
}

function scheduleStructuredDataSync(delay = 2000) {
  if (applyingSharedState || isPublicReportUrl() || !hasSharedMaintenanceData(state)) return;
  window.clearTimeout(structuredSyncTimer);
  structuredSyncTimer = window.setTimeout(syncStructuredDataToSupabase, delay);
}

function leanCloudData(value) {
  if (Array.isArray(value)) return value.map(leanCloudData);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !["dataUrl", "photoDataUrl"].includes(key))
    .map(([key, item]) => [key, leanCloudData(item)]));
}

function leanCloudMedia(file) {
  if (!file || typeof file !== "object") return null;
  const clean = leanCloudData(file);
  return clean.url || clean.name ? clean : null;
}

function leanCloudRecord(record) {
  const clean = leanCloudData(record);
  if (clean.photo) clean.photo = leanCloudMedia(clean.photo);
  if (clean.manualFile) clean.manualFile = leanCloudMedia(clean.manualFile);
  if (Array.isArray(clean.photos)) clean.photos = clean.photos.map(leanCloudMedia).filter(Boolean);
  if (Array.isArray(clean.history)) {
    clean.history = clean.history.map((item) => ({
      ...item,
      photo: leanCloudMedia(item.photo)
    }));
  }
  return clean;
}

async function syncStructuredDataToSupabase() {
  if (structuredSyncActive || !hasSharedMaintenanceData(state)) return;
  structuredSyncActive = true;
  try {
    await upsertStructuredRows("customers", state.customers.map((customer) => ({
      id: customer.id,
      name: customer.name || "",
      created_at: customer.createdAt || new Date().toISOString(),
      updated_at: customer.updatedAt || state.updatedAt || new Date().toISOString(),
      data: customer
    })));

    await upsertStructuredRows("locations", state.locations.map((locationRecord) => ({
      id: locationRecord.id,
      customer_id: locationRecord.customerId,
      name: locationRecord.name || "",
      created_at: locationRecord.createdAt || new Date().toISOString(),
      updated_at: locationRecord.updatedAt || state.updatedAt || new Date().toISOString(),
      data: locationRecord
    })));

    await upsertStructuredRows("pm_templates", state.templates.map((template) => ({
      id: template.id,
      name: template.name || "",
      items: template.items || [],
      created_at: template.createdAt || new Date().toISOString(),
      updated_at: template.updatedAt || state.updatedAt || new Date().toISOString(),
      data: template
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
      updated_at: asset.updatedAt || state.updatedAt || new Date().toISOString(),
      data: leanCloudRecord(asset)
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
      updated_at: item.updatedAt || state.updatedAt || new Date().toISOString(),
      data: leanCloudRecord(item)
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
      photo_data_url: cloudMediaSource(item.photo),
      photo_name: item.photo?.name || "",
      created_at: item.createdAt || new Date().toISOString(),
      updated_at: item.updatedAt || state.updatedAt || new Date().toISOString(),
      data: leanCloudRecord(item)
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
      completed_at: item.completedAt || new Date().toISOString(),
      data: leanCloudRecord(item)
    })));
    await upsertStructuredRows("pm_history", historyRows);
    state.sharedDataUpdatedAt = state.updatedAt || new Date().toISOString();
    persistLocalStateOnly(false);
    markSyncSuccess("save");
  } catch (error) {
    markSyncError(error?.message || "Structured cloud save failed.");
    console.warn("Structured Supabase sync skipped.", error);
  } finally {
    structuredSyncActive = false;
  }
}

async function upsertStructuredRows(table, rows) {
  if (!rows.length) return;
  try {
    await siteworksApi.saveRows(table, rows);
  } catch (error) {
    const message = `Structured cloud save failed for ${table}: ${error?.message || error}`;
    markSyncError(message);
    console.warn(`Structured Supabase sync skipped for ${table}.`, error);
    throw new Error(message);
  }
}

async function deleteStructuredRows(table, column, values) {
  try {
    await siteworksApi.deleteRows(table, column, values);
  } catch (error) {
    console.warn(`Structured Supabase delete skipped for ${table}.`, error);
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
    photo: report.photo_data_url ? { name: report.photo_name || "Report photo", url: report.photo_data_url } : null,
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
    saveStateQuietly();
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
    qrBaseUrl: normalizeQrBaseUrl(input.qrBaseUrl || guessNetworkQrUrl()),
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
    equipmentId: asset.equipmentId || "",
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
  normalized.assets.forEach((asset) => {
    asset.extraChecklistItems = Array.isArray(asset.extraChecklistItems) ? asset.extraChecklistItems : [];
  });

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
      photos: [],
      ...item,
      history: Array.isArray(item.history) ? item.history : [],
      photos: Array.isArray(item.photos) ? item.photos : [],
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

  normalized.users = normalized.users.map((user) => {
    const customerId = user.role !== "Admin" && user.username !== "scan-customer"
      ? user.customerId || normalized.customers[0]?.id || ""
      : user.customerId || "";
    const locationRecord = normalized.locations.find((location) => location.id === user.locationId);
    const locationId = user.role !== "Admin" &&
      user.username !== "scan-customer" &&
      locationRecord?.customerId === customerId
      ? user.locationId || ""
      : "";
    return {
      ...user,
      customerId,
      locationId
    };
  });

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
  if (/sitesworks\.info$/i.test(location.hostname)) return PRODUCTION_SITE_URL;
  if (location.protocol.startsWith("http") && location.hostname !== "127.0.0.1" && location.hostname !== "localhost") {
    return getCurrentPageUrl();
  }
  return PRODUCTION_SITE_URL;
}

function saveState() {
  state.updatedAt = new Date().toISOString();
  persistLocalStateOnly();
  scheduleSharedStateSave();
  scheduleStructuredDataSync();
}

function saveStateQuietly() {
  state.updatedAt = new Date().toISOString();
  try {
    persistLocalStateOnly(false);
  } catch (error) {
    console.warn("Local state save skipped because browser storage is full.", error);
  }
  scheduleSharedStateSave();
  scheduleStructuredDataSync();
}

function persistLocalStateOnly(showStorageWarning = true) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    try {
      localStorage.removeItem(AUTO_BACKUP_KEY);
      LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (retryError) {
      if (showStorageWarning) showStorageFullWarning();
      throw retryError;
    }
  }
  try {
    createAutoBackup();
  } catch (error) {
    console.warn("Auto backup skipped because browser storage is full.", error);
  }
}

function showStorageFullWarning() {
  if (shouldSuppressStorageFullWarning()) {
    console.warn("Browser storage is full; warning suppressed during login.");
    return;
  }
  if (storageFullWarningShown) return;
  storageFullWarningShown = true;
  alert("The browser could not save this change because this iPad's browser storage is full. Try exporting a backup, then remove a few old photos or PDFs from equipment records.");
}

function shouldSuppressStorageFullWarning() {
  const loginVisible = els.loginScreen && !els.loginScreen.classList.contains("hidden");
  return suppressStorageFullWarning || (loginVisible && !currentUser);
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
  const primaryPhotos = state.assets.filter((asset) => hasMedia(asset.photo)).length;
  const extraPhotos = state.assets.reduce((total, asset) => total + (asset.photos || []).length, 0);
  const pmPhotos = state.assets.reduce((total, asset) => (
    total + (asset.history || []).filter((item) => hasMedia(item.photo)).length
  ), 0);
  const uploadedManuals = state.assets.filter((asset) => hasMedia(asset.manualFile)).length;
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

function storedFileCloudPath(file) {
  return String(file?.storageKey || file?.storage_key || file?.path || file?.url || file?.publicUrl || file?.public_url || "").trim();
}

function isCloudBackedFile(file) {
  return Boolean(storedFileCloudPath(file));
}

function hasLocalBrowserCopy(file) {
  return Boolean(file?.dataUrl || file?.photoDataUrl);
}

function estimateDataUrlBytes(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return 0;
  const payload = dataUrl.includes(",") ? dataUrl.split(",").pop() : dataUrl;
  return Math.round(payload.length * 0.75);
}

function estimateLocalFileBytes(file) {
  return estimateDataUrlBytes(file?.dataUrl) + estimateDataUrlBytes(file?.photoDataUrl);
}

function collectStoredFileEntries() {
  const items = [];
  const addFile = (kind, label, file) => {
    if (!file || typeof file !== "object") return;
    if (!hasLocalBrowserCopy(file) && !isCloudBackedFile(file) && !file.name && !file.type) return;
    items.push({ kind, label: label || file.name || "File", file });
  };

  state.assets.forEach((asset) => {
    addFile("equipmentPhoto", asset.name, asset.photo);
    (asset.photos || []).forEach((photo) => addFile("equipmentGallery", asset.name, photo));
    addFile("manual", asset.name, asset.manualFile);
    (asset.history || []).forEach((record) => addFile("pmHistory", asset.name, record.photo));
    addFile("panelLogo", asset.name, asset.electricalPanelSchedule?.logo);
  });

  state.workOrders.forEach((workOrder) => {
    addFile("ticketPhoto", workOrder.title || formatIssueNumber(workOrder), workOrder.photo);
    (workOrder.photos || []).forEach((photo) => addFile("ticketPhoto", workOrder.title || formatIssueNumber(workOrder), photo));
  });

  state.serviceRequests.forEach((request) => {
    addFile("servicePhoto", request.title || formatServiceRequestNumber(request), request.photo);
  });

  return items;
}

function getStoredFileHealth() {
  return collectStoredFileEntries().reduce((summary, item) => {
    const localBytes = estimateLocalFileBytes(item.file);
    const localCopy = hasLocalBrowserCopy(item.file);
    const cloudBacked = isCloudBackedFile(item.file);
    summary.total += 1;
    summary[item.kind] = (summary[item.kind] || 0) + 1;
    if (cloudBacked) summary.cloudBacked += 1;
    if (localCopy && !cloudBacked) {
      summary.localOnly += 1;
      summary.localBytes += localBytes;
    }
    if (localCopy && cloudBacked) {
      summary.removableLocalCopies += 1;
      summary.removableLocalBytes += localBytes;
    }
    if (!localCopy && !cloudBacked) summary.brokenReferences += 1;
    return summary;
  }, {
    total: 0,
    cloudBacked: 0,
    localOnly: 0,
    localBytes: 0,
    removableLocalCopies: 0,
    removableLocalBytes: 0,
    brokenReferences: 0
  });
}

function buildStorageHealthSummaryText(summary = getStoredFileHealth()) {
  const migrationText = buildLocalFileMigrationSummaryText(scanLocalFilesForCloudMigration());
  const notes = [];
  if (summary.removableLocalCopies) {
    notes.push(`${summary.removableLocalCopies} cloud-backed local cop${summary.removableLocalCopies === 1 ? "y is" : "ies are"} ready to remove (${formatBytes(summary.removableLocalBytes)}).`);
  }
  if (summary.brokenReferences) {
    notes.push(`${summary.brokenReferences} file reference${summary.brokenReferences === 1 ? "" : "s"} may be missing a browser copy or cloud link.`);
  }
  return notes.length ? `${migrationText} ${notes.join(" ")}` : migrationText;
}

function scanLocalFilesForCloudMigration() {
  const items = collectLocalFileMigrationItems();
  const counts = items.reduce((summary, item) => {
    summary.total += 1;
    summary[item.kind] = (summary[item.kind] || 0) + 1;
    return summary;
  }, { total: 0 });
  return counts;
}

function buildLocalFileMigrationSummaryText(summary) {
  if (!summary.total) return "No old browser-stored photos or PDFs were found. New uploads are already cloud-ready.";
  const parts = [
    summary.equipmentPhoto ? `${summary.equipmentPhoto} primary equipment photo${summary.equipmentPhoto === 1 ? "" : "s"}` : "",
    summary.equipmentGallery ? `${summary.equipmentGallery} gallery photo${summary.equipmentGallery === 1 ? "" : "s"}` : "",
    summary.manual ? `${summary.manual} PDF manual${summary.manual === 1 ? "" : "s"}` : "",
    summary.pmHistory ? `${summary.pmHistory} PM history photo${summary.pmHistory === 1 ? "" : "s"}` : "",
    summary.ticketPhoto ? `${summary.ticketPhoto} ticket photo${summary.ticketPhoto === 1 ? "" : "s"}` : "",
    summary.servicePhoto ? `${summary.servicePhoto} service request photo${summary.servicePhoto === 1 ? "" : "s"}` : "",
    summary.panelLogo ? `${summary.panelLogo} panel logo${summary.panelLogo === 1 ? "" : "s"}` : ""
  ].filter(Boolean);
  return `Found ${summary.total} old browser-stored file${summary.total === 1 ? "" : "s"}: ${parts.join(", ")}.`;
}

function updateCloudCleanupStatus(message, manualMessage = true) {
  if (!els.cloudCleanupStatus) return;
  els.cloudCleanupStatus.textContent = message;
  els.cloudCleanupStatus.dataset.manualMessage = manualMessage ? "true" : "";
}

function collectLocalFileMigrationItems() {
  const items = [];
  state.assets.forEach((asset) => {
    if (shouldMigrateLocalFile(asset.photo)) {
      items.push({ kind: "equipmentPhoto", folder: "equipment", name: asset.photo.name, get: () => asset.photo, set: (file) => { asset.photo = file; } });
    }
    (asset.photos || []).forEach((photo, index) => {
      if (!shouldMigrateLocalFile(photo)) return;
      items.push({ kind: "equipmentGallery", folder: "equipment-gallery", name: photo.name, get: () => asset.photos[index], set: (file) => { asset.photos[index] = file; } });
    });
    if (shouldMigrateLocalFile(asset.manualFile)) {
      items.push({ kind: "manual", folder: "manuals", name: asset.manualFile.name, get: () => asset.manualFile, set: (file) => { asset.manualFile = file; } });
    }
    (asset.history || []).forEach((record, index) => {
      if (!shouldMigrateLocalFile(record.photo)) return;
      items.push({ kind: "pmHistory", folder: "pm-history", name: record.photo.name, get: () => asset.history[index].photo, set: (file) => { asset.history[index].photo = file; } });
    });
    if (shouldMigrateLocalFile(asset.electricalPanelSchedule?.logo)) {
      items.push({
        kind: "panelLogo",
        folder: "panel-logos",
        name: asset.electricalPanelSchedule.logo.name,
        get: () => asset.electricalPanelSchedule.logo,
        set: (file) => { asset.electricalPanelSchedule.logo = file; }
      });
    }
  });
  state.workOrders.forEach((workOrder) => {
    if (shouldMigrateLocalFile(workOrder.photo)) {
      items.push({ kind: "ticketPhoto", folder: "tickets", name: workOrder.photo.name, get: () => workOrder.photo, set: (file) => { workOrder.photo = file; } });
    }
    (workOrder.photos || []).forEach((photo, index) => {
      if (!shouldMigrateLocalFile(photo)) return;
      items.push({ kind: "ticketPhoto", folder: "tickets", name: photo.name, get: () => workOrder.photos[index], set: (file) => { workOrder.photos[index] = file; } });
    });
  });
  state.serviceRequests.forEach((request) => {
    if (!shouldMigrateLocalFile(request.photo)) return;
    items.push({ kind: "servicePhoto", folder: "service-requests", name: request.photo.name, get: () => request.photo, set: (file) => { request.photo = file; } });
  });
  return items;
}

function collectCloudBackedLocalCopies() {
  const items = [];
  const addIfCloudBacked = (kind, label, get, set) => {
    const file = get();
    if (!hasLocalBrowserCopy(file) || !isCloudBackedFile(file)) return;
    items.push({ kind, label: label || file.name || "file", get, set });
  };
  state.assets.forEach((asset) => {
    addIfCloudBacked("equipmentPhoto", asset.photo?.name || asset.name, () => asset.photo, (file) => { asset.photo = file; });
    (asset.photos || []).forEach((photo, index) => {
      addIfCloudBacked("equipmentGallery", photo?.name || asset.name, () => asset.photos[index], (file) => { asset.photos[index] = file; });
    });
    addIfCloudBacked("manual", asset.manualFile?.name || asset.name, () => asset.manualFile, (file) => { asset.manualFile = file; });
    (asset.history || []).forEach((record, index) => {
      addIfCloudBacked("pmHistory", record.photo?.name || asset.name, () => asset.history[index].photo, (file) => { asset.history[index].photo = file; });
    });
    addIfCloudBacked("panelLogo", asset.electricalPanelSchedule?.logo?.name || asset.name, () => asset.electricalPanelSchedule?.logo, (file) => {
      if (asset.electricalPanelSchedule) asset.electricalPanelSchedule.logo = file;
    });
  });
  state.workOrders.forEach((workOrder) => {
    addIfCloudBacked("ticketPhoto", workOrder.photo?.name || workOrder.title, () => workOrder.photo, (file) => { workOrder.photo = file; });
    (workOrder.photos || []).forEach((photo, index) => {
      addIfCloudBacked("ticketPhoto", photo?.name || workOrder.title, () => workOrder.photos[index], (file) => { workOrder.photos[index] = file; });
    });
  });
  state.serviceRequests.forEach((request) => {
    addIfCloudBacked("servicePhoto", request.photo?.name || request.title, () => request.photo, (file) => { request.photo = file; });
  });
  return items;
}

function removeCloudBackedLocalCopies() {
  if (!canManageWorkOrders()) {
    updateCloudCleanupStatus("Only Admin or Manager logins can remove local browser copies.");
    return;
  }
  const items = collectCloudBackedLocalCopies();
  if (!items.length) {
    updateCloudCleanupStatus("No removable local copies found. Cloud-backed files are already lean.");
    return;
  }
  const confirmed = window.confirm(`Remove local browser copies from ${items.length} cloud-backed file${items.length === 1 ? "" : "s"}? A complete backup will download first.`);
  if (!confirmed) return;
  exportCompleteBackup();
  items.forEach((item) => {
    const file = item.get();
    if (!file) return;
    const { dataUrl, photoDataUrl, ...cleanFile } = file;
    item.set(cleanFile);
  });
  addActivity("Local file copies removed", `${items.length} cloud-backed local file cop${items.length === 1 ? "y" : "ies"} removed from browser storage.`);
  saveState();
  render();
  updateCloudCleanupStatus(`Removed local browser copies from ${items.length} cloud-backed file${items.length === 1 ? "" : "s"}.`);
}

function shouldMigrateLocalFile(file) {
  return Boolean(hasLocalBrowserCopy(file) && !isCloudBackedFile(file));
}

async function migrateLocalFilesToCloud() {
  if (!canManageWorkOrders()) {
    updateCloudCleanupStatus("Only Admin or Manager logins can move files to cloud storage.");
    return;
  }
  const items = collectLocalFileMigrationItems();
  if (!items.length) {
    updateCloudCleanupStatus("No old browser-stored photos or PDFs were found.");
    return;
  }
  const confirmed = window.confirm(`Move ${items.length} old browser-stored file${items.length === 1 ? "" : "s"} to Supabase Storage? A complete backup will download first.`);
  if (!confirmed) return;
  exportCompleteBackup();
  els.cloudCleanupBlock?.classList.add("is-working");
  if (els.migrateLocalFilesBtn) els.migrateLocalFilesBtn.disabled = true;
  if (els.scanLocalFilesBtn) els.scanLocalFilesBtn.disabled = true;
  let moved = 0;
  let failed = 0;
  try {
    for (const item of items) {
      updateCloudCleanupStatus(`Moving ${moved + 1} of ${items.length}: ${item.name || "file"}...`);
      const localFile = item.get();
      const stored = await uploadDataUrlToSupabaseStorage(localFile, item.folder);
      if (stored) {
        item.set({ ...localFile, ...stored, dataUrl: "" });
        moved += 1;
      } else {
        failed += 1;
      }
    }
    if (moved) {
      addActivity("Local files moved to cloud", `${moved} file${moved === 1 ? "" : "s"} moved to Supabase Storage.`);
      saveState();
      render();
    }
    updateCloudCleanupStatus(failed
      ? `Moved ${moved} file${moved === 1 ? "" : "s"} to cloud. ${failed} file${failed === 1 ? "" : "s"} could not be uploaded.`
      : `Moved ${moved} file${moved === 1 ? "" : "s"} to cloud. Browser storage should be lighter now.`);
  } finally {
    els.cloudCleanupBlock?.classList.remove("is-working");
    if (els.migrateLocalFilesBtn) els.migrateLocalFilesBtn.disabled = false;
    if (els.scanLocalFilesBtn) els.scanLocalFilesBtn.disabled = false;
  }
}

async function uploadDataUrlToSupabaseStorage(file, folder) {
  if (!file?.dataUrl) return null;
  const blob = dataUrlToBlob(file.dataUrl);
  const uploadName = file.name || `${folder || "file"}-${Date.now()}`;
  const uploadFile = new File([blob], uploadName, { type: file.type || blob.type || "application/octet-stream" });
  return uploadFileToSupabaseStorage(uploadFile, folder);
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
    notes: "Belt tracking ticket appears every few weeks."
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
  const dataUrl = await resizePhotoDataUrl(rawDataUrl, 640, 0.5);
  return storeResizedPhotoFile(file, dataUrl, "equipment");
}

async function readIssuePhoto(file) {
  if (!file) return null;
  const rawDataUrl = await fileToDataUrl(file);
  const dataUrl = await resizePhotoDataUrl(rawDataUrl, 720, 0.58);
  return storeResizedPhotoFile(file, dataUrl, "tickets");
}

async function readServiceRequestPhoto(file) {
  if (!file) return null;
  const rawDataUrl = await fileToDataUrl(file);
  const dataUrl = await resizePhotoDataUrl(rawDataUrl, 680, 0.54);
  return storeResizedPhotoFile(file, dataUrl, "service-requests");
}

async function readPublicReportPhoto(file) {
  if (!file) return null;
  const rawDataUrl = await fileToDataUrl(file);
  const dataUrl = await resizePhotoDataUrl(rawDataUrl, 520, 0.45);
  return storeResizedPhotoFile(file, dataUrl, "public-reports");
}

async function safeReadPublicReportPhoto(file) {
  lastPublicReportError = "";
  if (!file) return null;
  try {
    return await readPublicReportPhoto(file);
  } catch (error) {
    console.warn("Public report photo could not be read.", error);
    lastPublicReportError = "That photo could not be attached.";
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
  return storeResizedPhotoFile(file, dataUrl, "equipment-gallery");
}

async function readDocumentFile(file, expectedType) {
  if (!file) return null;
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (expectedType === "application/pdf" && !isPdf) {
    alert("Please choose a PDF file.");
    return null;
  }
  const stored = await uploadFileToSupabaseStorage(file, "manuals");
  if (stored) {
    return stored;
  }
  if (file.size > 4 * 1024 * 1024) {
    alert("That PDF could not be uploaded to cloud storage and is too large for browser storage. Run the Supabase Storage setup, then try again.");
    return null;
  }
  const dataUrl = await fileToDataUrl(file);
  return { name: file.name, type: file.type || expectedType || "application/octet-stream", dataUrl };
}

async function storeResizedPhotoFile(file, dataUrl, folder) {
  const blob = dataUrlToBlob(dataUrl);
  const uploadFile = new File([blob], replaceFileExtension(file.name || "photo.jpg", "jpg"), { type: "image/jpeg" });
  const stored = await uploadFileToSupabaseStorage(uploadFile, folder);
  return stored || { name: file.name, type: "image/jpeg", dataUrl };
}

async function uploadFileToSupabaseStorage(file, folder = "uploads") {
  if (!file) return null;
  try {
    return await siteworksApi.uploadFile(file, folder, getSavedAuthSession());
  } catch (error) {
    console.warn("Supabase Storage upload skipped.", error);
    return null;
  }
}

function dataUrlToBlob(dataUrl) {
  const [header, payload] = String(dataUrl || "").split(",");
  const mime = /data:([^;]+)/.exec(header || "")?.[1] || "application/octet-stream";
  const binary = atob(payload || "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

function replaceFileExtension(name, extension) {
  const cleanName = String(name || "file").replace(/\.[^.]+$/, "");
  return `${cleanName}.${extension}`;
}

function slugifyStoragePath(value) {
  return String(value || "file")
    .trim()
    .replace(/[^a-z0-9._/-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "")
    .toLowerCase() || "file";
}

function mediaSource(file) {
  if (!file) return "";
  const signedUrl = signedMediaSource(file);
  return signedUrl || file.url || file.publicUrl || file.public_url || file.dataUrl || "";
}

function cloudMediaSource(file) {
  return file?.url || file?.publicUrl || file?.public_url || "";
}

function hasMedia(file) {
  return Boolean(mediaSource(file));
}

function signedMediaKey(file) {
  const path = file?.storageKey || file?.storage_key || file?.path || "";
  if (!path) return "";
  return `${file.bucket || file.storageBucket || SUPABASE_STORAGE_BUCKET}:${path}`;
}

function signedMediaSource(file) {
  if (!siteworksServerEnabled()) return "";
  const key = signedMediaKey(file);
  if (!key) return "";
  const cached = signedMediaUrlCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 30 * 1000) return cached.url;
  requestSignedMediaUrl(file, key);
  return cached?.url || "";
}

function requestSignedMediaUrl(file, key = signedMediaKey(file)) {
  if (!key || signedMediaUrlPending.has(key)) return;
  signedMediaUrlPending.add(key);
  siteworksApi.getSignedFileUrl(file)
    .then(async (response) => {
      if (!response?.ok) return;
      const data = await response.json();
      if (!data?.signedUrl) return;
      signedMediaUrlCache.set(key, {
        url: data.signedUrl,
        expiresAt: Date.now() + Number(data.expiresIn || 600) * 1000
      });
      window.setTimeout(render, 0);
    })
    .catch((error) => console.warn("Signed file link skipped.", error))
    .finally(() => signedMediaUrlPending.delete(key));
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

function downloadAssetRegisterCsv(assets, filename = `asset-register-${timestampForFile()}.csv`) {
  const rows = [
    ["Customer", "Location", "Equipment ID", "Equipment", "Status", "Next Maintenance", "Open Tickets", "Template", "Equipment Type", "Criticality", "Manufacturer", "Model", "Serial", "Install Date", "Vendor", "Vendor Contact", "Warranty Expires", "Parts / Supply Notes", "Manual / Document Link", "Uploaded Manual File", "Photo File", "Notes"],
    ...assets.map((asset) => {
      const customer = getCustomer(asset.customerId);
      const locationRecord = getLocation(asset.locationId);
      const template = getTemplate(asset.templateId);
      const due = getDueInfo(asset);
      return [
        customer?.name || "",
        locationRecord?.name || "",
        getAssetEquipmentId(asset),
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
  link.download = filename;
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

function getCurrentUserLabel() {
  return currentUser?.name || currentUser?.username || currentUser?.displayName || "SiteWorks user";
}

function appendDatedWorkNote(existingNotes, note, date = new Date()) {
  const cleanNote = String(note || "").trim();
  const currentNotes = String(existingNotes || "").trim();
  if (!cleanNote) return currentNotes;
  const entry = `${formatDateTime(date)} | ${getCurrentUserLabel()}\n${cleanNote}`;
  return currentNotes ? `${currentNotes}\n\n${entry}` : entry;
}

function formatOpenTicketAge(item) {
  if (!item || ["Resolved", "Closed"].includes(item.status)) return "";
  const created = new Date(item.createdAt || item.updatedAt || Date.now());
  if (Number.isNaN(created.getTime())) return "";
  const ageDays = Math.max(0, Math.floor((startOfDay(new Date()) - startOfDay(created)) / 86400000));
  if (ageDays === 0) return "Open today";
  if (ageDays === 1) return "Open for 1 day";
  return `Open for ${ageDays} days`;
}

function formatOpenServiceRequestAge(item) {
  if (!item || ["Completed", "Declined"].includes(item.status)) return "";
  const created = new Date(item.createdAt || item.updatedAt || Date.now());
  if (Number.isNaN(created.getTime())) return "";
  const ageDays = Math.max(0, Math.floor((startOfDay(new Date()) - startOfDay(created)) / 86400000));
  if (ageDays === 0) return "Open today";
  if (ageDays === 1) return "Open for 1 day";
  return `Open for ${ageDays} days`;
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
