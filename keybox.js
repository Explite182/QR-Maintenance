/* SiteWorks Keybox module version: 20260809-keybox-events-21 */
(function initSiteWorksKeybox(window) {
  "use strict";

  const KEYBOX_PAGE_SIZE = 24;
  const KEY_VERIFICATION_DUE_MS = 24 * 60 * 60 * 1000;

  function renderKeyCabinet(keys = [], env = {}) {
    const pageCount = Math.max(1, Math.ceil(keys.length / KEYBOX_PAGE_SIZE));
    const focusedKeyId = env.focusedKeyId || "";
    const focusedKeyIndex = focusedKeyId ? keys.findIndex((key) => key.id === focusedKeyId) : -1;
    let page = Number(env.getPage?.() || 0);
    if (focusedKeyIndex >= 0) page = Math.floor(focusedKeyIndex / KEYBOX_PAGE_SIZE);
    page = Math.min(Math.max(page, 0), pageCount - 1);
    env.setPage?.(page);

    const pageStart = page * KEYBOX_PAGE_SIZE;
    const pageKeys = keys.slice(pageStart, pageStart + KEYBOX_PAGE_SIZE);
    const slots = Array.from({ length: KEYBOX_PAGE_SIZE }, (_, index) => renderKeyCabinetSlot(pageKeys[index], pageStart + index, env));
    const focusedKey = focusedKeyIndex >= pageStart && focusedKeyIndex < pageStart + KEYBOX_PAGE_SIZE ? keys[focusedKeyIndex] : null;
    const availableCount = keys.filter((key) => getKeyCabinetStatus(key, env.isKeyCheckedOut(key), env.isKeyOverdue(key), env) === "available").length;
    const checkedOutCount = keys.filter((key) => env.isKeyCheckedOut(key)).length;
    const overdueCount = keys.filter((key) => env.isKeyOverdue(key)).length;
    const verifyOverdueCount = keys.filter((key) => isKeyVerificationOverdue(key, env)).length;
    const cabinetTabs = pageCount > 1
      ? `<div class="key-cabinet-tabs" role="tablist" aria-label="Key cabinet pages">
          ${Array.from({ length: pageCount }, (_, tabPage) => `
            <button type="button" class="${tabPage === page ? "is-active" : ""}" data-key-cabinet-page="${tabPage}" role="tab" aria-selected="${tabPage === page ? "true" : "false"}">
              Cabinet ${tabPage + 1}
            </button>
          `).join("")}
        </div>`
      : "";

    return `
      <section class="key-cabinet" aria-label="Key control center">
        <div class="key-cabinet-frame">
          <div class="key-cabinet-title">
            <strong>SITEWORKS</strong>
            <span>Key Control Center</span>
            <small class="key-cabinet-location-plate">${env.escapeHtml(getKeyCabinetScopeLabel(keys, env))}</small>
          </div>
          ${cabinetTabs}
          <div class="key-cabinet-board">
            <div class="key-cabinet-slots">
              ${slots.join("")}
            </div>
            <aside class="key-cabinet-side">
              <div class="key-cabinet-plate">
                <strong>Key Control</strong>
                <span>Sign out key</span>
                <span>Return key</span>
                <span>Verify key location</span>
                <span>Report missing keys</span>
              </div>
              <div class="key-cabinet-plate key-cabinet-counts">
                <strong>Status</strong>
                <span><b>${availableCount}</b> available</span>
                <span><b>${checkedOutCount}</b> checked out</span>
                <span><b>${overdueCount}</b> overdue</span>
                ${verifyOverdueCount ? `<span><b>${verifyOverdueCount}</b> need verify</span>` : ""}
                ${pageCount > 1 ? `<span><b>${page + 1}</b> of ${pageCount} cabinets</span>` : ""}
                <div class="key-status-legend" aria-label="Key status legend">
                  <span><i class="status-dot available"></i>Available: in cabinet and current</span>
                  <span><i class="status-dot out"></i>Checked out: assigned to a user</span>
                  <span><i class="status-dot overdue"></i>Overdue: not returned on time</span>
                  <span><i class="status-dot verify"></i>Needs verify: returned, confirm location</span>
                  <span><i class="status-dot unverified"></i>Unverified: no confirmed tag/location</span>
                </div>
              </div>
            </aside>
          </div>
          ${renderKeyCabinetDrawer(focusedKey, env)}
        </div>
      </section>
    `;
  }

  function getKeyCabinetScopeLabel(keys = [], env = {}) {
    const selectedCustomer = env.selectedCustomerId && env.selectedCustomerId !== env.ALL_CUSTOMERS
      ? env.getCustomer(env.selectedCustomerId)
      : null;
    const selectedLocation = env.selectedLocationId && env.selectedLocationId !== env.ALL_LOCATIONS
      ? env.getLocation(env.selectedLocationId)
      : null;
    if (selectedCustomer && selectedLocation) return `${selectedCustomer.name} | ${selectedLocation.name}`;
    if (selectedCustomer && env.selectedLocationId === env.ALL_LOCATIONS) return `${selectedCustomer.name} | All locations`;
    const firstKey = keys.find(Boolean);
    const keyCustomer = firstKey ? env.getCustomer(firstKey.customerId) : null;
    const keyLocation = firstKey ? env.getLocation(firstKey.locationId) : null;
    return [keyCustomer?.name, keyLocation?.name].filter(Boolean).join(" | ") || "All key locations";
  }

  function renderKeyCabinetSlot(key, index, env = {}) {
    const slotNumber = key?.keyNumber || String(index + 1);
    const label = key ? key.keyName || key.name || "Key" : "+ Add Key";
    const customer = key ? env.getCustomer(key.customerId) : null;
    const locationRecord = key ? env.getLocation(key.locationId) : null;
    const checkedOut = key ? env.isKeyCheckedOut(key) : false;
    const overdue = key ? env.isKeyOverdue(key) : false;
    const status = key ? getKeyCabinetStatus(key, checkedOut, overdue, env) : "empty";
    const statusText = key ? siteKeyCabinetStatusLabel(status) : "Add Key";
    const holder = checkedOut ? key.currentHolderName || "Unknown holder" : key?.storageLocation || "Cabinet";
    const slotContext = key ? locationRecord?.name || customer?.name || "Unassigned" : "Empty slot";
    const lastVerified = key ? getKeyCabinetLastVerifiedLabel(key, env) : "";
    const verificationDue = key ? getKeyVerificationOverdueLabel(key, env) : "";
    const lastUser = key ? getKeyCabinetLastUserLabel(key, checkedOut, env) : "";
    const lastUserLine = key ? `Last user: ${lastUser || "No history yet"}` : "Last user: No history yet";
    const verifiedLine = verificationDue || lastVerified || "Last verified: No history yet";
    const titleParts = key
      ? [`Slot ${slotNumber} - ${label}`, `Status: ${statusText}`, checkedOut ? `With: ${holder}` : lastUser ? `Last user: ${lastUser}` : "", verificationDue || lastVerified]
      : [`Slot ${slotNumber} - Add Key`, "Empty key slot"];
    const title = titleParts.filter(Boolean).join(" | ");
    const selectedClass = key?.id && key.id === env.focusedKeyId ? " key-cabinet-slot-selected" : "";
    return `
      <button type="button" class="key-cabinet-slot key-cabinet-slot-${status}${selectedClass}" ${key ? `data-key-cabinet-slot="${env.escapeAttribute(key.id)}"` : env.canManageKeys() ? "data-open-key-form" : "disabled"} title="${env.escapeAttribute(title)}">
        <span class="key-cabinet-label">
          <b>${env.escapeHtml(slotNumber)}</b>
          <span>${env.escapeHtml(label)}</span>
          <i class="key-cabinet-status" aria-label="${env.escapeAttribute(statusText)}" title="${env.escapeAttribute(statusText)}"></i>
        </span>
        <span class="key-cabinet-hook" aria-hidden="true"></span>
        ${key && !checkedOut ? `<span class="key-cabinet-keyring" aria-hidden="true"><i></i><i></i><i></i></span>` : ""}
        <small>
          <span>${env.escapeHtml(lastUserLine)}</span>
          <span>${env.escapeHtml(verifiedLine)}</span>
        </small>
      </button>
    `;
  }

  function renderKeyCabinetDrawer(key, env = {}) {
    if (!key) {
      return `
        <div class="key-cabinet-drawer key-cabinet-drawer-empty">
          <div>
            <strong>Key Details</strong>
            <p>Tap a key slot to see checkout, return, NFC, QR, and notes here.</p>
          </div>
        </div>
      `;
    }
    const customer = env.getCustomer(key.customerId);
    const locationRecord = env.getLocation(key.locationId);
    const checkedOut = env.isKeyCheckedOut(key);
    const overdue = env.isKeyOverdue(key);
    const status = getKeyCabinetStatus(key, checkedOut, overdue, env);
    const statusText = siteKeyCabinetStatusLabel(status);
    const verificationDue = getKeyVerificationOverdueLabel(key, env);
    const latestCheckout = getLatestKeyLogForAction(key, "Check-Out", env);
    const latestReturn = getLatestKeyLogForAction(key, "Check-In", env);
    const latestVerified = getLatestKeyLogForAction(key, "NFC Verify", env) || getLatestKeyLogForAction(key, "Verify", env);
    const tagUids = env.getAllKeyTagUids(key);
    const keyUrl = env.getKeyUrl(key);
    const locationLabel = [customer?.name, locationRecord?.name].filter(Boolean).join(" | ") || "Unassigned";
    const holder = checkedOut ? key.currentHolderName || "Unknown holder" : key.storageLocation || "Cabinet";
    const canVerify = env.canManageKeys() && env.canManageKeyCustomer(key.customerId);
    const lastVerification = key.nfcVerifiedAt
      ? env.formatDateTime(new Date(key.nfcVerifiedAt))
      : latestVerified ? env.formatDateTime(new Date(latestVerified.timestamp || latestVerified.createdAt || new Date())) : "Not verified";
    return `
      <div class="key-cabinet-drawer key-cabinet-drawer-${status}">
        <div class="key-cabinet-drawer-header">
          <div>
            <span>Key Details</span>
            <strong>${env.escapeHtml(key.keyName || key.name || "Key")}</strong>
            <small>${env.escapeHtml(locationLabel)}</small>
          </div>
          <div class="key-cabinet-drawer-actions">
            <button type="button" class="secondary mini" data-verify-key-manual="${env.escapeAttribute(key.id)}" ${canVerify ? "" : "disabled"}>Verify Key</button>
            <button type="button" class="secondary mini" data-key-drawer-close>Close</button>
          </div>
        </div>
        <div class="key-cabinet-detail-grid">
          <span>Status</span><strong>${env.escapeHtml(statusText)}${checkedOut ? ` to ${env.escapeHtml(holder)}` : ""}</strong>
          <span>Verification</span><strong>${env.escapeHtml(verificationDue || "Current")}</strong>
          <span>NFC tag ID</span><strong>${env.escapeHtml(tagUids.length ? tagUids.join(", ") : "Not assigned")}</strong>
          <span>QR link</span><strong><a href="${env.escapeAttribute(keyUrl)}" target="_blank" rel="noopener">Open key link</a></strong>
          <span>Last check-out</span><strong>${env.escapeHtml(latestCheckout ? `${env.formatDateTime(new Date(latestCheckout.timestamp || latestCheckout.createdAt || new Date()))} | ${latestCheckout.userName || key.currentHolderName || "SiteWorks"}` : "No checkout yet")}</strong>
          <span>Last return</span><strong>${env.escapeHtml(latestReturn ? `${env.formatDateTime(new Date(latestReturn.timestamp || latestReturn.createdAt || new Date()))} | ${latestReturn.userName || "SiteWorks"}` : "No return yet")}</strong>
          <span>Last verification</span><strong>${env.escapeHtml(lastVerification)}</strong>
          <span>Notes</span><strong>${env.escapeHtml(key.notes || "No notes")}</strong>
        </div>
        ${key.nfcMessage ? `<p class="key-cabinet-drawer-message">${env.escapeHtml(key.nfcMessage)}</p>` : ""}
      </div>
    `;
  }

  function getLatestKeyLogForAction(key, action, env = {}) {
    const keyId = key?.id || "";
    if (!keyId) return null;
    const target = String(action || "").toLowerCase();
    return (env.keyLogs || [])
      .filter((log) => log.keyId === keyId && String(log.action || "").toLowerCase().includes(target))
      .sort((a, b) => String(b.timestamp || b.createdAt || "").localeCompare(String(a.timestamp || a.createdAt || "")))[0] || null;
  }

  function getLatestKeyLog(key, env = {}) {
    const keyId = key?.id || "";
    if (!keyId) return null;
    return (env.keyLogs || [])
      .filter((log) => log.keyId === keyId)
      .sort((a, b) => String(b.timestamp || b.createdAt || "").localeCompare(String(a.timestamp || a.createdAt || "")))[0] || null;
  }

  function getKeyCabinetStatus(key, checkedOut = false, overdue = false, env = {}) {
    if (!key) return "available";
    if (overdue) return "overdue";
    if (checkedOut) return "out";
    if (isKeyVerificationOverdue(key, env)) return "verify-overdue";
    if (isKeyRecentlyReturned(key, env)) return "returned";
    if (isKeyMissingOrUnverified(key, env)) return "unverified";
    return "available";
  }

  function siteKeyCabinetStatusLabel(status) {
    if (status === "overdue") return "Overdue";
    if (status === "out") return "Checked out";
    if (status === "verify-overdue") return "Verify overdue";
    if (status === "returned") return "Needs verify";
    if (status === "unverified") return "Unverified";
    return "Available";
  }

  function isKeyMissingOrUnverified(key, env = {}) {
    const text = String(key?.currentStatus || key?.current_status || key?.nfcStatus || key?.nfc_status || "").toLowerCase();
    if (text.includes("missing") || text.includes("lost") || text.includes("unverified")) return true;
    return Boolean(key) && !getKeyCabinetLastVerifiedLabel(key, env);
  }

  function isKeyRecentlyReturned(key, env = {}) {
    const date = getValidDate(getKeyReturnDateNeedingVerification(key, env));
    return Boolean(date) && Date.now() - date.getTime() < KEY_VERIFICATION_DUE_MS;
  }

  function getLatestKeyReturnLog(key, env = {}) {
    return (env.keyLogs || [])
      .filter((log) => log.keyId === key?.id && String(log.action || "").toLowerCase() === "check-in")
      .sort((a, b) => String(b.timestamp || b.createdAt || "").localeCompare(String(a.timestamp || a.createdAt || "")))[0] || null;
  }

  function getKeyReturnDateNeedingVerification(key, env = {}) {
    const latestCheckIn = getLatestKeyReturnLog(key, env);
    if (!latestCheckIn) return false;
    const date = new Date(latestCheckIn.timestamp || latestCheckIn.createdAt || "");
    const verifiedDate = getKeyCabinetLastVerifiedDate(key);
    if (verifiedDate && Number.isFinite(date.getTime()) && verifiedDate.getTime() >= date.getTime()) return false;
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function isKeyVerificationOverdue(key, env = {}) {
    const date = getValidDate(getKeyReturnDateNeedingVerification(key, env));
    return Boolean(date) && Date.now() - date.getTime() >= KEY_VERIFICATION_DUE_MS;
  }

  function getKeyVerificationOverdueLabel(key, env = {}) {
    const date = getValidDate(getKeyReturnDateNeedingVerification(key, env));
    if (!date) return "";
    const diffMs = Date.now() - date.getTime();
    if (diffMs < KEY_VERIFICATION_DUE_MS) {
      const hoursLeft = Math.max(1, Math.ceil((KEY_VERIFICATION_DUE_MS - diffMs) / 3600000));
      return `Verify within ${hoursLeft}h`;
    }
    const hoursOver = Math.max(1, Math.floor((diffMs - KEY_VERIFICATION_DUE_MS) / 3600000));
    if (hoursOver < 24) return `Verify overdue by ${hoursOver}h`;
    const daysOver = Math.max(1, Math.floor(hoursOver / 24));
    return `Verify overdue by ${daysOver} day${daysOver === 1 ? "" : "s"}`;
  }

  function getKeyCabinetLastUserLabel(key, checkedOut = false, env = {}) {
    if (!key) return "";
    if (checkedOut) return key.currentHolderName || "Unknown holder";
    const latestLog = getLatestKeyLog(key, env);
    return latestLog?.userName || key.lastUserName || key.lastHolderName || key.currentHolderName || key.checkedOutByName || key.checkedOutBy || "";
  }

  function getKeyCabinetLastVerifiedLabel(key) {
    const date = getKeyCabinetLastVerifiedDate(key);
    if (!date) return "";
    return `Verified ${formatKeyCabinetRelativeDate(date)}`;
  }

  function getKeyCabinetLastVerifiedDate(key) {
    if (!key) return null;
    const value = key.lastVerifiedAt || key.verifiedAt || key.nfcLastVerifiedAt || key.nfcVerifiedAt || "";
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function getValidDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function formatKeyCabinetRelativeDate(date) {
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 60 * 60 * 1000) return "just now";
    if (diffMs < 24 * 60 * 60 * 1000) return "today";
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (days === 1) return "yesterday";
    if (days < 30) return `${days} days ago`;
    return date.toLocaleDateString();
  }

  function handleClick(event, env = {}) {
    const cabinetPageButton = event.target.closest("[data-key-cabinet-page]");
    if (cabinetPageButton) {
      event.preventDefault();
      event.stopPropagation();
      const page = Number(cabinetPageButton.dataset.keyCabinetPage);
      env.setPage?.(Number.isInteger(page) && page >= 0 ? page : 0);
      env.setFocusedKeyId?.("");
      env.renderKeys?.();
      return true;
    }

    const cabinetSlot = event.target.closest("[data-key-cabinet-slot]");
    if (cabinetSlot) {
      event.preventDefault();
      event.stopPropagation();
      const slotKeyId = cabinetSlot.dataset.keyCabinetSlot || "";
      const shouldOpenDrawer = env.focusedKeyId !== slotKeyId;
      env.setFocusedKeyId?.(shouldOpenDrawer ? slotKeyId : "");
      env.renderKeys?.();
      if (shouldOpenDrawer) env.scrollDrawerIntoView?.();
      return true;
    }

    const keyDrawerClose = event.target.closest("[data-key-drawer-close]");
    if (keyDrawerClose) {
      event.preventDefault();
      event.stopPropagation();
      env.setFocusedKeyId?.("");
      env.renderKeys?.();
      return true;
    }

    return false;
  }

  window.SiteWorksKeybox = {
    renderKeyCabinet,
    renderKeyCabinetSlot,
    renderKeyCabinetDrawer,
    handleClick,
    getKeyCabinetStatus,
    siteKeyCabinetStatusLabel,
    isKeyVerificationOverdue,
    getKeyCabinetLastUserLabel,
    getKeyCabinetLastVerifiedLabel
  };
})(window);
