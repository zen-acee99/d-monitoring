import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import zlib from 'zlib';
import { repairPdfCatalogIfCorrupted } from '../src/utils/dtrVectorPdf.js';

const bytes = fs.readFileSync('./scratch/test_pov.pdf');
const repaired = repairPdfCatalogIfCorrupted(bytes);
const pdfDoc = await PDFDocument.load(repaired);
const page = pdfDoc.getPages()[0];
const contentsNode = page.node.Contents();
const rawBytes = contentsNode.contents;

console.log("Raw bytes length:", rawBytes.length);
console.log("First 16 bytes:", Array.from(rawBytes.slice(0, 16)));

// Try skipping 2 bytes (deflate header)
for (let skip = 0; skip <= 4; skip++) {
  try {
    const res = zlib.inflateRawSync(Buffer.from(rawBytes.slice(skip)));
    console.log(`zlib.inflateRawSync with skip ${skip} SUCCESS! length:`, res.length);
    console.log("Sample text:", res.toString('latin1').slice(0, 200));
    break;
  } catch (e) {
    // console.log(`skip ${skip} failed:`, e.message);
  }
}

// Try standard inflate
try {
  const res = zlib.inflateSync(Buffer.from(rawBytes));
  console.log("zlib.inflateSync SUCCESS! length:", res.length);
} catch (e) {
  console.log("zlib.inflateSync failed:", e.message);
}
