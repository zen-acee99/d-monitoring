import fs from "fs";
import { autoSignPdfWithReneJane } from "../src/utils/reneJaneAutoSign";

// Polyfill fetch for node to hit backend
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === "string" && input.startsWith("/api")) {
    input = `http://localhost:3001${input}`;
  }
  return originalFetch(input, init);
};

async function test() {
  const dtrBytes = new Uint8Array(fs.readFileSync("public/DTR_Ace_M._Malto_September_2026.pdf"));
  console.log("Original DTR size:", dtrBytes.length);

  const res = await autoSignPdfWithReneJane(dtrBytes, "DTR_Ace_M._Malto_September_2026.pdf");
  console.log("Auto-sign result:", {
    success: res.success,
    detectedReason: res.detectedReason,
    docType: res.docType,
    pageIndex: res.pageIndex,
    signatureCount: res.signatureCount,
    isCryptographic: res.isCryptographic,
    error: res.error,
  });

  if (res.signedPdfBytes) {
    fs.writeFileSync("scratch/test_autosigned_output.pdf", res.signedPdfBytes);
    console.log("Wrote scratch/test_autosigned_output.pdf, size:", res.signedPdfBytes.length);
  }
}

test().catch(console.error);
