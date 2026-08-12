// SiteWorks Panel Monitor feature module.
// Loaded before app.js as a classic script so existing app state/render helpers stay shared.
// Keep panel monitor rendering, device setup, channel mapping, and live breaker state here.

function monitoringElements() {
  return {
    setupDrawer: document.querySelector(".monitoring-setup-drawer"),
    deviceForm: document.getElementById("monitoringDeviceForm"),
    deviceId: document.getElementById("monitoringDeviceId"),
    devicePanel: document.getElementById("monitoringDevicePanel"),
    deviceUid: document.getElementById("monitoringDeviceUid"),
    deviceApiKey: document.getElementById("monitoringDeviceApiKey"),
    sourcePhaseAChannel: document.getElementById("monitoringSourcePhaseAChannel"),
    sourcePhaseBChannel: document.getElementById("monitoringSourcePhaseBChannel"),
    sourcePhaseCChannel: document.getElementById("monitoringSourcePhaseCChannel"),
    rotateKeyBtn: document.getElementById("monitoringRotateKeyBtn"),
    repairKeyBtn: document.getElementById("monitoringRepairKeyBtn"),
    generatedApiKey: document.getElementById("monitoringGeneratedApiKey"),
    deviceName: document.getElementById("monitoringDeviceName"),
    deviceModel: document.getElementById("monitoringDeviceModel"),
    deviceFirmware: document.getElementById("monitoringDeviceFirmware"),
    deviceHeartbeat: document.getElementById("monitoringDeviceHeartbeat"),
    deviceMaintenance: document.getElementById("monitoringDeviceMaintenance"),
    deviceStatus: document.getElementById("monitoringDeviceStatus"),
    deviceList: document.getElementById("monitoringDeviceList"),
    deviceDetails: document.getElementById("monitoringDeviceDetails"),
    channelForm: document.getElementById("monitoringChannelForm"),
    channelDevice: document.getElementById("monitoringChannelDevice"),
    channelCircuit: document.getElementById("monitoringChannelCircuit"),
    channelCircuitManualWrap: document.getElementById("monitoringChannelCircuitManualWrap"),
    channelCircuitManual: document.getElementById("monitoringChannelCircuitManual"),
    channelNumber: document.getElementById("monitoringChannelNumber"),
    channelPhase: document.getElementById("monitoringChannelPhase"),
    channelPhase2Wrap: document.getElementById("monitoringChannelPhase2Wrap"),
    channelPhase2: document.getElementById("monitoringChannelPhase2"),
    channelPhase3Wrap: document.getElementById("monitoringChannelPhase3Wrap"),
    channelPhase3: document.getElementById("monitoringChannelPhase3"),
    channelPoles: document.getElementById("monitoringChannelPoles"),
    channelDelay: document.getElementById("monitoringChannelDelay"),
    channelMode: document.getElementById("monitoringChannelMode"),
    channelCriticality: document.getElementById("monitoringChannelCriticality"),
    channelStatus: document.getElementById("monitoringChannelStatus"),
    channelList: document.getElementById("monitoringChannelList"),
    simulatorForm: document.getElementById("monitoringSimulatorForm"),
    simulatorDevice: document.getElementById("monitoringSimulatorDevice"),
    simulatorStatus: document.getElementById("monitoringSimulatorStatus"),
    simulatorHistory: document.getElementById("monitoringSimulatorHistory"),
    panelSelect: document.getElementById("monitoringPanelSelect"),
    livePanel: document.getElementById("monitoringLivePanel"),
    breakerDetail: document.getElementById("monitoringBreakerDetail"),
    alertList: document.getElementById("monitoringAlertList"),
    eventList: document.getElementById("monitoringEventList")
  };
}

function ensureMonitoringCollections() {
  state.monitoringDevices = Array.isArray(state.monitoringDevices) ? state.monitoringDevices : [];
  state.monitoringChannels = Array.isArray(state.monitoringChannels) ? state.monitoringChannels : [];
  state.monitoringEvents = Array.isArray(state.monitoringEvents) ? state.monitoringEvents : [];
  state.monitoringAlerts = Array.isArray(state.monitoringAlerts) ? state.monitoringAlerts : [];
}

function allElectricalPanelAssetsForMonitoring() {
  return (state.assets || [])
    .filter(asset => canSeeAsset(asset) && isElectricalPanelAsset(asset) && monitoringRecordMatchesCurrentView(asset))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

function getMonitoringDevice(deviceId) {
  ensureMonitoringCollections();
  const needle = String(deviceId || "");
  if (!needle) return null;
  return state.monitoringDevices.find(device => {
    const normalized = normalizeMonitoringDevice(device);
    return normalized?.id === needle || normalized?.deviceUid === needle;
  }) || null;
}

function normalizeMonitoringDevice(device) {
  if (!device) return null;
  const deviceUid = String(device.deviceUid || device.device_uid || device.uid || "").trim();
  const id = String(device.id || device.deviceId || device.device_id || device.monitoringDeviceId || device.monitoring_device_id || deviceUid || "").trim();
  const panelAssetId = String(device.panelAssetId || device.panel_asset_id || device.panelId || device.panel_id || device.assetId || device.asset_id || "").trim();
  const panel = panelAssetId ? getAsset(panelAssetId) : null;
  const panelCustomerId = panel?.customerId || panel?.customer_id || "";
  const panelLocationId = panel?.locationId || panel?.location_id || "";
  return {
    ...device,
    id,
    panelAssetId,
    customerId: device.customerId || device.customer_id || panelCustomerId,
    locationId: device.locationId || device.location_id || panelLocationId,
    deviceUid: deviceUid || id || "",
    name: device.name || device.deviceName || device.device_name || "",
    model: device.model || "",
    firmwareVersion: device.firmwareVersion || device.firmware_version || "",
    heartbeatSeconds: Math.max(30, Number(device.heartbeatSeconds || device.heartbeat_seconds || MONITORING_DEFAULT_HEARTBEAT_SECONDS)),
    maintenanceMode: Boolean(device.maintenanceMode ?? device.maintenance_mode),
    onlineStatus: device.onlineStatus || device.online_status || "offline",
    lastSeenAt: device.lastSeenAt || device.last_seen_at || "",
    apiKeyLast4: device.apiKeyLast4 || device.api_key_last4 || "",
    sourcePhases: normalizeMonitoringSourcePhases(device.sourcePhases || device.source_phases),
    sourcePhaseChannels: monitoringEngine()?.normalizeSourcePhaseChannels
      ? monitoringEngine().normalizeSourcePhaseChannels(device.sourcePhaseChannels || device.source_phase_channels)
      : (device.sourcePhaseChannels || device.source_phase_channels || { A: "", B: "", C: "" }),
    rawPayloads: Array.isArray(device.rawPayloads) ? device.rawPayloads : [],
    recentErrors: Array.isArray(device.recentErrors) ? device.recentErrors : []
  };
}

function monitoringRecordMatchesCurrentView(record, fallback = null) {
  if (!record) return false;
  const customerId = String(record.customerId || record.customer_id || fallback?.customerId || fallback?.customer_id || "");
  const locationId = String(record.locationId || record.location_id || fallback?.locationId || fallback?.location_id || "");
  if (!selectedCustomerId || selectedCustomerId === ALL_CUSTOMERS) return false;
  if (!customerId || customerId !== String(selectedCustomerId)) return false;
  if (selectedLocationId !== ALL_LOCATIONS && locationId && locationId !== String(selectedLocationId)) return false;
  return true;
}

function getMonitoringChannel(channelId) {
  ensureMonitoringCollections();
  return state.monitoringChannels.find(channel => channel.id === channelId);
}

function visibleMonitoringDevices() {
  ensureMonitoringCollections();
  const visiblePanelIds = new Set(allElectricalPanelAssetsForMonitoring().map(panel => String(panel.id || "")));
  return state.monitoringDevices
    .map(normalizeMonitoringDevice)
    .filter(device => {
      if (!device?.id) return false;
      const panel = device?.panelAssetId ? getAsset(device.panelAssetId) : null;
      if (panel) {
        const panelId = String(panel.id || "");
        return canSeeAsset(panel) && visiblePanelIds.has(panelId) && monitoringRecordMatchesCurrentView(panel, device);
      }
      if (!monitoringRecordMatchesCurrentView(device)) return false;
      return !device.customerId || canSeeCustomer(device.customerId);
    });
}

function monitoringChannelsForDevice(deviceId) {
  ensureMonitoringCollections();
  const needle = String(deviceId || "");
  return state.monitoringChannels.filter(channel => {
    const normalizedDeviceId = String(channel.deviceId || channel.device_id || "");
    if (normalizedDeviceId === needle) return true;
    const device = getMonitoringDevice(normalizedDeviceId);
    return Boolean(device && (String(device.id || "") === needle || String(device.deviceUid || "") === needle));
  });
}

function normalizeApiMonitoringChannelName(value = "") {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return "";
  return text.startsWith("DI") ? text.slice(2) : text;
}

function monitoringApiStatusToDevice(row) {
  return {
    id: row.id,
    customerId: row.customerId || row.customer_id || "",
    locationId: row.locationId || row.location_id || "",
    panelAssetId: row.panelAssetId || row.panel_asset_id || "",
    deviceUid: row.deviceUid || row.device_uid || "",
    name: row.name || "Panel monitor",
    model: row.model || "",
    firmwareVersion: row.firmwareVersion || row.firmware_version || "",
    heartbeatSeconds: row.heartbeatSeconds || row.heartbeat_seconds || MONITORING_DEFAULT_HEARTBEAT_SECONDS,
    maintenanceMode: Boolean(row.maintenanceMode ?? row.maintenance_mode),
    onlineStatus: row.onlineStatus || row.online_status || "unknown",
    healthStatus: row.healthStatus || row.health_status || "",
    lastSeenAt: row.lastSeenAt || row.last_seen_at || "",
    updatedAt: row.updatedAt || row.updated_at || "",
    sourcePhases: normalizeMonitoringSourcePhases(row.sourcePhases || row.source_phases),
    sourcePhaseChannels: row.sourcePhaseChannels || row.source_phase_channels || { A: "", B: "", C: "" },
    rawPayloads: row.data?.last_payload ? [{ receivedAt: row.lastSeenAt || row.updatedAt || new Date().toISOString(), payload: row.data.last_payload }] : []
  };
}

function monitoringApiStatusToChannel(row, deviceId) {
  return {
    id: row.id,
    deviceId,
    panelAssetId: row.panelAssetId || row.panel_asset_id || "",
    circuitNumber: String(row.circuitNumber || row.circuit_number || ""),
    physicalChannel: normalizeApiMonitoringChannelName(row.physicalChannel || row.physical_channel || ""),
    sourcePhase: row.sourcePhase || row.source_phase || "A",
    sourcePhases: [row.sourcePhase || row.source_phase || "A"],
    poleCount: row.poleCount || row.pole_count || 1,
    alarmDelaySeconds: row.alarmDelaySeconds || row.alarm_delay_seconds || MONITORING_DEFAULT_DELAY_SECONDS,
    monitoringMode: row.monitoringMode || row.monitoring_mode || "normal",
    criticality: row.criticality || "normal",
    lastRawState: row.lastRawState ?? row.last_raw_state ?? null,
    lastDerivedState: row.lastDerivedState || row.last_derived_state || "open",
    firstAbsentAt: row.firstAbsentAt || row.first_absent_at || "",
    updatedAt: row.updatedAt || row.updated_at || "",
    data: row.data || {}
  };
}

function monitoringApiStatusToEvent(row, deviceIdByApiId) {
  const eventType = row.eventType || row.event_type || "device-status";
  const circuitNumber = row.circuitNumber || row.circuit_number || "";
  const newState = row.newState || row.new_state || "";
  return {
    id: row.id,
    deviceId: deviceIdByApiId.get(String(row.deviceId || row.device_id || "")) || row.deviceId || row.device_id || "",
    channelId: row.channelId || row.channel_id || "",
    circuitNumber,
    type: eventType,
    state: newState,
    message: eventType === "channel-state" && circuitNumber
      ? `Circuit ${circuitNumber} is ${monitoringStateLabel(newState)}.`
      : "Panel monitor reported status.",
    data: row.payload || {},
    createdAt: row.createdAt || row.created_at || new Date().toISOString()
  };
}

async function syncMonitoringStatusFromApi() {
  if (document.hidden || !currentUser) return;
  if (!MONITORING_LIVE_STATUS_API) {
    await syncMonitoringStatusFromSupabase();
    return;
  }
  ensureMonitoringCollections();
  try {
    const response = await siteworksServerFetch("/api/breaker-monitor/status", { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json();
    if (!Array.isArray(body.devices) || !Array.isArray(body.channels)) return;

    const deviceIdByApiId = new Map();
    let changed = false;

    body.devices.forEach((row) => {
      const incoming = monitoringApiStatusToDevice(row);
      if (!incoming.deviceUid) return;
      const existing = state.monitoringDevices.find((device) => {
        const normalized = normalizeMonitoringDevice(device);
        return normalized?.deviceUid === incoming.deviceUid || String(normalized?.id || "") === String(incoming.id);
      });
      const localId = existing?.id || incoming.id || makeId();
      deviceIdByApiId.set(String(incoming.id || ""), localId);
      const next = { ...(existing || {}), ...incoming, id: localId };
      if (existing) {
        Object.assign(existing, next);
      } else {
        state.monitoringDevices.push(next);
      }
      changed = true;
    });

    body.channels.forEach((row) => {
      const apiDeviceId = String(row.deviceId || row.device_id || "");
      const localDeviceId = deviceIdByApiId.get(apiDeviceId) || apiDeviceId;
      const incoming = monitoringApiStatusToChannel(row, localDeviceId);
      if (!incoming.deviceId || !incoming.physicalChannel) return;
      const existing = state.monitoringChannels.find((channel) => {
        return String(channel.id || "") === String(incoming.id)
          || (
            String(channel.deviceId || channel.device_id || "") === String(incoming.deviceId)
            && normalizeApiMonitoringChannelName(channel.physicalChannel || channel.physical_channel || "") === incoming.physicalChannel
          )
          || (
            String(channel.panelAssetId || channel.panel_asset_id || "") === String(incoming.panelAssetId)
            && String(channel.circuitNumber || channel.circuit_number || "") === String(incoming.circuitNumber)
          );
      });
      const next = { ...(existing || {}), ...incoming };
      if (existing) {
        Object.assign(existing, next);
      } else {
        state.monitoringChannels.push(next);
      }
      changed = true;
    });

    if (Array.isArray(body.events)) {
      const existingEventIds = new Set(state.monitoringEvents.map((event) => String(event.id || "")));
      body.events.slice(0, 20).reverse().forEach((row) => {
        if (!row.id || existingEventIds.has(String(row.id))) return;
        state.monitoringEvents.unshift(monitoringApiStatusToEvent(row, deviceIdByApiId));
        changed = true;
      });
      state.monitoringEvents = state.monitoringEvents.slice(0, 1000);
    }

    if (changed) renderMonitoring();
  } catch (error) {
    console.warn("Monitoring live status sync failed", error);
  }
}

async function syncMonitoringStatusFromSupabase() {
  ensureMonitoringCollections();
  try {
    const [
      deviceRows,
      channelRows,
      eventRows,
      alertRows
    ] = await Promise.all([
      fetchOptionalStructuredRows("monitoring_devices", "updated_at.desc"),
      fetchOptionalStructuredRows("monitoring_channels", "updated_at.desc"),
      fetchOptionalStructuredRows("monitoring_events", "created_at.desc"),
      fetchOptionalStructuredRows("monitoring_alerts", "updated_at.desc")
    ]);
    let changed = false;
    const deviceIdByCloudId = new Map();

    deviceRows.forEach((row) => {
      const incoming = monitoringDeviceFromStructuredRow(row);
      if (!incoming.deviceUid) return;
      const existing = state.monitoringDevices.find((device) => {
        const normalized = normalizeMonitoringDevice(device);
        return normalized?.deviceUid === incoming.deviceUid || String(normalized?.id || "") === String(incoming.id);
      });
      const localId = existing?.id || incoming.id || makeId();
      deviceIdByCloudId.set(String(incoming.id || ""), localId);
      const next = { ...(existing || {}), ...incoming, id: localId };
      if (existing) {
        Object.assign(existing, next);
      } else {
        state.monitoringDevices.push(next);
      }
      changed = true;
    });

    channelRows.forEach((row) => {
      const incoming = monitoringChannelFromStructuredRow(row);
      const localDeviceId = deviceIdByCloudId.get(String(incoming.deviceId || "")) || incoming.deviceId;
      incoming.deviceId = localDeviceId;
      if (!incoming.deviceId || !incoming.physicalChannel) return;
      const existing = state.monitoringChannels.find((channel) => {
        return String(channel.id || "") === String(incoming.id)
          || (
            String(channel.deviceId || channel.device_id || "") === String(incoming.deviceId)
            && normalizeApiMonitoringChannelName(channel.physicalChannel || channel.physical_channel || "") === normalizeApiMonitoringChannelName(incoming.physicalChannel)
          );
      });
      const next = { ...(existing || {}), ...incoming };
      if (existing) {
        Object.assign(existing, next);
      } else {
        state.monitoringChannels.push(next);
      }
      changed = true;
    });

    const existingEventIds = new Set(state.monitoringEvents.map((event) => String(event.id || "")));
    eventRows.slice(0, 50).reverse().forEach((row) => {
      if (!row.id || existingEventIds.has(String(row.id))) return;
      const event = monitoringEventFromStructuredRow(row);
      event.deviceId = deviceIdByCloudId.get(String(event.deviceId || "")) || event.deviceId;
      state.monitoringEvents.unshift(event);
      changed = true;
    });
    state.monitoringEvents = state.monitoringEvents.slice(0, 1000);

    const alertIds = new Set();
    alertRows.forEach((row) => {
      const incoming = monitoringAlertFromStructuredRow(row);
      incoming.deviceId = deviceIdByCloudId.get(String(incoming.deviceId || "")) || incoming.deviceId;
      if (!incoming.id) return;
      alertIds.add(String(incoming.id));
      const existing = state.monitoringAlerts.find((alert) => String(alert.id || "") === String(incoming.id));
      if (existing) {
        Object.assign(existing, { ...existing, ...incoming });
      } else {
        state.monitoringAlerts.push(incoming);
      }
      changed = true;
    });

    if (changed) {
      persistLocalStateOnly(false);
      renderMonitoring();
    }
  } catch (error) {
    console.warn("Monitoring Supabase status sync failed", error);
  }
}

function monitoringEngine() {
  return window.SiteWorksMonitoringEngine || null;
}

function normalizeMonitoringSourcePhases(phases = {}) {
  if (monitoringEngine()?.normalizeSourcePhases) return monitoringEngine().normalizeSourcePhases(phases);
  const result = {};
  MONITORING_SOURCE_PHASES.forEach(phase => {
    result[phase] = phases[phase] !== false;
  });
  return result;
}

function normalizeMonitoringPhase(value = "") {
  const phase = String(value || "").trim().toUpperCase();
  return MONITORING_SOURCE_PHASES.includes(phase) ? phase : "";
}

function getMonitoringChannelSourcePhases(elements, poleCount = 1) {
  const selected = [
    normalizeMonitoringPhase(elements.channelPhase?.value || "A"),
    normalizeMonitoringPhase(elements.channelPhase2?.value || "B"),
    normalizeMonitoringPhase(elements.channelPhase3?.value || "C")
  ].filter(Boolean);
  return selected.slice(0, Math.max(1, Math.min(3, Number(poleCount) || 1)));
}

function getMonitoringChannelPhaseList(channel = {}) {
  if (monitoringEngine()?.getChannelPhaseList) return monitoringEngine().getChannelPhaseList(channel);
  const phases = Array.isArray(channel.sourcePhases)
    ? channel.sourcePhases.map(normalizeMonitoringPhase).filter(Boolean)
    : String(channel.sourcePhases || "")
      .split(/[\s,/-]+/)
      .map(normalizeMonitoringPhase)
      .filter(Boolean);
  const fallback = normalizeMonitoringPhase(channel.sourcePhase) || "A";
  const count = Math.max(1, Math.min(3, Number(channel.poleCount || phases.length || 1)));
  return (phases.length ? phases : [fallback]).slice(0, count);
}

function monitoringChannelPhaseLabel(channel = {}) {
  return getMonitoringChannelPhaseList(channel).join("/") || "A";
}

function parseMonitoringCircuitNumbers(value = "") {
  if (monitoringEngine()?.parseCircuitNumbers) return monitoringEngine().parseCircuitNumbers(value);
  return String(value || "")
    .split(/[\s,;/]+/)
    .map(item => Number(String(item).replace(/\D/g, "")))
    .filter(number => Number.isInteger(number) && number > 0);
}

function findPanelScheduleCircuit(circuits = [], circuitNumber = "") {
  const target = Number(String(circuitNumber || "").replace(/\D/g, ""));
  const targetText = String(circuitNumber || "").trim();
  return circuits.find((item) => {
    const rawNumber = String(item?.number || item?.cct || item?.circuit || "").trim();
    if (target && parseMonitoringCircuitNumbers(rawNumber).includes(target)) return true;
    return rawNumber === targetText;
  }) || null;
}

function buildPanelCircuitMap(circuits = []) {
  const byNumber = new Map();
  circuits.forEach((circuit) => {
    const rawNumber = String(circuit?.number || circuit?.cct || circuit?.circuit || "").trim();
    const numbers = parseMonitoringCircuitNumbers(rawNumber);
    if (!numbers.length && rawNumber) {
      byNumber.set(rawNumber, circuit);
      return;
    }
    numbers.forEach((number) => {
      const key = String(number);
      if (!byNumber.has(key)) {
        byNumber.set(key, {
          ...circuit,
          number: key,
          groupedNumber: rawNumber
        });
      }
    });
  });
  return byNumber;
}

function monitoringPanelCircuitCount(panel = null, channels = []) {
  const schedule = isElectricalPanelAsset(panel) ? getElectricalPanelSchedule(panel) : {};
  const scheduledCount = Number(schedule.circuitCount || 0);
  const maxMapped = channels.reduce((max, channel) => {
    const circuitMax = parseMonitoringCircuitNumbers(channel.circuitNumber).reduce((innerMax, number) => Math.max(innerMax, number), 0);
    return Math.max(max, circuitMax);
  }, 0);
  const count = Math.max(scheduledCount || 0, maxMapped || 0, 42);
  return count % 2 === 0 ? count : count + 1;
}

function monitoringChannelByCircuitMap(channels = []) {
  const map = new Map();
  channels.forEach(channel => {
    parseMonitoringCircuitNumbers(channel.circuitNumber).forEach(number => {
      if (!map.has(number)) map.set(number, channel);
    });
  });
  return map;
}

function monitoringPanelCircuitLabel(panel = null, circuitNumber = "") {
  const schedule = isElectricalPanelAsset(panel) ? getElectricalPanelSchedule(panel) : {};
  const circuits = Array.isArray(schedule.circuits) ? schedule.circuits : [];
  const circuit = findPanelScheduleCircuit(circuits, circuitNumber);
  return panelCircuitLoadText(circuit) || circuit?.description || circuit?.loadServed || "";
}

function monitoringPanelCircuitBreakerSize(panel = null, circuitNumber = "") {
  const schedule = isElectricalPanelAsset(panel) ? getElectricalPanelSchedule(panel) : {};
  const circuits = Array.isArray(schedule.circuits) ? schedule.circuits : [];
  const circuit = findPanelScheduleCircuit(circuits, circuitNumber);
  const value = String(circuit?.breaker || circuit?.breakerSize || circuit?.amp || circuit?.amps || circuit?.amperage || "").trim();
  if (!value || value === "-") return "";
  return /^\d+(?:\.\d+)?$/.test(value) ? `${value}A` : value;
}

function monitoringPanelCircuitRecord(panel = null, circuitNumber = "") {
  const schedule = isElectricalPanelAsset(panel) ? getElectricalPanelSchedule(panel) : {};
  const circuits = Array.isArray(schedule.circuits) ? schedule.circuits : [];
  const target = Number(String(circuitNumber || "").replace(/\D/g, ""));
  return circuits.find((item) => {
    const numbers = parseMonitoringCircuitNumbers(item.number || item.cct || item.circuit || "");
    return numbers.includes(target);
  }) || null;
}

function monitoringPanelCircuitGroupNumbers(panel = null, circuitNumber = "", side = "left") {
  const circuit = monitoringPanelCircuitRecord(panel, circuitNumber);
  const wantOdd = side === "left";
  return parseMonitoringCircuitNumbers(circuit?.number || circuit?.cct || circuit?.circuit || circuitNumber)
    .filter((number) => wantOdd ? number % 2 === 1 : number % 2 === 0)
    .sort((a, b) => a - b);
}

function monitoringPanelCircuitGroupSpan(panel = null, circuitNumber = "", side = "left") {
  const groupNumbers = monitoringPanelCircuitGroupNumbers(panel, circuitNumber, side);
  if (groupNumbers.length < 2) return 1;
  return Math.max(1, Math.floor((groupNumbers.at(-1) - groupNumbers[0]) / 2) + 1);
}

function isFirstMonitoringPanelGroupCircuit(panel = null, circuitNumber = "", side = "left") {
  const target = Number(String(circuitNumber || "").replace(/\D/g, ""));
  const groupNumbers = monitoringPanelCircuitGroupNumbers(panel, circuitNumber, side);
  return groupNumbers.length < 2 || groupNumbers[0] === target;
}

function inferMonitoringPoleCountFromSchedule(panel = null, circuitNumber = "") {
  const circuit = monitoringPanelCircuitRecord(panel, circuitNumber);
  const schedule = isElectricalPanelAsset(panel) ? getElectricalPanelSchedule(panel) : {};
  const circuits = Array.isArray(schedule.circuits) ? schedule.circuits : [];
  const numbers = parseMonitoringCircuitNumbers(circuit?.number || circuit?.cct || circuit?.circuit || circuitNumber);
  const explicitCount = Math.max(...numbers.map(() => 1), numbers.length || 1);
  const text = [
    circuit?.poles,
    circuit?.poleCount,
    circuit?.breaker,
    circuit?.breakerSize,
    circuit?.amp,
    circuit?.amps,
    circuit?.amperage,
    panelCircuitLoadText(circuit)
  ].filter(Boolean).join(" ").toLowerCase();
  const poleMatch = text.match(/\b([123])\s*(?:p|pole|poles)\b/);
  if (poleMatch) return Math.max(1, Math.min(3, Number(poleMatch[1])));
  if (explicitCount > 1) return Math.max(1, Math.min(3, explicitCount));

  const baseNumber = Number(String(circuitNumber || "").replace(/\D/g, ""));
  if (!baseNumber || !circuit) return 1;
  const baseBreaker = String(circuit.breaker || circuit.breakerSize || circuit.amp || circuit.amps || circuit.amperage || "").trim().toLowerCase();
  const baseLabel = String(panelCircuitLoadText(circuit) || circuit.description || circuit.loadServed || "").trim().toLowerCase();
  if (!baseBreaker || !baseLabel || baseBreaker === "-" || baseLabel.includes("spare")) return 1;

  let count = 1;
  for (let offset = 2; offset <= 4; offset += 2) {
    const next = circuits.find((item) => {
      const itemNumbers = parseMonitoringCircuitNumbers(item.number || item.cct || item.circuit || "");
      return itemNumbers.includes(baseNumber + offset);
    });
    const nextBreaker = String(next?.breaker || next?.breakerSize || next?.amp || next?.amps || next?.amperage || "").trim().toLowerCase();
    const nextLabel = String(panelCircuitLoadText(next) || next?.description || next?.loadServed || "").trim().toLowerCase();
    if (nextBreaker === baseBreaker && nextLabel === baseLabel) count += 1;
    else break;
  }
  return Math.max(1, Math.min(3, count));
}

function expandMonitoringPhysicalChannels(value = "", poleCount = 1) {
  const channels = monitoringEngine()?.parseList ? monitoringEngine().parseList(value) : String(value || "").split(/[\s,;/]+/).filter(Boolean);
  const count = Math.max(1, Math.min(3, Number(poleCount) || 1));
  if (channels.length === 1 && count > 1 && /^\d+$/.test(channels[0])) {
    const start = Number(channels[0]);
    return Array.from({ length: count }, (_, index) => String(start + index));
  }
  return channels;
}

function applyMonitoringCircuitScheduleDefaults() {
  const elements = monitoringElements();
  const device = normalizeMonitoringDevice(getMonitoringDevice(elements.channelDevice?.value));
  const panel = device ? getAsset(device.panelAssetId) : null;
  const circuitNumber = String(elements.channelCircuit?.value || elements.channelCircuitManual?.value || "").trim();
  if (!panel || !circuitNumber) return;
  const poleCount = inferMonitoringPoleCountFromSchedule(panel, circuitNumber);
  if (elements.channelPoles) elements.channelPoles.value = String(poleCount);
  if (elements.channelNumber) {
    const expandedChannels = expandMonitoringPhysicalChannels(elements.channelNumber.value, poleCount);
    if (expandedChannels.length > 1) elements.channelNumber.value = expandedChannels.join(",");
  }
  syncMonitoringPhaseSelectors();
}

function monitoringMainMeterValue(device = null, names = []) {
  for (const name of names) {
    const value = device?.[name] ?? device?.telemetry?.[name] ?? device?.latestTelemetry?.[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

const MONITORING_PANEL_TEMPLATES = {
  "panel-c-42": {
    id: "panel-c-42",
    name: "Panel C 42 circuit",
    backgroundImage: "panel-monitor-background.png",
    circuitCount: 42,
    aspectRatio: "3 / 2",
    rows: {
      left: { startY: 21.32, rowStep: 3.12 },
      right: { startY: 21.32, rowStep: 3.12 }
    },
    zones: {
      left: {
        row: { x: 6.82, width: 30.45, height: 2.78 },
        number: { x: 6.92, y: 5, width: 1.45, height: 90 },
        amps: { x: 28.72, y: 0, width: 2.0, height: 28 },
        label: { x: 9.1, width: 15.65 },
        breaker: { x: 29.18, width: 2.25 },
        status: { x: 36.1, width: 1.0 },
        voltage: { x: 31.45, width: 2.55 },
        temperature: { x: 34.15, width: 2.55 }
      },
      right: {
        row: { x: 58.7, width: 25.65, height: 2.78 },
        status: { x: 58.78, width: 1.0 },
        breaker: { x: 62.22, width: 2.25 },
        label: { x: 70.4, width: 11.75 },
        number: { x: 82.85, y: 5, width: 1.42, height: 90 },
        amps: { x: 62.02, y: 0, width: 2.0, height: 28 },
        voltage: { x: 56.1, width: 2.55 },
        temperature: { x: 58.8, width: 2.55 }
      }
    }
  }
};

function getMonitoringPanelTemplate(panel = null) {
  const schedule = isElectricalPanelAsset(panel) ? getElectricalPanelSchedule(panel) : {};
  const count = normalizePanelCircuitCount(schedule.circuitCount || 42);
  return {
    ...MONITORING_PANEL_TEMPLATES["panel-c-42"],
    circuitCount: count || 42
  };
}

function monitoringTemplateCircuitPosition(template, circuitNumber) {
  const number = Number(circuitNumber);
  const side = number % 2 === 0 ? "right" : "left";
  const rowIndex = Math.floor((number - 1) / 2);
  const sideRows = template.rows[side] || template.rows.left;
  return {
    side,
    y: sideRows.startY + rowIndex * sideRows.rowStep,
    height: template.zones[side].row.height
  };
}

function monitoringOverlayStyle(zone = {}, y = 0, height = 2.6) {
  const zoneHeight = zone.height || height;
  return `left:${zone.x}%;top:${y}%;width:${zone.width}%;height:${zoneHeight}%;`;
}

function monitoringOverlayInnerStyle(rowZone = {}, zone = {}, height = 100) {
  const rowX = Number(rowZone.x || 0);
  const rowWidth = Math.max(1, Number(rowZone.width || 100));
  const left = ((Number(zone.x || 0) - rowX) / rowWidth) * 100;
  const top = Number(zone.y || 0);
  const width = (Number(zone.width || 0) / rowWidth) * 100;
  const zoneHeight = zone.height || height;
  return `left:${left}%;top:${top}%;width:${width}%;height:${zoneHeight}%;`;
}

function monitoringCircuitValue(channel = null, names = []) {
  for (const name of names) {
    const value = channel?.[name] ?? channel?.data?.[name] ?? channel?.telemetry?.[name] ?? channel?.latestTelemetry?.[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function showMonitoringBreakerDetail(channelId = "", circuitNumber = "") {
  const elements = monitoringElements();
  if (!elements.breakerDetail) return;
  const channel = getMonitoringChannel(channelId);
  const panel = getAsset(channel?.panelAssetId || selectedMonitoringPanelId);
  const device = channel ? getMonitoringDevice(channel.deviceId) : null;
  const circuit = circuitNumber || channel?.circuitNumber || "";
  const label = monitoringPanelCircuitLabel(panel, circuitNumber) || "No panel label saved";
  const breakerSize = monitoringPanelCircuitBreakerSize(panel, circuitNumber) || "Not entered";
  const voltage = monitoringCircuitValue(channel, ["voltage", "lineVoltage", "line_voltage"]) || "Not reported";
  const current = monitoringCircuitValue(channel, ["current", "amps", "amperage", "loadCurrent", "load_current"]) || "Not reported";
  const temperature = monitoringCircuitValue(channel, ["temperature", "temp", "temperatureF", "temperature_f"]) || "Not reported";
  const power = monitoringCircuitValue(channel, ["kw", "kW", "power", "powerKw", "power_kw"]) || "Not reported";
  const status = channel ? monitoringStateLabel(channel.lastDerivedState) : "Not monitored";
  elements.breakerDetail.classList.remove("hidden");
  elements.breakerDetail.innerHTML = `
    <div>
      <span>Circuit ${escapeHtml(circuit)}</span>
      <strong>${escapeHtml(status)}</strong>
      <small>${escapeHtml(label)}</small>
    </div>
    <dl>
      <div><dt>Panel</dt><dd>${escapeHtml(panel?.name || "Panel")}</dd></div>
      <div><dt>Breaker size</dt><dd>${escapeHtml(breakerSize)}</dd></div>
      <div><dt>Phase</dt><dd>${escapeHtml(channel ? monitoringChannelPhaseLabel(channel) : "Not mapped")}</dd></div>
      <div><dt>Physical channel</dt><dd>${escapeHtml(channel?.physicalChannel || "Not mapped")}</dd></div>
      <div><dt>Voltage</dt><dd>${escapeHtml(voltage)}</dd></div>
      <div><dt>Current</dt><dd>${escapeHtml(current)}</dd></div>
      <div><dt>Power</dt><dd>${escapeHtml(power)}</dd></div>
      <div><dt>Temperature</dt><dd>${escapeHtml(temperature)}</dd></div>
      <div><dt>Device</dt><dd>${escapeHtml(device?.name || "No monitor")}</dd></div>
      <div><dt>Last update</dt><dd>${escapeHtml(channel?.updatedAt ? formatDateTime(channel.updatedAt) : "Not monitored")}</dd></div>
    </dl>
  `;
}

function syncMonitoringPhaseSelectors() {
  const elements = monitoringElements();
  const poleCount = Math.max(1, Number(elements.channelPoles?.value || 1));
  elements.channelPhase2Wrap?.classList.toggle("hidden", poleCount < 2);
  elements.channelPhase3Wrap?.classList.toggle("hidden", poleCount < 3);
  if (elements.channelPhase2) elements.channelPhase2.disabled = poleCount < 2;
  if (elements.channelPhase3) elements.channelPhase3.disabled = poleCount < 3;
}

function monitoringStateLabel(stateValue) {
  const labels = {
    energized: "Energized",
    open: "Open",
    "suspected-trip": "Suspected trip",
    "upstream-power-loss": "Upstream phase loss",
    "monitoring-offline": "Monitoring offline",
    "maintenance-mode": "Maintenance mode",
    disabled: "Disabled"
  };
  return labels[stateValue] || "Unknown";
}

function monitoringStatusClass(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

async function hashMonitoringApiKey(apiKey) {
  const value = String(apiKey || "").trim();
  if (!value) return "";
  if (!window.crypto?.subtle) throw new Error("Secure browser crypto is required before saving an API key.");
  const data = new TextEncoder().encode(value);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function generateMonitoringApiKey() {
  const bytes = new Uint8Array(24);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  }
  return `swm_${Array.from(bytes).map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function rotateMonitoringDeviceKey() {
  ensureMonitoringCollections();
  const elements = monitoringElements();
  if (!canManageMonitoringSetup()) {
    if (elements.generatedApiKey) elements.generatedApiKey.textContent = "Admin access is required to rotate monitoring keys.";
    return;
  }
  const deviceId = String(elements.deviceId?.value || elements.channelDevice?.value || "");
  const device = getMonitoringDevice(deviceId);
  if (!device) {
    if (elements.generatedApiKey) elements.generatedApiKey.textContent = "Choose or edit a saved device first.";
    return;
  }
  const newKey = generateMonitoringApiKey();
  device.apiKeyHash = await hashMonitoringApiKey(newKey);
  device.apiKeyLast4 = newKey.slice(-4);
  device.updatedAt = new Date().toISOString();
  addMonitoringEvent({ deviceId: device.id, panelAssetId: device.panelAssetId, type: "api-key-rotated", message: `${device.name} API key was rotated.` });
  saveState();
  try {
    await syncMonitoringDeviceToSupabase(device, newKey);
  } catch (error) {
    console.warn("Monitoring key cloud save failed", error);
    if (elements.generatedApiKey) elements.generatedApiKey.textContent = `New API key, shown once: ${newKey}. Cloud save needs attention.`;
    return;
  }
  render();
  const nextElements = monitoringElements();
  if (nextElements.generatedApiKey) {
    nextElements.generatedApiKey.textContent = `New API key, shown once: ${newKey}`;
  }
}

async function repairMonitoringCloudKey() {
  ensureMonitoringCollections();
  const elements = monitoringElements();
  if (!canManageMonitoringSetup()) {
    if (elements.deviceStatus) elements.deviceStatus.textContent = "Admin access is required to repair monitoring keys.";
    return;
  }
  const apiKey = String(elements.deviceApiKey?.value || "").trim();
  const uid = String(elements.deviceUid?.value || "").trim();
  const deviceId = String(elements.deviceId?.value || elements.channelDevice?.value || "");
  const device = getMonitoringDevice(deviceId) || state.monitoringDevices.find((item) => normalizeMonitoringDevice(item)?.deviceUid === uid);
  if (!uid && !device?.deviceUid) {
    if (elements.deviceStatus) elements.deviceStatus.textContent = "Enter or edit the device UID first.";
    return;
  }
  if (!apiKey || apiKey.length < 16) {
    if (elements.deviceStatus) elements.deviceStatus.textContent = "Paste the ESP32 API key first. It must be at least 16 characters.";
    return;
  }
  try {
    if (device) {
      await syncMonitoringDeviceToSupabase({
        ...device,
        deviceUid: uid || device.deviceUid,
        apiKeyLast4: apiKey.slice(-4),
        updatedAt: new Date().toISOString()
      }, apiKey);
      device.apiKeyHash = await hashMonitoringApiKey(apiKey);
      device.apiKeyLast4 = apiKey.slice(-4);
      device.updatedAt = new Date().toISOString();
      saveState();
    } else {
      await setMonitoringDeviceKeyInSupabaseByUid(uid, apiKey);
    }
    if (elements.deviceStatus) {
      elements.deviceStatus.textContent = `Cloud key repaired. ESP32 key must end in ${apiKey.slice(-4)}.`;
    }
    const nextElements = monitoringElements();
    if (nextElements.generatedApiKey) nextElements.generatedApiKey.textContent = "";
  } catch (error) {
    console.warn("Monitoring cloud key repair failed", error);
    if (elements.deviceStatus) {
      const message = String(error?.message || "Unknown error");
      elements.deviceStatus.textContent = message.includes("siteworks_monitoring_set_device_api_key_by_uid")
        ? "Cloud key repair needs the new Supabase SQL file run first."
        : `Cloud key repair failed: ${message}`;
    }
  }
}

async function handleMonitoringDeviceSubmit(form) {
  ensureMonitoringCollections();
  const elements = monitoringElements();
  if (!canManageMonitoringSetup()) {
    if (elements.deviceStatus) elements.deviceStatus.textContent = "Admin access is required to save monitoring devices.";
    return;
  }
  try {
    const panel = getAsset(elements.devicePanel?.value);
    if (!panel || !isElectricalPanelAsset(panel)) {
      if (elements.deviceStatus) elements.deviceStatus.textContent = "Choose an electrical panel first.";
      return;
    }
    const uid = String(elements.deviceUid?.value || "").trim();
    const name = String(elements.deviceName?.value || "").trim();
    if (!uid || !name) {
      if (elements.deviceStatus) elements.deviceStatus.textContent = "Device UID and name are required.";
      return;
    }
    const existingId = String(elements.deviceId?.value || "");
    const duplicate = state.monitoringDevices.find(device => {
      const normalized = normalizeMonitoringDevice(device);
      return normalized?.deviceUid === uid && String(normalized?.id || "") !== existingId;
    });
    if (duplicate) {
      if (elements.deviceStatus) elements.deviceStatus.textContent = "That device UID is already assigned.";
      return;
    }
    const now = new Date().toISOString();
    const apiKey = String(elements.deviceApiKey?.value || "").trim();
    if (apiKey && apiKey.length < 16) {
      if (elements.deviceStatus) elements.deviceStatus.textContent = "API key must be at least 16 characters for ESP32 cloud testing.";
      return;
    }
    const device = existingId ? getMonitoringDevice(existingId) : {
      id: makeId(),
      createdAt: now,
      onlineStatus: "offline",
      sourcePhases: normalizeMonitoringSourcePhases()
    };
    if (!device) {
      if (elements.deviceStatus) elements.deviceStatus.textContent = "Device could not be found for editing.";
      return;
    }
    device.customerId = panel.customerId || panel.customer_id || "";
    device.locationId = panel.locationId || panel.location_id || "";
    device.panelAssetId = panel.id;
    device.deviceUid = uid;
    device.name = name;
    device.model = String(elements.deviceModel?.value || "").trim();
    device.firmwareVersion = String(elements.deviceFirmware?.value || "").trim();
    device.heartbeatSeconds = Math.max(30, Number(elements.deviceHeartbeat?.value || MONITORING_DEFAULT_HEARTBEAT_SECONDS));
    device.maintenanceMode = Boolean(elements.deviceMaintenance?.checked);
    device.sourcePhaseChannels = monitoringEngine()?.normalizeSourcePhaseChannels
      ? monitoringEngine().normalizeSourcePhaseChannels({
        A: elements.sourcePhaseAChannel?.value || "",
        B: elements.sourcePhaseBChannel?.value || "",
        C: elements.sourcePhaseCChannel?.value || ""
      })
      : {
        A: String(elements.sourcePhaseAChannel?.value || "").trim(),
        B: String(elements.sourcePhaseBChannel?.value || "").trim(),
        C: String(elements.sourcePhaseCChannel?.value || "").trim()
      };
    device.updatedAt = now;
    if (apiKey) {
      device.apiKeyHash = await hashMonitoringApiKey(apiKey);
      device.apiKeyLast4 = apiKey.slice(-4);
    }
    if (!existingId) {
      state.monitoringDevices.push(device);
      addMonitoringEvent({ deviceId: device.id, panelAssetId: panel.id, type: "device-created", message: `${name} was added.` });
    } else {
      addMonitoringEvent({ deviceId: device.id, panelAssetId: panel.id, type: "device-updated", message: `${name} was updated.` });
    }
    addActivity("Monitoring device saved", `${device.name} assigned to ${panel.name}`);
    const savedDeviceId = String(device.id || "");
    saveState();
    let cloudSaved = false;
    try {
      cloudSaved = await syncMonitoringDeviceToSupabase(device, apiKey);
    } catch (error) {
      console.warn("Monitoring device cloud save failed", error);
      if (elements.deviceStatus) elements.deviceStatus.textContent = `Device saved locally, but cloud save failed: ${error?.message || "Unknown error"}`;
    }
    form.reset();
    if (elements.deviceId) elements.deviceId.value = "";
    render();
    const nextElements = monitoringElements();
    const savedDevices = visibleMonitoringDevices();
    const savedDeviceIsVisible = savedDevices.some(item => String(item.id || "") === savedDeviceId);
    if (savedDeviceIsVisible) {
      if (nextElements.channelDevice) {
        nextElements.channelDevice.value = savedDeviceId;
        renderMonitoringCircuitOptions(savedDeviceId);
      }
      if (nextElements.simulatorDevice) nextElements.simulatorDevice.value = savedDeviceId;
    }
    if (nextElements.deviceStatus) {
      nextElements.deviceStatus.textContent = savedDeviceIsVisible
        ? cloudSaved
          ? "Device saved to SiteWorks. It is ready for channel mapping and ESP32 testing."
          : "Device saved locally. Cloud save will retry with the normal sync."
        : "Device saved, but it is hidden by the current customer or location filter.";
    }
  } catch (error) {
    console.error("Monitoring device save failed", error);
    if (elements.deviceStatus) elements.deviceStatus.textContent = `Device save failed: ${error?.message || "Unknown error"}`;
  }
}

async function handleMonitoringChannelSubmit(form) {
  ensureMonitoringCollections();
  const elements = monitoringElements();
  if (!canManageMonitoringSetup()) {
    if (elements.channelStatus) elements.channelStatus.textContent = "Admin access is required to map breaker channels.";
    return;
  }
  try {
  const device = normalizeMonitoringDevice(getMonitoringDevice(elements.channelDevice?.value));
  if (!device) {
    if (elements.channelStatus) elements.channelStatus.textContent = "Choose a device first.";
    return;
  }
  const physicalChannel = String(elements.channelNumber?.value || "").trim();
  const circuitNumber = String(elements.channelCircuit?.value || elements.channelCircuitManual?.value || physicalChannel || "").trim();
  const schedulePoleCount = inferMonitoringPoleCountFromSchedule(getAsset(device.panelAssetId), circuitNumber);
  const poleCount = Math.max(1, Math.min(3, Number(schedulePoleCount || elements.channelPoles?.value || 1)));
  const sourcePhases = getMonitoringChannelSourcePhases(elements, poleCount);
  if (!circuitNumber || !physicalChannel) {
    if (elements.channelStatus) elements.channelStatus.textContent = "Circuit and channel are required.";
    return;
  }
  const physicalChannels = expandMonitoringPhysicalChannels(physicalChannel, poleCount);
  const physicalChannelList = physicalChannels.join(",");
  const editingChannel = editingMonitoringChannelId ? getMonitoringChannel(editingMonitoringChannelId) : null;
  const editingGroupId = editingChannel?.breakerGroupId || editingChannel?.id || "";
  const duplicate = state.monitoringChannels.find(channel => {
    const channelGroupId = channel.breakerGroupId || channel.id || "";
    if (editingGroupId && channelGroupId === editingGroupId) return false;
    return channel.deviceId === device.id && physicalChannels.includes(String(channel.physicalChannel || ""));
  });
  if (duplicate) {
    if (elements.channelStatus) elements.channelStatus.textContent = "One of those physical channels is already mapped on this device.";
    return;
  }
  const created = monitoringEngine()?.createChannelRecords
    ? monitoringEngine().createChannelRecords({
      deviceId: device.id,
      panelAssetId: device.panelAssetId,
      circuitNumber,
      physicalChannel: physicalChannelList,
      sourcePhases,
      poleCount,
      alarmDelaySeconds: Math.max(0, Number(elements.channelDelay?.value || MONITORING_DEFAULT_DELAY_SECONDS)),
      monitoringMode: String(elements.channelMode?.value || "normal"),
      criticality: String(elements.channelCriticality?.value || "normal")
    }, { makeId })
    : { ok: true, records: [{
      id: makeId(),
      deviceId: device.id,
      panelAssetId: device.panelAssetId,
      circuitNumber,
      physicalChannel: physicalChannelList,
      sourcePhase: sourcePhases[0] || "A",
      sourcePhases,
      poleCount,
      alarmDelaySeconds: Math.max(0, Number(elements.channelDelay?.value || MONITORING_DEFAULT_DELAY_SECONDS)),
      monitoringMode: String(elements.channelMode?.value || "normal"),
      criticality: String(elements.channelCriticality?.value || "normal"),
      lastRawState: null,
      lastDerivedState: "open",
      firstAbsentAt: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }] };
  if (!created.ok) {
    if (elements.channelStatus) elements.channelStatus.textContent = created.message || "Channel mapping is incomplete.";
    return;
  }
  const replacedChannels = editingGroupId
    ? state.monitoringChannels.filter(channel => (channel.breakerGroupId || channel.id || "") === editingGroupId)
    : [];
  if (replacedChannels.length) {
    state.monitoringChannels = state.monitoringChannels.filter(channel => (channel.breakerGroupId || channel.id || "") !== editingGroupId);
  }
  state.monitoringChannels.push(...created.records);
  created.records.forEach(channel => {
    addMonitoringEvent({
      deviceId: device.id,
      channelId: channel.id,
      panelAssetId: device.panelAssetId,
      circuitNumber: channel.circuitNumber || circuitNumber,
      breakerGroupId: channel.breakerGroupId || "",
      type: replacedChannels.length ? "channel-updated" : "channel-mapped",
      message: `Channel ${channel.physicalChannel} mapped to circuit ${channel.circuitNumber || circuitNumber}.`
    });
  });
  addActivity(replacedChannels.length ? "Monitoring channel updated" : "Monitoring channel mapped", `${device.name} channel ${physicalChannelList} -> circuit ${circuitNumber}`);
  const replacedChannelIds = replacedChannels.map(channel => channel.id).filter(Boolean);
  editingMonitoringChannelId = "";
  form.reset();
  if (elements.channelDevice) elements.channelDevice.value = device.id;
  saveState();
  let cloudSaved = false;
  try {
    if (replacedChannelIds.length) await deleteStructuredRows("monitoring_channels", "id", replacedChannelIds);
    cloudSaved = await syncMonitoringChannelsToSupabase(created.records);
  } catch (error) {
    console.warn("Monitoring channel cloud save failed", error);
  }
  render();
  const nextElements = monitoringElements();
  if (nextElements.channelStatus) {
    nextElements.channelStatus.textContent = cloudSaved
      ? (replacedChannels.length ? "Channel updated in SiteWorks." : "Channel mapped to SiteWorks.")
      : (replacedChannels.length ? "Channel updated locally. Cloud save will retry with the normal sync." : "Channel mapped locally. Cloud save will retry with the normal sync.");
  }
  } catch (error) {
    console.error("Monitoring channel save failed", error);
    if (elements.channelStatus) elements.channelStatus.textContent = `Channel save failed: ${error?.message || "Unknown error"}`;
  }
}

function handleMonitoringSimulatorSubmit(form) {
  ensureMonitoringCollections();
  const elements = monitoringElements();
  if (!canManageMonitoringSetup()) {
    if (elements.simulatorStatus) elements.simulatorStatus.textContent = "Admin access is required to use the simulator.";
    return;
  }
  try {
  const device = normalizeMonitoringDevice(getMonitoringDevice(elements.simulatorDevice?.value));
  if (!device) {
    if (elements.simulatorStatus) elements.simulatorStatus.textContent = "Choose a device first.";
    return;
  }
  const formData = new FormData(form);
  const mappedChannels = monitoringChannelsForDevice(device.id);
  if (!mappedChannels.length) {
    if (elements.simulatorStatus) elements.simulatorStatus.textContent = "Map at least one breaker channel for this device first.";
    return;
  }
  const closedChannels = String(formData.get("closedChannels") || "")
    .split(/[\s,]+/)
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  ingestMonitoringStatus({
    deviceId: device.id,
    deviceUid: device.deviceUid,
    timestamp: new Date().toISOString(),
    healthStatus: "ok",
    sourcePhases: {
      A: formData.has("sourceA"),
      B: formData.has("sourceB"),
      C: formData.has("sourceC")
    },
    channels: mappedChannels.map(channel => ({
      channel: channel.physicalChannel,
      closed: closedChannels.includes(String(channel.physicalChannel).toLowerCase())
    }))
  }, { simulated: true });
  const successMessage = `Simulator status applied to ${mappedChannels.length} channel${mappedChannels.length === 1 ? "" : "s"}.`;
  if (elements.simulatorStatus) elements.simulatorStatus.textContent = successMessage;
  saveState();
  render();
  const nextElements = monitoringElements();
  if (nextElements.simulatorStatus) nextElements.simulatorStatus.textContent = successMessage;
  } catch (error) {
    console.error("Monitoring simulator failed", error);
    if (elements.simulatorStatus) elements.simulatorStatus.textContent = `Simulator failed: ${error?.message || "Unknown error"}`;
  }
}

function ingestMonitoringStatus(payload, options = {}) {
  ensureMonitoringCollections();
  if (monitoringEngine()?.ingestStatus) {
    return monitoringEngine().ingestStatus(state, payload, { ...options, makeId, now: payload.timestamp || new Date().toISOString() });
  }
  const device = state.monitoringDevices.find(item => item.deviceUid === payload.deviceUid || item.id === payload.deviceId);
  if (!device) return { ok: false, message: "Unknown monitoring device." };
  const now = payload.timestamp || new Date().toISOString();
  device.lastSeenAt = now;
  device.onlineStatus = "online";
  device.healthStatus = payload.healthStatus || "ok";
  device.sourcePhases = normalizeMonitoringSourcePhases(payload.sourcePhases);
  device.mainVoltage = payload.mainVoltage ?? payload.main_voltage ?? payload.voltage ?? payload.lineVoltage ?? payload.line_voltage ?? device.mainVoltage ?? "";
  device.mainCurrent = payload.mainCurrent ?? payload.main_current ?? payload.current ?? payload.loadCurrent ?? payload.load_current ?? payload.amps ?? payload.amperage ?? device.mainCurrent ?? "";
  device.updatedAt = new Date().toISOString();
  const channelStates = new Map((payload.channels || []).map(channel => [String(channel.channel), Boolean(channel.closed)]));
  monitoringChannelsForDevice(device.id).forEach(channel => {
    const rawClosed = channelStates.has(String(channel.physicalChannel)) ? channelStates.get(String(channel.physicalChannel)) : channel.lastRawState;
    const previousRaw = channel.lastRawState;
    const previousDerived = channel.lastDerivedState;
    channel.lastRawState = rawClosed;
    channel.lastDerivedState = deriveMonitoringChannelState(device, channel, rawClosed, now);
    channel.updatedAt = new Date().toISOString();
    if (previousRaw !== channel.lastRawState || previousDerived !== channel.lastDerivedState) {
      addMonitoringEvent({
        deviceId: device.id,
        channelId: channel.id,
        panelAssetId: channel.panelAssetId,
        circuitNumber: channel.circuitNumber,
        type: "state-change",
        state: channel.lastDerivedState,
        message: `Circuit ${channel.circuitNumber} is ${monitoringStateLabel(channel.lastDerivedState)}.`,
        data: { simulated: Boolean(options.simulated), rawClosed }
      });
    }
    if (channel.lastDerivedState === "suspected-trip") {
      ensureMonitoringAlert(device, channel);
    } else if (["energized", "maintenance-mode", "disabled", "upstream-power-loss"].includes(channel.lastDerivedState)) {
      resolveMonitoringAlertsForChannel(channel.id, `Circuit moved to ${monitoringStateLabel(channel.lastDerivedState)}.`);
    }
  });
  addMonitoringEvent({ deviceId: device.id, panelAssetId: device.panelAssetId, type: options.simulated ? "simulator-status" : "device-status", message: `${device.name} reported status.` });
  return { ok: true };
}

function deriveMonitoringChannelState(device, channel, rawClosed, timestamp) {
  if (monitoringEngine()?.deriveChannelState) return monitoringEngine().deriveChannelState(device, channel, rawClosed, timestamp);
  if (device.maintenanceMode || channel.monitoringMode === "maintenance") return "maintenance-mode";
  if (channel.monitoringMode === "disabled") return "disabled";
  if (device.onlineStatus === "offline") return "monitoring-offline";
  const sourcePhases = getMonitoringChannelPhaseList(channel);
  if (sourcePhases.some(phase => device.sourcePhases?.[phase] === false)) {
    channel.firstAbsentAt = "";
    return "upstream-power-loss";
  }
  if (rawClosed === true) {
    channel.firstAbsentAt = "";
    return "energized";
  }
  if (!channel.firstAbsentAt) channel.firstAbsentAt = timestamp;
  const elapsedSeconds = (new Date(timestamp).getTime() - new Date(channel.firstAbsentAt).getTime()) / 1000;
  return elapsedSeconds >= Number(channel.alarmDelaySeconds || 0) ? "suspected-trip" : "open";
}

function runMonitoringOfflineCheck(shouldSave = true) {
  if (!state?.monitoringDevices) return;
  ensureMonitoringCollections();
  if (monitoringEngine()?.runOfflineCheck) {
    const result = monitoringEngine().runOfflineCheck(state, { makeId, now: new Date().toISOString() });
    if (result.changed && shouldSave) {
      saveStateQuietly();
      render();
    }
    return;
  }
  let changed = false;
  const now = Date.now();
  state.monitoringDevices.forEach(device => {
    if (!device.lastSeenAt) return;
    const heartbeatMs = Number(device.heartbeatSeconds || MONITORING_DEFAULT_HEARTBEAT_SECONDS) * 1000;
    if (device.onlineStatus !== "offline" && now - new Date(device.lastSeenAt).getTime() > heartbeatMs + 60000) {
      device.onlineStatus = "offline";
      device.updatedAt = new Date().toISOString();
      monitoringChannelsForDevice(device.id).forEach(channel => {
        channel.lastDerivedState = "monitoring-offline";
        channel.updatedAt = device.updatedAt;
      });
      addMonitoringEvent({ deviceId: device.id, panelAssetId: device.panelAssetId, type: "device-offline", state: "monitoring-offline", message: `${device.name} is offline.` });
      changed = true;
    }
  });
  if (changed && shouldSave) {
    saveStateQuietly();
    render();
  }
}

function addMonitoringEvent(event) {
  ensureMonitoringCollections();
  state.monitoringEvents.unshift({
    id: event.id || makeId(),
    deviceId: event.deviceId || "",
    channelId: event.channelId || "",
    panelAssetId: event.panelAssetId || "",
    circuitNumber: event.circuitNumber || "",
    breakerGroupId: event.breakerGroupId || event.breaker_group_id || "",
    type: event.type || "event",
    state: event.state || "",
    message: event.message || "",
    data: event.data || {},
    createdAt: event.createdAt || new Date().toISOString()
  });
  state.monitoringEvents = state.monitoringEvents.slice(0, 1000);
}

function ensureMonitoringAlert(device, channel) {
  ensureMonitoringCollections();
  const existing = state.monitoringAlerts.find(alert => alert.channelId === channel.id && alert.status !== "resolved");
  if (existing) return existing;
  const alert = {
    id: makeId(),
    deviceId: device.id,
    channelId: channel.id,
    panelAssetId: channel.panelAssetId,
    circuitNumber: channel.circuitNumber,
    breakerGroupId: channel.breakerGroupId || "",
    status: "active",
    severity: channel.criticality || "normal",
    title: `Suspected trip on circuit ${channel.circuitNumber}`,
    message: `${device.name} reports no breaker output while phase ${channel.sourcePhase} is healthy.`,
    createdAt: new Date().toISOString(),
    acknowledgedAt: "",
    resolvedAt: "",
    durationSeconds: null,
    workOrderId: ""
  };
  state.monitoringAlerts.unshift(alert);
  addMonitoringEvent({ deviceId: device.id, channelId: channel.id, panelAssetId: channel.panelAssetId, circuitNumber: channel.circuitNumber, breakerGroupId: channel.breakerGroupId || "", type: "alert-created", state: "suspected-trip", message: alert.title });
  addActivity("Breaker alert created", alert.title);
  return alert;
}

function resolveMonitoringAlertsForChannel(channelId, message) {
  state.monitoringAlerts
    .filter(alert => alert.channelId === channelId && alert.status !== "resolved")
    .forEach(alert => {
      alert.status = "resolved";
      alert.resolvedAt = new Date().toISOString();
      const started = new Date(alert.createdAt || alert.resolvedAt).getTime();
      const ended = new Date(alert.resolvedAt).getTime();
      alert.durationSeconds = Number.isFinite(started) && Number.isFinite(ended) ? Math.max(0, Math.round((ended - started) / 1000)) : null;
      addMonitoringEvent({ deviceId: alert.deviceId, channelId, panelAssetId: alert.panelAssetId, circuitNumber: alert.circuitNumber, breakerGroupId: alert.breakerGroupId || "", type: "alert-resolved", message, data: { durationSeconds: alert.durationSeconds } });
    });
}

function updateMonitoringAlertStatus(alertId, status) {
  const alert = state.monitoringAlerts.find(item => item.id === alertId);
  if (!alert) return;
  const now = new Date().toISOString();
  if (status === "acknowledged") {
    alert.status = "acknowledged";
    alert.acknowledgedAt = now;
  } else if (status === "resolved") {
    alert.status = "resolved";
    alert.resolvedAt = now;
    const started = new Date(alert.createdAt || now).getTime();
    const ended = new Date(now).getTime();
    alert.durationSeconds = Number.isFinite(started) && Number.isFinite(ended) ? Math.max(0, Math.round((ended - started) / 1000)) : null;
  }
  addMonitoringEvent({ deviceId: alert.deviceId, channelId: alert.channelId, panelAssetId: alert.panelAssetId, circuitNumber: alert.circuitNumber, breakerGroupId: alert.breakerGroupId || "", type: `alert-${status}`, message: `${alert.title} ${status}.`, data: status === "resolved" ? { durationSeconds: alert.durationSeconds } : {} });
  addActivity("Breaker alert updated", `${alert.title} ${status}`);
  saveState();
  render();
}

function createMonitoringWorkOrder(alertId) {
  const alert = state.monitoringAlerts.find(item => item.id === alertId);
  const panel = alert ? getAsset(alert.panelAssetId) : null;
  if (!alert || !panel) return;
  const workOrder = {
    id: makeId(),
    issueNumber: nextIssueNumber(),
    title: alert.title,
    status: "Open",
    priority: alert.severity === "critical" ? "High" : "Medium",
    customerId: panel.customerId,
    customerName: getCustomer(panel.customerId)?.name || "",
    locationId: panel.locationId,
    locationName: getLocation(panel.locationId)?.name || "",
    assetId: panel.id,
    assetName: panel.name,
    areaName: "",
    source: "breaker-monitoring",
    notes: alert.message,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dueAt: "",
    history: []
  };
  state.workOrders.unshift(workOrder);
  addWorkOrderHistory(workOrder, "Created", `${formatIssueNumber(workOrder)} - ${workOrder.title}`);
  alert.workOrderId = workOrder.id;
  alert.status = alert.status === "active" ? "acknowledged" : alert.status;
  alert.acknowledgedAt = alert.acknowledgedAt || new Date().toISOString();
  addMonitoringEvent({ deviceId: alert.deviceId, channelId: alert.channelId, panelAssetId: alert.panelAssetId, circuitNumber: alert.circuitNumber, type: "work-order-created", message: `${formatIssueNumber(workOrder)} created from breaker alert.` });
  addActivity("Breaker work order created", `${formatIssueNumber(workOrder)} - ${workOrder.title}`);
  saveState();
  render();
}

function loadMonitoringDeviceForm(deviceId) {
  const device = normalizeMonitoringDevice(getMonitoringDevice(deviceId));
  const elements = monitoringElements();
  if (!device || !elements.deviceForm) return;
  elements.deviceId.value = device.id;
  elements.devicePanel.value = device.panelAssetId || "";
  elements.deviceUid.value = device.deviceUid || "";
  elements.deviceName.value = device.name || "";
  elements.deviceModel.value = device.model || "";
  elements.deviceFirmware.value = device.firmwareVersion || "";
  elements.deviceHeartbeat.value = device.heartbeatSeconds || MONITORING_DEFAULT_HEARTBEAT_SECONDS;
  elements.deviceMaintenance.checked = Boolean(device.maintenanceMode);
  elements.deviceApiKey.value = "";
  if (elements.sourcePhaseAChannel) elements.sourcePhaseAChannel.value = device.sourcePhaseChannels?.A || "";
  if (elements.sourcePhaseBChannel) elements.sourcePhaseBChannel.value = device.sourcePhaseChannels?.B || "";
  if (elements.sourcePhaseCChannel) elements.sourcePhaseCChannel.value = device.sourcePhaseChannels?.C || "";
  if (elements.generatedApiKey) elements.generatedApiKey.textContent = "";
  elements.deviceStatus.textContent = "Editing device. Enter a new API key only if you want to rotate it.";
  elements.deviceForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteMonitoringDevice(deviceId) {
  if (!canManageMonitoringSetup()) return;
  const device = getMonitoringDevice(deviceId);
  if (!device || !window.confirm(`Delete monitoring device "${device.name}" and its channel mappings?`)) return;
  state.monitoringDevices = state.monitoringDevices.filter(item => item.id !== deviceId);
  state.monitoringChannels = state.monitoringChannels.filter(item => item.deviceId !== deviceId);
  state.monitoringAlerts = state.monitoringAlerts.filter(item => item.deviceId !== deviceId);
  addActivity("Monitoring device deleted", device.name);
  saveState();
  render();
}

function deleteMonitoringChannel(channelId) {
  if (!canManageMonitoringSetup()) return;
  const channel = getMonitoringChannel(channelId);
  if (!channel) return;
  state.monitoringChannels = state.monitoringChannels.filter(item => item.id !== channelId);
  addMonitoringEvent({ deviceId: channel.deviceId, channelId, panelAssetId: channel.panelAssetId, circuitNumber: channel.circuitNumber, type: "channel-removed", message: `Circuit ${channel.circuitNumber} monitoring was removed.` });
  addActivity("Monitoring channel removed", `Circuit ${channel.circuitNumber}`);
  saveState();
  render();
}

function loadMonitoringChannelForm(channelId) {
  ensureMonitoringCollections();
  const elements = monitoringElements();
  if (!canManageMonitoringSetup()) {
    if (elements.channelStatus) elements.channelStatus.textContent = "Admin access is required to edit breaker channels.";
    return;
  }
  const channel = getMonitoringChannel(channelId);
  if (!channel) return;
  const groupId = channel.breakerGroupId || channel.id || "";
  const groupChannels = state.monitoringChannels
    .filter((item) => (item.breakerGroupId || item.id || "") === groupId)
    .sort((a, b) => Number(a.poleIndex || 1) - Number(b.poleIndex || 1));
  const members = groupChannels.length ? groupChannels : [channel];
  const device = normalizeMonitoringDevice(getMonitoringDevice(channel.deviceId));
  editingMonitoringChannelId = channel.id;
  if (elements.channelDevice && device?.id) elements.channelDevice.value = device.id;
  renderMonitoringCircuitOptions(device?.id || channel.deviceId);
  const circuitNumber = channel.circuitNumber || members[0]?.circuitNumber || "";
  if (elements.channelCircuit) {
    const hasOption = [...elements.channelCircuit.options].some((option) => option.value === circuitNumber);
    elements.channelCircuit.value = hasOption ? circuitNumber : "";
    if (elements.channelCircuitManual && !hasOption) elements.channelCircuitManual.value = circuitNumber;
  }
  if (elements.channelNumber) elements.channelNumber.value = members.map((member) => member.physicalChannel).filter(Boolean).join(",");
  const poleCount = Math.max(1, Math.min(3, Number(channel.breakerPoleCount || members.length || channel.poleCount || 1)));
  if (elements.channelPoles) elements.channelPoles.value = String(poleCount);
  const phases = members.map((member) => monitoringChannelPhaseLabel(member).split("/")[0]).filter(Boolean);
  if (elements.channelPhase) elements.channelPhase.value = phases[0] || "A";
  if (elements.channelPhase2) elements.channelPhase2.value = phases[1] || "B";
  if (elements.channelPhase3) elements.channelPhase3.value = phases[2] || "C";
  if (elements.channelDelay) elements.channelDelay.value = channel.alarmDelaySeconds ?? MONITORING_DEFAULT_DELAY_SECONDS;
  if (elements.channelMode) elements.channelMode.value = channel.monitoringMode || "normal";
  if (elements.channelCriticality) elements.channelCriticality.value = channel.criticality || "normal";
  syncMonitoringPhaseSelectors();
  const submitButton = elements.channelForm?.querySelector('button[type="submit"]');
  if (submitButton) submitButton.textContent = "Update Channel";
  if (elements.channelStatus) elements.channelStatus.textContent = "Editing channel. Update the fields, then save.";
  elements.channelForm?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderMonitoring() {
  if (!currentUser) return;
  ensureMonitoringCollections();
  const elements = monitoringElements();
  if (!elements.livePanel) return;
  const canSetupMonitoring = canManageMonitoringSetup();
  if (elements.setupDrawer) {
    elements.setupDrawer.classList.toggle("hidden", !canSetupMonitoring);
    if (!canSetupMonitoring) elements.setupDrawer.open = false;
  }
  const panels = allElectricalPanelAssetsForMonitoring();
  const hasCustomerScope = Boolean(selectedCustomerId && selectedCustomerId !== ALL_CUSTOMERS);
  const panelOptions = panels.length ? panels.map(panel => {
    const locationId = panel.locationId || panel.location_id || "";
    return `<option value="${escapeHtml(panel.id)}">${escapeHtml(panel.name)} - ${escapeHtml(getLocation(locationId)?.name || "Unknown location")}</option>`;
  }).join("") : `<option value="">${hasCustomerScope ? "No electrical panels for this customer" : "Choose a customer first"}</option>`;
  if (elements.devicePanel && elements.devicePanel.innerHTML !== panelOptions) elements.devicePanel.innerHTML = panelOptions;
  if (elements.devicePanel) elements.devicePanel.disabled = !hasCustomerScope || !panels.length;
  const devices = visibleMonitoringDevices();
  const selectablePanels = monitoringSelectablePanels(devices);
  if (!selectedMonitoringPanelId || !selectablePanels.some(panel => String(panel.id || "") === String(selectedMonitoringPanelId))) {
    selectedMonitoringPanelId = selectablePanels[0]?.id || "";
  }
  renderMonitoringPanelSelect(selectablePanels);
  const selectedDevices = selectedMonitoringPanelId
    ? devices.filter(device => String(device.panelAssetId || "") === String(selectedMonitoringPanelId))
    : devices;
  const deviceOptions = devices.map(device => {
    const panel = getAsset(device.panelAssetId);
    return `<option value="${escapeHtml(device.id)}">${escapeHtml(device.name)} - ${escapeHtml(panel?.name || "Panel")}</option>`;
  }).join("");
  const selectedChannelDevice = elements.channelDevice?.value || "";
  const selectedSimulatorDevice = elements.simulatorDevice?.value || "";
  if (elements.channelDevice) {
    elements.channelDevice.innerHTML = deviceOptions || `<option value="">Add a device first</option>`;
    const channelDeviceStillVisible = devices.some(device => String(device.id || "") === String(selectedChannelDevice));
    elements.channelDevice.value = channelDeviceStillVisible ? selectedChannelDevice : (devices[0]?.id || "");
  }
  if (elements.simulatorDevice) {
    elements.simulatorDevice.innerHTML = deviceOptions || `<option value="">Add a device first</option>`;
    const simulatorDeviceStillVisible = devices.some(device => String(device.id || "") === String(selectedSimulatorDevice));
    elements.simulatorDevice.value = simulatorDeviceStillVisible ? selectedSimulatorDevice : (devices[0]?.id || "");
  }
  renderMonitoringCircuitOptions(elements.channelDevice?.value || devices[0]?.id || "");
  if (!editingMonitoringChannelId) applyMonitoringCircuitScheduleDefaults();
  syncMonitoringPhaseSelectors();
  const channelSubmitButton = elements.channelForm?.querySelector('button[type="submit"]');
  if (channelSubmitButton) channelSubmitButton.textContent = editingMonitoringChannelId ? "Update Channel" : "Map Channel";
  renderMonitoringDeviceList(devices);
  renderMonitoringChannelList(devices, elements.channelDevice?.value || devices[0]?.id || "");
  renderMonitoringDeviceDetails(devices, elements.channelDevice?.value || devices[0]?.id || "");
  renderMonitoringSimulatorHistory(devices, elements.simulatorDevice?.value || devices[0]?.id || "");
  renderMonitoringLivePanel(selectedDevices);
  renderMonitoringAlerts(selectedDevices);
  renderMonitoringEvents(selectedDevices);
}

function monitoringSelectablePanels(devices = []) {
  const panelsById = new Map();
  devices.forEach(device => {
    const panel = getAsset(device.panelAssetId);
    if (!panel?.id) return;
    panelsById.set(panel.id, panel);
  });
  return [...panelsById.values()].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

function renderMonitoringPanelSelect(panels = []) {
  const elements = monitoringElements();
  if (!elements.panelSelect) return;
  elements.panelSelect.innerHTML = panels.length
    ? panels.map(panel => {
      const locationName = getLocation(panel.locationId || panel.location_id || "")?.name || "Unknown location";
      return `<option value="${escapeHtml(panel.id)}">${escapeHtml(panel.name || "Panel")} - ${escapeHtml(locationName)}</option>`;
    }).join("")
    : `<option value="">Add a monitoring device first</option>`;
  elements.panelSelect.value = selectedMonitoringPanelId || "";
}

function renderMonitoringCircuitOptions(deviceId) {
  const elements = monitoringElements();
  const device = normalizeMonitoringDevice(getMonitoringDevice(deviceId));
  const panel = device ? getAsset(device.panelAssetId) : null;
  const schedule = isElectricalPanelAsset(panel) ? getElectricalPanelSchedule(panel) : {};
  const circuits = Array.isArray(schedule.circuits) ? schedule.circuits : [];
  if (!elements.channelCircuit) return;
  const selectedCircuit = String(elements.channelCircuit.value || "").trim();
  if (!circuits.length && !elements.channelCircuitManualWrap && elements.channelCircuit.insertAdjacentHTML) {
    const label = document.createElement("label");
    label.id = "monitoringChannelCircuitManualWrap";
    label.textContent = "Circuit number";
    const input = document.createElement("input");
    input.id = "monitoringChannelCircuitManual";
    input.placeholder = "1";
    label.appendChild(input);
    elements.channelCircuit.closest("label")?.after(label);
    elements.channelCircuitManualWrap = label;
    elements.channelCircuitManual = input;
  }
  elements.channelCircuit.innerHTML = circuits.length
    ? circuits.map(circuit => {
        const cct = String(circuit.cct || circuit.circuit || circuit.number || "");
        const label = [cct, panelCircuitLoadText(circuit) || circuit.description || circuit.loadServed || ""].filter(Boolean).join(" - ");
        return `<option value="${escapeHtml(cct)}">${escapeHtml(label || cct)}</option>`;
      }).join("")
    : `<option value="">Manual circuit entry or use physical channel</option>`;
  if (selectedCircuit && [...elements.channelCircuit.options].some((option) => option.value === selectedCircuit)) {
    elements.channelCircuit.value = selectedCircuit;
  }
  elements.channelCircuit.disabled = !circuits.length;
  elements.channelCircuitManualWrap?.classList.toggle("hidden", Boolean(circuits.length));
  if (elements.channelCircuitManual) {
    elements.channelCircuitManual.disabled = Boolean(circuits.length);
    elements.channelCircuitManual.required = !circuits.length;
    if (circuits.length) elements.channelCircuitManual.value = "";
  }
}

function renderMonitoringDeviceList(devices) {
  const elements = monitoringElements();
  elements.deviceList.innerHTML = devices.length ? devices.map(device => {
    const panel = getAsset(device.panelAssetId);
    const status = device.onlineStatus || "offline";
    return `
      <div class="monitoring-record">
        <div>
          <h4>${escapeHtml(device.name)}</h4>
          <p>${escapeHtml(panel?.name || "Panel")} | UID ${escapeHtml(device.deviceUid || "Not set")}</p>
          <p>Last seen: ${device.lastSeenAt ? formatDateTime(device.lastSeenAt) : "Never"} | Firmware ${escapeHtml(device.firmwareVersion || "Unknown")}</p>
        </div>
        <div class="monitoring-record-actions">
          <span class="monitoring-status-pill ${monitoringStatusClass(status)}">${escapeHtml(status)}</span>
          <button type="button" data-monitoring-edit-device="${escapeHtml(device.id)}">Edit</button>
          <button type="button" data-monitoring-delete-device="${escapeHtml(device.id)}">Delete</button>
        </div>
      </div>`;
  }).join("") : `<p class="muted">No monitoring devices for this view yet.</p>`;
}

function renderMonitoringChannelList(devices, selectedDeviceId = "") {
  const elements = monitoringElements();
  const deviceIds = new Set(devices.map(device => String(device.id)));
  const selectedId = String(selectedDeviceId || "");
  const channels = state.monitoringChannels.filter(channel => {
    const channelDeviceId = String(channel.deviceId || channel.device_id || "");
    if (!deviceIds.has(channelDeviceId)) return false;
    return !selectedId || channelDeviceId === selectedId;
  });
  elements.channelList.innerHTML = channels.length ? channels.map(channel => {
    const device = getMonitoringDevice(channel.deviceId);
    return `
      <div class="monitoring-record">
        <div>
          <h4>${escapeHtml(device?.name || "Device")} channel ${escapeHtml(channel.physicalChannel)}</h4>
          <p>Circuit ${escapeHtml(channel.circuitNumber)} | Phase${Number(channel.poleCount || 1) > 1 ? "s" : ""} ${escapeHtml(monitoringChannelPhaseLabel(channel))} | ${escapeHtml(channel.poleCount)} pole</p>
          <p>${escapeHtml(channel.monitoringMode)} | ${escapeHtml(channel.criticality)} | ${escapeHtml(channel.alarmDelaySeconds)}s delay</p>
        </div>
        <div class="monitoring-record-actions">
          <span class="monitoring-status-pill ${monitoringStatusClass(channel.lastDerivedState)}">${escapeHtml(monitoringStateLabel(channel.lastDerivedState))}</span>
          <button type="button" data-monitoring-edit-channel="${escapeHtml(channel.id)}">Edit</button>
          <button type="button" data-monitoring-delete-channel="${escapeHtml(channel.id)}">Remove</button>
        </div>
      </div>`;
  }).join("") : `<p class="muted">No mapped breaker channels for this device yet.</p>`;
}

function renderMonitoringDeviceDetails(devices, selectedDeviceId = "") {
  const elements = monitoringElements();
  if (!elements.deviceDetails) return;
  const device = normalizeMonitoringDevice(devices.find(item => String(item.id || "") === String(selectedDeviceId)) || devices[0]);
  if (!device) {
    elements.deviceDetails.innerHTML = `<p class="muted">Select a device to see details.</p>`;
    return;
  }
  const panel = getAsset(device.panelAssetId);
  const channels = monitoringChannelsForDevice(device.id);
  const recentPayloads = (device.rawPayloads || []).slice(0, 5);
  const recentErrors = (device.recentErrors || []).slice(0, 5);
  const sourceMap = device.sourcePhaseChannels || {};
  elements.deviceDetails.innerHTML = `
    <details class="monitoring-detail-drawer" open>
      <summary>Device Details</summary>
      <div class="monitoring-detail-grid">
        <div><span>Device UID</span><strong>${escapeHtml(device.deviceUid || "Not set")}</strong></div>
        <div><span>State</span><strong>${escapeHtml(device.onlineStatus || "offline")}</strong></div>
        <div><span>Last seen</span><strong>${escapeHtml(device.lastSeenAt ? formatDateTime(device.lastSeenAt) : "Never")}</strong></div>
        <div><span>Firmware</span><strong>${escapeHtml(device.firmwareVersion || "Unknown")}</strong></div>
        <div><span>Heartbeat</span><strong>${escapeHtml(device.heartbeatSeconds || MONITORING_DEFAULT_HEARTBEAT_SECONDS)} seconds</strong></div>
        <div><span>Assigned panel</span><strong>${escapeHtml(panel?.name || "Panel")}</strong></div>
      </div>
      <div class="monitoring-detail-block">
        <span>Source-phase configuration</span>
        <p>A: ${escapeHtml(sourceMap.A || "API field")} | B: ${escapeHtml(sourceMap.B || "API field")} | C: ${escapeHtml(sourceMap.C || "API field")}</p>
      </div>
      <div class="monitoring-detail-block">
        <span>Mapped channels</span>
        ${channels.length ? channels.map(channel => `<p>${escapeHtml(channel.physicalChannel)}: Circuit ${escapeHtml(channel.circuitNumber)} | Phase ${escapeHtml(monitoringChannelPhaseLabel(channel))}${channel.breakerGroupId ? ` | Group ${escapeHtml(channel.breakerGroupId)}` : ""}</p>`).join("") : `<p>No mapped channels.</p>`}
      </div>
      <div class="monitoring-detail-block">
        <span>Recent raw payloads</span>
        ${recentPayloads.length ? recentPayloads.map(item => `<pre>${escapeHtml(JSON.stringify(item.payload || item, null, 2))}</pre>`).join("") : `<p>No raw payloads yet.</p>`}
      </div>
      <div class="monitoring-detail-block">
        <span>Recent errors</span>
        ${recentErrors.length ? recentErrors.map(error => `<p>${escapeHtml(error.message || error)}</p>`).join("") : `<p>No recent errors.</p>`}
      </div>
    </details>
  `;
}

function renderMonitoringSimulatorHistory(devices, selectedDeviceId = "") {
  const elements = monitoringElements();
  if (!elements.simulatorHistory) return;
  const deviceIds = new Set(devices.map(device => String(device.id || "")));
  const deviceId = String(selectedDeviceId || "");
  const matchesDevice = (item) => deviceId ? String(item.deviceId || "") === deviceId : deviceIds.has(String(item.deviceId || ""));
  const events = state.monitoringEvents.filter(matchesDevice).slice(0, 8);
  const alerts = state.monitoringAlerts.filter(matchesDevice).slice(0, 5);
  elements.simulatorHistory.innerHTML = `
    <details class="monitoring-detail-drawer" open>
      <summary>Simulator Event and Alarm History</summary>
      <div class="monitoring-detail-block">
        <span>Recent alarms</span>
        ${alerts.length ? alerts.map(alert => `<p>${escapeHtml(alert.title)} | ${escapeHtml(alert.status)}${alert.durationSeconds !== null && alert.durationSeconds !== undefined ? ` | ${escapeHtml(alert.durationSeconds)}s` : ""}</p>`).join("") : `<p>No recent alarms.</p>`}
      </div>
      <div class="monitoring-detail-block">
        <span>Recent events</span>
        ${events.length ? events.map(event => `<p>${escapeHtml(formatDateTime(event.createdAt))} | ${escapeHtml(event.type)} | ${escapeHtml(event.message)}</p>`).join("") : `<p>No recent events.</p>`}
      </div>
    </details>
  `;
}

function renderMonitoringLivePanel(devices) {
  const elements = monitoringElements();
  elements.breakerDetail?.classList.add("hidden");
  if (elements.breakerDetail) elements.breakerDetail.innerHTML = "";
  const deviceIds = new Set(devices.map(device => String(device.id)));
  const channels = state.monitoringChannels.filter(channel => deviceIds.has(String(channel.deviceId || channel.device_id || "")));
  const panel = selectedMonitoringPanelId
    ? getAsset(selectedMonitoringPanelId)
    : getAsset(devices[0]?.panelAssetId || channels[0]?.panelAssetId);
  if (!panel && !channels.length) {
    elements.livePanel.innerHTML = `<p class="muted">Add a monitoring device to select a panel and see its breaker layout.</p>`;
    return;
  }
  const primaryDevice = devices[0] || getMonitoringDevice(channels[0]?.deviceId);
  const circuitCount = monitoringPanelCircuitCount(panel, channels);
  const channelByCircuit = monitoringChannelByCircuitMap(channels);
  const rowCount = Math.ceil(circuitCount / 2);
  const oddCircuits = Array.from({ length: rowCount }, (_, index) => index * 2 + 1).filter(number => number <= circuitCount);
  const evenCircuits = Array.from({ length: rowCount }, (_, index) => (index + 1) * 2).filter(number => number <= circuitCount);
  const voltage = monitoringMainMeterValue(primaryDevice, ["mainVoltage", "main_voltage", "voltage", "lineVoltage", "line_voltage"]);
  const current = monitoringMainMeterValue(primaryDevice, ["mainCurrent", "main_current", "current", "loadCurrent", "load_current", "amps", "amperage"]);
  const meterHtml = voltage || current ? `
    <div class="monitoring-main-meter">
      ${voltage ? `<span><small>Main voltage</small><strong>${escapeHtml(voltage)}</strong></span>` : ""}
      ${current ? `<span><small>Main current</small><strong>${escapeHtml(current)}</strong></span>` : ""}
    </div>
  ` : "";
  elements.livePanel.innerHTML = `
    ${meterHtml}
    <div class="monitoring-panel-mockup generated-template" style="--monitoring-panel-rows:${escapeAttribute(rowCount)};" aria-label="${escapeAttribute(panel?.name || "Panel")} live monitor layout">
      ${renderMonitoringPanelCabinetLabel(panel, getLocation(panel?.locationId || panel?.location_id || ""))}
      <div class="monitoring-panel-rail-label" aria-hidden="true">
        <span>Odd circuits</span>
        <span>Even circuits</span>
      </div>
      <div class="monitoring-panel-board">
        <div class="monitoring-breaker-column left">
          ${renderMonitoringBreakerColumn(oddCircuits, channelByCircuit, panel, "left")}
        </div>
        ${renderMonitoringPanelCenter(panel, circuitCount)}
        <div class="monitoring-breaker-column right">
          ${renderMonitoringBreakerColumn(evenCircuits, channelByCircuit, panel, "right")}
        </div>
      </div>
    </div>
  `;
}

function renderMonitoringPanelCabinetLabel(panel = null, location = null) {
  const schedule = isElectricalPanelAsset(panel) ? getElectricalPanelSchedule(panel) : {};
  const title = schedule.panelName || panel?.name || "Electrical panel";
  const locationName = location?.name || "";
  const voltage = schedule.voltage || panel?.voltage || "";
  const phase = schedule.phase || panel?.phase || "";
  const mainBreaker = monitoringMainBreakerLabel(panel);
  const circuitCount = monitoringPanelCircuitCount(panel, []);
  return `
    <div class="monitoring-panel-cabinet-label">
      <strong>${escapeHtml(title)}</strong>
      ${locationName ? `<span>${escapeHtml(locationName)}</span>` : ""}
      <small>${escapeHtml([voltage, phase].filter(Boolean).join(" | ") || "Voltage not entered")}</small>
      <small>${escapeHtml(`${mainBreaker} main | ${circuitCount} circuits`)}</small>
    </div>
  `;
}

function monitoringMainBreakerLabel(panel = null) {
  const schedule = isElectricalPanelAsset(panel) ? getElectricalPanelSchedule(panel) : {};
  const value = schedule.mainBreaker || schedule.main_breaker || panel?.mainBreaker || panel?.main_breaker || "";
  return value ? String(value) : "Main";
}

function renderMonitoringPanelTemplateLabels(panel = null) {
  const schedule = isElectricalPanelAsset(panel) ? getElectricalPanelSchedule(panel) : {};
  const location = getLocation(panel?.locationId || panel?.location_id || "");
  const title = schedule.panelName || panel?.name || "Electrical panel";
  const centerTitle = String(schedule.panelName || title).replace(/^Electrical\s+/i, "");
  const locationName = location?.name || "";
  const voltage = schedule.voltage || panel?.voltage || "";
  const phase = schedule.phase || panel?.phase || "";
  const mainBreaker = monitoringMainBreakerLabel(panel);
  const mainBreakerText = mainBreaker && mainBreaker !== "Main" ? mainBreaker : "";
  const circuitCount = monitoringPanelCircuitCount(panel, []);
  return `
    <div class="monitoring-panel-cabinet-label monitoring-panel-template-label">
      <strong>${escapeHtml(title)}</strong>
      ${locationName ? `<span>${escapeHtml(locationName)}</span>` : ""}
      <small>${escapeHtml([voltage, phase].filter(Boolean).join(" | ") || "Voltage not entered")}</small>
      <small>${escapeHtml(`${mainBreakerText || "Main"} main | ${circuitCount} circuits`)}</small>
    </div>
    <div class="monitoring-panel-center-nameplate">${escapeHtml(centerTitle)}</div>
    ${mainBreakerText ? `<div class="monitoring-panel-main-breaker-size">${escapeHtml(mainBreakerText)}</div>` : ""}
  `;
}

function renderMonitoringPanelCenter(panel = null, circuitCount = 42) {
  const schedule = isElectricalPanelAsset(panel) ? getElectricalPanelSchedule(panel) : {};
  const panelTitle = String(schedule.panelName || panel?.name || "Panel").replace(/^Electrical\s+/i, "");
  const voltage = schedule.voltage || panel?.voltage || "Voltage not entered";
  const mainBreaker = monitoringMainBreakerLabel(panel);
  const mainBreakerText = mainBreaker && mainBreaker !== "Main" ? mainBreaker : "Main";
  const fedFrom = schedule.fedFrom || schedule.fed_from || panel?.fedFrom || panel?.fed_from || "";
  return `
    <div class="monitoring-panel-center">
      <span class="monitoring-fed-label">${fedFrom ? `Fed from<br>${escapeHtml(fedFrom)}` : "&nbsp;"}</span>
      <span class="monitoring-main-disconnect-label">Main disconnect</span>
      <span class="monitoring-main-disconnect">
        <strong>${escapeHtml(mainBreakerText)}</strong>
        <i aria-hidden="true"></i>
      </span>
      <span class="monitoring-service-label">
        Suitable for use as service equipment
        <small>${escapeHtml(voltage)}</small>
        <small>${escapeHtml(`${mainBreakerText} main | ${circuitCount} circuits`)}</small>
      </span>
      <span class="monitoring-danger-label"><b>Danger</b><small>Arc flash and shock hazard</small></span>
      <span class="monitoring-panel-nameplate">${escapeHtml(panelTitle)}</span>
      <span class="monitoring-phase-card" aria-label="Phase designation">
        <b>A</b><b>B</b><b>C</b>
      </span>
    </div>
  `;
}

function renderMonitoringTemplateRows(template, channelByCircuit, panel = null) {
  return Array.from({ length: template.circuitCount }, (_, index) => index + 1)
    .map((circuitNumber) => renderMonitoringTemplateCircuit(template, circuitNumber, channelByCircuit.get(circuitNumber), panel))
    .join("");
}

function renderMonitoringTemplateCircuit(template, circuitNumber, channel = null, panel = null) {
  const position = monitoringTemplateCircuitPosition(template, circuitNumber);
  const zones = template.zones[position.side];
  const state = channel?.lastDerivedState || "not-monitored";
  const circuitLabel = monitoringPanelCircuitLabel(panel, circuitNumber).trim();
  const breakerSize = monitoringPanelCircuitBreakerSize(panel, circuitNumber);
  const faceLabel = circuitLabel || "";
  const tooltipLabel = [
    `Circuit ${circuitNumber}`,
    faceLabel || "No panel label saved",
    breakerSize ? `Breaker ${breakerSize}` : "",
    channel ? monitoringStateLabel(channel.lastDerivedState) : "Not monitored"
  ].filter(Boolean).join(" | ");
  const voltage = monitoringCircuitValue(channel, ["voltage", "lineVoltage", "line_voltage"]);
  const temperature = monitoringCircuitValue(channel, ["temperature", "temp", "temperatureF", "temperature_f"]);
  const highTemp = Number(String(temperature).replace(/[^\d.-]/g, "")) >= 120;
  const selectedClass = selectedMonitoringBreakerCircuit === String(circuitNumber) ? " selected" : "";
  const tempClass = highTemp ? " high-temperature" : "";
  const rowStyle = monitoringOverlayStyle(zones.row, position.y, position.height);
  return `
    <button type="button" class="monitoring-panel-overlay-row monitoring-channel-card ${monitoringStatusClass(state)} ${escapeAttribute(position.side)}${selectedClass}${tempClass}" data-monitoring-breaker-detail="${escapeAttribute(channel?.id || "")}" data-monitoring-breaker-circuit="${escapeAttribute(circuitNumber)}" title="${escapeAttribute(tooltipLabel)}" style="${rowStyle}">
      <span class="monitoring-overlay-number" style="${monitoringOverlayInnerStyle(zones.row, zones.number, 100)}">${escapeHtml(circuitNumber)}</span>
      <span class="monitoring-overlay-amps" style="${monitoringOverlayInnerStyle(zones.row, zones.amps, 100)}">${breakerSize ? escapeHtml(breakerSize) : ""}</span>
      <span class="monitoring-overlay-label" style="${monitoringOverlayInnerStyle(zones.row, zones.label, 100)}">${escapeHtml(faceLabel)}</span>
      <span class="monitoring-overlay-breaker" style="${monitoringOverlayInnerStyle(zones.row, zones.breaker, 100)}"><i></i></span>
      <span class="monitoring-overlay-status" aria-label="${escapeAttribute(channel ? monitoringStateLabel(channel.lastDerivedState) : "Not monitored")}" style="${monitoringOverlayInnerStyle(zones.row, zones.status, 100)}"></span>
      <span class="monitoring-overlay-voltage" style="${monitoringOverlayInnerStyle(zones.row, zones.voltage, 100)}">${voltage ? escapeHtml(voltage) : ""}</span>
      <span class="monitoring-overlay-temperature" style="${monitoringOverlayInnerStyle(zones.row, zones.temperature, 100)}">${temperature ? escapeHtml(temperature) : ""}</span>
      <em class="monitoring-breaker-tooltip">${escapeHtml(tooltipLabel)}</em>
    </button>
  `;
}

function renderMonitoringBreakerColumn(circuitNumbers = [], channelByCircuit, panel = null, side = "left") {
  const renderedChannelIds = new Set();
  return circuitNumbers.map((circuitNumber) => {
    if (!isFirstMonitoringPanelGroupCircuit(panel, circuitNumber, side)) return "";
    const channel = channelByCircuit.get(circuitNumber);
    if (channel) {
      const channelKey = channel.id || `${channel.deviceId}-${channel.physicalChannel}-${channel.circuitNumber}`;
      if (renderedChannelIds.has(channelKey)) return "";
      renderedChannelIds.add(channelKey);
    }
    const scheduleSpan = monitoringPanelCircuitGroupSpan(panel, circuitNumber, side);
    const span = Math.max(scheduleSpan, channel ? monitoringBreakerSpanForSide(channel, side) : 1);
    return renderMonitoringBreakerSlot(circuitNumber, channel, panel, side, span);
  }).join("");
}

function monitoringBreakerSpanForSide(channel = {}, side = "left") {
  const wantOdd = side === "left";
  const sideCircuits = parseMonitoringCircuitNumbers(channel.circuitNumber)
    .filter(number => wantOdd ? number % 2 === 1 : number % 2 === 0)
    .sort((a, b) => a - b);
  if (sideCircuits.length >= 2) {
    return Math.max(1, Math.floor((sideCircuits.at(-1) - sideCircuits[0]) / 2) + 1);
  }
  return Math.max(1, Number(channel.poleCount || 1));
}

function renderMonitoringBreakerSlot(circuitNumber, channel = null, panel = null, side = "left", span = 1) {
  const state = channel?.lastDerivedState || "not-monitored";
  const label = channel ? monitoringStateLabel(channel.lastDerivedState) : "Not monitored";
  const phaseText = channel ? `Phase${Number(channel.poleCount || 1) > 1 ? "s" : ""} ${monitoringChannelPhaseLabel(channel)}` : "";
  const circuitLabel = monitoringPanelCircuitLabel(panel, circuitNumber).trim();
  const breakerSize = monitoringPanelCircuitBreakerSize(panel, circuitNumber);
  const groupNumbers = monitoringPanelCircuitGroupNumbers(panel, circuitNumber, side);
  const circuitText = groupNumbers.length > 1 ? groupNumbers.join(",") : String(circuitNumber);
  const displayNumbers = groupNumbers.length > 1 ? groupNumbers : [circuitNumber];
  const hasCircuitLabel = Boolean(circuitLabel);
  const tooltipLabel = [
    `Circuit ${circuitText}`,
    circuitLabel || "No panel label or input saved",
    breakerSize ? `Breaker ${breakerSize}` : ""
  ].filter(Boolean).join(" | ");
  const faceLabel = circuitLabel;
  const spanStyle = span > 1 ? ` style="grid-row: span ${span};"` : "";
  const multiClass = span > 1 ? " multi-pole" : "";
  if (!channel && !hasCircuitLabel) {
    return `
      <button type="button" class="monitoring-breaker-slot monitoring-channel-card blank-filler ${escapeAttribute(side)}" data-monitoring-breaker-detail="" data-monitoring-breaker-circuit="${escapeAttribute(circuitNumber)}" title="${escapeAttribute(tooltipLabel)}"${spanStyle}>
        <span>${escapeHtml(circuitNumber)}</span>
        <i class="monitoring-breaker-blank-fill" aria-hidden="true"></i>
        <em class="monitoring-breaker-tooltip">${escapeHtml(tooltipLabel)}</em>
      </button>
    `;
  }
  const content = `
    <i class="monitoring-breaker-handle" aria-hidden="true"><span></span></i>
    <span class="monitoring-breaker-number">
      ${displayNumbers.map((number) => `
        <b>${escapeHtml(number)}</b>
        ${breakerSize ? `<small>${escapeHtml(breakerSize)}</small>` : "<small></small>"}
      `).join("")}
    </span>
    <strong class="monitoring-channel-state">${escapeHtml(label)}</strong>
    <small class="monitoring-breaker-load-label">${escapeHtml(faceLabel)}</small>
    ${span > 1 ? `<small class="monitoring-breaker-pole-label">${escapeHtml(span === 2 ? "2 pole" : "3 pole")}</small>` : ""}
    ${phaseText ? `<small class="monitoring-breaker-phase-label">${escapeHtml(phaseText)}</small>` : ""}
    <em class="monitoring-breaker-tooltip">${escapeHtml(tooltipLabel)}</em>
  `;
  if (!channel) {
    return `
      <button type="button" class="monitoring-breaker-slot monitoring-channel-card not-monitored ${escapeAttribute(side)}${multiClass}" data-monitoring-breaker-detail="" data-monitoring-breaker-circuit="${escapeAttribute(circuitNumber)}" title="${escapeAttribute(tooltipLabel)}"${spanStyle}>
        ${content}
      </button>
    `;
  }
  return `
    <button type="button" class="monitoring-breaker-slot monitoring-channel-card ${monitoringStatusClass(state)} ${escapeAttribute(side)}${multiClass}" data-monitoring-breaker-detail="${escapeAttribute(channel.id)}" data-monitoring-breaker-circuit="${escapeAttribute(circuitNumber)}" title="${escapeAttribute(tooltipLabel)}"${spanStyle}>
      ${content}
    </button>
  `;
}

function renderMonitoringAlerts(devices) {
  const elements = monitoringElements();
  const deviceIds = new Set(devices.map(device => String(device.id)));
  const alerts = state.monitoringAlerts.filter(alert => deviceIds.has(String(alert.deviceId || alert.device_id || "")) && alert.status !== "resolved");
  elements.alertList.innerHTML = alerts.length ? alerts.map(alert => `
    <div class="monitoring-record alert">
      <div>
        <h4>${escapeHtml(alert.title)}</h4>
        <p>${escapeHtml(alert.message)}</p>
        <p>${formatDateTime(alert.createdAt)} | ${escapeHtml(alert.status)} | ${escapeHtml(alert.severity)}</p>
      </div>
      <div class="monitoring-record-actions">
        ${alert.status === "active" ? `<button type="button" data-monitoring-ack="${escapeHtml(alert.id)}">Acknowledge</button>` : ""}
        <button type="button" data-monitoring-resolve="${escapeHtml(alert.id)}">Resolve</button>
        ${alert.workOrderId ? `<span class="monitoring-status-pill acknowledged">Ticket created</span>` : `<button type="button" data-monitoring-work-order="${escapeHtml(alert.id)}">Create ticket</button>`}
      </div>
    </div>`).join("") : `<p class="muted">No active breaker alerts.</p>`;
}

function renderMonitoringEvents(devices) {
  const elements = monitoringElements();
  const deviceIds = new Set(devices.map(device => String(device.id)));
  const events = state.monitoringEvents.filter(event => !event.deviceId || deviceIds.has(String(event.deviceId || event.device_id || ""))).slice(0, 50);
  elements.eventList.innerHTML = events.length ? events.map(event => `
    <div class="monitoring-record compact">
      <div>
        <h4>${escapeHtml(event.message || event.type)}</h4>
        <p>${formatDateTime(event.createdAt)} | ${escapeHtml(event.type)}${event.circuitNumber ? ` | Circuit ${escapeHtml(event.circuitNumber)}` : ""}</p>
      </div>
    </div>`).join("") : `<p class="muted">No monitoring events yet.</p>`;
}
