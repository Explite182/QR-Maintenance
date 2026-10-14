(function () {
  "use strict";

  const state = { enabled: false, active: null, entries: [], selectedWorkOrderId: "", busy: false, bootstrappedUserId: "", initializing: false };
  let elapsedTimer = null;
  const expandedEntries = new Set();

  const bridge = () => window.siteworksTimeTrackingBridge;
  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);

  function eventId(action) {
    return `${action}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
  }

  function formatElapsed(seconds) {
    const value = Math.max(0, Number(seconds || 0));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const remaining = Math.floor(value % 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  }

  function elapsedSeconds(entry) {
    if (!entry?.startAt) return 0;
    const end = entry.endAt ? new Date(entry.endAt).getTime() : Date.now();
    return Math.max(0, Math.floor((end - new Date(entry.startAt).getTime()) / 1000));
  }

  function verificationLabel(status, deviceLocationCaptured = false) {
    if (status === "LOCATION_UNAVAILABLE" && deviceLocationCaptured) return "GPS captured; site not verified";
    return ({ VERIFIED:"Verified",LOW_ACCURACY:"Low accuracy",LOCATION_DENIED:"Location denied",OUTSIDE_GEOFENCE:"Outside geofence",
      LOCATION_UNAVAILABLE:"Device location unavailable",LOCATION_TIMEOUT:"Device location timed out",
      SITE_COORDINATES_NOT_CONFIGURED:"Site coordinates not configured",OFFLINE_PENDING_VERIFICATION:"Pending verification" })[status] || "Unavailable";
  }

  async function api(path, options = {}) {
    const response = await bridge().apiFetch(path, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || payload.detail || "Time Tracking request failed.");
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function captureLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({ error: "UNAVAILABLE" });
      try {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude:position.coords.latitude, longitude:position.coords.longitude, accuracy:position.coords.accuracy,
          capturedAt: new Date(position.timestamp || Date.now()).toISOString() }),
        (error) => resolve({ error:error.code === 1 ? "DENIED" : error.code === 3 ? "TIMEOUT" : "UNAVAILABLE" }),
        { enableHighAccuracy:true, timeout:12000, maximumAge:30000 }
      );
      } catch (_) { resolve({ error: "UNAVAILABLE" }); }
    });
  }

  function setBusy(busy, message = "") {
    state.busy = busy;
    const status = byId("timeTrackingStatus");
    if (status) status.textContent = message;
    document.querySelectorAll("[data-time-start],[data-time-stop]").forEach((button) => { button.disabled = busy; });
  }

  async function refreshData() {
    if (!state.enabled) return;
    const [activeData, entryData] = await Promise.all([api("/api/time/active"), api("/api/time/entries")]);
    state.active = activeData.active || null;
    state.entries = entryData.entries || [];
    renderView();
  }

  function renderGpsDetail(entry, phase) {
    const gps = entry[`${phase}Gps`];
    const at = phase === "start" ? entry.startAt : entry.endAt;
    const captured = gps && typeof gps.latitude === "number" && typeof gps.longitude === "number"
      && Number.isFinite(gps.latitude) && Math.abs(gps.latitude) <= 90
      && Number.isFinite(gps.longitude) && Math.abs(gps.longitude) <= 180;
    const label = phase === "start" ? "Start" : "Stop";
    if (!at) return `<section><h4>${label}</h4><p>Timer has not stopped yet.</p></section>`;
    const status = verificationLabel(entry[phase === "start" ? "startVerification" : "stopVerification"], entry[`${phase}DeviceLocationCaptured`]);
    const accuracy = typeof gps?.accuracy === "number" && Number.isFinite(gps.accuracy) && gps.accuracy >= 0 ? `${Math.round(gps.accuracy)} m` : "Not recorded";
    return `<section><h4>${label}</h4><dl>
      <div><dt>Time</dt><dd>${escapeHtml(new Date(at).toLocaleString())}</dd></div>
      <div><dt>Verification</dt><dd>${escapeHtml(status)}</dd></div>
      <div><dt>GPS accuracy</dt><dd>${escapeHtml(accuracy)}</dd></div>
      ${captured ? `<div><dt>Coordinates</dt><dd>${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}</dd></div>` : ""}</dl>
      ${captured ? `<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(`${gps.latitude},${gps.longitude}`)}" target="_blank" rel="noopener noreferrer">View ${label} on Map</a>` : "<p>No saved device coordinates for this reading.</p>"}</section>`;
  }

  function renderEntry(entry) {
    return `<details class="time-entry-details" data-time-entry="${escapeHtml(entry.id)}"${expandedEntries.has(String(entry.id)) ? " open" : ""}><summary class="time-entry-row">
      <div><strong>${escapeHtml(entry.workOrderNumber)} · ${escapeHtml(entry.jobTitle || "Job")}</strong>
      <span>${escapeHtml(entry.customer)} · ${escapeHtml(entry.location)}</span></div>
      <div><strong>${formatElapsed(entry.durationSeconds)}</strong><span>Start GPS: ${escapeHtml(verificationLabel(entry.startVerification, entry.startDeviceLocationCaptured))}<br>Stop GPS: ${escapeHtml(verificationLabel(entry.stopVerification, entry.stopDeviceLocationCaptured))}</span></div>
    </summary><div class="time-entry-gps">${renderGpsDetail(entry, "start")}${renderGpsDetail(entry, "stop")}</div></details>`;
  }

  function renderView() {
    const panel = byId("timeTrackingPanel");
    const nav = document.querySelector("[data-open-target='timeTrackingPanel']");
    const indicator = byId("currentTimerIndicator");
    if (panel) panel.classList.toggle("hidden", !state.enabled);
    if (nav) nav.classList.toggle("hidden", !state.enabled);
    if (indicator) indicator.classList.toggle("hidden", !state.enabled || !state.active);
    if (!state.enabled) return;
    const active = state.active;
    const card = byId("currentTimeCard");
    if (indicator && active) {
      indicator.innerHTML = `<span>CURRENT JOB</span><strong>${escapeHtml(active.workOrderNumber)}</strong><span data-time-elapsed>${formatElapsed(elapsedSeconds(active))}</span>`;
    }
    if (card) card.innerHTML = active ? `<div class="time-current-heading"><span>CURRENT JOB</span><strong>${escapeHtml(active.workOrderNumber)}</strong></div>
      <h3>${escapeHtml(active.customer || active.jobTitle)}</h3><p>${escapeHtml(active.location)}</p>
      <dl><div><dt>Started</dt><dd>${new Date(active.startAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}</dd></div>
      <div><dt>Elapsed</dt><dd data-time-elapsed>${formatElapsed(elapsedSeconds(active))}</dd></div>
      <div><dt>GPS verification</dt><dd>${escapeHtml(verificationLabel(active.startVerification, active.startDeviceLocationCaptured))}</dd></div></dl>
      <button class="primary time-end-button" type="button" data-time-stop>End Job</button>`
      : `<div class="time-empty"><strong>No active job timer</strong><span>Open an eligible job and select Start Timer.</span></div>`;
    const list = byId("timeEntryList");
    if (list) list.innerHTML = state.entries.length ? state.entries.map(renderEntry).join("") : `<p class="muted">No saved time entries yet.</p>`;
    window.clearInterval(elapsedTimer);
    elapsedTimer = active ? window.setInterval(() => {
      document.querySelectorAll("[data-time-elapsed]").forEach((node) => { node.textContent = formatElapsed(elapsedSeconds(state.active)); });
    }, 1000) : null;
  }

  async function startOrSwitch(workOrderId) {
    if (state.busy) return;
    if (state.active && String(state.active.workOrderId) === String(workOrderId)) {
      openPanel(); return;
    }
    const switching = Boolean(state.active);
    if (switching && !window.confirm(`You are currently working on ${state.active.workOrderNumber}.\n\nEnd that job and start the selected job?`)) return;
    setBusy(true, "Checking your location...");
    try {
      const location = await captureLocation();
      const payload = { workOrderId, clientEventId:eventId(switching ? "switch" : "start"), deviceEventAt:new Date().toISOString(), location };
      const result = await api(switching ? "/api/time/switch" : "/api/time/start", { method:"POST", body:JSON.stringify(payload) });
      state.active = result.active;
      if (result.warning) window.alert(result.warning);
      await refreshData(); openPanel();
    } catch (error) {
      window.alert(error.message);
    } finally { setBusy(false); }
  }

  async function stop() {
    if (state.busy || !state.active) return;
    setBusy(true, "Checking your location...");
    try {
      const location = await captureLocation();
      const result = await api("/api/time/stop", { method:"POST", body:JSON.stringify({ clientEventId:eventId("stop"), deviceEventAt:new Date().toISOString(), location }) });
      if (result.warning) window.alert(result.warning);
      state.active = null; await refreshData();
    } catch (error) { window.alert(error.message); }
    finally { setBusy(false); }
  }

  function openPanel() {
    if (!state.enabled) return;
    bridge().openPanel("timeTrackingPanel");
    byId("timeTrackingPanel")?.scrollIntoView({ behavior:"smooth", block:"start" });
  }

  async function openSiteGps(id) {
    if (bridge()?.getCurrentUser()?.role !== "Admin") return;
    try {
      const result = await api(`/api/time/sites/${encodeURIComponent(id)}`);
      byId("timeSiteGpsDialog")?.remove();
      const dialog = document.createElement("dialog");
      dialog.id = "timeSiteGpsDialog";
      dialog.className = "time-site-gps-dialog";
      const settings = result.settings || {};
      dialog.innerHTML = `<form class="stack"><h3 id="timeSiteGpsTitle">Site GPS: ${escapeHtml(result.locationName)}</h3>
        <label>Latitude<input name="latitude" type="number" step="any" min="-90" max="90" required value="${escapeHtml(settings.latitude ?? "")}"></label>
        <label>Longitude<input name="longitude" type="number" step="any" min="-180" max="180" required value="${escapeHtml(settings.longitude ?? "")}"></label>
        <label>Allowed distance (metres)<input name="radiusM" type="number" step="1" min="10" max="10000" required value="${escapeHtml(settings.geofence_radius_m ?? 100)}"></label>
        <button type="button" class="secondary" data-site-current>Use my current location</button>
        <p role="status" aria-live="polite"></p><div class="record-actions"><button type="submit" class="primary">Save GPS</button>
        <button type="button" class="secondary" data-site-close>Cancel</button></div></form>`;
      dialog.setAttribute("aria-labelledby", "timeSiteGpsTitle");
      document.body.append(dialog);
      const form = dialog.querySelector("form");
      const message = dialog.querySelector("[role=status]");
      let busy = false;
      const setControls = value => {
        busy = value;
        form.querySelectorAll("input,button").forEach(control => { control.disabled = value; });
      };
      dialog.querySelector("[data-site-close]").onclick = () => dialog.close();
      dialog.addEventListener("close", () => dialog.remove(), {once:true});
      dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
      dialog.querySelector("[data-site-current]").onclick = async () => {
        if (!window.confirm(`Are you physically at ${result.locationName}? Only use your current location while at this site.`)) return;
        setControls(true); message.textContent = "Getting your location...";
        try {
          const gps = await captureLocation();
          if (gps.error) { message.textContent = gps.error === "TIMEOUT" ? "Your phone took too long to return a location. Please try again." : "Your device location is unavailable. Try again or enter the site coordinates."; return; }
          if (!Number.isFinite(gps.latitude) || !Number.isFinite(gps.longitude)) { message.textContent = "No valid device coordinates returned. Please try again."; return; }
          form.elements.latitude.value = gps.latitude;
          form.elements.longitude.value = gps.longitude;
          message.textContent = `Location captured. GPS accuracy: ${Number.isFinite(gps.accuracy) ? `${Math.round(gps.accuracy)} metres` : "unknown"}. Review before saving.`;
        } finally { setControls(false); }
      };
      form.onsubmit = async event => {
        event.preventDefault(); if (busy || !form.reportValidity()) return;
        const body = {latitude:form.elements.latitude.value,longitude:form.elements.longitude.value,radiusM:form.elements.radiusM.value};
        setControls(true); message.textContent = "Saving site GPS...";
        try {
          await api(`/api/time/sites/${encodeURIComponent(id)}`, {method:"PUT",body:JSON.stringify(body)});
          dialog.close(); window.alert("Site GPS saved. Future timer starts and stops will use these coordinates.");
        } catch (error) { message.textContent = error.message; }
        finally { setControls(false); }
      };
      dialog.showModal();
    } catch (error) { window.alert(error.message); }
  }

  async function initialize() {
    if (!bridge()) return;
    const userId = String(bridge().getCurrentUser()?.id || "");
    if (!userId) { state.enabled=false; state.active=null; state.bootstrappedUserId=""; renderView(); return; }
    if (state.initializing || state.bootstrappedUserId === userId) return;
    state.initializing = true;
    try {
      const bootstrap = await api("/api/time/bootstrap");
      state.bootstrappedUserId = userId;
      state.enabled = bootstrap.enabled === true;
      renderView();
      bridge().renderApp();
      if (state.enabled) await refreshData();
    } catch (error) {
      state.enabled = false; renderView();
      console.warn("Time Tracking is unavailable.", error.message);
    } finally { state.initializing = false; }
  }

  function refreshFromApp() {
    const userId = String(bridge()?.getCurrentUser()?.id || "");
    if (!userId) { state.enabled=false; state.active=null; state.bootstrappedUserId=""; }
    renderView();
    if (userId && state.bootstrappedUserId !== userId) queueMicrotask(initialize);
  }

  document.addEventListener("click", (event) => {
    const siteButton = event.target.closest("[data-time-site]");
    if (siteButton) { event.preventDefault(); openSiteGps(siteButton.dataset.timeSite); return; }
    const startButton = event.target.closest("[data-time-start]");
    if (startButton) { event.preventDefault(); startOrSwitch(startButton.dataset.timeStart); return; }
    if (event.target.closest("[data-time-stop]")) { event.preventDefault(); stop(); return; }
    if (event.target.closest("#currentTimerIndicator")) { event.preventDefault(); openPanel(); }
  });
  document.addEventListener("toggle", (event) => {
    if (!event.target.matches?.("details[data-time-entry]")) return;
    const id = event.target.dataset.timeEntry;
    if (event.target.open) expandedEntries.add(id); else expandedEntries.delete(id);
  }, true);

  window.SiteWorksTimeTracking = {
    siteSettingsAction(id) {
      return state.enabled && bridge()?.getCurrentUser()?.role === "Admin"
        ? `<button type="button" class="secondary mini" data-time-site="${escapeHtml(id)}">Site GPS</button>` : "";
    },
    workOrderAction(item) {
      if (!state.enabled || !bridge()?.canWorkOnTicket(item) || ["Closed","Resolved"].includes(item.status)) return "";
      const activeHere = String(state.active?.workOrderId || "") === String(item.id);
      return `<button class="primary mini" type="button" data-time-start="${escapeHtml(item.id)}">${activeHere ? "View Timer" : "Start Timer"}</button>`;
    },
    refreshView: refreshFromApp,
    initialize
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once:true }); else initialize();
})();
