(function () {
  "use strict";

  const state = { enabled: false, active: null, entries: [], selectedWorkOrderId: "", busy: false, bootstrappedUserId: "", initializing: false };
  let elapsedTimer = null;

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

  function verificationLabel(status) {
    return ({ VERIFIED:"Verified",LOW_ACCURACY:"Low accuracy",LOCATION_DENIED:"Location denied",OUTSIDE_GEOFENCE:"Outside geofence",
      LOCATION_UNAVAILABLE:"Location unavailable",OFFLINE_PENDING_VERIFICATION:"Pending verification" })[status] || "Unavailable";
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
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude:position.coords.latitude, longitude:position.coords.longitude, accuracy:position.coords.accuracy }),
        (error) => resolve({ error:error.code === error.PERMISSION_DENIED ? "DENIED" : "UNAVAILABLE" }),
        { enableHighAccuracy:true, timeout:12000, maximumAge:30000 }
      );
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

  function renderEntry(entry) {
    return `<article class="time-entry-row">
      <div><strong>${escapeHtml(entry.workOrderNumber)} · ${escapeHtml(entry.jobTitle || "Job")}</strong>
      <span>${escapeHtml(entry.customer)} · ${escapeHtml(entry.location)}</span></div>
      <div><strong>${formatElapsed(entry.durationSeconds)}</strong><span>${escapeHtml(verificationLabel(entry.startVerification))} / ${escapeHtml(verificationLabel(entry.stopVerification))}</span></div>
    </article>`;
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
      <div><dt>Location</dt><dd>${escapeHtml(verificationLabel(active.startVerification))}</dd></div></dl>
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
      await api("/api/time/stop", { method:"POST", body:JSON.stringify({ clientEventId:eventId("stop"), deviceEventAt:new Date().toISOString(), location }) });
      state.active = null; await refreshData();
    } catch (error) { window.alert(error.message); }
    finally { setBusy(false); }
  }

  function openPanel() {
    if (!state.enabled) return;
    bridge().openPanel("timeTrackingPanel");
    byId("timeTrackingPanel")?.scrollIntoView({ behavior:"smooth", block:"start" });
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
    const startButton = event.target.closest("[data-time-start]");
    if (startButton) { event.preventDefault(); startOrSwitch(startButton.dataset.timeStart); return; }
    if (event.target.closest("[data-time-stop]")) { event.preventDefault(); stop(); return; }
    if (event.target.closest("#currentTimerIndicator")) { event.preventDefault(); openPanel(); }
  });

  window.SiteWorksTimeTracking = {
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
