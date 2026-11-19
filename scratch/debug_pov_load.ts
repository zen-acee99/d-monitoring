import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

async function main() {
  const buf = fs.readFileSync('scratch/test_pov.pdf');
  try {
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true, parseSpeed: 500 });
    console.log("Loaded successfully with parseSpeed 500!");
    console.log("Pages count:", doc.getPageCount());
  } catch (e) {
    console.log("Failed with default load:", e.message);
  }

  // Check what PDFCatalog has
  try {
    const doc2 = await PDFDocument.load(buf, { updateMetadata: false });
    console.log("Loaded with updateMetadata false!");
  } catch (e) {
    console.log("Failed with updateMetadata false:", e.message);
  }
}

main();
