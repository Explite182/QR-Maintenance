const assert = require("assert");
const policies = require("./siteworks-policies");

const admin = { role: "Admin" };
const facilityManager = { role: "Facility Manager", customerId: "club-16" };
const manager = { role: "Manager", customerId: "club-16" };
const locationManager = { role: "Manager", customerId: "club-16", locationId: "north" };
const technician = { role: "Technician", customerId: "club-16", locationId: "north", id: "tech-1", name: "Jordan" };
const customer = { role: "Customer", customerId: "club-16", locationId: "north" };

assert.equal(policies.canCreateUserRole(admin, "Admin"), true);
assert.equal(policies.canCreateUserRole(manager, "Technician"), true);
assert.equal(policies.canCreateUserRole(manager, "Manager"), false);
assert.equal(policies.canCreateUserRole(facilityManager, "Manager"), true);

assert.equal(policies.canManageUsers(manager), true);
assert.equal(policies.canManageUsers(locationManager), false);

assert.equal(policies.canManageUserScope(manager, { role: "Technician", customerId: "club-16" }), true);
assert.equal(policies.canManageUserScope(manager, { role: "Technician", customerId: "other" }), false);
assert.equal(policies.canManageUserScope(manager, { role: "Admin", customerId: "club-16" }), false);

assert.equal(policies.canCreateEquipment(manager, { customerId: "club-16" }), true);
assert.equal(policies.canCreateEquipment(locationManager, { customerId: "club-16" }), false);
assert.equal(policies.canDeleteEquipment(manager), false);
assert.equal(policies.canDeleteEquipment(admin), true);

assert.equal(policies.canWorkOnTicket(technician, { customerId: "club-16", locationId: "north", assignedUserId: "tech-1" }), true);
assert.equal(policies.canWorkOnTicket(technician, { customerId: "club-16", locationId: "north", assignedUserId: "tech-2" }), false);
assert.equal(policies.canWorkOnTicket(customer, { customerId: "club-16", locationId: "north" }), false);

assert.equal(policies.canAccessTable(manager, "assets", "write"), true);
assert.equal(policies.canAccessTable(manager, "assets", "delete"), false);
assert.equal(policies.canAccessTable(manager, "work_orders", "delete"), true);
assert.equal(policies.canAccessTable(customer, "assets", "write"), false);

console.log("SiteWorks policy smoke test passed.");
