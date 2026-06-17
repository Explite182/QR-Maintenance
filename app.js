const STORAGE_KEY = "qr-pm-prototype-v3";
const AUTO_BACKUP_KEY = "qr-pm-prototype-auto-backups-v1";
const MAX_AUTO_BACKUPS = 5;
const LEGACY_KEYS = ["qr-pm-prototype-v2", "qr-pm-prototype-v1"];
const SUPABASE_URL = "https://chpjmtfxmkcelszeixnu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_HduxX7ZCGdxQpT0xtDv7hQ_dVz_fAwr";
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
let remoteReportsLoaded = false;
let remoteReportsLoading = false;

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
  printFilteredLabelsBtn: document.getElementById("printFilteredLabelsBtn"),
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
  dueToday: document.getElementById("dueToday"),
  overdue: document.getElementById("overdue"),
  completed: document.getElementById("completed"),
  openWorkOrders: document.getElementById("openWorkOrders"),
  workOrderCount: document.getElementById("workOrderCount"),
  workOrderList: document.getElementById("workOrderList"),
  assetWorkOrderCount: document.getElementById("assetWorkOrderCount"),
  assetWorkOrderList: document.getElementById("assetWorkOrderList"),
  assetGalleryCount: document.getElementById("assetGalleryCount"),
  assetGalleryPanel: document.getElementById("assetGalleryPanel"),
  exportBtn: document.getElementById("exportBtn"),
  printLabelsBtn: document.getElementById("printLabelsBtn"),
  labelSheet: document.getElementById("labelSheet"),
  photoViewer: document.getElementById("photoViewer"),
  photoViewerImage: document.getElementById("photoViewerImage"),
  photoViewerCaption: document.getElementById("photoViewerCaption"),
  photoViewerClose: document.getElementById("photoViewerClose")
};

render();

window.addEventListener("hashchange", () => {
  hydrateAssetFromHash();
  if (!currentUser && isQrAccessUrl() && getAssetIdFromUrl()) {
    currentUser = getOrCreateCustomerAccessUser();
    assignQrCustomerAccessUser();
    currentRole = currentUser.role;
    state.currentUserId = currentUser.id;
    saveState();
  }
  selectedId = getAssetIdFromUrl() || selectedId;
  syncFiltersToSelectedAsset();
  render();
});

els.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const user = findUserForLogin(els.loginUsername.value, els.loginPassword.value);

  if (!user) {
    els.loginError.textContent = "Username or password is incorrect.";
    return;
  }

  currentUser = user;
  currentRole = user.role;
  state.currentUserId = user.id;
  saveState();
  els.loginForm.reset();
  els.loginError.textContent = "";
  render();
});

els.firstAdminForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (hasSetupUsers()) return;
  const username = els.firstAdminUsername.value.trim();
  const name = els.firstAdminName.value.trim() || username;
  const password = els.firstAdminPassword.value;
  if (!username || !password.trim()) {
    els.firstAdminMessage.textContent = "Enter a username and password.";
    return;
  }
  const user = {
    id: crypto.randomUUID(),
    username,
    name,
    password,
    role: "Admin",
    customerId: "",
    createdAt: new Date().toISOString()
  };
  state.users.push(user);
  currentUser = user;
  currentRole = user.role;
  state.currentUserId = user.id;
  addActivity("First admin created", username);
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

els.publicReportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const report = getReportContext();
  if (!report) return;
  const photo = await readPhoto(els.publicReportPhoto.files[0]);
  const note = els.publicReportNote.value.trim();
  const contact = els.publicReportContact.value.trim();
  const issue = createIssueFromPublicReport(report, note, contact, photo);
  const remoteId = await savePublicReportToSupabase(report, note, contact, photo);
  if (remoteId) issue.remoteReportId = remoteId;
  state.workOrders.unshift(issue);
  addActivity("Public issue reported", issue.title);
  saveState();
  els.publicReportForm.reset();
  els.publicReportMessage.textContent = remoteId
    ? "Report sent. Thank you."
    : "Report saved on this device. Shared sync will start after Supabase setup is complete.";
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
  exportDataBackup("logout");
  currentUser = null;
  currentRole = "Customer";
  state.currentUserId = "";
  if (!isQrAccessUrl()) {
    history.replaceState(null, "", getCurrentPageUrl());
  }
  saveState();
  render();
});

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

els.userForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canManageSetup()) return;
  const username = els.newUsername.value.trim();
  if (state.users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    alert("That username already exists.");
    return;
  }

  const newUser = {
    id: crypto.randomUUID(),
    username,
    name: els.newUserName.value.trim(),
    password: els.newUserPassword.value,
    role: els.newUserRole.value,
    customerId: els.newUserRole.value === "Customer" ? els.newUserCustomer.value : "",
    createdAt: new Date().toISOString()
  };
  state.users.push(newUser);
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

els.userList.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canManageSetup()) return;
  const form = event.target.closest("form[data-user-id]");
  if (!form) return;
  const user = state.users.find((item) => item.id === form.dataset.userId);
  if (!user) return;

  const formData = new FormData(form);
  const username = String(formData.get("username") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "Customer");
  const customerId = role === "Customer" ? String(formData.get("customerId") || "") : "";
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
  if (password.trim()) user.password = password;
  user.updatedAt = new Date().toISOString();
  if (currentUser?.id === user.id) {
    currentUser = user;
    currentRole = user.role;
  }
  addActivity("User updated", `${user.username} (${user.role})`);
  saveState();
  render();
});

els.userList.addEventListener("click", (event) => {
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
    if (filter === "workOrders") {
      assetSort = "workOrders";
      assetStatusFilter = "all";
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

els.printLabelsBtn.addEventListener("click", () => {
  renderLabels();
  window.print();
});

els.printFilteredLabelsBtn.addEventListener("click", () => {
  renderLabels(assetTableAssets());
  window.print();
});

els.printReportLabelsBtn.addEventListener("click", () => {
  renderReportLabels(assetTableAssets());
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
  const button = event.target.closest("[data-work-order-action]");
  if (!button || !canManageWorkOrders()) return;
  const workOrder = getWorkOrder(button.dataset.workOrderId);
  if (!workOrder) return;

  workOrder.status = button.dataset.workOrderAction;
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

  els.historyList.innerHTML = asset.history.length
    ? asset.history.map(renderHistoryItem).join("")
    : `<p class="muted">No completed maintenance yet.</p>`;
}

function renderAuth() {
  const isReport = isPublicReportUrl();
  const isLoggedIn = Boolean(currentUser);
  const needsFirstAdmin = !isReport && !isLoggedIn && !hasSetupUsers();
  els.publicReportScreen.classList.toggle("hidden", !isReport);
  els.loginScreen.classList.toggle("hidden", isReport || isLoggedIn);
  els.loginForm.classList.toggle("hidden", needsFirstAdmin);
  els.firstAdminForm.classList.toggle("hidden", !needsFirstAdmin);
  els.appOnly.forEach((node) => node.classList.toggle("hidden", isReport || !isLoggedIn));
  if (isReport || !isLoggedIn) return;
  els.currentUserName.textContent = currentUser.name || currentUser.username;
  els.currentUserRole.textContent = currentUser.role;
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
  const isCustomer = currentRole === "Customer";
  els.adminToolsDrawer.classList.toggle("hidden", isCustomer);
  if (isCustomer) els.adminToolsDrawer.open = false;
  [els.quickAddDrawer, els.setupDrawer, els.backupDrawer].forEach((drawer) => {
    drawer.classList.toggle("hidden", isCustomer);
    if (isCustomer) drawer.open = false;
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
  const customerAssignment = user.role === "Customer"
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
          Username
          <input name="username" required value="${escapeAttribute(user.username)}" ${disabled}>
        </label>
        <label>
          Display name
          <input name="name" required value="${escapeAttribute(user.name || user.username)}" ${disabled}>
        </label>
        <label>
          New password
          <input name="password" type="password" placeholder="Leave blank to keep current password" ${disabled}>
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
  els.customerFilter.disabled = currentRole === "Customer";

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
  els.dueToday.textContent = dueInfos.filter((item) => item.daysUntil <= 0).length;
  els.overdue.textContent = dueInfos.filter((item) => item.daysUntil < 0).length;
  els.completed.textContent = assets.reduce((count, asset) => count + asset.history.length, 0);
  els.openWorkOrders.textContent = filteredWorkOrders().filter((item) => item.status !== "Closed").length;
}

function renderAssetTableControls() {
  els.assetSearch.value = assetQuery;
  els.statusFilter.value = assetStatusFilter;
  els.assetSort.value = assetSort;
  els.assetPageSize.value = String(assetPageSize);
  els.templateFilter.innerHTML = [
    `<option value="all">All templates</option>`,
    ...state.templates.map((template) => `<option value="${template.id}">${escapeHtml(template.name)}</option>`)
  ].join("");
  els.templateFilter.value = state.templates.some((template) => template.id === assetTemplateFilter)
    ? assetTemplateFilter
    : "all";
}

function renderAssetTable() {
  const assets = assetTableAssets();
  const totalPages = getAssetTablePageCount(assets);
  assetPage = Math.min(assetPage, totalPages);
  const start = (assetPage - 1) * assetPageSize;
  const pageAssets = assets.slice(start, start + assetPageSize);
  els.tableAssetCount.textContent = assets.length;
  els.assetTableBody.innerHTML = pageAssets.length
    ? pageAssets.map(renderAssetTableRow).join("")
    : `<tr><td colspan="9" class="empty-cell">No equipment matches these filters.</td></tr>`;

  els.assetTableBody.querySelectorAll("tr[data-id]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("[data-edit-asset]")) return;
      selectedId = row.dataset.id;
      syncFiltersToSelectedAsset();
      location.hash = `asset/${selectedId}`;
      render();
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
  const workOrders = filteredWorkOrders().filter((item) => item.status !== "Closed");
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
  els.editAssetDocumentUrl.value = asset.documentUrl || "";
  els.editAssetNotes.value = asset.notes || "";
  els.editAssetManualFile.value = "";
  els.assetManualUploadStatus.textContent = "";
  els.editAssetPhoto.value = "";
  els.editAssetGalleryPhotos.value = "";
  els.assetGalleryUploadStatus.textContent = "";
}

function renderHistoryItem(item) {
  const checks = item.completedChecks.length ? item.completedChecks.join(", ") : "No checklist items selected";
  return `
    <article class="history-item">
      <header>
        <span>${escapeHtml(item.result)}</span>
        <time>${formatDate(new Date(item.completedAt))}</time>
      </header>
      <p><strong>Technician:</strong> ${escapeHtml(item.technician)}</p>
      <p><strong>Checks:</strong> ${escapeHtml(checks)}</p>
      ${item.reading ? `<p><strong>Reading:</strong> ${escapeHtml(item.reading)}</p>` : ""}
      ${item.notes ? `<p><strong>Notes:</strong> ${escapeHtml(item.notes)}</p>` : ""}
      ${item.photo ? `<img class="history-photo" alt="PM evidence photo" src="${item.photo.dataUrl}">` : ""}
    </article>
  `;
}

function renderWorkOrderItem(item) {
  const asset = getAsset(item.assetId);
  const customer = getCustomer(item.customerId);
  const locationRecord = getLocation(item.locationId);
  const assetAction = asset
    ? `<button class="secondary mini" type="button" data-asset-link="${item.assetId}">View Equipment</button>`
    : "";
  const actions = item.status === "Closed" ? "" : `
    <div class="work-order-actions">
      ${item.status === "Open" ? `<button class="secondary" data-work-order-id="${item.id}" data-work-order-action="In progress">Start</button>` : ""}
      <button class="secondary" data-work-order-id="${item.id}" data-work-order-action="Closed">Close</button>
    </div>
  `;
  return `
    <article class="work-order-item">
      <header>
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.priority)} | ${escapeHtml(item.status)} | Due ${formatDate(new Date(item.dueAt))}</span>
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
  return currentRole === "Admin" || currentRole === "Manager";
}

function canCompletePm() {
  return currentRole === "Admin" || currentRole === "Manager" || currentRole === "Technician" || currentRole === "Customer";
}

function canManageWorkOrders() {
  return currentRole === "Admin" || currentRole === "Manager";
}

function hasSetupUsers() {
  return state.users.some((user) => user.username !== "scan-customer");
}

function visibleCustomers() {
  if (currentRole !== "Customer") return state.customers;
  return state.customers.filter((customer) => customer.id === currentUser?.customerId);
}

function canSeeCustomer(customerId) {
  return currentRole !== "Customer" || currentUser?.customerId === customerId;
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
      console.warn("Supabase public report save skipped.", await response.text());
      return "";
    }
    const data = await response.json();
    return data?.[0]?.id || "";
  } catch (error) {
    console.warn("Supabase public report save skipped.", error);
    return "";
  }
}

async function syncPublicReportsFromSupabase() {
  if (remoteReportsLoaded || remoteReportsLoading || !canManageWorkOrders()) return;
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
  return normalized.users.find((user) => user.id === normalized.currentUserId) || null;
}

function getInitialUser() {
  if (isQrAccessUrl() && getAssetIdFromUrl()) {
    const user = getOrCreateCustomerAccessUser();
    state.currentUserId = user.id;
    user.customerId = getRawAsset(getAssetIdFromUrl())?.customerId || "";
    selectedCustomerId = user.customerId || selectedCustomerId;
    saveState();
    return user;
  }
  const user = getCurrentSessionUser();
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
    qrBaseUrl: input.qrBaseUrl || guessNetworkQrUrl()
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
    customerId: user.role === "Customer" && user.username !== "scan-customer"
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
    qrBaseUrl: guessNetworkQrUrl()
  };
}

function defaultBackupLocation() {
  return "C:\\Users\\expli\\Documents\\QR Maintenance Backups\\Data Backups";
}

function guessNetworkQrUrl() {
  if (location.protocol.startsWith("http") && location.hostname !== "127.0.0.1" && location.hostname !== "localhost") {
    return getCurrentPageUrl();
  }
  return "http://10.0.0.12:8766/index.html";
}

function saveState() {
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
    ? `qr-maintenance-logout-backup-${timestampForFile()}.json`
    : `qr-maintenance-data-backup-${timestampForFile()}.json`;
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
  link.download = `qr-maintenance-complete-backup-${timestampForFile()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function buildBackupPayload(reason) {
  return {
    app: "QR Maintenance Pilot",
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
    alert("That backup file could not be imported. Please choose a valid QR Maintenance data backup JSON file.");
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
    ["Customer", "Location", "Equipment", "Status", "Next Maintenance", "Open Issues", "Template", "Equipment Type", "Criticality", "Manufacturer", "Model", "Serial", "Install Date", "Manual / Document Link", "Uploaded Manual File", "Photo File", "Notes"],
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
