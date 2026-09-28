// Polyfill fetch for node to talk to backend
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === "string" && input.startsWith("/api")) {
    input = `http://localhost:3001${input}`;
  }
  return originalFetch(input, init);
};

import { getSignedDtrVectorPdfBytes } from "../src/utils/dtrVectorPdf";

async function testItemDownload() {
  const res = await fetch("http://localhost:3001/api/dtr-storage");
  const data = await res.json();
  const list = data.records || data.items || data;
  const item = list.find((i: any) => i.id === "DTR-PROVINCIAL-840732-134");

  console.log("=== Testing Scenario 1: p12Options is null ===");
  const res1 = await getSignedDtrVectorPdfBytes(
    {
      employeeName: item.employeeName,
      supervisorName: item.supervisorName,
      supervisorTitle: item.supervisorTitle,
      periodText: item.periodText,
      regularHours: item.regularHours,
      saturdayHours: item.saturdayHours,
      month: item.month,
      year: item.year,
      scope: item.scope,
      status: item.status,
      employeeSignatureImage: item.employeeSignatureImage || item.signatureImage,
      employeeHasP12: item.employeeHasP12 ?? item.hasP12,
      employeeSignerName: item.employeeSignerName || item.employeeName,
      supervisorSignatureImage: item.supervisorSignatureImage,
      supervisorHasP12: true,
      signerName: item.signerName,
    } as any,
    item.rows,
    item.signatureImage,
    true,
    null
  );

  const pdfText1 = Buffer.from(res1.bytes).toString("binary");
  const sigs1 = pdfText1.match(/\/Type\s*\/Sig/g);
  const names1 = pdfText1.match(/\/Name\s*\(([^)]+)\)/g);
  const fields1 = pdfText1.match(/\/T\s*\(([^)]+)\)/g);
  console.log("Scenario 1 Sigs count:", sigs1 ? sigs1.length : 0);
  console.log("Scenario 1 Signer Names:", names1);
  console.log("Scenario 1 Field Names:", fields1);

  console.log("\n=== Testing Scenario 2: Current user is Ralph (signerRole: employee) ===");
  const ralphOpts = {
    profileId: "dtr-sig-usr-mudrq46b",
    user_Id: "usr-mudrq46b",
    signerName: "Dela Torre Ralph Bitome",
    signerRole: "employee" as const,
  };
  const res2 = await getSignedDtrVectorPdfBytes(
    {
      employeeName: item.employeeName,
      supervisorName: item.supervisorName,
      supervisorTitle: item.supervisorTitle,
      periodText: item.periodText,
      regularHours: item.regularHours,
      saturdayHours: item.saturdayHours,
      month: item.month,
      year: item.year,
      scope: item.scope,
      status: item.status,
      employeeSignatureImage: item.employeeSignatureImage || item.signatureImage,
      employeeHasP12: item.employeeHasP12 ?? item.hasP12,
      employeeSignerName: item.employeeSignerName || item.employeeName,
      supervisorSignatureImage: item.supervisorSignatureImage,
      supervisorHasP12: true,
      signerName: item.signerName,
    } as any,
    item.rows,
    item.signatureImage,
    true,
    ralphOpts
  );

  const pdfText2 = Buffer.from(res2.bytes).toString("binary");
  const sigs2 = pdfText2.match(/\/Type\s*\/Sig/g);
  const names2 = pdfText2.match(/\/Name\s*\(([^)]+)\)/g);
  const fields2 = pdfText2.match(/\/T\s*\(([^)]+)\)/g);
  console.log("Scenario 2 Sigs count:", sigs2 ? sigs2.length : 0);
  console.log("Scenario 2 Signer Names:", names2);
  console.log("Scenario 2 Field Names:", fields2);
}

testItemDownload().catch(console.error);
