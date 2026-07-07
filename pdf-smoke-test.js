const assert = require("assert");
const { buildIssuePdfAttachment, normalizeIssueReport } = require("./siteworks-server");

const issue = normalizeIssueReport({
  id: "SW-0052",
  issueNumber: "SW-0052",
  reportTitle: "Ticket PDF Email",
  title: "First Aid Station 053",
  customer: "Club 16",
  location: "Vancouver Convention Center",
  equipment: "First Aid Station 053",
  status: "Open",
  priority: "Medium",
  assignedTo: "Mike",
  dueAt: "Jul 3, 2026",
  createdAt: "Jun 26, 2026",
  notes: "Test work note\nSecond line"
});

const attachment = buildIssuePdfAttachment(issue);
const pdf = Buffer.from(attachment.content, "base64");

assert.equal(attachment.content_type, "application/pdf");
assert.equal(attachment.filename, "siteworks-sw-0052.pdf");
assert.equal(pdf.slice(0, 8).toString("latin1"), "%PDF-1.4");
assert.ok(pdf.includes(Buffer.from("%%EOF", "latin1")));

console.log("SiteWorks PDF smoke test passed.");
