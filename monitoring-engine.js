(function monitoringEngineFactory(root, factory) {
  const engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  if (root) root.SiteWorksMonitoringEngine = engine;
})(typeof globalThis !== "undefined" ? globalThis : null, function createMonitoringEngine() {
  const PHASES = ["A", "B", "C"];
  const DEFAULT_HEARTBEAT_SECONDS = 120;
  const DEFAULT_DELAY_SECONDS = 30;

  function makeFallbackId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function ensureCollections(state) {
    state.monitoringDevices = Array.isArray(state.monitoringDevices) ? state.monitoringDevices : [];
    state.monitoringChannels = Array.isArray(state.monitoringChannels) ? state.monitoringChannels : [];
    state.monitoringEvents = Array.isArray(state.monitoringEvents) ? state.monitoringEvents : [];
    state.monitoringAlerts = Array.isArray(state.monitoringAlerts) ? state.monitoringAlerts : [];
  }

  function parseList(value) {
    return String(value || "")
      .split(/[\s,;/]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function parseCircuitNumbers(value) {
    return parseList(value)
      .map((item) => Number(String(item).replace(/\D/g, "")))
      .filter((number) => Number.isInteger(number) && number > 0);
  }

  function normalizePhase(value, fallback = "A") {
    const phase = String(value || fallback).trim().toUpperCase();
    return PHASES.includes(phase) ? phase : fallback;
  }

  function normalizeSourcePhases(sourcePhases) {
    return PHASES.reduce((result, phase) => {
      result[phase] = sourcePhases && Object.prototype.hasOwnProperty.call(sourcePhases, phase)
        ? Boolean(sourcePhases[phase])
        : true;
      return result;
    }, {});
  }

  function normalizeSourcePhaseChannels(sourcePhaseChannels) {
    return PHASES.reduce((result, phase) => {
      const mapped = sourcePhaseChannels?.[phase] ?? sourcePhaseChannels?.[phase.toLowerCase()];
      result[phase] = mapped === undefined || mapped === null ? "" : String(mapped).trim();
      return result;
    }, {});
  }

  function channelStateMap(payload) {
    const map = new Map();
    (payload?.channels || []).forEach((channel) => {
      const id = String(channel.channel ?? channel.physicalChannel ?? channel.physical_channel ?? "").trim();
      if (!id) return;
      const value = channel.closed ?? channel.energized ?? channel.healthy ?? channel.value;
      map.set(id, Boolean(value));
    });
    return map;
  }

  function sourcePhasesFromPayload(device, payload) {
    const direct = payload?.sourcePhases || payload?.source_phases;
    const phases = normalizeSourcePhases(direct);
    const mappings = normalizeSourcePhaseChannels(payload?.sourcePhaseChannels || payload?.source_phase_channels || device?.sourcePhaseChannels || device?.source_phase_channels);
    const states = channelStateMap(payload);
    PHASES.forEach((phase) => {
      if (mappings[phase] && states.has(mappings[phase])) phases[phase] = states.get(mappings[phase]);
    });
    return phases;
  }

  function getChannelPhaseList(channel) {
    const count = Math.max(1, Math.min(3, Number(channel?.poleCount || channel?.pole_count || 1)));
    const stored = Array.isArray(channel?.sourcePhases)
      ? channel.sourcePhases
      : Array.isArray(channel?.source_phases)
        ? channel.source_phases
        : [];
    const fallback = normalizePhase(channel?.sourcePhase || channel?.source_phase || PHASES[(Number(channel?.poleIndex || channel?.pole_index || 1) - 1 + 3) % 3] || "A");
    const phases = stored.length ? stored.map((phase) => normalizePhase(phase, fallback)) : [fallback];
    return phases.slice(0, count);
  }

  function deriveChannelState(device, channel, rawClosed, timestamp) {
    if (device?.maintenanceMode || device?.maintenance_mode || channel?.monitoringMode === "maintenance" || channel?.monitoring_mode === "maintenance") return "maintenance-mode";
    if (channel?.monitoringMode === "disabled" || channel?.monitoring_mode === "disabled") return "disabled";
    if (device?.onlineStatus === "offline" || device?.online_status === "offline") return "monitoring-offline";
    const sourcePhases = normalizeSourcePhases(device?.sourcePhases || device?.source_phases);
    if (getChannelPhaseList(channel).some((phase) => sourcePhases[phase] === false)) {
      channel.firstAbsentAt = "";
      channel.first_absent_at = "";
      return "upstream-power-loss";
    }
    if (rawClosed === true) {
      channel.firstAbsentAt = "";
      channel.first_absent_at = "";
      return "energized";
    }
    const firstAbsentAt = channel.firstAbsentAt || channel.first_absent_at || timestamp;
    channel.firstAbsentAt = firstAbsentAt;
    const elapsedSeconds = (new Date(timestamp).getTime() - new Date(firstAbsentAt).getTime()) / 1000;
    const delay = Number(channel.alarmDelaySeconds ?? channel.alarm_delay_seconds ?? DEFAULT_DELAY_SECONDS);
    return elapsedSeconds >= delay ? "suspected-trip" : "open";
  }

  function stateLabel(value) {
    return {
      energized: "Energized",
      open: "Open",
      "suspected-trip": "Suspected trip",
      "upstream-power-loss": "Upstream phase loss",
      "monitoring-offline": "Monitoring offline",
      "maintenance-mode": "Maintenance mode",
      disabled: "Disabled"
    }[value] || "Unknown";
  }

  function addEvent(state, event, options = {}) {
    state.monitoringEvents.unshift({
      id: event.id || options.makeId?.() || makeFallbackId(),
      deviceId: event.deviceId || "",
      channelId: event.channelId || "",
      panelAssetId: event.panelAssetId || "",
      circuitNumber: event.circuitNumber || "",
      breakerGroupId: event.breakerGroupId || "",
      type: event.type || "event",
      state: event.state || "",
      message: event.message || "",
      data: event.data || {},
      createdAt: event.createdAt || options.now || new Date().toISOString()
    });
    state.monitoringEvents = state.monitoringEvents.slice(0, 1000);
  }

  function activeAlertForChannel(state, channelId) {
    return state.monitoringAlerts.find((alert) => alert.channelId === channelId && alert.status !== "resolved");
  }

  function ensureAlert(state, device, channel, options = {}) {
    const existing = activeAlertForChannel(state, channel.id);
    if (existing) return existing;
    const now = options.now || new Date().toISOString();
    const phase = getChannelPhaseList(channel).join("/");
    const alert = {
      id: options.makeId?.() || makeFallbackId(),
      deviceId: device.id,
      channelId: channel.id,
      panelAssetId: channel.panelAssetId || channel.panel_asset_id || device.panelAssetId || "",
      circuitNumber: channel.circuitNumber || "",
      breakerGroupId: channel.breakerGroupId || "",
      status: "active",
      severity: channel.criticality || "normal",
      title: `Suspected trip on circuit ${channel.circuitNumber}`,
      message: `${device.name || "Device"} reports no breaker output while phase ${phase} is healthy.`,
      createdAt: now,
      acknowledgedAt: "",
      resolvedAt: "",
      durationSeconds: null,
      workOrderId: ""
    };
    state.monitoringAlerts.unshift(alert);
    addEvent(state, {
      deviceId: device.id,
      channelId: channel.id,
      panelAssetId: alert.panelAssetId,
      circuitNumber: alert.circuitNumber,
      breakerGroupId: alert.breakerGroupId,
      type: "alert-created",
      state: "suspected-trip",
      message: alert.title
    }, options);
    return alert;
  }

  function resolveAlertsForChannel(state, channelId, message, options = {}) {
    const now = options.now || new Date().toISOString();
    state.monitoringAlerts
      .filter((alert) => alert.channelId === channelId && alert.status !== "resolved")
      .forEach((alert) => {
        alert.status = "resolved";
        alert.resolvedAt = now;
        const started = new Date(alert.createdAt || now).getTime();
        const ended = new Date(now).getTime();
        alert.durationSeconds = Number.isFinite(started) && Number.isFinite(ended)
          ? Math.max(0, Math.round((ended - started) / 1000))
          : null;
        addEvent(state, {
          deviceId: alert.deviceId,
          channelId,
          panelAssetId: alert.panelAssetId,
          circuitNumber: alert.circuitNumber,
          breakerGroupId: alert.breakerGroupId,
          type: "alert-resolved",
          message,
          data: { durationSeconds: alert.durationSeconds }
        }, options);
      });
  }

  function channelsForDevice(state, deviceId) {
    const id = String(deviceId || "");
    return state.monitoringChannels.filter((channel) => String(channel.deviceId || channel.device_id || "") === id);
  }

  function ingestStatus(state, payload, options = {}) {
    ensureCollections(state);
    const device = state.monitoringDevices.find((item) => item.deviceUid === payload.deviceUid || item.id === payload.deviceId);
    if (!device) return { ok: false, message: "Unknown monitoring device." };
    const now = payload.timestamp || options.now || new Date().toISOString();
    device.lastSeenAt = now;
    device.onlineStatus = "online";
    device.healthStatus = payload.healthStatus || "ok";
    device.sourcePhases = sourcePhasesFromPayload(device, payload);
    device.sourcePhaseChannels = normalizeSourcePhaseChannels(payload.sourcePhaseChannels || payload.source_phase_channels || device.sourcePhaseChannels || device.source_phase_channels);
    device.mainVoltage = payload.mainVoltage ?? payload.main_voltage ?? payload.voltage ?? payload.lineVoltage ?? payload.line_voltage ?? device.mainVoltage ?? "";
    device.mainCurrent = payload.mainCurrent ?? payload.main_current ?? payload.current ?? payload.loadCurrent ?? payload.load_current ?? payload.amps ?? payload.amperage ?? device.mainCurrent ?? "";
    device.rawPayloads = Array.isArray(device.rawPayloads) ? device.rawPayloads : [];
    device.rawPayloads.unshift({ receivedAt: now, payload });
    device.rawPayloads = device.rawPayloads.slice(0, 20);
    device.updatedAt = options.savedAt || now;

    const states = channelStateMap(payload);
    channelsForDevice(state, device.id).forEach((channel) => {
      const key = String(channel.physicalChannel || channel.physical_channel || "");
      const rawClosed = states.has(key) ? states.get(key) : channel.lastRawState;
      const previousRaw = channel.lastRawState;
      const previousDerived = channel.lastDerivedState;
      channel.lastRawState = rawClosed;
      channel.lastDerivedState = deriveChannelState(device, channel, rawClosed, now);
      channel.updatedAt = options.savedAt || now;
      if (previousRaw !== channel.lastRawState) {
        addEvent(state, {
          deviceId: device.id,
          channelId: channel.id,
          panelAssetId: channel.panelAssetId,
          circuitNumber: channel.circuitNumber,
          breakerGroupId: channel.breakerGroupId,
          type: "raw-state-change",
          state: channel.lastRawState === true ? "closed" : "open",
          message: `Raw input ${channel.physicalChannel} changed.`,
          data: { simulated: Boolean(options.simulated), rawClosed }
        }, { ...options, now });
      }
      if (previousDerived !== channel.lastDerivedState) {
        addEvent(state, {
          deviceId: device.id,
          channelId: channel.id,
          panelAssetId: channel.panelAssetId,
          circuitNumber: channel.circuitNumber,
          breakerGroupId: channel.breakerGroupId,
          type: "state-change",
          state: channel.lastDerivedState,
          message: `Circuit ${channel.circuitNumber} is ${stateLabel(channel.lastDerivedState)}.`,
          data: { simulated: Boolean(options.simulated), rawClosed }
        }, { ...options, now });
      }
      if (channel.lastDerivedState === "suspected-trip") {
        ensureAlert(state, device, channel, { ...options, now });
      } else if (["energized", "maintenance-mode", "disabled", "upstream-power-loss"].includes(channel.lastDerivedState)) {
        resolveAlertsForChannel(state, channel.id, `Circuit moved to ${stateLabel(channel.lastDerivedState)}.`, { ...options, now });
      }
    });
    addEvent(state, {
      deviceId: device.id,
      panelAssetId: device.panelAssetId,
      type: options.simulated ? "simulator-status" : "device-status",
      message: `${device.name || "Device"} reported status.`
    }, { ...options, now });
    return { ok: true };
  }

  function runOfflineCheck(state, options = {}) {
    ensureCollections(state);
    let changed = false;
    const nowMs = new Date(options.now || new Date()).getTime();
    state.monitoringDevices.forEach((device) => {
      if (!device.lastSeenAt) return;
      const heartbeatMs = Number(device.heartbeatSeconds || DEFAULT_HEARTBEAT_SECONDS) * 1000;
      if (device.onlineStatus !== "offline" && nowMs - new Date(device.lastSeenAt).getTime() > heartbeatMs + 60000) {
        device.onlineStatus = "offline";
        device.updatedAt = options.now || new Date().toISOString();
        channelsForDevice(state, device.id).forEach((channel) => {
          channel.lastDerivedState = "monitoring-offline";
          channel.updatedAt = device.updatedAt;
        });
        addEvent(state, {
          deviceId: device.id,
          panelAssetId: device.panelAssetId,
          type: "device-offline",
          state: "monitoring-offline",
          message: `${device.name || "Device"} is offline.`
        }, options);
        changed = true;
      }
    });
    return { changed };
  }

  function createChannelRecords(input, options = {}) {
    const poleCount = Math.max(1, Math.min(3, Number(input.poleCount || 1)));
    const physicalChannels = parseList(input.physicalChannel);
    const sourcePhases = (input.sourcePhases || []).map((phase, index) => normalizePhase(phase, PHASES[index]));
    const circuitNumbers = parseCircuitNumbers(input.circuitNumber);
    const baseCircuit = circuitNumbers[0] || Number(String(input.circuitNumber || "").replace(/\D/g, "")) || 0;
    const inferredCircuits = circuitNumbers.length >= poleCount
      ? circuitNumbers
      : Array.from({ length: poleCount }, (_, index) => baseCircuit ? baseCircuit + index * 2 : "");
    if (physicalChannels.length < poleCount) {
      return { ok: false, message: `Enter ${poleCount} physical channel${poleCount === 1 ? "" : "s"} for this breaker.` };
    }
    const breakerGroupId = input.breakerGroupId || options.makeId?.() || makeFallbackId();
    const records = Array.from({ length: poleCount }, (_, index) => ({
      id: options.makeId?.() || makeFallbackId(),
      deviceId: input.deviceId,
      panelAssetId: input.panelAssetId,
      breakerGroupId,
      breakerPoleCount: poleCount,
      poleIndex: index + 1,
      circuitNumber: inferredCircuits.filter(Boolean).join(","),
      physicalChannel: physicalChannels[index],
      sourcePhase: sourcePhases[index] || PHASES[index],
      sourcePhases: [sourcePhases[index] || PHASES[index]],
      poleCount: 1,
      alarmDelaySeconds: Math.max(0, Number(input.alarmDelaySeconds ?? DEFAULT_DELAY_SECONDS)),
      monitoringMode: input.monitoringMode || "normal",
      criticality: input.criticality || "normal",
      lastRawState: null,
      lastDerivedState: "open",
      firstAbsentAt: "",
      createdAt: input.createdAt || new Date().toISOString(),
      updatedAt: input.updatedAt || input.createdAt || new Date().toISOString()
    }));
    return { ok: true, records };
  }

  function breakerGroupSummaries(channels = []) {
    const groups = new Map();
    channels.forEach((channel) => {
      const key = channel.breakerGroupId || channel.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(channel);
    });
    return [...groups.entries()].map(([breakerGroupId, members]) => {
      const missing = members.filter((channel) => ["open", "suspected-trip"].includes(channel.lastDerivedState));
      const lostSource = members.filter((channel) => channel.lastDerivedState === "upstream-power-loss");
      const expected = Math.max(...members.map((channel) => Number(channel.breakerPoleCount || channel.poleCount || 1)), members.length);
      return {
        breakerGroupId,
        poleCount: expected,
        channels: members,
        missingPoles: missing.map((channel) => ({ channelId: channel.id, physicalChannel: channel.physicalChannel, sourcePhase: channel.sourcePhase, state: channel.lastDerivedState })),
        lostSourcePhases: lostSource.map((channel) => channel.sourcePhase),
        state: missing.length === 0
          ? members.every((channel) => channel.lastDerivedState === "energized") ? "energized" : members[0]?.lastDerivedState || "unknown"
          : missing.length >= expected ? "complete-breaker-open" : "single-pole-missing"
      };
    });
  }

  return {
    PHASES,
    DEFAULT_HEARTBEAT_SECONDS,
    DEFAULT_DELAY_SECONDS,
    ensureCollections,
    parseList,
    parseCircuitNumbers,
    normalizeSourcePhases,
    normalizeSourcePhaseChannels,
    sourcePhasesFromPayload,
    getChannelPhaseList,
    deriveChannelState,
    stateLabel,
    ingestStatus,
    runOfflineCheck,
    resolveAlertsForChannel,
    createChannelRecords,
    breakerGroupSummaries
  };
});
