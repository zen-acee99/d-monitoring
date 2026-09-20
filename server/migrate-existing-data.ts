import { db } from "./db.js";
import { FREE_WIFI_SITES } from "../src/data/freewifiData.js";
import { ELGU_LGUS_DATA } from "../src/data/elguData.js";
import { RAW_PNPKI_CERTIFICATES } from "../src/data/pnpkiCertificates.js";
import { ILCDB_SARO_ACTIVITIES } from "../src/data/ilcdbData.js";
import { CYBERSECURITY_EVENTS } from "../src/data/cybersecurityData.js";
import { MISS_INTERNAL_SYSTEMS } from "../src/data/missData.js";

async function transferData() {
  console.log("=================================================");
  console.log(" Starting data transfer to Turso Database...");
  console.log("=================================================");

  // 1. FREE WIFI 4 ALL
  console.log(`\n[1/6] Transferring Free WiFi 4 All data (${FREE_WIFI_SITES.length} records)...`);
  await db.execute(`DELETE FROM "freewifi"`);
  for (const site of FREE_WIFI_SITES) {
    const rec = {
      ...site,
      id: site.id || `fw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      siteName: site.locationName || site.projectName,
      siteType: site.siteTypeLabel || site.siteType,
      municipality: site.municipality,
      province: site.province,
      linkType: site.linkType === "FOC" ? "Fiber Optic" : "VSAT Satellite",
      apCount: site.apCount || 1,
      bandwidth: site.averageBandwidthMbps || 50,
      fundSource: site.fundSource === "PICS-MUN" ? "DICT Centrally Managed" : "LGU Co-Funded",
      status: site.status === "Operational" ? "Active" : site.status === "Maintenance" ? "Under Maintenance" : "Degraded",
    };

    await db.execute({
      sql: `INSERT OR REPLACE INTO "freewifi" (id, data, status, province, created_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [rec.id, JSON.stringify(rec), rec.status, rec.province || null],
    });
  }
  console.log(`✓ Free WiFi: successfully transferred ${FREE_WIFI_SITES.length} records.`);

  // 2. eLGU
  console.log(`\n[2/6] Transferring eLGU data (${ELGU_LGUS_DATA.length} records)...`);
  await db.execute(`DELETE FROM "elgu"`);
  for (const lgu of ELGU_LGUS_DATA) {
    const rec = {
      ...lgu,
      id: lgu.id || `elgu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      lguName: lgu.name,
      province: lgu.province,
      classification: lgu.classification || lgu.district || "Component LGU",
      version: lgu.version || (lgu.versions && lgu.versions[0]) || "V2 eLGU (Cloud)",
      deployedModules: lgu.notes || "eBPLS, eTax, Citizen Portal",
      progressPercentage: lgu.progressPercentage ?? 100,
      monthlyTransactions: lgu.monthlyTransactions || 1200,
      registeredUsers: lgu.registeredUsers || 3500,
      dictFocal: lgu.dictFocal || "TOD Region V",
      status: lgu.status || "Live",
      goLiveDate: lgu.goLiveDate || null,
    };

    await db.execute({
      sql: `INSERT OR REPLACE INTO "elgu" (id, data, status, province, created_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [rec.id, JSON.stringify(rec), rec.status, rec.province || null],
    });
  }
  console.log(`✓ eLGU: successfully transferred ${ELGU_LGUS_DATA.length} records.`);

  // 3. PNPKI
  console.log(`\n[3/6] Transferring PNPKI certificates (${RAW_PNPKI_CERTIFICATES.length} records)...`);
  await db.execute(`DELETE FROM "pnpki"`);
  for (const cert of RAW_PNPKI_CERTIFICATES) {
    const rec = {
      ...cert,
      id: cert.id || `pnpki-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      applicantName: cert.fullName,
      agencyName: cert.agency,
      email: cert.email,
      certType: "Individual (Gov't Employee)",
      province: cert.province,
      validityYears: "2 Years",
      issuedDate: "2024-01-15",
      status: cert.status === "PROCESSED" ? "Active" : "Pending Approval",
      serialNumber: cert.serialNumber,
    };

    await db.execute({
      sql: `INSERT OR REPLACE INTO "pnpki" (id, data, status, province, created_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [rec.id, JSON.stringify(rec), rec.status, rec.province || null],
    });
  }
  console.log(`✓ PNPKI: successfully transferred ${RAW_PNPKI_CERTIFICATES.length} records.`);

  // 4. ILCDB
  console.log(`\n[4/6] Transferring ILCDB activities (${ILCDB_SARO_ACTIVITIES.length} records)...`);
  await db.execute(`DELETE FROM "ilcdb"`);
  for (const saro of ILCDB_SARO_ACTIVITIES) {
    const rec = {
      ...saro,
      id: saro.id || `ilc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      courseTitle: saro.activity,
      track: saro.division === "SPARK" ? "Digital Governance & eLGU" : "Software & Web Development",
      modality: "In-Person Classroom",
      targetAudience: saro.remarks || "LGU & Regional Personnel",
      province: saro.province,
      enrolledCount: saro.projectedExpenses ? Math.round(saro.projectedExpenses / 1500) : 40,
      targetQuota: 50,
      startDate: "2024-06-01",
      status: saro.status === "Completed" ? "Completed" : saro.status === "Upcoming" ? "Scheduled" : "Ongoing",
    };

    await db.execute({
      sql: `INSERT OR REPLACE INTO "ilcdb" (id, data, status, province, created_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [rec.id, JSON.stringify(rec), rec.status, rec.province || null],
    });
  }
  console.log(`✓ ILCDB: successfully transferred ${ILCDB_SARO_ACTIVITIES.length} records.`);

  // 5. CYBERSECURITY
  console.log(`\n[5/6] Transferring Cybersecurity events (${CYBERSECURITY_EVENTS.length} records)...`);
  await db.execute(`DELETE FROM "cybersecurity"`);
  for (let idx = 0; idx < CYBERSECURITY_EVENTS.length; idx++) {
    const ev: any = CYBERSECURITY_EVENTS[idx];
    const rec = {
      ...ev,
      id: ev.id || `cs-ev-${idx + 1}`,
      incidentTitle: ev.title || "Cyber Threat & Resilience Campaign",
      threatCategory: ev.category || "Awareness & Incident Response",
      affectedEntity: ev.location || "Regional Infrastructure",
      province: ev.province || "Regional Scope",
      severity: "Medium",
      status: ev.status === "Completed" ? "Resolved" : "Monitoring",
      dateLogged: ev.date || "2024-05-10",
      handler: ev.speaker || "CERT-R5 Cyber Ops",
    };

    await db.execute({
      sql: `INSERT OR REPLACE INTO "cybersecurity" (id, data, status, province, created_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [rec.id, JSON.stringify(rec), rec.status, rec.province || null],
    });
  }
  console.log(`✓ Cybersecurity: successfully transferred ${CYBERSECURITY_EVENTS.length} records.`);

  // 6. MISS
  console.log(`\n[6/6] Transferring MISS internal systems (${MISS_INTERNAL_SYSTEMS.length} records)...`);
  await db.execute(`DELETE FROM "miss"`);
  for (const sys of MISS_INTERNAL_SYSTEMS) {
    const rec = {
      ...sys,
      id: sys.id || `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      systemName: sys.name,
      category: sys.category,
      version: sys.version,
      userBase: sys.userBase,
      description: sys.description,
      status: sys.status,
      lastUpdated: sys.lastUpdated,
    };

    await db.execute({
      sql: `INSERT OR REPLACE INTO "miss" (id, data, status, province, created_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [rec.id, JSON.stringify(rec), rec.status, null],
    });
  }
  console.log(`✓ MISS: successfully transferred ${MISS_INTERNAL_SYSTEMS.length} records.`);

  console.log("\n=================================================");
  console.log(" All datasets transferred to Turso Cloud successfully!");
  console.log("=================================================");
}

transferData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Data transfer failed:", err);
    process.exit(1);
  });
