const MANAGER_ROLES = new Set(["Manager", "Facility Manager"]);
const EDITABLE_TABLES = new Set([
  "customers",
  "locations",
  "pm_templates",
  "assets",
  "work_orders",
  "service_requests",
  "pm_history",
  "asset_files"
]);

function normalizeRole(role) {
  return String(role || "Customer").trim() || "Customer";
}

function normalizeUser(user = {}) {
  return {
    id: user.id || "",
    email: user.email || "",
    name: user.name || user.display_name || user.username || "",
    role: normalizeRole(user.role),
    customerId: user.customerId || user.customer_id || "",
    locationId: user.locationId || user.location_id || ""
  };
}

function isAdmin(user) {
  return normalizeUser(user).role === "Admin";
}

function isManager(user) {
  return MANAGER_ROLES.has(normalizeUser(user).role);
}

function isFacilityManager(user) {
  return normalizeUser(user).role === "Facility Manager";
}

function canSeeAllCustomers(user) {
  return isAdmin(user);
}

function canSeeCustomer(user, customerId) {
  const viewer = normalizeUser(user);
  return canSeeAllCustomers(viewer) || Boolean(customerId && viewer.customerId === customerId);
}

function canSeeLocation(user, locationId, customerId = "") {
  const viewer = normalizeUser(user);
  if (canSeeAllCustomers(viewer)) return true;
  if (customerId && !canSeeCustomer(viewer, customerId)) return false;
  if (!viewer.locationId) return canSeeCustomer(viewer, customerId || viewer.customerId);
  return Boolean(locationId && locationId === viewer.locationId);
}

function canManageUsers(user) {
  const viewer = normalizeUser(user);
  return isAdmin(viewer) || (isManager(viewer) && Boolean(viewer.customerId) && !viewer.locationId);
}

function creatableRolesFor(user) {
  const viewer = normalizeUser(user);
  if (viewer.role === "Admin") return ["Customer", "Technician", "Manager", "Facility Manager", "Admin"];
  if (viewer.role === "Facility Manager") return ["Customer", "Technician", "Manager"];
  if (viewer.role === "Manager") return ["Customer", "Technician"];
  return [];
}

function canCreateUserRole(user, role) {
  return creatableRolesFor(user).includes(normalizeRole(role));
}

function canManageUserScope(user, target = {}) {
  const viewer = normalizeUser(user);
  const targetUser = normalizeUser(target);
  if (isAdmin(viewer)) return true;
  if (!canManageUsers(viewer)) return false;
  if (targetUser.role === "Admin" || targetUser.role === "Facility Manager") return false;
  if (targetUser.role === "Manager" && !isFacilityManager(viewer)) return false;
  if (!targetUser.customerId || targetUser.customerId !== viewer.customerId) return false;
  if (!viewer.locationId) return true;
  return !targetUser.locationId || targetUser.locationId === viewer.locationId;
}

function canCreateEquipment(user, record = {}) {
  const viewer = normalizeUser(user);
  if (isAdmin(viewer)) return true;
  if (!isManager(viewer) || viewer.locationId) return false;
  return canSeeCustomer(viewer, record.customerId || record.customer_id || viewer.customerId);
}

function canDeleteEquipment(user) {
  return isAdmin(user);
}

function canManageTickets(user, record = {}) {
  const viewer = normalizeUser(user);
  if (isAdmin(viewer)) return true;
  if (!isManager(viewer)) return false;
  return canSeeLocation(
    viewer,
    record.locationId || record.location_id || "",
    record.customerId || record.customer_id || viewer.customerId
  );
}

function canWorkOnTicket(user, record = {}) {
  const viewer = normalizeUser(user);
  if (canManageTickets(viewer, record)) return true;
  if (viewer.role !== "Technician") return false;
  const assigneeId = record.assignedUserId || record.assigned_user_id || "";
  const assigneeName = String(record.assignedUserName || record.assigned_user_name || "").trim().toLowerCase();
  const viewerNames = [viewer.name, viewer.email].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
  if (!assigneeId && !assigneeName) return canSeeLocation(viewer, record.locationId || record.location_id || "", record.customerId || record.customer_id || "");
  return assigneeId === viewer.id || viewerNames.includes(assigneeName);
}

function canAccessTable(user, table, action = "read") {
  const viewer = normalizeUser(user);
  if (!EDITABLE_TABLES.has(table)) return false;
  if (isAdmin(viewer)) return true;
  if (action === "read") return Boolean(viewer.customerId);
  if (action === "delete") {
    if (table === "work_orders" || table === "service_requests") return isManager(viewer);
    return false;
  }
  if (table === "pm_templates") return false;
  if (table === "customers") return false;
  if (table === "locations") return isManager(viewer) && !viewer.locationId;
  if (table === "assets") return canCreateEquipment(viewer, { customerId: viewer.customerId });
  if (table === "work_orders" || table === "service_requests") return isManager(viewer);
  if (table === "pm_history") return ["Manager", "Facility Manager", "Technician", "Customer"].includes(viewer.role);
  if (table === "asset_files") return isManager(viewer) || viewer.role === "Technician";
  return false;
}

function assertAllowed(condition, message) {
  if (condition) return;
  const error = new Error(message || "This user is not allowed to perform that action.");
  error.status = 403;
  throw error;
}

module.exports = {
  MANAGER_ROLES,
  normalizeUser,
  normalizeRole,
  isAdmin,
  isManager,
  canSeeAllCustomers,
  canSeeCustomer,
  canSeeLocation,
  canManageUsers,
  creatableRolesFor,
  canCreateUserRole,
  canManageUserScope,
  canCreateEquipment,
  canDeleteEquipment,
  canManageTickets,
  canWorkOnTicket,
  canAccessTable,
  assertAllowed
};
