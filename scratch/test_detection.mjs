import fs from "fs";
import { PDFDocument } from "pdf-lib";

async function inspect(pdfPath) {
  console.log("\n=== Inspecting:", pdfPath);
  const buf = fs.readFileSync(pdfPath);
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  console.log("Pages count:", doc.getPageCount());

  // Search raw string for clues
  const str = buf.toString("latin1");
  const isDtr = /Civil Service Form No\.?\s*48|DAILY TIME RECORD|VERIFIED as to the prescribed/i.test(str);
  const isAr = /Accomplishment Report|Monthly Accomplishment|Deliverables/i.test(str);
  console.log("Detected flags: isDtr =", isDtr, ", isAr =", isAr);

  for (let i = 0; i < doc.getPageCount(); i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    console.log(`Page ${i + 1} size: ${width} x ${height}`);
  }
}

async function run() {
  await inspect("public/DTR_Ace_M._Malto_September_2026.pdf");
  await inspect("public/AR_Ace_M._Malto_September_2026.pdf");
}

run().catch(console.error);
