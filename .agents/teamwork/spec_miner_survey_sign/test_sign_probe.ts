import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import {
  findPersonnelSignatureCoordinates,
  scanPdfForSigners,
  extractPageContentStreamBytes,
  loadPageFontCMaps,
  extractTextItemsFromContentStream,
  matchNames,
  normalizeName
} from "../../../src/utils/dtrVectorPdf";

async function probe() {
  const samplePath = path.resolve(".agents/teamwork/spec_miner_survey_sign/samples/sta_elena.pdf");
  const bytes = fs.readFileSync(samplePath);
  console.log("sta_elena.pdf size:", bytes.length);

  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  console.log("Pages count:", doc.getPageCount());

  // Let's inspect page 0 text items
  const page0 = doc.getPage(0);
  const sBytes = extractPageContentStreamBytes(doc, page0);
  const cmaps = loadPageFontCMaps(doc, page0);
  const items = extractTextItemsFromContentStream(sBytes, cmaps);

  console.log("Page 0 extracted text items count:", items.length);
  const matchingItems = items.filter(it => 
    it.text.toLowerCase().includes("annabel") || 
    it.text.toLowerCase().includes("calimpong") ||
    it.text.toLowerCase().includes("elena")
  );
  console.log("Matching text items on page 0:", matchingItems);

  console.log("\nTesting scanPdfForSigners:");
  const scanRes = await scanPdfForSigners(bytes, [
    { id: "usr-muxedv66", name: "Annabel C. Odoño-Calimpong", role: "Regional Director" }
  ]);
  console.log("Scan result signers:", scanRes.detectedSigners);

  console.log("\nTesting findPersonnelSignatureCoordinates:");
  try {
    const loc = findPersonnelSignatureCoordinates(doc, "ANNABEL C. ODOÑO-CALIMPONG");
    console.log("Found loc:", loc);
  } catch (err: any) {
    console.error("findPersonnelSignatureCoordinates ERROR:", err.message, err.stack);
  }
}

probe().catch(console.error);
