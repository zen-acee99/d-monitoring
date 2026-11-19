import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { repairPdfCatalogIfCorrupted } from '../src/utils/dtrVectorPdf.js';

async function safeLoad(bytes: Uint8Array): Promise<PDFDocument> {
  // Try 1: Normal load
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    doc.getPages(); // force evaluate catalog!
    return doc;
  } catch (err1) {
    console.log("Normal load failed, repairing catalog:", err1.message);
  }

  // Try 2: Repaired catalog load
  const repaired = repairPdfCatalogIfCorrupted(bytes);
  const doc2 = await PDFDocument.load(repaired, { ignoreEncryption: true });
  const p = doc2.getPages();
  console.log("Repaired load SUCCESS! Page count:", p.length);
  return doc2;
}

const bytes = fs.readFileSync('./scratch/test_pov.pdf');
safeLoad(bytes).catch(console.error);
