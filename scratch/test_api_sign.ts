import fs from 'fs';
import { PDFDocument, rgb } from 'pdf-lib';

async function testApiSigning() {
  // 1. Create a blank CS Form 48 DTR dummy PDF with 2 copies
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  page.drawText("CIVIL SERVICE FORM NO. 48 - DAILY TIME RECORD", { x: 100, y: 750, size: 12 });
  page.drawText("Copy 1 (Original)", { x: 100, y: 730, size: 10 });
  page.drawText("Copy 2 (Duplicate)", { x: 400, y: 730, size: 10 });
  
  // Personnel names
  page.drawText("ACE MATA MALTO", { x: 100, y: 170, size: 9 });
  page.drawText("ACE MATA MALTO", { x: 400, y: 170, size: 9 });

  // Supervisor names
  page.drawText("RENE JANE R. BUENA", { x: 100, y: 70, size: 9 });
  page.drawText("RENE JANE R. BUENA", { x: 400, y: 70, size: 9 });

  const pdfBytes = await doc.save();
  const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

  console.log("Created test PDF. Size:", pdfBytes.length);

  // 2. Call API to sign Pass 1 (Personnel)
  const empSigRects = [
    [54, 184, 249, 216],
    [354, 184, 549, 216]
  ];

  console.log("Calling /api/dtr-generator/sign-pdf for Pass 1...");
  const res1 = await fetch("http://localhost:3001/api/dtr-generator/sign-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pdfBase64,
      profileId: "dtr-sig-sup-01",
      sigRects: empSigRects,
      reason: "Civil Service Form No. 48 Daily Time Record Submission",
      fieldName: "Personnel_Signature"
    })
  });

  const data1 = await res1.json();
  if (!data1.success) {
    throw new Error("Pass 1 Failed: " + JSON.stringify(data1));
  }
  console.log("Pass 1 Success! Signed by:", data1.signerName);
  const pass1PdfBase64 = data1.signedPdfBase64;
  fs.writeFileSync("scratch/live_api_pass1.pdf", Buffer.from(pass1PdfBase64, "base64"));

  // 3. Call API to sign Pass 2 (Supervisor Incremental)
  const supSigRects = [
    [54, 84, 249, 116],
    [354, 84, 549, 116]
  ];

  console.log("Calling /api/dtr-generator/sign-pdf for Pass 2 (Incremental)...");
  const res2 = await fetch("http://localhost:3001/api/dtr-generator/sign-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pdfBase64: pass1PdfBase64,
      profileId: "dtr-sig-sup-01",
      sigRects: supSigRects,
      reason: "Civil Service Form No. 48 Official Verification",
      fieldName: "Supervisor_Signature"
    })
  });

  const data2 = await res2.json();
  if (!data2.success) {
    throw new Error("Pass 2 Failed: " + JSON.stringify(data2));
  }
  console.log("Pass 2 Success! Signed by:", data2.signerName);
  const pass2Pdf = Buffer.from(data2.signedPdfBase64, "base64");
  fs.writeFileSync("scratch/live_api_pass2.pdf", pass2Pdf);
  console.log("Wrote scratch/live_api_pass2.pdf. Size:", pass2Pdf.length);
}

testApiSigning().catch(console.error);
