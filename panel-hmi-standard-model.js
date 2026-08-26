(function panelHmiStandardModelFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SiteWorksPanelHmiStandardModel = api;
})(typeof globalThis !== "undefined" ? globalThis : null, function createPanelHmiStandardModel() {
  const BREAKER_STATES = new Set(["ON", "OFF", "TRIPPED", "UNKNOWN"]);
  const PANEL_SIDES = new Set(["LEFT", "RIGHT"]);

  const DEFAULT_HANDLE_CONFIGS = {
    leftSide: {
      orientation: "HORIZONTAL",
      hingeSide: "CENTER",
      onDirection: "RIGHT",
      offDirection: "LEFT",
      onAngle: 0,
      offAngle: 0,
      trippedPosition: 0.5,
      note: "Default left branch handle; replace with manufacturer geometry when verified."
    },
    rightSide: {
      orientation: "HORIZONTAL",
      hingeSide: "CENTER",
      onDirection: "LEFT",
      offDirection: "RIGHT",
      onAngle: 0,
      offAngle: 0,
      trippedPosition: 0.5,
      note: "Default right branch handle; replace with manufacturer geometry when verified."
    },
    center: {
      orientation: "VERTICAL",
      hingeSide: "CENTER",
      onDirection: "UP",
      offDirection: "DOWN",
      onAngle: 0,
      offAngle: 0,
      trippedPosition: 0.5,
      note: "Default main-device handle; replace with manufacturer geometry when verified."
    }
  };

  function clamp(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
  }

  function normalizePoleCount(value) {
    return Math.max(1, Math.min(3, Number(value) || 1));
  }

  function normalizeTotalPositions(value) {
    const number = Math.max(2, Math.min(200, Number(value) || 42));
    return number % 2 === 0 ? number : number + 1;
  }

  function sideForPosition(position) {
    return Number(position) % 2 === 0 ? "RIGHT" : "LEFT";
  }

  function rowForPosition(position) {
    return Math.ceil(Number(position) / 2);
  }

  function topPositionForSideRow(side, row) {
    const normalizedSide = String(side || "").toUpperCase() === "RIGHT" ? "RIGHT" : "LEFT";
    return normalizedSide === "LEFT" ? (Number(row) * 2) - 1 : Number(row) * 2;
  }

  function occupiedPositionsFor(side, position, poleCount) {
    const count = normalizePoleCount(poleCount);
    const normalizedSide = PANEL_SIDES.has(side) ? side : sideForPosition(position);
    const row = rowForPosition(position);
    return Array.from({ length: count }, (_, index) => topPositionForSideRow(normalizedSide, row + index));
  }

  function createPositions(totalPositions, breakers) {
    const count = normalizeTotalPositions(totalPositions);
    const byPosition = new Map();
    (breakers || []).forEach((breaker) => {
      (breaker.occupiedPositions || []).forEach((position) => {
        byPosition.set(Number(position), breaker.deviceId);
      });
    });
    return Array.from({ length: count }, (_, index) => {
      const position = index + 1;
      return {
        position,
        side: sideForPosition(position),
        row: rowForPosition(position),
        occupied: byPosition.has(position),
        deviceId: byPosition.get(position) || null
      };
    });
  }

  function normalizeBreakerState(value) {
    const state = String(value || "").trim().toUpperCase();
    return BREAKER_STATES.has(state) ? state : null;
  }

  function resolveHandleConfig(panel, breakerOrMain, side) {
    const supplied = breakerOrMain?.handleConfig;
    if (supplied && typeof supplied === "object") {
      return {
        ...supplied,
        trippedPosition: clamp(supplied.trippedPosition ?? 0.5, 0, 1)
      };
    }
    const defaults = panel?.handleDefaults || DEFAULT_HANDLE_CONFIGS;
    if (side === "LEFT") return defaults.leftSide || DEFAULT_HANDLE_CONFIGS.leftSide;
    if (side === "RIGHT") return defaults.rightSide || DEFAULT_HANDLE_CONFIGS.rightSide;
    return defaults.center || DEFAULT_HANDLE_CONFIGS.center;
  }

  function handleTravelFraction(state, handleConfig, lastKnownHandlePosition) {
    if (state === "ON") return 1;
    if (state === "OFF") return 0;
    if (state === "TRIPPED") return clamp(handleConfig?.trippedPosition ?? 0.5, 0, 1);
    if (state === "UNKNOWN" && lastKnownHandlePosition !== undefined && lastKnownHandlePosition !== null) {
      return clamp(lastKnownHandlePosition, 0, 1);
    }
    return 0.5;
  }

  function validatePanel(panel) {
    const issues = [];
    const totalPositions = normalizeTotalPositions(panel?.totalPositions);
    if (totalPositions !== Number(panel?.totalPositions)) issues.push("totalPositions must be even.");
    if (Number(panel?.rowsPerSide) !== totalPositions / 2) issues.push("rowsPerSide must equal totalPositions / 2.");
    const seen = new Map();
    (panel?.breakers || []).forEach((breaker) => {
      if (!breaker.deviceId) issues.push("Breaker missing deviceId.");
      if (!PANEL_SIDES.has(breaker.panelSide)) issues.push(`${breaker.deviceId || "Breaker"} has invalid panelSide.`);
      const expectedSide = sideForPosition(breaker.position);
      if (expectedSide !== breaker.panelSide) issues.push(`${breaker.deviceId || "Breaker"} position does not match side.`);
      (breaker.occupiedPositions || []).forEach((position) => {
        if (sideForPosition(position) !== breaker.panelSide) issues.push(`${breaker.deviceId || "Breaker"} occupies mixed sides.`);
        if (seen.has(position) && seen.get(position) !== breaker.deviceId) issues.push(`Position ${position} occupied by multiple breakers.`);
        seen.set(position, breaker.deviceId);
      });
    });
    return issues;
  }

  function createPanel(input) {
    const totalPositions = normalizeTotalPositions(input?.totalPositions);
    const panel = {
      panelId: input?.panelId || "panel-hmi",
      location: input?.location || "",
      systemVoltage: input?.systemVoltage || "Not supplied",
      phaseWiring: input?.phaseWiring || "Not supplied",
      wireCount: Number(input?.wireCount || 0) || 0,
      wireNote: input?.wireNote || "",
      totalPositions,
      rowsPerSide: totalPositions / 2,
      manufacturer: input?.manufacturer || "",
      modelNumber: input?.modelNumber || "",
      branchHandleConvention: input?.branchHandleConvention || "TOWARD_CENTER",
      handleDefaults: input?.handleDefaults || DEFAULT_HANDLE_CONFIGS,
      mainDevice: input?.mainDevice || { deviceId: "main", type: "MAIN_BREAKER" },
      breakers: input?.breakers || [],
      positions: [],
      circuits: input?.circuits || [],
      aiObservations: input?.aiObservations || [],
      telemetry: input?.telemetry || {},
      communication: input?.communication || {},
      diagnostics: input?.diagnostics || []
    };
    panel.positions = createPositions(totalPositions, panel.breakers);
    panel.validationIssues = validatePanel(panel);
    return panel;
  }

  return {
    BREAKER_STATES: [...BREAKER_STATES],
    DEFAULT_HANDLE_CONFIGS,
    createPanel,
    createPositions,
    handleTravelFraction,
    normalizeBreakerState,
    normalizePoleCount,
    normalizeTotalPositions,
    occupiedPositionsFor,
    resolveHandleConfig,
    rowForPosition,
    sideForPosition,
    topPositionForSideRow,
    validatePanel
  };
});
