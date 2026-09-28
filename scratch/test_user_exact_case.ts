// Polyfill fetch for node to talk to backend
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === "string" && input.startsWith("/api")) {
    input = `http://localhost:3001${input}`;
  }
  return originalFetch(input, init);
};

import { getSignedDtrVectorPdfBytes } from "../src/utils/dtrVectorPdf";
import fs from "fs";

async function testUserExactCase() {
  console.log("=== Testing User's Exact Case from media_1790237387253.png ===");

  const sampleRows = Array.from({ length: 31 }, (_, i) => ({
    day: i + 1,
    amArrival: "08:00",
    amDeparture: "12:00",
    pmArrival: "13:00",
    pmDeparture: "17:00",
    undertimeHours: "",
    undertimeMinutes: "",
  }));

  // Exactly what DtrGenerator passes:
  const config = {
    employeeName: "DELA TORRE, RALPH B.",
    province: "Regional Office (RO)",
    supervisorName: "NORLY A. TABO",
    supervisorTitle: "OIC Chief - Technical Operations Division",
    periodText: "SEPTEMBER 01-30, 2026",
    regularHours: "Regular days",
    saturdayHours: "Saturdays",
    month: 8,
    year: 2026,
    scope: "full",
  };

  const p12Options = {
    profileId: "dtr-sig-usr-mudrq46b", // Ralph's profile ID
    signerName: "Dela Torre Ralph Bitome",
    signerRole: "employee" as const,
  };

  const { bytes, resolvedSignerName, fileName } = await getSignedDtrVectorPdfBytes(
    config as any,
    sampleRows as any,
    null,
    true,
    p12Options
  );

  console.log("\nGenerated PDF:", fileName);
  console.log("Size:", bytes.byteLength, "bytes");
  console.log("Resolved Signer:", resolvedSignerName);

  const pdfText = Buffer.from(bytes).toString("binary");
  const sigMatches = pdfText.match(/\/Type\s*\/Sig/g);
  console.log("\nTotal /Type /Sig found in DTR PDF:", sigMatches ? sigMatches.length : 0);

  const nameMatches = pdfText.match(/\/Name\s*\(([^)]+)\)/g);
  console.log("Signer Names in PDF:", nameMatches);

  const fieldMatches = pdfText.match(/\/T\s*\(([^)]+)\)/g);
  console.log("Signature Field Names in PDF:", fieldMatches);
}

testUserExactCase().catch(console.error);
