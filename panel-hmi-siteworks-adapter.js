(function panelHmiSiteWorksAdapterFactory(root, factory) {
  const api = factory(root?.SiteWorksPanelHmiStandardModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SiteWorksPanelHmiAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : null, function createPanelHmiSiteWorksAdapter(model) {
  function text(value) {
    return value === undefined || value === null ? "" : String(value).trim();
  }

  function parseNumbers(value) {
    return text(value)
      .split(/[\s,;/]+/)
      .map((item) => Number(String(item).replace(/\D/g, "")))
      .filter((number) => Number.isInteger(number) && number > 0);
  }

  function parseAmpRating(value, fallback = 0) {
    const match = text(value).match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : fallback;
  }

  function inferWireCount(phaseWiring) {
    const match = text(phaseWiring).match(/(\d+)\s*w/i);
    return match ? Number(match[1]) : 0;
  }

  function systemVoltageFromSchedule(schedule = {}, panel = {}) {
    return text(schedule.voltage || panel.voltage || "Not supplied");
  }

  function phaseWiringFromSchedule(schedule = {}, panel = {}) {
    const phase = text(schedule.phase || panel.phase || "Not supplied");
    if (/3/.test(phase) && !/w/i.test(phase)) return "3φ 4W";
    if (/1/.test(phase) && !/w/i.test(phase)) return "1φ 3W";
    return phase;
  }

  function connectionForPoleCount(poleCount) {
    if (poleCount >= 3) return { connectionType: "3P", phaseAssignment: "ABC" };
    if (poleCount === 2) return { connectionType: "2P_LL", phaseAssignment: "AB" };
    return { connectionType: "1P_LN", phaseAssignment: "A" };
  }

  function circuitLabel(circuit = {}) {
    return text(
      circuit.load
      || circuit.loadServed
      || circuit.description
      || circuit.label
      || circuit.notes
    );
  }

  function scheduleBreakerKey(circuit = {}) {
    return text(circuit.groupedNumber || circuit.number || circuit.cct || circuit.circuit);
  }

  function positionSide(position) {
    return model.sideForPosition(position);
  }

  function breakerStateFromSuppliedData(source = {}) {
    const raw = source.authoritativeBreakerState
      || source.breakerState
      || source.state;
    return model.normalizeBreakerState(raw);
  }

  function diagnosticForChannel(channel = null) {
    if (!channel) return null;
    const condition = text(channel.lastDerivedState || channel.last_derived_state || "not-monitored");
    const timestamp = text(channel.updatedAt || channel.updated_at);
    const physicalChannel = text(channel.physicalChannel || channel.physical_channel);
    return {
      condition,
      label: condition || "not-monitored",
      sourceType: "MONITORING_CHANNEL",
      sourceId: text(channel.id),
      physicalChannel,
      timestamp,
      stale: false,
      advisory: ["suspected-trip", "open", "upstream-power-loss"].includes(condition),
      communication: condition === "monitoring-offline" ? "COMMUNICATION_LOSS" : ""
    };
  }

  function channelForPositionMap(channels = []) {
    const map = new Map();
    channels.forEach((channel) => {
      parseNumbers(channel.circuitNumber || channel.circuit_number).forEach((number) => {
        if (!map.has(number)) map.set(number, channel);
      });
    });
    return map;
  }

  function buildBreakers(schedule = {}, channels = []) {
    const channelByPosition = channelForPositionMap(channels);
    const circuits = Array.isArray(schedule.circuits) ? schedule.circuits : [];
    const circuitByPosition = new Map();
    circuits.forEach((circuit) => {
      const numbers = parseNumbers(scheduleBreakerKey(circuit));
      numbers.forEach((number) => {
        if (!circuitByPosition.has(number)) circuitByPosition.set(number, circuit);
      });
    });

    const totalPositions = model.normalizeTotalPositions(schedule.circuitCount || Math.max(24, ...[...circuitByPosition.keys(), ...channelByPosition.keys()], 0));
    const used = new Set();
    const breakers = [];
    const preparedCircuits = [];

    for (let position = 1; position <= totalPositions; position += 1) {
      if (used.has(position)) continue;
      const circuit = circuitByPosition.get(position);
      const channel = channelByPosition.get(position);
      if (!circuit && !channel) continue;
      const numbers = parseNumbers(scheduleBreakerKey(circuit) || channel?.circuitNumber || channel?.circuit_number || position)
        .filter((number) => positionSide(number) === positionSide(position))
        .sort((a, b) => a - b);
      const occupied = numbers.length ? numbers : [position];
      const topPosition = occupied[0] || position;
      if (topPosition !== position) continue;
      const poleCount = model.normalizePoleCount(Math.max(occupied.length, Number(channel?.poleCount || channel?.pole_count || circuit?.poles || 1) || 1));
      const finalOccupied = model.occupiedPositionsFor(positionSide(topPosition), topPosition, poleCount);
      finalOccupied.forEach((item) => used.add(item));
      const isSpare = /spare/i.test(circuitLabel(circuit)) || /spare/i.test(text(circuit?.breaker || circuit?.breakerSize));
      const connection = connectionForPoleCount(poleCount);
      const deviceId = `breaker-${topPosition}`;
      const authoritativeState = breakerStateFromSuppliedData(circuit || {});
      const diagnostic = diagnosticForChannel(channel);
      breakers.push({
        deviceId,
        circuitId: isSpare ? null : `circuit-${topPosition}`,
        panelSide: positionSide(topPosition),
        position: topPosition,
        row: model.rowForPosition(topPosition),
        occupiedPositions: finalOccupied,
        poleCount,
        ampRating: parseAmpRating(circuit?.breaker || circuit?.breakerSize || circuit?.amp || circuit?.amps || circuit?.amperage, 0),
        voltageRating: parseAmpRating(schedule.voltage, 0),
        state: authoritativeState || null,
        stateSupplied: Boolean(authoritativeState),
        connectionType: connection.connectionType,
        phaseAssignment: connection.phaseAssignment,
        manufacturer: "",
        modelNumber: "",
        label: circuitLabel(circuit) || (isSpare ? "SPARE" : ""),
        note: text(circuit?.notes),
        lastKnownHandlePosition: circuit?.lastKnownHandlePosition,
        occupancyType: isSpare ? "SPARE" : "BREAKER",
        telemetry: diagnostic,
        channel
      });
      if (!isSpare) {
        preparedCircuits.push({
          circuitId: `circuit-${topPosition}`,
          label: circuitLabel(circuit) || `Circuit ${topPosition}`,
          connectionType: connection.connectionType,
          phaseAssignment: connection.phaseAssignment,
          breakerId: deviceId,
          circuitVoltage: parseAmpRating(schedule.voltage, 0) || undefined,
          loads: circuitLabel(circuit) ? [{ loadId: `load-${topPosition}`, label: circuitLabel(circuit) }] : []
        });
      }
    }
    return { breakers, circuits: preparedCircuits, totalPositions };
  }

  function createExamplePanel() {
    const totalPositions = 24;
    const breakerInputs = [
      { position: 1, poleCount: 1, label: "Lighting", state: "ON", ampRating: 15, telemetry: { condition: "energized", physicalChannel: "DI1", timestamp: new Date().toISOString(), sourceType: "TEST" } },
      { position: 2, poleCount: 1, label: "Receptacles", state: "OFF", ampRating: 20 },
      { position: 3, poleCount: 2, label: "Unit heater", state: "TRIPPED", ampRating: 30, telemetry: { condition: "suspected-trip", physicalChannel: "DI2", advisory: true, timestamp: new Date().toISOString(), sourceType: "TEST" } },
      { position: 6, poleCount: 3, label: "Rooftop unit", state: "UNKNOWN", ampRating: 60, lastKnownHandlePosition: 0.42, telemetry: { condition: "monitoring-offline", physicalChannel: "DI3", communication: "COMMUNICATION_LOSS", timestamp: new Date().toISOString(), sourceType: "TEST" } },
      { position: 9, poleCount: 1, label: "SPARE", state: "OFF", ampRating: 20, occupancyType: "SPARE", circuitId: null },
      { position: 12, poleCount: 1, label: "Camera advisory", state: "ON", ampRating: 15, ai: true }
    ];
    const breakers = breakerInputs.map((input) => {
      const side = positionSide(input.position);
      const connection = connectionForPoleCount(input.poleCount);
      return {
        deviceId: `test-breaker-${input.position}`,
        circuitId: input.occupancyType === "SPARE" ? null : `test-circuit-${input.position}`,
        panelSide: side,
        position: input.position,
        row: model.rowForPosition(input.position),
        occupiedPositions: model.occupiedPositionsFor(side, input.position, input.poleCount),
        poleCount: input.poleCount,
        ampRating: input.ampRating,
        voltageRating: 600,
        state: input.state,
        stateSupplied: true,
        connectionType: connection.connectionType,
        phaseAssignment: connection.phaseAssignment,
        label: input.label,
        occupancyType: input.occupancyType || "BREAKER",
        telemetry: input.telemetry || null,
        lastKnownHandlePosition: input.lastKnownHandlePosition,
        aiAdvisory: Boolean(input.ai)
      };
    });
    return model.createPanel({
      panelId: "standard-test-panel",
      location: "Standard test panel",
      systemVoltage: "347/600 V",
      phaseWiring: "3φ 4W",
      wireCount: 4,
      totalPositions,
      branchHandleConvention: "TOWARD_CENTER",
      mainDevice: {
        deviceId: "test-main",
        type: "MAIN_BREAKER",
        ampRating: 200,
        poleCount: 3,
        state: "ON"
      },
      breakers,
      circuits: breakers.filter((breaker) => breaker.circuitId).map((breaker) => ({
        circuitId: breaker.circuitId,
        label: breaker.label,
        connectionType: breaker.connectionType,
        phaseAssignment: breaker.phaseAssignment,
        breakerId: breaker.deviceId
      })),
      aiObservations: [{
        observationId: "test-ai-1",
        sourceId: "camera-1",
        sourceType: "CAMERA",
        targetDeviceId: "test-breaker-12",
        observedState: "ON",
        confidence: 0.84,
        timestamp: new Date().toISOString(),
        promoted: false
      }],
      communication: { state: "ONLINE", sourceId: "test-monitor", timestamp: new Date().toISOString() }
    });
  }

  function createPreparedPanel(input = {}) {
    const schedule = input.schedule || {};
    const panelAsset = input.panel || {};
    if (input.useExample) return createExamplePanel();
    const built = buildBreakers(schedule, input.channels || []);
    const totalPositions = built.totalPositions || model.normalizeTotalPositions(schedule.circuitCount || 42);
    return model.createPanel({
      panelId: text(panelAsset.id) || "siteworks-panel",
      location: text(input.location?.name || panelAsset.location || ""),
      systemVoltage: systemVoltageFromSchedule(schedule, panelAsset),
      phaseWiring: phaseWiringFromSchedule(schedule, panelAsset),
      wireCount: inferWireCount(phaseWiringFromSchedule(schedule, panelAsset)),
      totalPositions,
      manufacturer: text(panelAsset.manufacturer),
      modelNumber: text(panelAsset.model || panelAsset.modelNumber),
      branchHandleConvention: "TOWARD_CENTER",
      mainDevice: {
        deviceId: `${text(panelAsset.id) || "panel"}-main`,
        type: "MAIN_BREAKER",
        ampRating: parseAmpRating(schedule.mainBreaker || panelAsset.mainBreaker, 0) || undefined,
        poleCount: 3,
        state: breakerStateFromSuppliedData(schedule.mainDevice || panelAsset.mainDevice) || null,
        stateSupplied: Boolean(breakerStateFromSuppliedData(schedule.mainDevice || panelAsset.mainDevice))
      },
      breakers: built.breakers,
      circuits: built.circuits,
      aiObservations: [],
      communication: input.device ? {
        state: text(input.device.onlineStatus || input.device.online_status || "unknown").toUpperCase(),
        sourceId: text(input.device.deviceUid || input.device.device_uid || input.device.id),
        timestamp: text(input.device.lastSeenAt || input.device.last_seen_at || input.device.updatedAt || input.device.updated_at)
      } : {}
    });
  }

  return {
    createExamplePanel,
    createPreparedPanel,
    diagnosticForChannel
  };
});
