import { db } from "../server/db.js";
import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { scanPdfForSigners } from "../src/utils/dtrVectorPdf.js";

async function inspectDv() {
  const full = await db.execute({
    sql: "SELECT pdf_data FROM dtr_storage WHERE id = ?",
    args: ["doc-upload-1794223582282-8-j69c"],
  });
  let b64 = full.rows[0].pdf_data as string;
  if (b64.startsWith("data:")) b64 = b64.split(",")[1];
  const buf = Buffer.from(b64, "base64");
  fs.writeFileSync("scratch/test_dv_real.pdf", buf);
  console.log("Saved scratch/test_dv_real.pdf, size:", buf.length);

  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();
  console.log("Page size:", { width, height });

  const mockUsers = [
    { name: "ANNABEL C. ODOÑO-CALIMPONG", role: "OIC-Regional Director", email: "annabel.calimpong@dict.gov.ph" },
    { name: "AIVAN M. BALOLOY", role: "Accountant III", email: "aivan.baloloy@dict.gov.ph" },
  ];
  const scan = await scanPdfForSigners(new Uint8Array(buf), mockUsers);
  console.log("Existing signatures:", scan.existingSignatures);

  // Filter detected texts safely
  const relevant = scan.detectedTexts?.filter(t => {
    if (!t || !t.text) return false;
    const txt = t.text.toUpperCase();
    return txt.includes("ANNABEL") ||
      txt.includes("BALOLOY") ||
      txt.includes("PRINTED NAME") ||
      txt.includes("SIGNATURE") ||
      txt.includes("APPROVED") ||
      txt.includes("CERTIFIED") ||
      txt.includes("ACCOUNTANT") ||
      txt.includes("POSITION");
  });
  console.log("Relevant detected texts on page:");
  relevant?.forEach(r => console.log(`  "${r.text}" at x=${r.x.toFixed(1)}, y=${r.y.toFixed(1)}`));
}

inspectDv().catch(console.error);
