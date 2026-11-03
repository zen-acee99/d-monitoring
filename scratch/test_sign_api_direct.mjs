import fs from "fs";
import { PDFDocument } from "pdf-lib";

async function main() {
  console.log("Creating test PDF...");
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  page.drawText("Test Document", { x: 50, y: 700, size: 12 });
  const bytes = await doc.save();
  const base64 = Buffer.from(bytes).toString("base64");

  console.log("Calling API at http://localhost:3001/api/dtr-generator/sign-pdf...");
  const res = await fetch("http://localhost:3001/api/dtr-generator/sign-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pdfBase64: base64,
      profileId: "dtr-sig-sup-01",
      user_Id: "usr-mu72vs2b",
      sigRect: [320, 80, 125, 26],
      fieldName: "Supervisor_Signature_ReneJane",
      pageIndex: 0,
      reason: "Test Auto-Sign API Direct"
    })
  });

  console.log("Response status:", res.status);
  const data = await res.json();
  console.log("API response success:", data.success);
  if (data.success) {
    console.log("Signer name:", data.signerName);
    console.log("Serial:", data.signerIdentity?.serialNumber);
    console.log("Signed PDF base64 length:", data.signedPdfBase64?.length);
  } else {
    console.error("API error:", data.error);
  }
}

main().catch(console.error);
