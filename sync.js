// SiteWorks structured cloud sync module.
// Loaded before app.js as a classic script so existing app state, permissions, and helpers stay shared.
// Keep Supabase structured row loading, merging, saving, and delete helpers here.

async function loadStructuredDataFromSupabase(options = {}) {
  if (!STRUCTURED_DATA_SYNC_ENABLED) return false;
  if (structuredDataLoading || applyingSharedState || isPublicReportUrl() || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  structuredDataLoading = true;
  try {
    const forceReload = Boolean(options.forceReload);
    const remoteStructuredState = forceReload
      ? { hasRows: true, updatedAt: "" }
      : await peekStructuredCloudState();
    if (!forceReload) {
      if (remoteStructuredState.hasRows && hasSharedMaintenanceData(state) && !isRemoteSharedStateNewer(remoteStructuredState.updatedAt)) {
        structuredDataLoading = false;
        structuredDataReady = true;
        scheduleStructuredDataSync(0);
        markSyncSuccess("load");
        return true;
      }
    }
    const [
      customerRows,
      locationRows,
      templateRows,
      assetRows,
      workOrderRows,
      serviceRequestRows,
      historyRows,
      preferredContractorRows,
      inventoryItemRows,
      keyRows,
      keyLogRows,
      siteMapRows,
      monitoringDeviceRows,
      monitoringChannelRows,
      monitoringEventRows,
      monitoringAlertRows
    ] = await Promise.all([
      fetchStructuredRows("customers", "updated_at.asc"),
      fetchStructuredRows("locations", "updated_at.asc"),
      fetchStructuredRows("pm_templates", "updated_at.asc"),
      fetchStructuredRows("assets", "updated_at.asc"),
      fetchStructuredRows("work_orders", "updated_at.asc"),
      fetchStructuredRows("service_requests", "updated_at.asc"),
      fetchStructuredRows("pm_history", "completed_at.asc"),
      fetchOptionalStructuredRows("preferred_contractors", "updated_at.asc"),
      fetchOptionalStructuredRows("inventory_items", "updated_at.asc"),
      fetchOptionalStructuredRows("keys", "updated_at.asc"),
      fetchOptionalStructuredRows("key_logs", "timestamp.asc"),
      fetchOptionalStructuredRows("site_maps", "updated_at.asc"),
      fetchOptionalStructuredRows("monitoring_devices", "updated_at.asc"),
      fetchOptionalStructuredRows("monitoring_channels", "updated_at.asc"),
      fetchOptionalStructuredRows("monitoring_events", "created_at.desc"),
      fetchOptionalStructuredRows("monitoring_alerts", "updated_at.desc")
    ]);
    structuredDataLoading = false;
    structuredDataReady = true;
    const hasRows = customerRows.length || locationRows.length || templateRows.length || assetRows.length || workOrderRows.length || serviceRequestRows.length || preferredContractorRows.length || inventoryItemRows.length || keyRows.length || keyLogRows.length || siteMapRows.length || monitoringDeviceRows.length || monitoringChannelRows.length || monitoringEventRows.length || monitoringAlertRows.length;
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
      history: historyRows,
      preferredContractors: preferredContractorRows,
      inventoryItems: inventoryItemRows,
      keys: keyRows,
      keyLogs: keyLogRows,
      siteMaps: siteMapRows,
      monitoringDevices: monitoringDeviceRows,
      monitoringChannels: monitoringChannelRows,
      monitoringEvents: monitoringEventRows,
      monitoringAlerts: monitoringAlertRows
    };
    if (structuredRowsMissingAssets(structuredRows)) {
      markSyncError("Structured cloud load returned related records but no equipment. Keeping/restoring the last known equipment list.");
      const restoredSharedState = canUseSharedStateFallback()
        ? await loadSharedStateFromSupabase(true)
        : false;
      if (!restoredSharedState && state.assets?.length) scheduleStructuredDataSync(0);
      return Boolean(restoredSharedState || state.assets?.length);
    }
    const structuredUpdatedAt = newestStructuredUpdatedAt(structuredRows);
    if (!forceReload && hasSharedMaintenanceData(state) && !isRemoteSharedStateNewer(structuredUpdatedAt)) {
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

async function fetchOptionalStructuredRows(table, order = "updated_at.asc") {
  try {
    return await siteworksApi.loadRows(table, order);
  } catch (error) {
    console.warn(`Optional Supabase table ${table} is not available yet.`, error);
    return [];
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
    { table: "pm_history", timestamp: "completed_at" },
    { table: "preferred_contractors", timestamp: "updated_at", optional: true },
    { table: "inventory_items", timestamp: "updated_at", optional: true },
    { table: "keys", timestamp: "updated_at", optional: true },
    { table: "key_logs", timestamp: "timestamp", optional: true },
    { table: "site_maps", timestamp: "updated_at", optional: true },
    { table: "monitoring_devices", timestamp: "updated_at", optional: true },
    { table: "monitoring_channels", timestamp: "updated_at", optional: true },
    { table: "monitoring_events", timestamp: "created_at", optional: true },
    { table: "monitoring_alerts", timestamp: "updated_at", optional: true }
  ];
  const rows = await Promise.all(tables.map(({ table, timestamp, optional }) =>
    optional ? fetchOptionalStructuredTimestampRows(table, timestamp) : fetchStructuredTimestampRows(table, timestamp)
  ));
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

async function fetchOptionalStructuredTimestampRows(table, timestampColumn) {
  try {
    return await siteworksApi.peekRows(table, timestampColumn);
  } catch (error) {
    console.warn(`Optional Supabase table ${table} is not available yet.`, error);
    return [];
  }
}

function applyStructuredState(rows, updatedAt = "") {
  const previousCustomerId = selectedCustomerId;
  const previousLocationId = selectedLocationId;
  const localUsers = state.users || [];
  const localAccessRequests = state.accessRequests || [];
  const localCurrentUserId = state.currentUserId || "";
  const localWorkOrders = state.workOrders || [];
  const nextAssets = rows.assets.map(assetFromStructuredRow);
  const mergedAssetResult = mergeStructuredAssetsWithLocal(nextAssets, state.assets || []);
  const mergedAssets = mergedAssetResult.assets;
  const historyByAsset = groupStructuredHistoryByAsset(rows.history);
  mergedAssets.forEach((asset) => {
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
    assets: mergedAssets,
    workOrders: mergeStructuredWorkOrdersWithLocalPublicReports(
      rows.workOrders.map(workOrderFromStructuredRow),
      localWorkOrders
    ),
    serviceRequests: rows.serviceRequests.map(serviceRequestFromStructuredRow),
    preferredContractors: rows.preferredContractors.map(preferredContractorFromStructuredRow),
    inventoryItems: (rows.inventoryItems || []).map(inventoryItemFromStructuredRow),
    keys: (rows.keys || []).map(keyFromStructuredRow),
    keyLogs: (rows.keyLogs || []).map(keyLogFromStructuredRow),
    siteMaps: mergeStructuredSiteMapsWithLocal(
      (rows.siteMaps || []).map(siteMapFromStructuredRow),
      state.siteMaps || []
    ),
    monitoringDevices: (rows.monitoringDevices || []).map(monitoringDeviceFromStructuredRow),
    monitoringChannels: (rows.monitoringChannels || []).map(monitoringChannelFromStructuredRow),
    monitoringEvents: (rows.monitoringEvents || []).map(monitoringEventFromStructuredRow).slice(0, 1000),
    monitoringAlerts: (rows.monitoringAlerts || []).map(monitoringAlertFromStructuredRow),
    users: localUsers,
    accessRequests: localAccessRequests,
    currentUserId: localCurrentUserId,
    sharedDataUpdatedAt: updatedAt || newestStructuredUpdatedAt(rows)
  });
  currentUser = findStateUserForCurrentSession() || currentUser;
  currentRole = currentUser?.role || "Customer";
  restoreSelectionAfterCloudApply(previousCustomerId, previousLocationId);
  selectedId = getAssetIdFromUrl() || selectedId;
  persistLocalStateOnly(false);
  applyingSharedState = false;
  if (mergedAssetResult.keptLocalChanges) {
    scheduleStructuredDataSync(0);
  }
  render();
  window.setTimeout(syncLoginQrReportPrompt, 0);
}

function mergeStructuredWorkOrdersWithLocalPublicReports(structuredWorkOrders = [], localWorkOrders = []) {
  const merged = structuredWorkOrders.slice();
  const knownIds = new Set(merged.map((item) => item.id).filter(Boolean));
  const knownRemoteReportIds = new Set(merged.map((item) => item.remoteReportId).filter(Boolean));
  localWorkOrders.forEach((item) => {
    if (!isCustomerReportedIssue(item) || !item.remoteReportId) return;
    if (state.dismissedPublicReportIds.includes(item.remoteReportId)) return;
    if (knownIds.has(item.id) || knownRemoteReportIds.has(item.remoteReportId)) return;
    merged.unshift(item);
    knownIds.add(item.id);
    knownRemoteReportIds.add(item.remoteReportId);
  });
  return merged;
}

function mapUpdatedTime(record = {}) {
  const time = Date.parse(record.updatedAt || record.updated_at || "");
  return Number.isFinite(time) ? time : 0;
}

function siteMapMergeKey(map = {}) {
  return map.id || `${map.customerId || ""}:${map.locationId || ""}`;
}

function mergeStructuredSiteMapsWithLocal(structuredSiteMaps = [], localSiteMaps = []) {
  const merged = new Map();
  structuredSiteMaps.forEach((map) => {
    if (!map) return;
    merged.set(siteMapMergeKey(map), map);
  });
  localSiteMaps.forEach((localMap) => {
    if (!localMap?.customerId) return;
    const key = siteMapMergeKey(localMap);
    const remoteMap = merged.get(key);
    if (!remoteMap || mapUpdatedTime(localMap) > mapUpdatedTime(remoteMap)) {
      merged.set(key, localMap);
    }
  });
  return [...merged.values()];
}

function mergeStructuredAssetsWithLocal(structuredAssets = [], localAssets = []) {
  const merged = new Map();
  let keptLocalChanges = false;
  structuredAssets.forEach((asset) => {
    if (!asset?.id) return;
    merged.set(asset.id, asset);
  });
  localAssets.forEach((localAsset) => {
    if (!localAsset?.id) return;
    const remoteAsset = merged.get(localAsset.id);
    if (!remoteAsset) return;
    if (mapUpdatedTime(localAsset) > mapUpdatedTime(remoteAsset)) {
      merged.set(localAsset.id, localAsset);
      keptLocalChanges = true;
    }
  });
  return {
    assets: [...merged.values()],
    keptLocalChanges
  };
}

function structuredPayload(row) {
  return row?.data && typeof row.data === "object" ? row.data : {};
}

function nfcTagFromStructuredRow(row) {
  const payload = structuredPayload(row);
  return normalizeAssetNfcTag(payload.nfcTag || {
    uid: row.nfc_uid || payload.nfcUid || payload.nfc_uid || "",
    url: row.nfc_url || payload.nfcUrl || payload.nfc_url || "",
    status: row.nfc_status || payload.nfcStatus || payload.nfc_status || "",
    lastWrittenAt: row.nfc_written_at || payload.nfcWrittenAt || payload.nfc_written_at || "",
    lastVerifiedAt: row.nfc_verified_at || payload.nfcVerifiedAt || payload.nfc_verified_at || "",
    message: payload.nfcMessage || payload.nfc_message || ""
  });
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
    customerId: row.customer_id || "",
    name: row.name || "",
    items: Array.isArray(row.items) ? row.items : [],
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    ...structuredPayload(row)
  };
}

function assetFromStructuredRow(row) {
  const payload = structuredPayload(row);
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
    ...payload,
    nfcTag: nfcTagFromStructuredRow(row)
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

function preferredContractorFromStructuredRow(row) {
  return {
    id: row.id,
    customerId: row.customer_id || "",
    name: row.name || "",
    email: row.email || "",
    trade: row.trade || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    ...structuredPayload(row)
  };
}

function inventoryItemFromStructuredRow(row) {
  return {
    id: row.id,
    customerId: row.customer_id || "",
    category: row.category || "Parts",
    name: row.name || "",
    quantity: Number(row.quantity_on_hand || 0),
    minStock: Number(row.min_stock || 0),
    bin: row.bin || "",
    supplier: row.supplier || "",
    nfcTag: row.nfc_tag || "",
    notes: row.notes || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    ...structuredPayload(row)
  };
}

function keyFromStructuredRow(row) {
  const payload = structuredPayload(row);
  const uniqueTagId = row.unique_tag_id || payload.uniqueTagId || payload.unique_tag_id || "";
  return {
    ...payload,
    id: row.id || payload.id,
    customerId: row.customer_id || payload.customerId || "",
    locationId: row.location_id || payload.locationId || "",
    uniqueTagId,
    additionalTagUids: normalizeKeyExtraTagUids(payload.additionalTagUids || payload.additional_tag_uids || payload.extraTagUids || []).filter((uid) => uid !== normalizeNfcUid(uniqueTagId)),
    keyName: row.key_name || payload.keyName || payload.name || "",
    keyNumber: row.key_number || payload.keyNumber || "",
    storageLocation: row.storage_location || payload.storageLocation || "",
    currentStatus: row.current_status || payload.currentStatus || "Available",
    currentHolderId: row.current_holder_id || payload.currentHolderId || "",
    currentHolderName: row.current_holder_name || payload.currentHolderName || "",
    defaultCheckoutHours: normalizeKeyCheckoutHours(row.default_checkout_hours ?? payload.defaultCheckoutHours ?? payload.default_checkout_hours),
    dueBackAt: row.due_back_at || payload.dueBackAt || payload.due_back_at || "",
    notes: row.notes || payload.notes || "",
    createdAt: row.created_at || payload.createdAt || "",
    updatedAt: row.updated_at || payload.updatedAt || ""
  };
}

function keyLogFromStructuredRow(row) {
  const payload = structuredPayload(row);
  return {
    id: row.id,
    keyId: row.key_id || payload.keyId || "",
    customerId: row.customer_id || payload.customerId || "",
    locationId: row.location_id || payload.locationId || "",
    userId: row.user_id || payload.userId || "",
    userName: row.user_name || payload.userName || "",
    action: row.action || payload.action || "Check-In",
    notes: row.notes || payload.notes || "",
    timestamp: row.timestamp || payload.timestamp || payload.createdAt || "",
    ...payload,
    dueBackAt: row.due_back_at || payload.dueBackAt || payload.due_back_at || ""
  };
}

function siteMapFromStructuredRow(row) {
  const payload = structuredPayload(row);
  return {
    ...payload,
    id: row.id || payload.id,
    customerId: row.customer_id || payload.customerId || "",
    locationId: row.location_id || payload.locationId || "",
    name: row.name || payload.name || "",
    image: row.image || payload.image || null,
    pins: Array.isArray(row.pins) ? row.pins : Array.isArray(payload.pins) ? payload.pins : [],
    levels: Array.isArray(payload.levels) ? payload.levels : Array.isArray(payload.areas) ? payload.areas : [],
    createdAt: row.created_at || payload.createdAt || "",
    updatedAt: row.updated_at || payload.updatedAt || ""
  };
}

function monitoringDeviceFromStructuredRow(row) {
  const payload = structuredPayload(row);
  return {
    ...payload,
    id: row.id || payload.id,
    customerId: row.customer_id || payload.customerId || "",
    locationId: row.location_id || payload.locationId || "",
    panelAssetId: row.panel_asset_id || payload.panelAssetId || "",
    deviceUid: row.device_uid || payload.deviceUid || "",
    apiKeyHash: "",
    apiKeyLast4: row.api_key_last4 || payload.apiKeyLast4 || "",
    name: row.name || payload.name || "Panel monitor",
    model: row.model || payload.model || "",
    firmwareVersion: row.firmware_version || payload.firmwareVersion || "",
    onlineStatus: row.online_status || payload.onlineStatus || "offline",
    healthStatus: row.health_status || payload.healthStatus || "",
    sourcePhases: normalizeMonitoringSourcePhases(row.source_phases || payload.sourcePhases),
    sourcePhaseChannels: monitoringEngine()?.normalizeSourcePhaseChannels
      ? monitoringEngine().normalizeSourcePhaseChannels(payload.sourcePhaseChannels || payload.source_phase_channels)
      : (payload.sourcePhaseChannels || payload.source_phase_channels || { A: "", B: "", C: "" }),
    heartbeatSeconds: Math.max(30, Number(row.heartbeat_seconds || payload.heartbeatSeconds || MONITORING_DEFAULT_HEARTBEAT_SECONDS)),
    maintenanceMode: Boolean(row.maintenance_mode ?? payload.maintenanceMode),
    rawPayloads: row.data?.last_payload
      ? [{ receivedAt: row.last_seen_at || row.updated_at || new Date().toISOString(), payload: row.data.last_payload }]
      : Array.isArray(payload.rawPayloads) ? payload.rawPayloads.slice(0, 20) : [],
    recentErrors: Array.isArray(payload.recentErrors) ? payload.recentErrors.slice(0, 20) : [],
    lastSeenAt: row.last_seen_at || payload.lastSeenAt || "",
    createdAt: row.created_at || payload.createdAt || "",
    updatedAt: row.updated_at || payload.updatedAt || ""
  };
}

function monitoringChannelFromStructuredRow(row) {
  const payload = structuredPayload(row);
  const poleCount = Math.max(1, Math.min(3, Number(row.pole_count || payload.poleCount || 1)));
  const sourcePhases = getMonitoringChannelPhaseList({
    ...payload,
    sourcePhase: row.source_phase || payload.sourcePhase || "A",
    poleCount
  });
  return {
    ...payload,
    id: row.id || payload.id,
    deviceId: row.device_id || payload.deviceId || "",
    customerId: row.customer_id || payload.customerId || "",
    locationId: row.location_id || payload.locationId || "",
    panelAssetId: row.panel_asset_id || payload.panelAssetId || "",
    breakerGroupId: payload.breakerGroupId || payload.breaker_group_id || "",
    breakerPoleCount: Math.max(1, Math.min(3, Number(payload.breakerPoleCount || payload.breaker_pole_count || poleCount))),
    poleIndex: Math.max(1, Math.min(3, Number(payload.poleIndex || payload.pole_index || 1))),
    circuitNumber: String(row.circuit_number || payload.circuitNumber || "").trim(),
    physicalChannel: String(row.physical_channel || payload.physicalChannel || "").trim(),
    sourcePhase: sourcePhases[0] || row.source_phase || "A",
    sourcePhases,
    poleCount,
    monitoringMode: row.monitoring_mode || payload.monitoringMode || "normal",
    criticality: row.criticality || payload.criticality || "normal",
    alarmDelaySeconds: Math.max(0, Number(row.alarm_delay_seconds || payload.alarmDelaySeconds || MONITORING_DEFAULT_DELAY_SECONDS)),
    lastRawState: row.last_raw_state ?? payload.lastRawState ?? null,
    lastDerivedState: row.last_derived_state || payload.lastDerivedState || "open",
    firstAbsentAt: row.first_absent_at || payload.firstAbsentAt || "",
    createdAt: row.created_at || payload.createdAt || "",
    updatedAt: row.updated_at || payload.updatedAt || ""
  };
}

function monitoringEventFromStructuredRow(row) {
  const payload = structuredPayload(row);
  return {
    id: row.id || payload.id,
    customerId: row.customer_id || payload.customerId || "",
    locationId: row.location_id || payload.locationId || "",
    deviceId: row.device_id || payload.deviceId || "",
    channelId: row.channel_id || payload.channelId || "",
    panelAssetId: row.panel_asset_id || payload.panelAssetId || "",
    circuitNumber: row.circuit_number || payload.circuitNumber || "",
    type: row.event_type || payload.type || "device-status",
    state: row.new_state || payload.state || "",
    previousState: row.previous_state || payload.previousState || "",
    message: payload.message || (row.circuit_number ? `Circuit ${row.circuit_number} is ${monitoringStateLabel(row.new_state)}.` : "Panel monitor reported status."),
    data: row.payload || payload.data || {},
    createdAt: row.created_at || payload.createdAt || ""
  };
}

function monitoringAlertFromStructuredRow(row) {
  const payload = structuredPayload(row);
  return {
    ...payload,
    id: row.id || payload.id,
    customerId: row.customer_id || payload.customerId || "",
    locationId: row.location_id || payload.locationId || "",
    deviceId: row.device_id || payload.deviceId || "",
    channelId: row.channel_id || payload.channelId || "",
    panelAssetId: row.panel_asset_id || payload.panelAssetId || "",
    circuitNumber: row.circuit_number || payload.circuitNumber || "",
    type: row.alert_type || payload.type || "suspected-trip",
    severity: row.severity || payload.severity || "medium",
    status: row.status || payload.status || "open",
    title: payload.title || "Panel monitor alert",
    message: payload.message || "",
    acknowledgedAt: row.acknowledged_at || payload.acknowledgedAt || "",
    resolvedAt: row.resolved_at || payload.resolvedAt || "",
    createdAt: row.created_at || payload.createdAt || "",
    updatedAt: row.updated_at || payload.updatedAt || ""
  };
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
    ...rows.history,
    ...(rows.preferredContractors || []),
    ...(rows.inventoryItems || []),
    ...(rows.keys || []),
    ...(rows.keyLogs || []),
    ...(rows.siteMaps || [])
  ]);
}

function newestTimestampFromRows(rows = []) {
  return rows.map((row) => row.updated_at || row.completed_at || row.timestamp || row.created_at || "")
    .filter(Boolean)
    .sort()
    .at(-1) || new Date().toISOString();
}

async function loadSharedStateFromSupabase(forceApplyAssets = false) {
  if (!canUseSharedStateFallback() || sharedStateLoading || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
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
  const previousCustomerId = selectedCustomerId;
  const previousLocationId = selectedLocationId;
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
  currentUser = findStateUserForCurrentSession() || currentUser;
  currentRole = currentUser?.role || "Customer";
  restoreSelectionAfterCloudApply(previousCustomerId, previousLocationId);
  selectedId = getAssetIdFromUrl() || null;
  persistLocalStateOnly();
  applyingSharedState = false;
  render();
  if (!Array.isArray(sharedData.users) && nextUsers.some((user) => user.username !== "scan-customer")) {
    window.setTimeout(() => scheduleSharedStateSave(0), 0);
  }
  window.setTimeout(syncLoginQrReportPrompt, 0);
}

function canUseSharedStateFallback() {
  return currentRole === "Admin";
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
  const savedSession = getSavedAuthSession();
  const sessionEmail = savedSession?.user?.email?.toLowerCase() || "";
  const currentLocalUser = localUsers.find((user) =>
    user.id === localCurrentUserId ||
    user.id === savedSession?.user?.id ||
    (sessionEmail && user.username?.toLowerCase() === sessionEmail) ||
    user.id === currentUser?.id ||
    user.username?.toLowerCase() === currentUser?.username?.toLowerCase()
  );
  if (currentLocalUser && !merged.some((user) => user.id === currentLocalUser.id)) {
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
  return;
  if (!sharedStateReady || applyingSharedState || isPublicReportUrl() || !hasSharedMaintenanceData(state) || !hasAuthenticatedCloudSession()) return;
  window.clearTimeout(sharedStateSaveTimer);
  sharedStateSaveTimer = window.setTimeout(saveSharedStateToSupabase, delay);
}

async function saveSharedStateToSupabase() {
  return;
  if (!sharedStateReady || applyingSharedState || !hasSharedMaintenanceData(state) || !hasAuthenticatedCloudSession()) return;
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

function hasAuthenticatedCloudSession() {
  const session = getSavedAuthSession();
  if (!session?.access_token || !session?.user?.id) return false;
  if (session.expires_at && Number(session.expires_at) <= Math.floor(Date.now() / 1000) + 60) return false;
  if (session.expires_in && session.created_at && Number(session.created_at) + Number(session.expires_in) <= Math.floor(Date.now() / 1000) + 60) return false;
  return true;
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
    inventoryItems: state.inventoryItems || [],
    keys: state.keys || [],
    keyLogs: state.keyLogs || [],
    siteMaps: state.siteMaps || [],
    users: (state.users || []).map(sanitizeSharedUser),
    accessRequests: state.accessRequests || [],
    activityLog: state.activityLog || [],
    dismissedPublicReportIds: state.dismissedPublicReportIds || [],
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
    candidate?.inventoryItems?.length ||
    candidate?.keys?.length ||
    candidate?.keyLogs?.length ||
    candidate?.siteMaps?.length ||
    candidate?.users?.some((user) => user.username !== "scan-customer") ||
    candidate?.accessRequests?.length
  );
}

function scheduleStructuredDataSync(delay = 2000) {
  if (!STRUCTURED_DATA_SYNC_ENABLED) return;
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

function buildStructuredKeyRow(key, cloudLocationIds = null) {
  const locationId = key.locationId && (!cloudLocationIds || cloudLocationIds.has(key.locationId)) ? key.locationId : null;
  const additionalTagUids = getKeyAdditionalTagUids(key);
  const defaultCheckoutHours = normalizeKeyCheckoutHours(key.defaultCheckoutHours ?? key.default_checkout_hours);
  const dueBackAt = getKeyDueBackAt(key) || null;
  return {
    id: key.id,
    customer_id: key.customerId || null,
    location_id: locationId,
    unique_tag_id: normalizeNfcUid(key.uniqueTagId || "") || key.uniqueTagId || "",
    key_name: key.keyName || key.name || "",
    key_number: key.keyNumber || "",
    storage_location: key.storageLocation || "",
    current_status: KEY_STATUS_OPTIONS.includes(key.currentStatus) ? key.currentStatus : "Available",
    current_holder_id: isUuid(key.currentHolderId) ? key.currentHolderId : null,
    current_holder_name: key.currentHolderName || "",
    default_checkout_hours: defaultCheckoutHours,
    due_back_at: dueBackAt,
    notes: key.notes || "",
    created_at: key.createdAt || new Date().toISOString(),
    updated_at: key.updatedAt || state.updatedAt || new Date().toISOString(),
    data: leanCloudRecord({
      ...key,
      additionalTagUids,
      additional_tag_uids: additionalTagUids,
      defaultCheckoutHours,
      default_checkout_hours: defaultCheckoutHours,
      dueBackAt: dueBackAt || "",
      due_back_at: dueBackAt || "",
      locationId: locationId || ""
    })
  };
}

function buildStructuredKeyLogRow(log, cloudLocationIds = null) {
  const locationId = log.locationId && (!cloudLocationIds || cloudLocationIds.has(log.locationId)) ? log.locationId : null;
  const dueBackAt = log.dueBackAt || log.due_back_at || null;
  return {
    id: log.id,
    key_id: log.keyId,
    customer_id: log.customerId || null,
    location_id: locationId,
    user_id: isUuid(log.userId) ? log.userId : null,
    user_name: log.userName || "",
    action: log.action === "Check-Out" ? "Check-Out" : "Check-In",
    notes: log.notes || "",
    due_back_at: dueBackAt,
    timestamp: log.timestamp || log.createdAt || new Date().toISOString(),
    data: leanCloudRecord({
      ...log,
      dueBackAt: dueBackAt || "",
      due_back_at: dueBackAt || "",
      locationId: locationId || ""
    })
  };
}

function buildStructuredSiteMapRow(map, cloudLocationIds = null) {
  const locationId = map.locationId && (!cloudLocationIds || cloudLocationIds.has(map.locationId)) ? map.locationId : null;
  const mapForCloud = {
    ...map,
    locationId: locationId || "",
    levels: ensureSiteMapLevels(map, true).map((level) => normalizeSiteMapLevel(level)),
    pins: normalizeSiteMapPins(map.pins)
  };
  const mainLevel = mapForCloud.levels.find((level) => level.id === "main");
  if (mainLevel) {
    mapForCloud.image = mainLevel.image || mapForCloud.image || null;
    mapForCloud.pins = normalizeSiteMapPins(mainLevel.pins);
  }
  return {
    id: map.id,
    customer_id: map.customerId || null,
    location_id: locationId,
    name: map.name || "",
    image: mapForCloud.image || null,
    pins: mapForCloud.pins,
    created_at: map.createdAt || new Date().toISOString(),
    updated_at: map.updatedAt || state.updatedAt || new Date().toISOString(),
    data: leanCloudRecord(mapForCloud)
  };
}

function buildMonitoringDeviceRow(device, cloudLocationIds = null) {
  const locationId = device.locationId && (!cloudLocationIds || cloudLocationIds.has(device.locationId)) ? device.locationId : null;
  return {
    id: device.id,
    customer_id: device.customerId || null,
    location_id: locationId,
    panel_asset_id: device.panelAssetId,
    device_uid: device.deviceUid || "",
    api_key_last4: device.apiKeyLast4 || null,
    name: device.name || "Panel monitor",
    model: device.model || "",
    firmware_version: device.firmwareVersion || "",
    online_status: device.onlineStatus || "offline",
    health_status: device.healthStatus || "",
    source_phases: normalizeMonitoringSourcePhases(device.sourcePhases),
    heartbeat_seconds: Math.max(30, Number(device.heartbeatSeconds || MONITORING_DEFAULT_HEARTBEAT_SECONDS)),
    maintenance_mode: Boolean(device.maintenanceMode),
    last_seen_at: device.lastSeenAt || null,
    created_at: device.createdAt || new Date().toISOString(),
    updated_at: device.updatedAt || state.updatedAt || new Date().toISOString(),
    data: leanCloudRecord({
      ...device,
      apiKeyHash: "",
      locationId: locationId || "",
      rawPayloads: Array.isArray(device.rawPayloads) ? device.rawPayloads.slice(0, 20) : [],
      recentErrors: Array.isArray(device.recentErrors) ? device.recentErrors.slice(0, 20) : []
    })
  };
}

function buildMonitoringChannelRow(channel, cloudLocationIds = null) {
  const device = getMonitoringDevice(channel.deviceId);
  const locationId = (channel.locationId || device?.locationId || "") && (!cloudLocationIds || cloudLocationIds.has(channel.locationId || device?.locationId)) ? (channel.locationId || device?.locationId) : null;
  const sourcePhases = getMonitoringChannelPhaseList(channel);
  return {
    id: channel.id,
    device_id: channel.deviceId,
    customer_id: channel.customerId || device?.customerId || null,
    location_id: locationId,
    panel_asset_id: channel.panelAssetId || device?.panelAssetId || null,
    circuit_number: String(channel.circuitNumber || ""),
    physical_channel: String(channel.physicalChannel || ""),
    source_phase: sourcePhases[0] || channel.sourcePhase || "A",
    pole_count: Math.max(1, Math.min(3, Number(channel.poleCount || 1))),
    monitoring_mode: channel.monitoringMode || "normal",
    criticality: channel.criticality || "normal",
    alarm_delay_seconds: Math.max(0, Number(channel.alarmDelaySeconds || MONITORING_DEFAULT_DELAY_SECONDS)),
    last_raw_state: channel.lastRawState ?? null,
    last_derived_state: channel.lastDerivedState || "open",
    first_absent_at: channel.firstAbsentAt || null,
    created_at: channel.createdAt || new Date().toISOString(),
    updated_at: channel.updatedAt || state.updatedAt || new Date().toISOString(),
    data: leanCloudRecord({
      ...channel,
      customerId: channel.customerId || device?.customerId || "",
      locationId: locationId || "",
      panelAssetId: channel.panelAssetId || device?.panelAssetId || "",
      sourcePhases
    })
  };
}

function buildMonitoringEventRow(event, cloudLocationIds = null) {
  const device = getMonitoringDevice(event.deviceId);
  const locationId = (event.locationId || device?.locationId || "") && (!cloudLocationIds || cloudLocationIds.has(event.locationId || device?.locationId)) ? (event.locationId || device?.locationId) : null;
  return {
    id: event.id,
    customer_id: event.customerId || device?.customerId || null,
    location_id: locationId,
    device_id: isUuid(event.deviceId) ? event.deviceId : null,
    channel_id: isUuid(event.channelId) ? event.channelId : null,
    panel_asset_id: event.panelAssetId || device?.panelAssetId || null,
    circuit_number: event.circuitNumber || null,
    event_type: event.type || "device-status",
    previous_state: event.previousState || null,
    new_state: event.state || null,
    payload: leanCloudRecord({ ...event, locationId: locationId || "" }),
    created_at: event.createdAt || new Date().toISOString()
  };
}

function buildMonitoringAlertRow(alert, cloudLocationIds = null) {
  const device = getMonitoringDevice(alert.deviceId);
  const locationId = (alert.locationId || device?.locationId || "") && (!cloudLocationIds || cloudLocationIds.has(alert.locationId || device?.locationId)) ? (alert.locationId || device?.locationId) : null;
  return {
    id: alert.id,
    customer_id: alert.customerId || device?.customerId || null,
    location_id: locationId,
    device_id: isUuid(alert.deviceId) ? alert.deviceId : null,
    channel_id: isUuid(alert.channelId) ? alert.channelId : null,
    panel_asset_id: alert.panelAssetId || device?.panelAssetId || null,
    circuit_number: alert.circuitNumber || null,
    alert_type: alert.type || "suspected-trip",
    severity: alert.severity || "medium",
    status: alert.status === "resolved" ? "resolved" : alert.status === "acknowledged" ? "acknowledged" : "open",
    acknowledged_at: alert.acknowledgedAt || null,
    resolved_at: alert.resolvedAt || null,
    created_at: alert.createdAt || new Date().toISOString(),
    updated_at: alert.updatedAt || state.updatedAt || new Date().toISOString(),
    data: leanCloudRecord({ ...alert, locationId: locationId || "" })
  };
}

async function setMonitoringDeviceKeyInSupabase(deviceId, apiKey) {
  if (!deviceId || !apiKey || !hasAuthenticatedCloudSession()) return false;
  const response = await cloudApi.rest("rpc/siteworks_monitoring_set_device_api_key", {
    method: "POST",
    body: JSON.stringify({
      p_device_id: deviceId,
      p_api_key: apiKey
    })
  });
  if (!response.ok) throw new Error(await response.text());
  return true;
}

async function setMonitoringDeviceKeyInSupabaseByUid(deviceUid, apiKey) {
  if (!deviceUid || !apiKey || !hasAuthenticatedCloudSession()) return false;
  const response = await cloudApi.rest("rpc/siteworks_monitoring_set_device_api_key_by_uid", {
    method: "POST",
    body: JSON.stringify({
      p_device_uid: deviceUid,
      p_api_key: apiKey
    })
  });
  if (!response.ok) throw new Error(await response.text());
  return true;
}

async function syncMonitoringDeviceToSupabase(device, apiKey = "") {
  if (!STRUCTURED_DATA_SYNC_ENABLED || !device?.id || !SUPABASE_URL || !SUPABASE_ANON_KEY || !hasAuthenticatedCloudSession()) return false;
  const cloudLocationIds = new Set((state.locations || []).map((locationRecord) => locationRecord.id).filter(Boolean));
  await upsertStructuredRows("monitoring_devices", [buildMonitoringDeviceRow(device, cloudLocationIds)]);
  if (apiKey) {
    try {
      await setMonitoringDeviceKeyInSupabaseByUid(device.deviceUid, apiKey);
    } catch (error) {
      console.warn("Monitoring key by UID failed; trying device id.", error);
      await setMonitoringDeviceKeyInSupabase(device.id, apiKey);
    }
  }
  return true;
}

async function syncMonitoringChannelsToSupabase(channels = []) {
  if (!STRUCTURED_DATA_SYNC_ENABLED || !channels.length || !SUPABASE_URL || !SUPABASE_ANON_KEY || !hasAuthenticatedCloudSession()) return false;
  const cloudLocationIds = new Set((state.locations || []).map((locationRecord) => locationRecord.id).filter(Boolean));
  await upsertStructuredRows("monitoring_channels", channels.map((channel) => buildMonitoringChannelRow(channel, cloudLocationIds)));
  return true;
}

async function syncSingleKeyToSupabase(key) {
  if (!STRUCTURED_DATA_SYNC_ENABLED || !key?.id || !SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  const customerId = activeCloudCustomerId();
  if (customerId && key.customerId !== customerId) return;
  const knownCustomerIds = new Set((state.customers || []).map((customer) => customer.id).filter(Boolean));
  if (key.customerId && !knownCustomerIds.has(key.customerId)) {
    setKeyNfcMessage(key, "Key cloud save skipped because the assigned customer is missing locally.");
    markSyncError("Key cloud save skipped because the assigned customer is missing locally.");
    return;
  }
  const cloudLocationIds = new Set((state.locations || [])
    .filter((locationRecord) => !key.customerId || locationRecord.customerId === key.customerId)
    .map((locationRecord) => locationRecord.id)
    .filter(Boolean));
  try {
    await upsertStructuredRows("keys", [buildStructuredKeyRow(key, cloudLocationIds)]);
    const logs = (state.keyLogs || []).filter((log) => log.keyId === key.id);
    if (logs.length) {
      await upsertStructuredRows("key_logs", logs.map((log) => buildStructuredKeyLogRow(log, cloudLocationIds)));
    }
    markSyncSuccess("save");
  } catch (error) {
    const message = `Key cloud save failed: ${error?.message || error}`;
    setKeyNfcMessage(key, message);
    markSyncError(message);
    console.warn("Key cloud save failed.", error);
  }
}

async function syncStructuredDataToSupabase() {
  if (!STRUCTURED_DATA_SYNC_ENABLED) return;
  if (structuredSyncActive || !hasSharedMaintenanceData(state)) return;
  structuredSyncActive = true;
  setSyncBanner("saving", "Saving to cloud", "", 0);
  try {
    const syncCustomers = (state.customers || []).filter((customer) => {
      const customerId = activeCloudCustomerId();
      return !customerId || customer.id === customerId;
    });
    const syncLocations = (state.locations || []).filter(canSyncCustomerOwnedRecord);
    const syncTemplates = (state.templates || []).filter(canSyncTemplateRecord);
    const syncAssets = (state.assets || []).filter(canSyncCustomerOwnedRecord);
    const syncWorkOrders = (state.workOrders || []).filter(canSyncCustomerOwnedRecord);
    const syncServiceRequests = (state.serviceRequests || []).filter(canSyncCustomerOwnedRecord);
    const syncPreferredContractors = (state.preferredContractors || []).filter(canSyncCustomerOwnedRecord);
    const syncInventoryItems = (state.inventoryItems || []).filter(canSyncCustomerOwnedRecord);
    const syncKeys = (state.keys || []).filter(canSyncCustomerOwnedRecord);
    const syncKeyLogs = (state.keyLogs || []).filter(canSyncCustomerOwnedRecord);
    const syncSiteMaps = (state.siteMaps || []).filter(canSyncCustomerOwnedRecord);
    const syncMonitoringDevices = (state.monitoringDevices || []).filter(canSyncCustomerOwnedRecord);
    const syncMonitoringDeviceIds = new Set(syncMonitoringDevices.map((device) => device.id).filter(Boolean));
    const syncMonitoringChannels = (state.monitoringChannels || []).filter((channel) => syncMonitoringDeviceIds.has(channel.deviceId));
    const syncMonitoringEvents = (state.monitoringEvents || []).filter((event) => !event.deviceId || syncMonitoringDeviceIds.has(event.deviceId)).slice(0, 250);
    const syncMonitoringAlerts = (state.monitoringAlerts || []).filter((alert) => !alert.deviceId || syncMonitoringDeviceIds.has(alert.deviceId));

    await upsertStructuredRows("customers", syncCustomers.map((customer) => ({
      id: customer.id,
      name: customer.name || "",
      created_at: customer.createdAt || new Date().toISOString(),
      updated_at: customer.updatedAt || state.updatedAt || new Date().toISOString(),
      data: customer
    })));

    await upsertStructuredRows("locations", syncLocations.map((locationRecord) => ({
      id: locationRecord.id,
      customer_id: locationRecord.customerId,
      name: locationRecord.name || "",
      created_at: locationRecord.createdAt || new Date().toISOString(),
      updated_at: locationRecord.updatedAt || state.updatedAt || new Date().toISOString(),
      data: locationRecord
    })));

    await upsertStructuredRows("pm_templates", syncTemplates.map((template) => ({
      id: template.id,
      name: template.name || "",
      customer_id: template.customerId || null,
      items: template.items || [],
      created_at: template.createdAt || new Date().toISOString(),
      updated_at: template.updatedAt || state.updatedAt || new Date().toISOString(),
      data: template
    })));

    await upsertStructuredRows("assets", syncAssets.map((asset) => {
      const nfcTag = normalizeAssetNfcTag(asset.nfcTag);
      return {
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
        nfc_uid: nfcTag.uid || null,
        nfc_url: nfcTag.url || null,
        nfc_written_at: nfcTag.lastWrittenAt || null,
        nfc_status: nfcTag.status || null,
        created_at: asset.createdAt || new Date().toISOString(),
        updated_at: asset.updatedAt || state.updatedAt || new Date().toISOString(),
        data: leanCloudRecord(asset)
      };
    }));

    const cloudCustomerIds = new Set(syncCustomers.map((customer) => customer.id).filter(Boolean));
    const cloudLocationIds = new Set(syncLocations.map((locationRecord) => locationRecord.id).filter(Boolean));
    const cloudAssetIds = new Set(syncAssets.map((asset) => asset.id).filter(Boolean));
    const cloudReadyWorkOrders = syncWorkOrders.filter((item) =>
      (!item.customerId || cloudCustomerIds.has(item.customerId)) &&
      (!item.assetId || cloudAssetIds.has(item.assetId))
    );
    const skippedWorkOrders = syncWorkOrders.length - cloudReadyWorkOrders.length;
    if (skippedWorkOrders > 0) {
      console.warn(`Skipped ${skippedWorkOrders} ticket sync row(s) because their linked customer or equipment is missing locally.`);
    }

    await upsertStructuredRows("work_orders", cloudReadyWorkOrders.map((item) => {
      const row = {
        id: item.id,
        issue_number: item.issueNumber || null,
        asset_id: item.assetId || null,
        customer_id: item.customerId || null,
        location_id: item.locationId && cloudLocationIds.has(item.locationId) ? item.locationId : null,
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
      };
      if (item.locationId && !row.location_id) {
        row.data = {
          ...row.data,
          missingLocationId: item.locationId
        };
      }
      return row;
    }));

    const cloudReadyServiceRequests = syncServiceRequests.filter((item) =>
      (!item.customerId || cloudCustomerIds.has(item.customerId)) &&
      (!item.assetId || cloudAssetIds.has(item.assetId))
    );
    const skippedServiceRequests = syncServiceRequests.length - cloudReadyServiceRequests.length;
    if (skippedServiceRequests > 0) {
      console.warn(`Skipped ${skippedServiceRequests} service request sync row(s) because their linked customer or equipment is missing locally.`);
    }

    await upsertStructuredRows("service_requests", cloudReadyServiceRequests.map((item) => ({
      id: item.id,
      service_request_number: item.serviceRequestNumber || null,
      asset_id: item.assetId || null,
      customer_id: item.customerId || null,
      location_id: item.locationId && cloudLocationIds.has(item.locationId) ? item.locationId : null,
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

    const cloudReadyPreferredContractors = syncPreferredContractors.filter((contractor) =>
      !contractor.customerId || cloudCustomerIds.has(contractor.customerId)
    );
    const skippedPreferredContractors = syncPreferredContractors.length - cloudReadyPreferredContractors.length;
    if (skippedPreferredContractors > 0) {
      console.warn(`Skipped ${skippedPreferredContractors} preferred contact sync row(s) because their linked customer is missing locally.`);
    }

    await upsertStructuredRows("preferred_contractors", cloudReadyPreferredContractors.map((contractor) => ({
      id: contractor.id,
      customer_id: contractor.customerId || null,
      name: contractor.name || "",
      email: contractor.email || "",
      trade: contractor.trade || "",
      created_at: contractor.createdAt || new Date().toISOString(),
      updated_at: contractor.updatedAt || state.updatedAt || new Date().toISOString(),
      data: leanCloudRecord(contractor)
    })));

    const cloudReadyInventoryItems = syncInventoryItems.filter((item) =>
      !item.customerId || cloudCustomerIds.has(item.customerId)
    );
    const skippedInventoryItems = syncInventoryItems.length - cloudReadyInventoryItems.length;
    if (skippedInventoryItems > 0) {
      console.warn(`Skipped ${skippedInventoryItems} inventory sync row(s) because their linked customer is missing locally.`);
    }

    await upsertStructuredRows("inventory_items", cloudReadyInventoryItems.map((item) => ({
      id: item.id,
      customer_id: item.customerId || null,
      category: item.category || "Parts",
      name: item.name || "",
      quantity_on_hand: Number(item.quantity || 0),
      min_stock: Number(item.minStock || 0),
      bin: item.bin || "",
      supplier: item.supplier || "",
      nfc_tag: item.nfcTag || "",
      notes: item.notes || "",
      created_at: item.createdAt || new Date().toISOString(),
      updated_at: item.updatedAt || state.updatedAt || new Date().toISOString(),
      data: leanCloudRecord(item)
    })));

    const cloudReadyKeys = syncKeys.filter((key) =>
      !key.customerId || cloudCustomerIds.has(key.customerId)
    );
    const skippedKeys = syncKeys.length - cloudReadyKeys.length;
    if (skippedKeys > 0) {
      console.warn(`Skipped ${skippedKeys} key sync row(s) because their linked customer is missing locally.`);
    }

    await upsertStructuredRows("keys", cloudReadyKeys.map((key) => buildStructuredKeyRow(key, cloudLocationIds)));

    const cloudKeyIds = new Set(cloudReadyKeys.map((key) => key.id).filter(Boolean));
    const cloudReadyKeyLogs = syncKeyLogs.filter((log) => log.keyId && cloudKeyIds.has(log.keyId));
    const skippedKeyLogs = syncKeyLogs.length - cloudReadyKeyLogs.length;
    if (skippedKeyLogs > 0) {
      console.warn(`Skipped ${skippedKeyLogs} key log sync row(s) because their linked key is missing locally.`);
    }

    await upsertStructuredRows("key_logs", cloudReadyKeyLogs.map((log) => buildStructuredKeyLogRow(log, cloudLocationIds)));

    const cloudReadySiteMaps = syncSiteMaps.filter((map) =>
      (!map.customerId || cloudCustomerIds.has(map.customerId)) &&
      map.locationId &&
      cloudLocationIds.has(map.locationId)
    );
    const skippedSiteMaps = syncSiteMaps.length - cloudReadySiteMaps.length;
    if (skippedSiteMaps > 0) {
      console.warn(`Skipped ${skippedSiteMaps} site map sync row(s) because their linked customer or location is missing locally.`);
    }

    await upsertStructuredRows("site_maps", cloudReadySiteMaps.map((map) => buildStructuredSiteMapRow(map, cloudLocationIds)));

    const cloudReadyMonitoringDevices = syncMonitoringDevices.filter((device) =>
      device.customerId &&
      cloudCustomerIds.has(device.customerId) &&
      device.panelAssetId &&
      cloudAssetIds.has(device.panelAssetId) &&
      (!device.locationId || cloudLocationIds.has(device.locationId))
    );
    const cloudMonitoringDeviceIds = new Set(cloudReadyMonitoringDevices.map((device) => device.id).filter(Boolean));
    const cloudReadyMonitoringChannels = syncMonitoringChannels.filter((channel) =>
      cloudMonitoringDeviceIds.has(channel.deviceId) &&
      (channel.panelAssetId || getMonitoringDevice(channel.deviceId)?.panelAssetId)
    );
    await upsertStructuredRows("monitoring_devices", cloudReadyMonitoringDevices.map((device) => buildMonitoringDeviceRow(device, cloudLocationIds)));
    await upsertStructuredRows("monitoring_channels", cloudReadyMonitoringChannels.map((channel) => buildMonitoringChannelRow(channel, cloudLocationIds)));
    await upsertStructuredRows("monitoring_events", syncMonitoringEvents.filter((event) => event.id).map((event) => buildMonitoringEventRow(event, cloudLocationIds)));
    await upsertStructuredRows("monitoring_alerts", syncMonitoringAlerts.filter((alert) => alert.id).map((alert) => buildMonitoringAlertRow(alert, cloudLocationIds)));

    const historyRows = syncAssets.filter(canSyncHistoryRecord).flatMap((asset) => (asset.history || []).map((item) => ({
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
    if (table === "pm_templates" && isMissingColumnError(error, "customer_id")) {
      await siteworksApi.saveRows(table, rows.map((row) => {
        const fallbackRow = { ...row };
        delete fallbackRow.customer_id;
        return fallbackRow;
      }));
      markSyncError("Maintenance templates saved without customer-specific scope. Run the Phase 1 Supabase SQL to enable customer-specific templates.");
      return;
    }
    if (table === "assets" && hasMissingAssetNfcColumnError(error)) {
      await siteworksApi.saveRows(table, rows.map(stripAssetNfcColumns));
      markSyncError("NFC tag details saved inside equipment data. Run the NFC Supabase SQL to enable short NFC lookup columns.");
      return;
    }
    if (["keys", "key_logs", "site_maps"].includes(table) && isMissingStructuredTableError(error)) {
      markSyncError(table === "site_maps"
        ? "Site maps are local only until supabase-site-maps.sql is run in Supabase."
        : "Key custody is local only until supabase-key-custody.sql is run in Supabase.");
      return;
    }
    if (table === "locations" && isRowLevelSecurityError(error)) {
      const message = "Location cloud save is blocked. Run supabase-locations-rls-fix.sql in Supabase.";
      markSyncError(message);
      console.warn("Location cloud save skipped because Supabase denied location table writes.", error);
      throw new Error(message);
    }
    if (table === "customers" && isRowLevelSecurityError(error)) {
      console.warn("Customer cloud save skipped because Supabase denied customer table writes.", error);
      return;
    }
    const message = `Structured cloud save failed for ${table}: ${error?.message || error}`;
    markSyncError(message);
    console.warn(`Structured Supabase sync skipped for ${table}.`, error);
    throw new Error(message);
  }
}

function isRowLevelSecurityError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  return code === "42501" || message.includes("row-level security") || message.includes("violates row-level security policy");
}

function isMissingColumnError(error, columnName) {
  const message = String(error?.message || error || "");
  return message.includes("PGRST204") && message.includes(columnName);
}

function hasMissingAssetNfcColumnError(error) {
  return ["nfc_uid", "nfc_url", "nfc_written_at", "nfc_status"].some((column) =>
    isMissingColumnError(error, column)
  );
}

function isMissingStructuredTableError(error) {
  const message = String(error?.message || error || "");
  return message.includes("PGRST205") ||
    message.includes("Could not find the table") ||
    message.includes("does not exist");
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function stripAssetNfcColumns(row) {
  const fallbackRow = { ...row };
  delete fallbackRow.nfc_uid;
  delete fallbackRow.nfc_url;
  delete fallbackRow.nfc_written_at;
  delete fallbackRow.nfc_status;
  return fallbackRow;
}

async function deleteStructuredRows(table, column, values) {
  try {
    setSyncBanner("saving", "Deleting from cloud", table.replaceAll("_", " "), 0);
    await siteworksApi.deleteRows(table, column, values);
    markSyncSuccess("save");
    return true;
  } catch (error) {
    const message = `Cloud delete failed for ${table}: ${error?.message || error}`;
    markSyncError(message);
    console.warn(`Structured Supabase delete skipped for ${table}.`, error);
    return false;
  }
}

async function finishCloudDelete(label, deleteResultPromise) {
  const result = await deleteResultPromise;
  const results = Array.isArray(result) ? result : [result];
  const failed = results.some((item) => item === false);
  if (failed) {
    alert(`${label} was removed on this device, but Supabase did not accept the cloud delete. It may come back on refresh until the delete policy is fixed.`);
    return false;
  }
  await syncStructuredDataToSupabase();
  return true;
}
