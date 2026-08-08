// SiteWorks Site Map feature module.
// Loaded before app.js as a classic script so existing app state/render helpers stay shared.
// Keep map levels, pins, layers, overlays, zoom, pan, and mobile touch behavior here.

function currentSiteMapScope() {
  const customerId = selectedCustomerId && selectedCustomerId !== "all"
    ? selectedCustomerId
    : visibleCustomers()[0]?.id || state.customers[0]?.id || "";
  const locationId = selectedLocationId && selectedLocationId !== "all" ? selectedLocationId : "";
  return { customerId, locationId };
}

function isSiteMapLocationSelected() {
  return Boolean(selectedLocationId && selectedLocationId !== "all");
}

function siteMapScopeLabel(map = null) {
  const scope = map || currentSiteMapScope();
  const customer = getCustomer(scope.customerId)?.name || "Current customer";
  const location = scope.locationId ? getLocation(scope.locationId)?.name || "Selected location" : "Choose a location";
  return `${customer} | ${location}`;
}

function normalizeSiteMapLevelId(value = "") {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "main";
  return text
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "main";
}

function normalizeSiteMapPins(pins = []) {
  return Array.isArray(pins)
    ? pins.map((pin) => ({
      ...pin,
      id: pin.id || crypto.randomUUID(),
      assetId: pin.assetId || "",
      label: pin.label || "",
      area: getSiteMapPinArea(pin),
      layer: normalizeSiteMapLayer(pin.layer || pin.system || pin.category),
      x: clampPercent(pin.x),
      y: clampPercent(pin.y),
      createdAt: pin.createdAt || new Date().toISOString()
    })).filter((pin) => pin.assetId || pin.label)
    : [];
}

function normalizeSiteMapLevel(level = {}, fallback = {}) {
  const id = normalizeSiteMapLevelId(level.id || fallback.id || level.name || fallback.name);
  return {
    id,
    name: String(level.name || fallback.name || "Map area").trim(),
    type: String(level.type || fallback.type || id || "area").trim(),
    image: level.image || null,
    pins: normalizeSiteMapPins(level.pins),
    createdAt: level.createdAt || new Date().toISOString(),
    updatedAt: level.updatedAt || level.createdAt || new Date().toISOString()
  };
}

function ensureSiteMapLevels(map = null, create = false) {
  if (!map) return [];
  const existing = Array.isArray(map.levels) ? map.levels : Array.isArray(map.areas) ? map.areas : [];
  if (!existing.length && create) {
    map.levels = SITE_MAP_DEFAULT_LEVELS.map((level) => normalizeSiteMapLevel({
      ...level,
      image: level.id === "main" ? map.image || null : null,
      pins: level.id === "main" ? map.pins || [] : []
    }, level));
  } else if (existing.length) {
    map.levels = existing.map((level) => normalizeSiteMapLevel(level));
  }
  if (create) {
    const levelIds = new Set((map.levels || []).map((level) => level.id));
    SITE_MAP_DEFAULT_LEVELS.forEach((level) => {
      if (!levelIds.has(level.id)) map.levels.push(normalizeSiteMapLevel(level, level));
    });
  }
  const main = (map.levels || []).find((level) => level.id === "main");
  if (main) {
    map.image = main.image || null;
    map.pins = main.pins || [];
  }
  return map.levels || [];
}

function getActiveSiteMapLevel(map = null, create = false) {
  const levels = ensureSiteMapLevels(map, create);
  if (!levels.length) return null;
  if (!levels.some((level) => level.id === siteMapLevelId)) siteMapLevelId = "main";
  return levels.find((level) => level.id === siteMapLevelId) || levels[0] || null;
}

function getAllSiteMapPins(map = null) {
  const levels = ensureSiteMapLevels(map, false);
  return levels.length ? levels.flatMap((level) => level.pins || []) : Array.isArray(map?.pins) ? map.pins : [];
}

function renderSiteMapLevelTabs(map = null) {
  const levels = ensureSiteMapLevels(map, true);
  if (!levels.length) return "";
  return `
    ${levels.map((level) => {
      const pinCount = Array.isArray(level.pins) ? level.pins.length : 0;
      const hasImage = Boolean(mediaSource(level.image));
      return `
        <button type="button" class="site-map-level-tab${level.id === siteMapLevelId ? " is-active" : ""}" data-site-map-level="${escapeAttribute(level.id)}">
          <span>${escapeHtml(level.name)}</span>
          <small>${hasImage ? "Map" : "No map"}${pinCount ? ` | ${pinCount}` : ""}</small>
        </button>
      `;
    }).join("")}
    <button type="button" class="site-map-level-tab site-map-level-add" data-site-map-level-add>+ Area</button>
  `;
}

function normalizeSiteMapLayer(value = "") {
  const text = String(value || "").trim().toLowerCase();
  if (!text || text === "auto" || text === "all") return "";
  if (["life", "life safety", "life_safety", "fire", "fire safety"].includes(text)) return "life-safety";
  if (["fitness equipment", "equipment", "gym"].includes(text)) return "fitness";
  if (["future tenant", "tenant", "construction", "future construction"].includes(text)) return "construction";
  if (["electrical", "hvac", "plumbing", "fitness"].includes(text)) return text;
  return "";
}

function siteMapLayerLabel(layer = "") {
  const labels = {
    electrical: "Electrical",
    hvac: "HVAC",
    "life-safety": "Life safety",
    plumbing: "Plumbing",
    fitness: "Fitness equipment",
    construction: "Future tenant / construction"
  };
  return labels[normalizeSiteMapLayer(layer)] || "General";
}

function siteMapLayerMarker(layer = "") {
  const markers = {
    electrical: "E",
    hvac: "H",
    "life-safety": "LS",
    plumbing: "P",
    fitness: "F",
    construction: "C"
  };
  return markers[normalizeSiteMapLayer(layer)] || "G";
}

function inferSiteMapLayer(asset = null) {
  const text = [asset?.type, asset?.category, asset?.template, asset?.name, asset?.equipmentId]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/\b(panel|breaker|electrical|meter|transformer|switchgear|lighting)\b/.test(text)) return "electrical";
  if (/\b(hvac|rtu|ahu|fan|furnace|boiler|chiller|heat pump|condenser)\b/.test(text)) return "hvac";
  if (/\b(fire|alarm|sprinkler|exit|emergency|life safety|extinguisher)\b/.test(text)) return "life-safety";
  if (/\b(plumb|pump|water|drain|toilet|sink|valve|backflow)\b/.test(text)) return "plumbing";
  if (/\b(treadmill|elliptical|bike|rower|strength|fitness|cardio|gym)\b/.test(text)) return "fitness";
  return "";
}

function getSiteMapPinArea(pin = {}) {
  return String(pin.area || pin.zone || pin.locationArea || "").trim();
}

function getSiteMapPinLayer(pin = {}, asset = null) {
  return normalizeSiteMapLayer(pin.layer || pin.system || pin.category) || inferSiteMapLayer(asset);
}

function siteMapPinMatchesFilters(pin = {}, asset = null) {
  const layer = getSiteMapPinLayer(pin, asset) || "";
  const area = getSiteMapPinArea(pin).toLowerCase();
  const layerMatches = siteMapLayerFilter === "all" || layer === siteMapLayerFilter;
  const areaMatches = siteMapAreaFilter === "all" || area === siteMapAreaFilter;
  return layerMatches && areaMatches;
}

function normalizeSiteMapOverlayMode(value = "") {
  const text = String(value || "").trim().toLowerCase();
  return ["live-status", "open-tickets", "pm-due", "electrical-issues", "breaker-feed", "pm-route"].includes(text) ? text : "normal";
}

function siteMapOverlayLabel(mode = siteMapOverlayMode) {
  const labels = {
    normal: "Normal",
    "live-status": "Live status",
    "open-tickets": "Open tickets",
    "pm-due": "PM due",
    "electrical-issues": "Electrical issues",
    "breaker-feed": "Breaker feed",
    "pm-route": "PM route"
  };
  return labels[normalizeSiteMapOverlayMode(mode)] || labels.normal;
}

function siteMapPinKey(pin = {}, index = 0) {
  return pin.id || pin.assetId || `pin-${index}`;
}

function getSiteMapAssetOpenTickets(asset = null) {
  return asset?.id ? openWorkOrdersForAsset(asset.id) : [];
}

function isSiteMapPmDue(asset = null) {
  if (!asset) return false;
  const due = getDueInfo(asset);
  return Number(due.daysUntil) <= 7;
}

function isSiteMapElectricalIssue(asset = null, pin = {}) {
  const layer = getSiteMapPinLayer(pin, asset);
  const tickets = getSiteMapAssetOpenTickets(asset);
  const text = [
    layer,
    asset?.name,
    asset?.type,
    asset?.category,
    asset?.template,
    asset?.equipmentId,
    ...tickets.flatMap((ticket) => [ticket.title, ticket.summary, ticket.description, ticket.issue, ticket.priority, ticket.category, ticket.source])
  ].filter(Boolean).join(" ").toLowerCase();
  return /\b(electrical|breaker|panel|power|voltage|phase|outlet|lighting|trip|tripped|meter|transformer)\b/.test(text);
}

function getSiteMapBreakerText(asset = null) {
  if (!asset) return "";
  const directValues = [
    asset.breaker,
    asset.breakerNumber,
    asset.breakerCircuit,
    asset.circuit,
    asset.circuitNumber,
    asset.panelCircuit,
    asset.electricalPanel,
    asset.electricalPanelName,
    asset.panel,
    asset.panelName,
    asset.powerSource,
    asset.servedBy
  ];
  const nestedSources = [asset.details, asset.customFields, asset.electrical, asset.power].filter(Boolean);
  nestedSources.forEach((source) => {
    directValues.push(
      source.breaker,
      source.breakerNumber,
      source.breakerCircuit,
      source.circuit,
      source.circuitNumber,
      source.panelCircuit,
      source.electricalPanel,
      source.electricalPanelName,
      source.panel,
      source.panelName,
      source.powerSource,
      source.servedBy
    );
  });
  return directValues
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" | ");
}

function getSiteMapBreakerCircuitNumbers(asset = null) {
  return parseMonitoringCircuitNumbers(getSiteMapBreakerText(asset));
}

function getSiteMapAssetMonitoringChannels(asset = null) {
  if (!asset) return [];
  const assetId = String(asset.id || "");
  if (assetId && isElectricalPanelAsset(asset)) {
    const panelDeviceIds = new Set(
      (state.monitoringDevices || [])
        .map(normalizeMonitoringDevice)
        .filter((device) => String(device?.panelAssetId || "") === assetId)
        .map((device) => String(device.id || device.deviceUid || ""))
        .filter(Boolean)
    );
    const panelChannels = (state.monitoringChannels || []).filter((channel) => {
      const channelPanelId = String(channel.panelAssetId || channel.panel_asset_id || "");
      const channelDeviceId = String(channel.deviceId || channel.device_id || "");
      return channelPanelId === assetId || panelDeviceIds.has(channelDeviceId);
    });
    if (panelChannels.length) return panelChannels;
  }
  const breakerCircuits = getSiteMapBreakerCircuitNumbers(asset);
  if (!breakerCircuits.length) return [];
  const panelText = getSiteMapBreakerText(asset).toLowerCase();
  return (state.monitoringChannels || []).filter((channel) => {
    const channelCircuits = parseMonitoringCircuitNumbers(channel.circuitNumber);
    if (!channelCircuits.some((number) => breakerCircuits.includes(number))) return false;
    const device = getMonitoringDevice(channel.deviceId);
    const panel = getRawAsset(channel.panelAssetId || device?.panelAssetId);
    if (!panelText || !panel) return true;
    return panelText.includes(String(panel.name || "").toLowerCase()) || panelText.includes(String(getAssetEquipmentId(panel) || "").toLowerCase());
  });
}

function getSiteMapAssetSensorValue(asset = null, keys = []) {
  if (!asset) return "";
  const sources = [asset, asset.details, asset.customFields, asset.environment, asset.sensors, asset.telemetry, asset.data].filter(Boolean);
  for (const source of sources) {
    for (const key of keys) {
      const value = source?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
  }
  return "";
}

function getSiteMapAssetEnvironmentalReadings(asset = null) {
  const temperature = getSiteMapAssetSensorValue(asset, ["temperature", "temp", "ambientTemp", "ambientTemperature", "temperatureF", "temperatureC"]);
  const humidity = getSiteMapAssetSensorValue(asset, ["humidity", "relativeHumidity", "rh"]);
  const co2 = getSiteMapAssetSensorValue(asset, ["co2", "co2ppm", "co2Ppm", "carbonDioxide"]);
  return [
    temperature !== "" ? `Temp ${temperature}` : "",
    humidity !== "" ? `Humidity ${humidity}` : "",
    co2 !== "" ? `CO2 ${co2}` : ""
  ].filter(Boolean);
}

function getSiteMapAssetLiveStatus(asset = null) {
  const channels = getSiteMapAssetMonitoringChannels(asset);
  const readings = getSiteMapAssetEnvironmentalReadings(asset);
  if (!asset) return { key: "unknown", label: "Equipment missing", detail: "", readings, channels };
  if (!channels.length) {
    const directStatus = getSiteMapAssetSensorValue(asset, ["liveStatus", "runtimeStatus", "operatingStatus", "faultStatus", "status"]);
    const label = directStatus ? String(directStatus) : readings.length ? "Sensor readings" : "No live data";
    return { key: directStatus ? "warn" : readings.length ? "sensor" : "unknown", label, detail: readings.join(" | "), readings, channels };
  }
  const states = channels.map((channel) => channel.lastDerivedState || "open");
  if (states.includes("monitoring-offline")) return { key: "offline", label: "Monitoring offline", detail: readings.join(" | "), readings, channels };
  if (states.includes("suspected-trip")) return { key: "danger", label: "Suspected trip", detail: readings.join(" | "), readings, channels };
  if (states.includes("upstream-power-loss")) return { key: "danger", label: "Upstream phase loss", detail: readings.join(" | "), readings, channels };
  if (states.includes("open")) return { key: "warn", label: "Open", detail: readings.join(" | "), readings, channels };
  if (states.includes("energized")) return { key: "ok", label: "Energized", detail: readings.join(" | "), readings, channels };
  return { key: "sensor", label: monitoringStateLabel(states[0] || "open"), detail: readings.join(" | "), readings, channels };
}

function getSiteMapRoutePins(pins = []) {
  const candidates = pins.filter((pin) => {
    const asset = getRawAsset(pin.assetId);
    return asset && isSiteMapPmDue(asset);
  });
  const routePins = candidates.length ? candidates : pins.filter((pin) => getRawAsset(pin.assetId));
  const remaining = [...routePins].sort((a, b) => (Number(a.y) + Number(a.x)) - (Number(b.y) + Number(b.x)));
  const ordered = [];
  let current = remaining.shift();
  while (current) {
    ordered.push(current);
    let nextIndex = -1;
    let bestDistance = Infinity;
    remaining.forEach((pin, index) => {
      const distance = Math.hypot(Number(pin.x) - Number(current.x), Number(pin.y) - Number(current.y));
      if (distance < bestDistance) {
        bestDistance = distance;
        nextIndex = index;
      }
    });
    current = nextIndex >= 0 ? remaining.splice(nextIndex, 1)[0] : null;
  }
  return ordered;
}

function renderSiteMapRouteOverlay(routePins = []) {
  if (siteMapOverlayMode !== "pm-route" || routePins.length < 2) return "";
  const points = routePins.map((pin) => `${clampPercent(pin.x)},${clampPercent(pin.y)}`).join(" ");
  return `
    <svg class="site-map-route-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${escapeAttribute(points)}"></polyline>
    </svg>
  `;
}

function getSiteMapPinOverlayInfo(pin = {}, index = 0, asset = null, routeIndexByPinKey = new Map()) {
  const mode = normalizeSiteMapOverlayMode(siteMapOverlayMode);
  const openTickets = getSiteMapAssetOpenTickets(asset);
  const due = asset ? getDueInfo(asset) : null;
  const routeStop = routeIndexByPinKey.get(siteMapPinKey(pin, index));
  const breakerText = getSiteMapBreakerText(asset);
  const liveStatus = getSiteMapAssetLiveStatus(asset);
  const selectedBreakerText = getSiteMapBreakerText(getRawAsset(selectedSiteMapOverlayAssetId));
  const info = {
    className: "",
    marker: siteMapLayerMarker(getSiteMapPinLayer(pin, asset)),
    summary: "",
    detail: ""
  };
  if (mode === "live-status") {
    info.marker = liveStatus.key === "ok" ? "âœ“" : liveStatus.key === "danger" ? "!" : liveStatus.key === "offline" ? "O" : liveStatus.key === "sensor" ? "S" : String(index + 1);
    info.marker = liveStatus.key === "ok" ? "OK" : liveStatus.key === "danger" ? "!" : liveStatus.key === "offline" ? "O" : liveStatus.key === "sensor" ? "S" : siteMapLayerMarker(getSiteMapPinLayer(pin, asset));
    info.summary = liveStatus.label;
    info.detail = liveStatus.detail || (liveStatus.channels.length ? `${liveStatus.channels.length} monitored channel${liveStatus.channels.length === 1 ? "" : "s"}` : "");
    info.className = liveStatus.key === "ok"
      ? " site-map-pin-overlay-ok"
      : liveStatus.key === "danger"
        ? " site-map-pin-overlay-danger site-map-pin-live-alert"
        : liveStatus.key === "offline"
          ? " site-map-pin-overlay-offline"
          : liveStatus.key === "sensor"
            ? " site-map-pin-overlay-sensor"
            : " site-map-pin-dimmed";
  } else if (mode === "open-tickets") {
    info.marker = openTickets.length ? String(openTickets.length) : siteMapLayerMarker(getSiteMapPinLayer(pin, asset));
    info.summary = openTickets.length ? `${openTickets.length} open ticket${openTickets.length === 1 ? "" : "s"}` : "No open tickets";
    info.className = openTickets.length > 1 ? " site-map-pin-overlay-danger" : openTickets.length ? " site-map-pin-overlay-warn" : " site-map-pin-dimmed";
  } else if (mode === "pm-due") {
    const dueSoon = due && Number(due.daysUntil) <= 7;
    info.marker = due && Number(due.daysUntil) <= 0 ? "!" : siteMapLayerMarker(getSiteMapPinLayer(pin, asset));
    info.summary = due?.label || "No PM status";
    info.className = dueSoon ? (Number(due.daysUntil) <= 0 ? " site-map-pin-overlay-danger" : " site-map-pin-overlay-warn") : " site-map-pin-dimmed";
  } else if (mode === "electrical-issues") {
    const electrical = isSiteMapElectricalIssue(asset, pin);
    info.marker = electrical && openTickets.length ? String(openTickets.length) : "E";
    info.summary = electrical ? (openTickets.length ? "Electrical ticket or issue" : "Electrical area") : "No electrical issue";
    info.className = electrical ? (openTickets.length ? " site-map-pin-overlay-danger" : " site-map-pin-overlay-warn") : " site-map-pin-dimmed";
  } else if (mode === "breaker-feed") {
    const isSelected = selectedSiteMapOverlayAssetId && asset?.id === selectedSiteMapOverlayAssetId;
    const isRelated = selectedBreakerText && breakerText && breakerText === selectedBreakerText && !isSelected;
    info.marker = "B";
    info.summary = breakerText || "No breaker feed saved";
    info.detail = selectedBreakerText ? `Selected feed: ${selectedBreakerText}` : "Tap equipment to focus its breaker feed.";
    info.className = breakerText ? " site-map-pin-overlay-feed" : " site-map-pin-dimmed";
    if (isSelected) info.className += " site-map-pin-breaker-selected";
    if (isRelated) info.className += " site-map-pin-breaker-related";
    if (selectedBreakerText && !isSelected && !isRelated) info.className += " site-map-pin-dimmed";
  } else if (mode === "pm-route") {
    info.marker = routeStop ? String(routeStop) : siteMapLayerMarker(getSiteMapPinLayer(pin, asset));
    info.summary = routeStop ? `Route stop ${routeStop}` : "Not on route";
    info.className = routeStop ? " site-map-pin-route" : " site-map-pin-dimmed";
  }
  if (mode !== "live-status" && liveStatus.key === "danger") {
    info.marker = "!";
    info.summary = liveStatus.label || info.summary;
    info.detail = liveStatus.detail || (liveStatus.channels.length ? `${liveStatus.channels.length} monitored channel${liveStatus.channels.length === 1 ? "" : "s"}` : info.detail);
    info.className = " site-map-pin-overlay-danger site-map-pin-live-alert";
  }
  return info;
}

function renderSiteMapOverlaySummary(visiblePins = [], routePins = []) {
  const mode = normalizeSiteMapOverlayMode(siteMapOverlayMode);
  if (mode === "normal") return "";
  const summary = {
    "live-status": `${visiblePins.filter((pin) => getSiteMapAssetLiveStatus(getRawAsset(pin.assetId)).key !== "unknown").length} pins have live or sensor data.`,
    "open-tickets": `${visiblePins.reduce((sum, pin) => sum + getSiteMapAssetOpenTickets(getRawAsset(pin.assetId)).length, 0)} open ticket markers in this view.`,
    "pm-due": `${visiblePins.filter((pin) => isSiteMapPmDue(getRawAsset(pin.assetId))).length} PM stops due soon or overdue.`,
    "electrical-issues": `${visiblePins.filter((pin) => isSiteMapElectricalIssue(getRawAsset(pin.assetId), pin)).length} electrical-related markers.`,
    "breaker-feed": selectedSiteMapOverlayAssetId ? "Tap another pin to compare breaker feed information." : "Tap a pin to focus its breaker feed information.",
    "pm-route": `${routePins.length} stop${routePins.length === 1 ? "" : "s"} in the current route.`
  }[mode];
  return `<p class="site-map-overlay-summary"><strong>${escapeHtml(siteMapOverlayLabel(mode))}:</strong> ${escapeHtml(summary || "")}</p>`;
}

function renderSiteMapLegend(pins = []) {
  const layers = ["electrical", "hvac", "life-safety", "plumbing", "fitness", "construction", ""];
  const usedLayers = new Set(pins.map((pin) => getSiteMapPinLayer(pin, getRawAsset(pin.assetId)) || ""));
  const layerItems = layers
    .filter((layer) => layer || usedLayers.has(layer))
    .map((layer) => {
      const markerClass = layer ? ` site-map-legend-${layer}` : " site-map-legend-general";
      return `
        <span class="site-map-legend-item">
          <span class="site-map-legend-marker${markerClass}">${escapeHtml(siteMapLayerMarker(layer))}</span>
          <span>${escapeHtml(siteMapLayerLabel(layer))}</span>
        </span>
      `;
    }).join("");
  return `
    <div class="site-map-legend" aria-label="Site map legend">
      <strong>Legend</strong>
      <div class="site-map-legend-grid">${layerItems}</div>
      <div class="site-map-legend-grid site-map-legend-statuses">
        <span class="site-map-legend-item"><span class="site-map-legend-marker site-map-legend-ok">OK</span><span>Live / energized</span></span>
        <span class="site-map-legend-item"><span class="site-map-legend-marker site-map-legend-warn">!</span><span>Due, open, or warning</span></span>
        <span class="site-map-legend-item"><span class="site-map-legend-marker site-map-legend-danger">!</span><span>Fault or trip</span></span>
      </div>
    </div>
  `;
}

function updateSiteMapViewportMemory() {
  const viewport = els.siteMapCanvas?.querySelector("[data-site-map-viewport]");
  if (!viewport) return;
  siteMapViewportMemory = { left: viewport.scrollLeft, top: viewport.scrollTop };
}

function addSiteMapLevel() {
  if (!isSiteMapLocationSelected()) {
    updateSiteMapStatus("Choose a location before adding a map area.");
    return;
  }
  const map = getCurrentSiteMap(true);
  if (!map) return;
  const name = prompt("Name this map area", "Mezzanine")?.trim();
  if (!name) return;
  const levels = ensureSiteMapLevels(map, true);
  let id = normalizeSiteMapLevelId(name);
  let suffix = 2;
  while (levels.some((level) => level.id === id)) {
    id = `${normalizeSiteMapLevelId(name)}-${suffix}`;
    suffix += 1;
  }
  const level = normalizeSiteMapLevel({ id, name, type: "area", image: null, pins: [] });
  levels.push(level);
  map.updatedAt = new Date().toISOString();
  siteMapLevelId = level.id;
  siteMapZoom = 1;
  siteMapViewportMemory = { left: 0, top: 0 };
  saveState();
  renderSiteMap();
  updateSiteMapStatus(`${level.name} added. Upload a map file for this area when ready.`);
}

function renderSiteMapFilters(pins = []) {
  const areas = [...new Set(pins.map(getSiteMapPinArea).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  if (siteMapAreaFilter !== "all" && !areas.some((area) => area.toLowerCase() === siteMapAreaFilter)) {
    siteMapAreaFilter = "all";
  }
  siteMapOverlayMode = normalizeSiteMapOverlayMode(siteMapOverlayMode);
  const overlays = ["normal", "live-status", "open-tickets", "pm-due", "electrical-issues", "breaker-feed", "pm-route"];
  const overlayButtons = overlays.map((mode) => `
    <button type="button" class="site-map-filter-chip site-map-overlay-chip${siteMapOverlayMode === mode ? " is-active" : ""}" data-site-map-overlay="${escapeAttribute(mode)}">${escapeHtml(siteMapOverlayLabel(mode))}</button>
  `).join("");
  const layers = ["electrical", "hvac", "life-safety", "plumbing", "fitness", "construction"];
  const layerButtons = [
    `<button type="button" class="site-map-filter-chip${siteMapLayerFilter === "all" ? " is-active" : ""}" data-site-map-filter="layer" data-site-map-value="all">All layers</button>`,
    ...layers.map((layer) => `
      <button type="button" class="site-map-filter-chip site-map-filter-${escapeAttribute(layer)}${siteMapLayerFilter === layer ? " is-active" : ""}" data-site-map-filter="layer" data-site-map-value="${escapeAttribute(layer)}">${escapeHtml(siteMapLayerLabel(layer))}</button>
    `)
  ].join("");
  const areaButtons = [
    `<button type="button" class="site-map-filter-chip${siteMapAreaFilter === "all" ? " is-active" : ""}" data-site-map-filter="area" data-site-map-value="all">All zones</button>`,
    ...areas.map((area) => {
      const value = area.toLowerCase();
      return `<button type="button" class="site-map-filter-chip${siteMapAreaFilter === value ? " is-active" : ""}" data-site-map-filter="area" data-site-map-value="${escapeAttribute(value)}">${escapeHtml(area)}</button>`;
    })
  ].join("");
  return `
    <div class="site-map-filters" aria-label="Site map filters">
      <div class="site-map-filter-group site-map-overlay-group">${overlayButtons}</div>
      <div class="site-map-filter-group">${layerButtons}</div>
      <div class="site-map-filter-group">${areaButtons}</div>
    </div>
  `;
}

function getCurrentSiteMap(create = false) {
  const { customerId, locationId } = currentSiteMapScope();
  if (!customerId || !locationId) return null;
  state.siteMaps = Array.isArray(state.siteMaps) ? state.siteMaps : [];
  let map = state.siteMaps.find((item) => item.customerId === customerId && (item.locationId || "") === locationId);
  if (!map && create) {
    map = {
      id: crypto.randomUUID(),
      customerId,
      locationId,
      name: siteMapScopeLabel({ customerId, locationId }),
      image: null,
      pins: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.siteMaps.push(map);
  }
  return map || null;
}

function renderSiteMap() {
  if (!els.siteMapPanel) return;
  const hasLocation = isSiteMapLocationSelected();
  const map = hasLocation ? getCurrentSiteMap(true) : getCurrentSiteMap(false);
  const levels = map ? ensureSiteMapLevels(map, true) : [];
  const activeLevel = getActiveSiteMapLevel(map, true);
  const assets = hasLocation ? filteredAssets() : [];
  const pins = Array.isArray(activeLevel?.pins) ? activeLevel.pins : [];
  const allPins = getAllSiteMapPins(map);
  const pinnedAssetIds = new Set(allPins.map((pin) => pin.assetId).filter(Boolean));
  const availablePinAssets = assets.filter((asset) => !pinnedAssetIds.has(asset.id));
  updateSiteMapViewportMemory();
  const visiblePins = pins.filter((pin) => siteMapPinMatchesFilters(pin, getRawAsset(pin.assetId)));
  const routePins = siteMapOverlayMode === "pm-route" ? getSiteMapRoutePins(visiblePins) : [];
  const routeIndexByPinKey = new Map(routePins.map((pin, index) => [siteMapPinKey(pin, index), index + 1]));
  if (els.siteMapPinCount) els.siteMapPinCount.textContent = visiblePins.length === pins.length ? pins.length : `${visiblePins.length}/${pins.length}`;
  if (els.siteMapImageInput) els.siteMapImageInput.disabled = !hasLocation;
  if (els.siteMapPinLabel) els.siteMapPinLabel.disabled = !hasLocation;
  if (els.siteMapPinArea) els.siteMapPinArea.disabled = !hasLocation;
  if (els.siteMapPinLayer) els.siteMapPinLayer.disabled = !hasLocation;
  if (els.siteMapAddPinBtn) els.siteMapAddPinBtn.disabled = !hasLocation;
  if (els.siteMapClearBtn) els.siteMapClearBtn.disabled = !hasLocation;
  if (els.siteMapPinAsset) {
    els.siteMapPinAsset.disabled = !hasLocation || !availablePinAssets.length;
    els.siteMapPinAsset.innerHTML = availablePinAssets.length
      ? availablePinAssets.map((asset) => `<option value="${escapeAttribute(asset.id)}">${escapeHtml(asset.name || asset.equipmentId || "Equipment")} - ${escapeHtml(getLocation(asset.locationId)?.name || "No location")}</option>`).join("")
      : `<option value="">${hasLocation ? assets.length ? "All equipment is already pinned" : "No equipment in this location" : "Choose a location first"}</option>`;
  }
  if (els.siteMapLevelTabs) {
    els.siteMapLevelTabs.innerHTML = hasLocation && map ? renderSiteMapLevelTabs(map) : "";
  }
  const imageUrl = mediaSource(activeLevel?.image);
  const zoomLabel = `${Math.round(siteMapZoom * 100)}%`;
  if (els.siteMapCanvas) {
    els.siteMapCanvas.classList.toggle("has-map", Boolean(imageUrl));
    els.siteMapCanvas.classList.toggle("is-placing-pin", Boolean(pendingSiteMapPin));
    els.siteMapCanvas.classList.toggle("is-clean-map", Boolean(siteMapCleanView));
    els.siteMapCanvas.innerHTML = !hasLocation
      ? `<div class="site-map-empty">Choose a location to view or create its site map.</div>`
      : imageUrl
      ? `
        <div class="site-map-controls" aria-label="Site map zoom controls">
          <button type="button" class="secondary mini" data-site-map-zoom="out">-</button>
          <span data-site-map-zoom-label>${escapeHtml(zoomLabel)}</span>
          <button type="button" class="secondary mini" data-site-map-zoom="in">+</button>
          <button type="button" class="secondary mini" data-site-map-zoom="reset">Reset</button>
          <button type="button" class="secondary mini site-map-clean-toggle${siteMapCleanView ? " is-active" : ""}" data-site-map-clean>${siteMapCleanView ? "Full plan" : "Clean plan"}</button>
        </div>
        <div class="site-map-viewport" data-site-map-viewport>
          <div class="site-map-stage" data-site-map-stage style="width: ${Math.round(siteMapZoom * 100)}%;">
            <img class="site-map-image" src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(activeLevel?.name || map?.name || "Site map")}">
            ${renderSiteMapRouteOverlay(routePins)}
            ${visiblePins.map((pin, index) => {
              const asset = getRawAsset(pin.assetId);
              const title = pin.label || asset?.name || `Pin ${index + 1}`;
              const overlayInfo = getSiteMapPinOverlayInfo(pin, index, asset, routeIndexByPinKey);
              const tooltip = renderSiteMapPinTooltip(pin, index, asset, title, overlayInfo);
              const layer = getSiteMapPinLayer(pin, asset);
              const layerClass = layer ? ` site-map-pin-${layer}` : "";
              return `
                <button type="button" class="site-map-pin${layerClass}${overlayInfo.className}" style="left: ${clampPercent(pin.x)}%; top: ${clampPercent(pin.y)}%;" data-open-site-map-pin="${escapeAttribute(pin.assetId)}" aria-label="${escapeAttribute(title)}">
                  <span>${escapeHtml(overlayInfo.marker)}</span>
                  ${tooltip}
                </button>
              `;
            }).join("")}
          </div>
        </div>
      `
      : `<div class="site-map-empty">Upload a site or floor plan image for ${escapeHtml(activeLevel?.name || "this map area")}.</div>`;
    if (imageUrl) {
      const restoredViewport = els.siteMapCanvas.querySelector("[data-site-map-viewport]");
      if (restoredViewport) {
        const restoreScroll = () => {
          restoredViewport.scrollLeft = siteMapViewportMemory.left;
          restoredViewport.scrollTop = siteMapViewportMemory.top;
        };
        restoreScroll();
        requestAnimationFrame(restoreScroll);
      }
    }
  }
  if (els.siteMapPinList) {
    els.siteMapPinList.innerHTML = !hasLocation
      ? `<p class="metric-dropdown-empty">Site maps are saved per location. Select a location above to continue.</p>`
      : pins.length
      ? `${renderSiteMapFilters(pins)}${renderSiteMapLegend(pins)}${renderSiteMapOverlaySummary(visiblePins, routePins)}${visiblePins.length ? visiblePins.map((pin, index) => {
        const asset = getRawAsset(pin.assetId);
        const locationName = asset ? getLocation(asset.locationId)?.name || "No location" : "Equipment missing";
        const area = getSiteMapPinArea(pin);
        const layer = siteMapLayerLabel(getSiteMapPinLayer(pin, asset));
        const overlayInfo = getSiteMapPinOverlayInfo(pin, index, asset, routeIndexByPinKey);
        return `
          <article class="site-map-pin-row">
            <button type="button" class="site-map-pin-open" data-open-site-map-pin="${escapeAttribute(pin.assetId)}">
              <strong>${escapeHtml(overlayInfo.marker)}. ${escapeHtml(pin.label || asset?.name || "Equipment pin")}</strong>
              <span>${escapeHtml(locationName)}${asset?.equipmentId ? ` | ${escapeHtml(asset.equipmentId)}` : ""}</span>
              <span>${escapeHtml(layer)}${area ? ` | ${escapeHtml(area)}` : ""}</span>
              ${overlayInfo.summary ? `<span>${escapeHtml(overlayInfo.summary)}</span>` : ""}
            </button>
            <button type="button" class="secondary mini" data-delete-site-map-pin="${escapeAttribute(pin.id)}">Remove</button>
          </article>
        `;
      }).join("") : `<p class="metric-dropdown-empty">No pins match these filters.</p>`}`
      : `<p class="metric-dropdown-empty">No equipment pins on this map yet.</p>`;
  }
}

function renderSiteMapPinTooltip(pin, index, asset, title, overlayInfo = null) {
  if (!asset) {
    return `
      <span class="site-map-pin-tooltip" role="tooltip">
        <strong>${escapeHtml(title || `Pin ${index + 1}`)}</strong>
        <small>Equipment missing</small>
      </span>
    `;
  }
  const due = getDueInfo(asset);
  const openCount = openWorkOrdersForAsset(asset.id).length;
  const locationName = getLocation(asset.locationId)?.name || "No location";
  const equipmentId = getAssetEquipmentId(asset);
  const typeLabel = asset.type || asset.category || asset.template || "Equipment";
  const area = getSiteMapPinArea(pin);
  const layer = siteMapLayerLabel(getSiteMapPinLayer(pin, asset));
  const liveStatus = getSiteMapAssetLiveStatus(asset);
  return `
    <span class="site-map-pin-tooltip" role="tooltip">
      <strong>${escapeHtml(title || asset.name || `Pin ${index + 1}`)}</strong>
      <small>${escapeHtml(equipmentId)}${typeLabel ? ` | ${escapeHtml(typeLabel)}` : ""}</small>
      <small>${escapeHtml(layer)}${area ? ` | ${escapeHtml(area)}` : ""}</small>
      <small>${escapeHtml(locationName)}</small>
      <small>${escapeHtml(due.label)}${openCount ? ` | ${openCount} open ticket${openCount === 1 ? "" : "s"}` : ""}</small>
      ${liveStatus.key !== "unknown" ? `<small>Live: ${escapeHtml(liveStatus.label)}${liveStatus.detail ? ` | ${escapeHtml(liveStatus.detail)}` : ""}</small>` : ""}
      ${overlayInfo?.summary ? `<small>${escapeHtml(siteMapOverlayLabel())}: ${escapeHtml(overlayInfo.summary)}</small>` : ""}
      ${overlayInfo?.detail ? `<small>${escapeHtml(overlayInfo.detail)}</small>` : ""}
    </span>
  `;
}

async function handleSiteMapImageChange() {
  const file = els.siteMapImageInput?.files?.[0];
  if (!file) return;
  if (!isSiteMapLocationSelected()) {
    updateSiteMapStatus("Choose a location before adding a site map.");
    if (els.siteMapImageInput) els.siteMapImageInput.value = "";
    return;
  }
  const map = getCurrentSiteMap(true);
  if (!map) {
    updateSiteMapStatus("Choose a location before adding a site map.");
    return;
  }
  const activeLevel = getActiveSiteMapLevel(map, true);
  if (!activeLevel) return;
  try {
    updateSiteMapStatus(isPdfFile(file) ? "Converting PDF page 1 into a site map..." : "Preparing site map image...");
    const image = await readSiteMapFile(file);
    activeLevel.image = image;
    activeLevel.updatedAt = new Date().toISOString();
    ensureSiteMapLevels(map, true);
    map.name = siteMapScopeLabel(map);
    map.updatedAt = new Date().toISOString();
    pendingSiteMapPin = null;
    saveState();
    renderSiteMap();
    updateSiteMapStatus(siteMapImageIsCloudReady(image)
      ? `${isPdfFile(file) ? "PDF map" : "Map image"} saved to cloud. It should show on iPad after refresh. Choose equipment, then Add Pin.`
      : `${isPdfFile(file) ? "PDF map" : "Map image"} saved only on this device because cloud storage did not accept the upload. It will not show on iPad until storage upload works.`);
  } catch (error) {
    console.warn("Site map file could not be loaded.", error);
    updateSiteMapStatus(error?.message || "Map file could not be loaded.");
  } finally {
    if (els.siteMapImageInput) els.siteMapImageInput.value = "";
  }
}

function startSiteMapPinPlacement() {
  if (!isSiteMapLocationSelected()) {
    updateSiteMapStatus("Choose a location before adding pins.");
    return;
  }
  const map = getCurrentSiteMap(false);
  const activeLevel = getActiveSiteMapLevel(map, true);
  if (!mediaSource(activeLevel?.image)) {
    updateSiteMapStatus("Upload a map image for this area first.");
    return;
  }
  const selectedAssetId = els.siteMapPinAsset?.value || "";
  if (selectedAssetId && getAllSiteMapPins(map).some((pin) => pin.assetId === selectedAssetId)) {
    updateSiteMapStatus("That equipment is already pinned on this map.");
    renderSiteMap();
    return;
  }
  const label = els.siteMapPinLabel?.value.trim() || "";
  if (!selectedAssetId && !label) {
    updateSiteMapStatus("Choose equipment or enter a label before placing a pin.");
    return;
  }
  const asset = getRawAsset(selectedAssetId);
  pendingSiteMapPin = {
    assetId: selectedAssetId,
    label,
    area: els.siteMapPinArea?.value.trim() || "",
    layer: normalizeSiteMapLayer(els.siteMapPinLayer?.value || "") || inferSiteMapLayer(asset)
  };
  renderSiteMap();
  updateSiteMapStatus(`Tap the map where ${asset?.name || label || "this pin"} belongs.`);
}

function startSiteMapDrag(event) {
  if (pendingSiteMapPin) return;
  if (event.button !== undefined && event.button !== 0) return;
  const isTouch = event.pointerType === "touch";
  if (event.target.closest(".site-map-controls, input, select, textarea, label")) return;
  if (!isTouch && event.target.closest(".site-map-pin, button")) return;
  if (isTouch && event.target.closest("button:not(.site-map-pin)")) return;
  const viewport = event.target.closest("[data-site-map-viewport]");
  if (!viewport) return;
  if (isTouch) {
    siteMapTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    viewport.setPointerCapture?.(event.pointerId);
    if (siteMapTouchPointers.size >= 2) {
      beginSiteMapPinch(viewport);
      siteMapDragState = null;
      viewport.classList.add("is-dragging");
      event.preventDefault();
      return;
    }
  }
  const canScroll = viewport.scrollWidth > viewport.clientWidth || viewport.scrollHeight > viewport.clientHeight;
  if (!canScroll) return;
  siteMapDragState = {
    pointerId: event.pointerId,
    viewport,
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: viewport.scrollLeft,
    scrollTop: viewport.scrollTop,
    moved: false
  };
  viewport.classList.add("is-dragging");
  viewport.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function moveSiteMapDrag(event) {
  if (event.pointerType === "touch" && siteMapTouchPointers.has(event.pointerId)) {
    siteMapTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (siteMapPinchState && siteMapTouchPointers.size >= 2) {
      moveSiteMapPinch();
      siteMapDragSuppressClick = true;
      event.preventDefault();
      return;
    }
  }
  if (!siteMapDragState || siteMapDragState.pointerId !== event.pointerId) return;
  const dx = event.clientX - siteMapDragState.startX;
  const dy = event.clientY - siteMapDragState.startY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    siteMapDragState.moved = true;
    siteMapDragSuppressClick = true;
  }
  siteMapDragState.viewport.scrollLeft = siteMapDragState.scrollLeft - dx;
  siteMapDragState.viewport.scrollTop = siteMapDragState.scrollTop - dy;
  event.preventDefault();
}

function endSiteMapDrag(event) {
  if (event.pointerType === "touch") {
    const hadTouchPointer = siteMapTouchPointers.delete(event.pointerId);
    if (siteMapPinchState && siteMapTouchPointers.size < 2) {
      const viewport = siteMapPinchState.viewport;
    siteMapPinchState = null;
      siteMapDragSuppressClick = true;
      viewport?.classList.remove("is-dragging");
      window.setTimeout(() => {
        siteMapDragSuppressClick = false;
      }, 80);
    }
    if (hadTouchPointer) {
      event.target?.releasePointerCapture?.(event.pointerId);
    }
  }
  if (!siteMapDragState || siteMapDragState.pointerId !== event.pointerId) return;
  const viewport = siteMapDragState.viewport;
  const moved = siteMapDragState.moved;
  viewport.classList.remove("is-dragging");
  viewport.releasePointerCapture?.(event.pointerId);
  siteMapDragState = null;
  if (moved) {
    window.setTimeout(() => {
      siteMapDragSuppressClick = false;
    }, 0);
  }
}

function siteMapTouchPair() {
  const points = [...siteMapTouchPointers.values()];
  if (points.length < 2) return null;
  return [points[0], points[1]];
}

function siteMapTouchDistance(pair) {
  const [first, second] = pair;
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function siteMapTouchCenter(pair) {
  const [first, second] = pair;
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2
  };
}

function beginSiteMapPinch(viewport) {
  const pair = siteMapTouchPair();
  if (!pair) return;
  const distance = siteMapTouchDistance(pair);
  if (distance <= 0) return;
  siteMapPinchState = {
    viewport,
    startDistance: distance,
    startZoom: siteMapZoom
  };
}

function moveSiteMapPinch() {
  const pair = siteMapTouchPair();
  if (!pair || !siteMapPinchState) return;
  const distance = siteMapTouchDistance(pair);
  if (distance <= 0 || siteMapPinchState.startDistance <= 0) return;
  const center = siteMapTouchCenter(pair);
  const nextZoom = Math.max(0.75, Math.min(5, Math.round(siteMapPinchState.startZoom * (distance / siteMapPinchState.startDistance) * 100) / 100));
  applySiteMapZoomAtPoint(nextZoom, siteMapPinchState.viewport, center.x, center.y);
}

function applySiteMapZoomAtPoint(nextZoom, viewport, clientX, clientY) {
  const stage = viewport?.querySelector("[data-site-map-stage]");
  if (!viewport || !stage || !Number.isFinite(nextZoom)) return;
  const currentRect = stage.getBoundingClientRect();
  if (!currentRect.width || !currentRect.height) return;
  const viewportRect = viewport.getBoundingClientRect();
  const currentStageLeft = currentRect.left - viewportRect.left + viewport.scrollLeft;
  const currentStageTop = currentRect.top - viewportRect.top + viewport.scrollTop;
  const contentX = viewport.scrollLeft + (clientX - viewportRect.left);
  const contentY = viewport.scrollTop + (clientY - viewportRect.top);
  const ratioX = Math.max(0, Math.min(1, (contentX - currentStageLeft) / currentRect.width));
  const ratioY = Math.max(0, Math.min(1, (contentY - currentStageTop) / currentRect.height));
  const fingerX = clientX - viewportRect.left;
  const fingerY = clientY - viewportRect.top;
  const beforeScrollWidth = viewport.scrollWidth;
  const beforeScrollHeight = viewport.scrollHeight;
  siteMapZoom = nextZoom;
  stage.style.width = `${Math.round(siteMapZoom * 100)}%`;
  const label = els.siteMapCanvas?.querySelector("[data-site-map-zoom-label]");
  if (label) label.textContent = `${Math.round(siteMapZoom * 100)}%`;
  requestAnimationFrame(() => {
    const nextRect = stage.getBoundingClientRect();
    const nextStageLeft = nextRect.left - viewportRect.left + viewport.scrollLeft;
    const nextStageTop = nextRect.top - viewportRect.top + viewport.scrollTop;
    let nextLeft = nextStageLeft + nextRect.width * ratioX - fingerX;
    let nextTop = nextStageTop + nextRect.height * ratioY - fingerY;
    if (viewport.scrollWidth === beforeScrollWidth && viewport.scrollHeight === beforeScrollHeight) {
      nextLeft = viewport.scrollLeft;
      nextTop = viewport.scrollTop;
    }
    viewport.scrollLeft = Math.max(0, nextLeft);
    viewport.scrollTop = Math.max(0, nextTop);
    updateSiteMapViewportMemory();
  });
}

async function addSiteMapPinFromEvent(event) {
  if (siteMapDragSuppressClick) {
    siteMapDragSuppressClick = false;
    return;
  }
  if (event.target.closest(".site-map-controls")) return;
  if (event.target.closest("[data-open-site-map-pin]")) return;
  if (!pendingSiteMapPin) return;
  if (!isSiteMapLocationSelected()) {
    updateSiteMapStatus("Choose a location before adding pins.");
    return;
  }
  const map = getCurrentSiteMap(true);
  if (!map) return;
  const activeLevel = getActiveSiteMapLevel(map, true);
  if (!activeLevel) return;
  const stage = event.target.closest("[data-site-map-stage]") || els.siteMapCanvas.querySelector("[data-site-map-stage]");
  if (!stage) {
    updateSiteMapStatus("Upload a map image first.");
    pendingSiteMapPin = null;
    return;
  }
  const rect = stage.getBoundingClientRect();
  const x = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
  const y = clampPercent(((event.clientY - rect.top) / rect.height) * 100);
  const pendingPin = pendingSiteMapPin && typeof pendingSiteMapPin === "object" ? pendingSiteMapPin : {};
  const assetId = pendingPin.assetId || els.siteMapPinAsset?.value || "";
  const label = pendingPin.label || els.siteMapPinLabel?.value.trim() || "";
  const area = pendingPin.area || els.siteMapPinArea?.value.trim() || "";
  const layer = normalizeSiteMapLayer(pendingPin.layer || els.siteMapPinLayer?.value || "") || inferSiteMapLayer(getRawAsset(assetId));
  activeLevel.pins = Array.isArray(activeLevel.pins) ? activeLevel.pins : [];
  if (assetId && getAllSiteMapPins(map).some((pin) => pin.assetId === assetId)) {
    pendingSiteMapPin = null;
    renderSiteMap();
    updateSiteMapStatus("That equipment is already pinned on this map.");
    return;
  }
  const newPin = {
    id: crypto.randomUUID(),
    assetId,
    label,
    area,
    layer,
    x,
    y,
    createdAt: new Date().toISOString()
  };
  const updatedAt = new Date().toISOString();
  activeLevel.pins.push(newPin);
  activeLevel.updatedAt = updatedAt;
  const levels = ensureSiteMapLevels(map, true);
  const storedLevel = levels.find((level) => level.id === activeLevel.id) || activeLevel;
  storedLevel.pins = Array.isArray(storedLevel.pins) ? storedLevel.pins : [];
  if (!storedLevel.pins.some((pin) => pin.id === newPin.id)) storedLevel.pins.push(newPin);
  storedLevel.updatedAt = updatedAt;
  if (storedLevel.id === "main") {
    map.pins = storedLevel.pins;
    map.image = storedLevel.image || map.image || null;
  }
  map.levels = levels;
  map.updatedAt = updatedAt;
  pendingSiteMapPin = null;
  if (els.siteMapPinLabel) els.siteMapPinLabel.value = "";
  if (els.siteMapPinArea) els.siteMapPinArea.value = "";
  if (els.siteMapPinLayer) els.siteMapPinLayer.value = "";
  let localSaved = true;
  state.updatedAt = updatedAt;
  try {
    persistLocalStateOnly(false);
  } catch (error) {
    localSaved = false;
    console.warn("Site map pin saved in memory, but local browser storage is full.", error);
  }
  scheduleSharedStateSave();
  scheduleStructuredDataSync(0);
  if (!localSaved) {
    try {
      const cloudLocationIds = new Set((state.locations || []).map((locationRecord) => locationRecord.id).filter(Boolean));
      await upsertStructuredRows("site_maps", [buildStructuredSiteMapRow(map, cloudLocationIds)]);
      markSyncSuccess("save");
    } catch (error) {
      markSyncError(`Site map cloud save failed: ${error?.message || error}`);
      console.warn("Site map cloud save failed after local storage was full.", error);
    }
  }
  renderSiteMap();
  updateSiteMapStatus(localSaved
    ? `Pin added. ${storedLevel.pins.length} pin${storedLevel.pins.length === 1 ? "" : "s"} on ${storedLevel.name || "this map"}.`
    : `Pin added and sent to cloud. This iPad storage is full, so remove old photos/PDFs soon.`);
}

function deleteSiteMapPin(pinId) {
  const map = getCurrentSiteMap(false);
  const activeLevel = getActiveSiteMapLevel(map, false);
  if (!map || !activeLevel || !Array.isArray(activeLevel.pins)) return;
  activeLevel.pins = activeLevel.pins.filter((pin) => pin.id !== pinId);
  activeLevel.updatedAt = new Date().toISOString();
  ensureSiteMapLevels(map, true);
  map.updatedAt = new Date().toISOString();
  saveState();
  renderSiteMap();
  updateSiteMapStatus("Pin removed.");
}

function changeSiteMapZoom(action = "") {
  const viewport = els.siteMapCanvas?.querySelector("[data-site-map-viewport]");
  updateSiteMapViewportMemory();
  if (action === "reset") {
    siteMapZoom = 1;
  } else if (action === "in") {
    siteMapZoom = Math.min(5, Math.round((siteMapZoom + 0.25) * 100) / 100);
  } else if (action === "out") {
    siteMapZoom = Math.max(0.75, Math.round((siteMapZoom - 0.25) * 100) / 100);
  }
  if (viewport && action !== "reset") {
    const rect = viewport.getBoundingClientRect();
    applySiteMapZoomAtPoint(siteMapZoom, viewport, rect.left + rect.width / 2, rect.top + rect.height / 2);
  } else {
    renderSiteMap();
  }
}

function clearCurrentSiteMap() {
  if (!isSiteMapLocationSelected()) {
    updateSiteMapStatus("Choose a location before clearing a map.");
    return;
  }
  const map = getCurrentSiteMap(false);
  const activeLevel = getActiveSiteMapLevel(map, false);
  if (!activeLevel?.image && !activeLevel?.pins?.length) {
    updateSiteMapStatus("No map to clear for this area.");
    return;
  }
  if (!confirm(`Clear ${activeLevel.name || "this map area"} image and pins?`)) return;
  activeLevel.image = null;
  activeLevel.pins = [];
  activeLevel.updatedAt = new Date().toISOString();
  ensureSiteMapLevels(map, true);
  map.updatedAt = new Date().toISOString();
  pendingSiteMapPin = null;
  saveState();
  renderSiteMap();
  updateSiteMapStatus("Map cleared.");
}

function openSiteMapAsset(assetId) {
  const asset = getAsset(assetId);
  if (!asset) {
    updateSiteMapStatus("That equipment is not available in your current view.");
    return;
  }
  selectedId = asset.id;
  render();
  updateSiteMapStatus(`${asset.name || "Equipment"} opened. Close the equipment panel to return to the map.`);
}

function updateSiteMapStatus(message = "") {
  if (els.siteMapStatus) els.siteMapStatus.textContent = message;
}
