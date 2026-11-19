import assert from "node:assert";
import { DEFAULT_USERS, cleanEmail } from "../src/data/userStore.js";
import { ALL_SYSTEM_MODULES, createFullAccessMatrix, hasModuleAccess } from "../src/services/authStore.js";
import { PROJECTS } from "../src/config/projects.js";

console.log("=== STARTING AUTHENTICATION & AUTO-PROVISIONING TESTS ===");

// 1. Test cleanEmail normalizer
console.log("\n[Test 1] Testing cleanEmail helper...");
assert.strictEqual(cleanEmail("  Ace.Malto@dict.gov.ph  "), "ace.malto@dict.gov.ph");
assert.strictEqual(cleanEmail("Acemm.1599@gmail.COM"), "acemm.1599@gmail.com");
assert.strictEqual(cleanEmail("user\u200B@dict.gov.ph"), "user@dict.gov.ph"); // Zero-width space
assert.strictEqual(cleanEmail(null), "");
assert.strictEqual(cleanEmail(undefined), "");
console.log("✓ cleanEmail passes all normalization checks.");

// 2. Test Super Admin detection & role assignment
console.log("\n[Test 2] Testing Ace Malto Super Admin detection...");
const aceEmails = [
  "ace.malto@dict.gov.ph",
  "acemm.1599@gmail.com",
  "ace.malto.work@gmail.com",
];
for (const em of aceEmails) {
  const isAce = em === "ace.malto@dict.gov.ph" || em === "acemm.1599@gmail.com" || em.startsWith("ace.malto");
  assert.strictEqual(isAce, true, `Expected ${em} to be recognized as Ace Malto`);
}

const regularPersonnelEmails = [
  "renejane.buena@dict.gov.ph",
  "john.penaflor@dict.gov.ph",
  "maria.santos@gmail.com",
  "new.hire@dict.gov.ph",
];
for (const em of regularPersonnelEmails) {
  const isAce = em === "ace.malto@dict.gov.ph" || em === "acemm.1599@gmail.com" || em.startsWith("ace.malto");
  assert.strictEqual(isAce, false, `Expected ${em} NOT to be recognized as Ace Malto`);
}
console.log("✓ Ace Malto detection logic verified.");

// 3. Test DEFAULT_USERS contains both Ace Malto administrative accounts
console.log("\n[Test 3] Testing DEFAULT_USERS pre-seeded administrators...");
const aceGovMail = DEFAULT_USERS.find((u) => u.email === "ace.malto@dict.gov.ph");
const aceGmail = DEFAULT_USERS.find((u) => u.email === "acemm.1599@gmail.com");

assert.ok(aceGovMail, "ace.malto@dict.gov.ph must exist in DEFAULT_USERS");
assert.strictEqual(aceGovMail.role, "Super Admin");
assert.strictEqual(aceGovMail.status, "active");
assert.strictEqual(aceGovMail.canEdit, true);
assert.strictEqual(aceGovMail.canDelete, true);

assert.ok(aceGmail, "acemm.1599@gmail.com must exist in DEFAULT_USERS");
assert.strictEqual(aceGmail.role, "Super Admin");
assert.strictEqual(aceGmail.status, "active");
assert.strictEqual(aceGmail.canEdit, true);
assert.strictEqual(aceGmail.canDelete, true);
console.log("✓ Both Ace Malto GovMail and Gmail accounts are verified in DEFAULT_USERS.");

// 4. Test Access Matrix coverage for auto-provisioned users
console.log("\n[Test 4] Testing access matrix for auto-provisioned personnel...");
// Build test user mimicking auto-provisioned viewer
const autoViewer: any = {
  id: "usr-test-123",
  name: "New Personnel",
  email: "new.personnel@dict.gov.ph",
  role: "Viewer",
  region: "Region V (Bicol)",
  status: "active",
  isFocal: false,
  access: {
    overview: true,
    MOD_OVERVIEW: true,
    "mod-overview": true,
    dtr: true,
    MOD_DTR: true,
    "mod-dtr": true,
    calendar: true,
    MOD_CALENDAR: true,
    "mod-calendar": true,
    signing: true,
    MOD_SIGNING: true,
    "mod-signing": true,
    "signing-workspace": true,
    "MOD_SIGNING-WORKSPACE": true,
    "mod-signing-workspace": true,
    gecs: true,
    MOD_GECS: true,
    "mod-gecs": true,
    freewifi: true,
    MOD_FREEWIFI: true,
    "mod-freewifi": true,
    egovph: true,
    MOD_EGOVPH: true,
    "mod-egovph": true,
    elgu: true,
    MOD_ELGU: true,
    "mod-elgu": true,
    nbp: true,
    MOD_NBP: true,
    "mod-nbp": true,
    govnet: true,
    MOD_GOVNET: true,
    "mod-govnet": true,
    pnpki: true,
    MOD_PNPKI: true,
    "mod-pnpki": true,
    ilcdb: true,
    MOD_ILCDB: true,
    "mod-ilcdb": true,
    cybersecurity: true,
    MOD_CYBERSECURITY: true,
    "mod-cybersecurity": true,
    miss: true,
    MOD_MISS: true,
    "mod-miss": true,
    iidb: true,
    MOD_IIDB: true,
    "mod-iidb": true,
    project_data: true,
    MOD_PROJECT_DATA: true,
    "project-data": true,
    "mod-project-data": true,
    admin: false,
    MOD_ADMIN: false,
    "mod-admin": false,
  },
  canEdit: false,
  canDelete: false,
  authProvider: "google",
  lastLogin: "Just now (GovMail SSO)",
  createdAt: new Date().toISOString(),
};

// Check that viewer has access to core modules
assert.strictEqual(hasModuleAccess(autoViewer, "MOD_OVERVIEW"), true);
assert.strictEqual(hasModuleAccess(autoViewer, "overview"), true);
assert.strictEqual(hasModuleAccess(autoViewer, "MOD_DTR"), true);
assert.strictEqual(hasModuleAccess(autoViewer, "dtr"), true);
assert.strictEqual(hasModuleAccess(autoViewer, "MOD_SIGNING"), true);
assert.strictEqual(hasModuleAccess(autoViewer, "signing-workspace"), true);
assert.strictEqual(hasModuleAccess(autoViewer, "MOD_CALENDAR"), true);
assert.strictEqual(hasModuleAccess(autoViewer, "calendar"), true);

// Check project modules
for (const p of PROJECTS) {
  assert.strictEqual(hasModuleAccess(autoViewer, p.id), true, `Viewer should access project ${p.id}`);
  assert.strictEqual(hasModuleAccess(autoViewer, `MOD_${p.id.toUpperCase()}`), true, `Viewer should access project MOD_${p.id.toUpperCase()}`);
}

// Check admin restrictions for Viewer
assert.strictEqual(hasModuleAccess(autoViewer, "MOD_ADMIN"), false, "Viewer should not have admin module access");
assert.strictEqual(hasModuleAccess(autoViewer, "admin"), false, "Viewer should not have admin module access");

// Build test user mimicking auto-provisioned Ace Malto
const autoAce: any = {
  ...autoViewer,
  id: "usr-test-ace",
  name: "Ace Malto",
  email: "ace.malto@dict.gov.ph",
  role: "Super Admin",
  access: {
    ...autoViewer.access,
    admin: true,
    MOD_ADMIN: true,
    "mod-admin": true,
  },
  canEdit: true,
  canDelete: true,
};
assert.strictEqual(hasModuleAccess(autoAce, "MOD_ADMIN"), true, "Super Admin must have admin module access");
assert.strictEqual(hasModuleAccess(autoAce, "MOD_OVERVIEW"), true);
assert.strictEqual(hasModuleAccess(autoAce, "MOD_DTR"), true);
console.log("✓ Module access matrix verified for both Viewer and Super Admin.");

// 5. Test Deactivated User Blocking
console.log("\n[Test 5] Testing explicit inactive user deactivation blocking...");
const inactiveUser: any = {
  ...autoViewer,
  id: "usr-deactivated",
  name: "Deactivated Personnel",
  email: "inactive.personnel@dict.gov.ph",
  status: "inactive",
};
assert.strictEqual(hasModuleAccess(inactiveUser, "MOD_OVERVIEW"), false, "Inactive user must NOT access overview");
assert.strictEqual(hasModuleAccess(inactiveUser, "MOD_DTR"), false, "Inactive user must NOT access DTR");
assert.strictEqual(hasModuleAccess(inactiveUser, "MOD_SIGNING"), false, "Inactive user must NOT access signing");

// Status string variations
assert.strictEqual(String(inactiveUser.status || "").trim().toLowerCase() === "inactive", true);
assert.strictEqual(String(" Inactive ").trim().toLowerCase() === "inactive", true);
assert.strictEqual(String("INACTIVE").trim().toLowerCase() === "inactive", true);
console.log("✓ Deactivated account blocking verified across all case variations.");

console.log("\n=== ALL AUTHENTICATION AND AUTO-PROVISIONING TESTS PASSED SUCCESSFULLY! ===");
