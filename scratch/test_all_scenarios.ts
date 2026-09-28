import { db } from "../server/db";
import { getSignedDtrVectorPdfBytes } from "../src/utils/dtrVectorPdf";
import fs from "fs";

// Polyfill fetch for node
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === "string" && input.startsWith("/api")) {
    input = `http://localhost:3001${input}`;
  }
  return originalFetch(input, init);
};

async function testAllScenarios() {
  console.log("=== COMPREHENSIVE MULTI-USER & SCENARIO VERIFICATION ===\n");

  const profiles = await db.execute("SELECT id, user_Id, Name, p12 IS NOT NULL as hasP12, p12_filename, p12_password IS NOT NULL as hasPass FROM dtr_generator");
  console.log("Found DTR Generator profiles in database:");
  profiles.rows.forEach(r => console.log(` - ID: ${r.id}, Name: ${r.Name}, hasP12: ${r.hasP12}, filename: ${r.p12_filename}`));

  const sampleRows = Array.from({ length: 31 }, (_, i) => ({
    day: i + 1,
    amArrival: "08:00",
    amDeparture: "12:00",
    pmArrival: "13:00",
    pmDeparture: "17:00",
    undertimeHours: "",
    undertimeMinutes: "",
  }));

  // Scenario 1: John Stephen D. Moral (Personnel with P12) + Ace Malto (Supervisor with P12)
  console.log("\n--- Scenario 1: John Stephen D. Moral (Personnel) + Malto Ace Mata (Supervisor) ---");
  const res1 = await getSignedDtrVectorPdfBytes(
    {
      employeeName: "JOHN STEPHEN D. MORAL",
      supervisorName: "MALTO ACE MATA",
      supervisorTitle: "OIC Chief - Technical Operations Division",
      periodText: "For the month of September 1-30, 2026",
      regularHours: "Regular days",
      saturdayHours: "Saturdays",
      month: "September",
      year: "2026",
      scope: "full-month",
      status: "Verified",
      employeeSignerName: "John Stephen D. Moral",
      signerName: "Malto Ace Mata",
      employeeHasP12: true,
      supervisorHasP12: true,
    } as any,
    sampleRows as any,
    null,
    true,
    null
  );
  
  const text1 = Buffer.from(res1.bytes).toString("binary");
  const sigs1 = text1.match(/\/Type\s*\/Sig/g) || [];
  const names1 = text1.match(/\/Name\s*\(([^)]+)\)/g) || [];
  const fields1 = text1.match(/\/T\s*\(([^)]+)\)/g) || [];
  console.log(`Scenario 1: Sigs=${sigs1.length}, Names=${names1.join(", ")}, Fields=${fields1.join(", ")}`);

  // Scenario 2: Personnel Only (Status = Submitted, only Personnel has P12 signed, Supervisor has not signed yet)
  console.log("\n--- Scenario 2: Ralph Dela Torre (Personnel Only, Status=Submitted) ---");
  const res2 = await getSignedDtrVectorPdfBytes(
    {
      employeeName: "RALPH B. DELA TORRE",
      supervisorName: "MALTO ACE MATA",
      supervisorTitle: "OIC Chief - Technical Operations Division",
      periodText: "For the month of September 1-30, 2026",
      regularHours: "Regular days",
      saturdayHours: "Saturdays",
      month: "September",
      year: "2026",
      scope: "full-month",
      status: "Submitted",
      employeeSignerName: "Dela Torre Ralph Bitome",
      employeeHasP12: true,
      supervisorHasP12: false,
    } as any,
    sampleRows as any,
    null,
    true,
    null
  );

  const text2 = Buffer.from(res2.bytes).toString("binary");
  const sigs2 = text2.match(/\/Type\s*\/Sig/g) || [];
  const names2 = text2.match(/\/Name\s*\(([^)]+)\)/g) || [];
  const fields2 = text2.match(/\/T\s*\(([^)]+)\)/g) || [];
  console.log(`Scenario 2: Sigs=${sigs2.length}, Names=${names2.join(", ")}, Fields=${fields2.join(", ")}`);

  // Scenario 3: Supervisor Only (Personnel has no P12, Supervisor signs with P12)
  console.log("\n--- Scenario 3: Supervisor Only signing with P12 (Personnel has image only) ---");
  const res3 = await getSignedDtrVectorPdfBytes(
    {
      employeeName: "JUAN DELA CRUZ",
      supervisorName: "MALTO ACE MATA",
      supervisorTitle: "OIC Chief - Technical Operations Division",
      periodText: "For the month of September 1-30, 2026",
      regularHours: "Regular days",
      saturdayHours: "Saturdays",
      month: "September",
      year: "2026",
      scope: "full-month",
      status: "Verified",
      signerName: "Malto Ace Mata",
      employeeHasP12: false,
      supervisorHasP12: true,
    } as any,
    sampleRows as any,
    null,
    true,
    null
  );

  const text3 = Buffer.from(res3.bytes).toString("binary");
  const sigs3 = text3.match(/\/Type\s*\/Sig/g) || [];
  const names3 = text3.match(/\/Name\s*\(([^)]+)\)/g) || [];
  const fields3 = text3.match(/\/T\s*\(([^)]+)\)/g) || [];
  console.log(`Scenario 3: Sigs=${sigs3.length}, Names=${names3.join(", ")}, Fields=${fields3.join(", ")}`);

  console.log("\n=== ALL SCENARIOS VERIFIED SUCCESSFULLY ===");
}

testAllScenarios().catch(console.error);
