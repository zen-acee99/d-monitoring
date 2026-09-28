// Set up Node.js fetch polyfill for relative URLs to talk to the local backend server
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === "string" && input.startsWith("/api")) {
    input = `http://localhost:3001${input}`;
  }
  return originalFetch(input, init);
};

import { getSignedDtrVectorPdfBytes } from "../src/utils/dtrVectorPdf";
import fs from "fs";

async function testFullDtrDownloadFlow() {
  console.log("=== Testing Full DTR Download Flow with 2 Users & 4 Signatures ===");

  const sampleRows = Array.from({ length: 31 }, (_, i) => ({
    day: i + 1,
    amArrival: "08:00",
    amDeparture: "12:00",
    pmArrival: "13:00",
    pmDeparture: "17:00",
    undertimeHours: "",
    undertimeMinutes: "",
  }));

  const config = {
    employeeName: "RALPH B. DELA TORRE",
    supervisorName: "MALTO ACE MATA",
    supervisorTitle: "OIC Chief - Technical Operations Division",
    periodText: "For the month of September 1-30, 2026",
    regularHours: "Regular days",
    saturdayHours: "Saturdays",
    month: "September",
    year: "2026",
    scope: "full-month",
    status: "Verified",
    employeeSignerName: "Dela Torre Ralph Bitome",
    signerName: "Malto Ace Mata",
    employeeHasP12: true,
    supervisorHasP12: true,
  };

  const { bytes, resolvedSignerName, fileName } = await getSignedDtrVectorPdfBytes(
    config as any,
    sampleRows as any,
    null,
    true,
    null
  );

  console.log("\nGenerated PDF:", fileName);
  console.log("Size:", bytes.byteLength, "bytes");
  console.log("Resolved Signer:", resolvedSignerName);

  fs.writeFileSync("test_full_dtr_download.pdf", Buffer.from(bytes));
  console.log("Saved test_full_dtr_download.pdf successfully!");

  const pdfText = Buffer.from(bytes).toString("binary");
  const sigMatches = pdfText.match(/\/Type\s*\/Sig/g);
  console.log("\nTotal /Type /Sig found in DTR PDF:", sigMatches ? sigMatches.length : 0);

  const nameMatches = pdfText.match(/\/Name\s*\(([^)]+)\)/g);
  console.log("Signer Names in PDF:", nameMatches);

  const fieldMatches = pdfText.match(/\/T\s*\(([^)]+)\)/g);
  console.log("Signature Field Names in PDF:", fieldMatches);

  const byteRanges = pdfText.match(/\/ByteRange\s*\[[^\]]+\]/g);
  console.log("ByteRanges in PDF:", byteRanges);
}

testFullDtrDownloadFlow().catch(console.error);
