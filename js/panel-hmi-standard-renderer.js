(function panelHmiStandardRendererFactory(root, factory) {
  const api = factory(root?.SiteWorksPanelHmiStandardModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SiteWorksPanelHmiRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : null, function createPanelHmiStandardRenderer(model) {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function stateClass(state, supplied) {
    if (!supplied) return "state-not-supplied";
    return `state-${String(state || "UNKNOWN").toLowerCase()}`;
  }

  function stateLabel(state, supplied) {
    if (!supplied) return "No physical state";
    return String(state || "UNKNOWN");
  }

  function stateBadgeLabel(state, supplied) {
    if (!supplied) return "NO STATE";
    return String(state || "UNKNOWN");
  }

  function telemetryTone(condition = "") {
    const value = String(condition || "").toLowerCase();
    if (value.includes("offline") || value.includes("communication")) return "info";
    if (value.includes("suspected") || value.includes("open") || value.includes("loss")) return "advisory";
    if (value.includes("energized")) return "normal";
    return "info";
  }

  function renderTelemetrySummary(breaker) {
    const telemetry = breaker.telemetry;
    const ai = breaker.aiAdvisory || false;
    const tone = telemetryTone(telemetry?.condition || telemetry?.communication || "");
    const primary = telemetry?.communication
      ? "COMM"
      : telemetry?.advisory
        ? "ADVISORY"
        : telemetry?.condition
          ? telemetry.condition
          : ai
            ? "AI"
            : "--";
    const parts = [
      telemetry?.condition ? `Condition: ${telemetry.condition}` : "",
      telemetry?.physicalChannel ? `Source: ${telemetry.physicalChannel}` : "",
      telemetry?.timestamp ? `Time: ${telemetry.timestamp}` : "",
      telemetry?.communication ? `Comm: ${telemetry.communication}` : "",
      ai ? "AI/camera advisory present" : ""
    ].filter(Boolean);
    return `
      <span class="standard-panel-meter is-${escapeAttribute(tone)}" title="${escapeAttribute(parts.join(" | ") || "No telemetry source")}" aria-label="${escapeAttribute(parts.join(" | ") || "No telemetry source")}">
        <b>${escapeHtml(primary)}</b>
        <small>${escapeHtml(telemetry?.physicalChannel || (ai ? "AI" : "--"))}</small>
      </span>
    `;
  }

  function renderHandle(panel, breaker, side) {
    const config = model.resolveHandleConfig(panel, breaker, side);
    const fraction = model.handleTravelFraction(breaker.state, config, breaker.lastKnownHandlePosition);
    const supplied = Boolean(breaker.stateSupplied);
    const state = supplied ? breaker.state : "";
    const style = config.orientation === "VERTICAL"
      ? `--handle-y:${100 - (fraction * 100)}%;--handle-x:50%;`
      : `--handle-x:${fraction * 100}%;--handle-y:50%;`;
    return `
      <span
        class="standard-breaker-handle ${config.orientation === "VERTICAL" ? "is-vertical" : "is-horizontal"} ${stateClass(state, supplied)}"
        style="${style}"
        aria-label="${escapeAttribute(stateLabel(state, supplied))} handle"
      >
        <i aria-hidden="true"></i>
      </span>
      ${supplied && state === "UNKNOWN" ? `<span class="standard-breaker-unknown-badge" aria-label="Unknown breaker state">?</span>` : ""}
    `;
  }

  function renderBreaker(panel, breaker) {
    const channelId = breaker.channel?.id || "";
    const circuitNumber = breaker.position || "";
    const supplied = Boolean(breaker.stateSupplied);
    const style = breaker.poleCount > 1 ? ` style="grid-row: span ${breaker.poleCount};"` : "";
    const status = stateLabel(breaker.state, supplied);
    const title = [
      `Position ${breaker.occupiedPositions.join("/")}`,
      breaker.label || "Unlabeled breaker",
      `State: ${status}`,
      breaker.telemetry?.condition ? `Telemetry: ${breaker.telemetry.condition}` : ""
    ].filter(Boolean).join(" | ");
    return `
      <button
        type="button"
        class="standard-breaker-body ${breaker.panelSide.toLowerCase()} ${stateClass(breaker.state, supplied)} ${breaker.poleCount > 1 ? "is-multipole" : ""} ${breaker.occupancyType === "SPARE" ? "is-spare" : ""}"
        data-monitoring-breaker-detail="${escapeAttribute(channelId)}"
        data-monitoring-breaker-circuit="${escapeAttribute(circuitNumber)}"
        data-panel-device-id="${escapeAttribute(breaker.deviceId)}"
        title="${escapeAttribute(title)}"
        ${style}
      >
        <span class="standard-breaker-position" aria-label="Panel position">
          ${breaker.occupiedPositions.map((position) => `<b>${escapeHtml(position)}</b>`).join("")}
        </span>
        <span class="standard-breaker-module">
          <span class="standard-breaker-screw top"></span>
          ${renderHandle(panel, breaker, breaker.panelSide)}
          <span class="standard-breaker-screw bottom"></span>
        </span>
        <span class="standard-breaker-label-plate">
          <strong>${escapeHtml(breaker.occupancyType === "SPARE" ? "SPARE" : breaker.label || "UNASSIGNED")}</strong>
          <small>${escapeHtml([breaker.ampRating ? `${breaker.ampRating}A` : "", breaker.poleCount > 1 ? `${breaker.poleCount}P` : "1P"].filter(Boolean).join(" | "))}</small>
        </span>
        <span class="standard-breaker-state-label">${escapeHtml(stateBadgeLabel(breaker.state, supplied))}</span>
        ${renderTelemetrySummary(breaker)}
      </button>
    `;
  }

  function renderSpace(position) {
    return `
      <div class="standard-panel-space ${position.side.toLowerCase()}" data-panel-position="${escapeAttribute(position.position)}">
        <span>${escapeHtml(position.position)}</span>
        <strong><b>SPACE</b><small>no device</small></strong>
      </div>
    `;
  }

  function renderColumn(panel, side) {
    const breakersByTop = new Map(panel.breakers
      .filter((breaker) => breaker.panelSide === side)
      .map((breaker) => [Number(breaker.position), breaker]));
    const occupiedNonTop = new Set();
    panel.breakers
      .filter((breaker) => breaker.panelSide === side)
      .forEach((breaker) => {
        breaker.occupiedPositions.slice(1).forEach((position) => occupiedNonTop.add(Number(position)));
      });
    const rows = Array.from({ length: panel.rowsPerSide }, (_, index) => {
      const positionNumber = model.topPositionForSideRow(side, index + 1);
      if (occupiedNonTop.has(positionNumber)) return "";
      const breaker = breakersByTop.get(positionNumber);
      if (breaker) return renderBreaker(panel, breaker);
      return renderSpace({ position: positionNumber, side });
    }).join("");
    return `<div class="standard-panel-column ${side.toLowerCase()}">${rows}</div>`;
  }

  function renderMainDevice(panel) {
    const main = panel.mainDevice || { deviceId: "main", type: "MAIN_BREAKER" };
    const supplied = Boolean(main.stateSupplied || main.state);
    const normalizedState = model.normalizeBreakerState(main.state);
    const mainForHandle = {
      ...main,
      state: normalizedState,
      stateSupplied: supplied && Boolean(normalizedState)
    };
    return `
      <section class="standard-panel-main-device ${stateClass(normalizedState, mainForHandle.stateSupplied)}" aria-label="Main device">
        <span>Main Device</span>
        <strong>${escapeHtml(main.type || "MAIN_BREAKER")}</strong>
        <small>${escapeHtml([main.ampRating ? `${main.ampRating}A` : "", main.poleCount ? `${main.poleCount}P` : ""].filter(Boolean).join(" | ") || "Rating not supplied")}</small>
        ${renderHandle(panel, mainForHandle, "CENTER")}
        <em>${escapeHtml(stateLabel(normalizedState, mainForHandle.stateSupplied))}</em>
      </section>
    `;
  }

  function renderComms(panel) {
    const comm = panel.communication || {};
    const state = comm.state || "NOT SUPPLIED";
    const title = [comm.sourceId, comm.timestamp].filter(Boolean).join(" | ");
    return `
      <div class="standard-panel-comm" title="${escapeAttribute(title)}">
        <span>Communication</span>
        <strong>${escapeHtml(state)}</strong>
      </div>
    `;
  }

  function renderLegend() {
    return `
      <div class="standard-panel-legend" aria-label="Panel HMI legend">
        <span class="legend-label">Legend</span>
        <span class="state-on">ON</span>
        <span class="state-off">OFF</span>
        <span class="state-tripped">TRIPPED</span>
        <span class="state-unknown">UNKNOWN</span>
        <span class="state-not-supplied">NO STATE</span>
        <span class="is-info">COMM</span>
        <span class="is-ai">AI</span>
        <span class="legend-note">Handle direction: left ON toward center, right ON toward center.</span>
      </div>
    `;
  }

  function render(panel) {
    if (!panel || !model) {
      return `<p class="muted">Panel HMI renderer is not available.</p>`;
    }
    const validation = Array.isArray(panel.validationIssues) && panel.validationIssues.length
      ? `<div class="standard-panel-validation">${panel.validationIssues.map((issue) => `<span>${escapeHtml(issue)}</span>`).join("")}</div>`
      : "";
    return `
      <section class="standard-panel-hmi" style="--standard-panel-rows:${escapeAttribute(panel.rowsPerSide)};" aria-label="Physical electrical panel view">
        <header class="standard-panel-header">
          <div>
            <span>SiteWorks Electrical Panel HMI</span>
            <strong>${escapeHtml(panel.panelId || "Panel")}</strong>
          </div>
          <div>
            <span>${escapeHtml(panel.systemVoltage || "Voltage not supplied")}</span>
            <strong>${escapeHtml(panel.phaseWiring || "Wiring not supplied")}</strong>
          </div>
          ${renderComms(panel)}
        </header>
        ${validation}
        <div class="standard-panel-cabinet">
          <div class="standard-panel-nameplate">
            <strong>${escapeHtml(panel.location || panel.panelId || "Electrical Panel")}</strong>
            <span>${escapeHtml(`${panel.totalPositions} positions | ${panel.rowsPerSide} rows`)}</span>
          </div>
          <div class="standard-panel-physical-grid">
            <div class="standard-panel-section-label left">LEFT ODD CIRCUITS</div>
            <div class="standard-panel-section-label center">MAIN / SERVICE</div>
            <div class="standard-panel-section-label right">RIGHT EVEN CIRCUITS</div>
            ${renderColumn(panel, "LEFT")}
            <div class="standard-panel-center-bus">
              ${renderMainDevice(panel)}
              <div class="standard-panel-equipment-plate">
                <strong>SiteWorks Panel Monitor</strong>
                <span>${escapeHtml(panel.systemVoltage || "Voltage not supplied")}</span>
                <span>${escapeHtml(panel.phaseWiring || "Wiring not supplied")}</span>
                <small>Monitoring only. Breaker control disabled.</small>
              </div>
              <div class="standard-panel-phase-labels"><b>A</b><b>B</b><b>C</b></div>
              <div class="standard-panel-note">Physical view. Telemetry and AI are overlays only.</div>
            </div>
            ${renderColumn(panel, "RIGHT")}
          </div>
        </div>
        ${renderLegend()}
      </section>
    `;
  }

  return { render };
});
