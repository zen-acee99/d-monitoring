// Polyfill fetch for node to talk to backend
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === "string" && input.startsWith("/api")) {
    input = `http://localhost:3001${input}`;
  }
  return originalFetch(input, init);
};

import { getSignedDtrVectorPdfBytes } from "../src/utils/dtrVectorPdf";

async function test() {
  const res = await fetch("http://localhost:3001/api/dtr-storage");
  const data = await res.json();
  const list = data.records || data.items || data;
  const item = list.find((i: any) => i.id === "DTR-PROVINCIAL-840732-134");

  // Exact p12Options passed when Ralph is logged in:
  const ralphOpts = {
    profileId: "dtr-sig-usr-mudrq46b", // userSigProfile.id (Ralph)
    user_Id: "usr-mudrq46b",
    p12Base64: undefined,
    signerName: "Malto Ace Mata",
    signerRole: "supervisor" as const,
    employeeProfileId: "dtr-sig-usr-mudrq46b",
    employeeUserId: "usr-mudrq46b",
    employeeP12Base64: undefined,
    employeeSignerName: "Dela Torre Ralph Bitome",
  };

  const result = await getSignedDtrVectorPdfBytes(
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
      employeeHasP12: true,
      employeeSignerName: item.employeeSignerName || item.employeeName,
      supervisorSignatureImage: item.supervisorSignatureImage,
      supervisorHasP12: true,
      signerName: "Malto Ace Mata",
    },
    item.rows,
    item.signatureImage,
    true,
    ralphOpts
  );

  const pdfText = Buffer.from(result.bytes).toString("binary");
  const sigs = pdfText.match(/\/Type\s*\/Sig/g);
  const names = pdfText.match(/\/Name\s*\(([^)]+)\)/g);
  console.log("Result Sigs Count:", sigs ? sigs.length : 0);
  console.log("Result Names:", names);
}

test().catch(console.error);
