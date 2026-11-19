import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import zlib from 'zlib';
import { repairPdfCatalogIfCorrupted } from '../src/utils/dtrVectorPdf.js';

const bytes = fs.readFileSync('./scratch/test_pov.pdf');
const repaired = repairPdfCatalogIfCorrupted(bytes);
const pdfDoc = await PDFDocument.load(repaired);
const page = pdfDoc.getPages()[0];
const contentsNode = page.node.Contents();

const arr = (contentsNode as any).asArray ? (contentsNode as any).asArray() : [contentsNode];
console.log("Contents array length:", arr.length);

for (const ref of arr) {
  const obj = pdfDoc.context.lookup(ref);
  const rawBytes = (obj as any).contents;
  console.log("Stream raw bytes length:", rawBytes.length, "header:", rawBytes.slice(0, 4));
  try {
    const uncompressed = zlib.inflateSync(Buffer.from(rawBytes));
    console.log("zlib.inflateSync SUCCESS! Uncompressed length:", uncompressed.length);
    console.log("Text snippet:", uncompressed.toString('latin1').slice(0, 300));
  } catch (e) {
    console.log("zlib.inflateSync failed:", e.message);
    try {
      const rawInflate = zlib.inflateRawSync(Buffer.from(rawBytes));
      console.log("zlib.inflateRawSync SUCCESS! Uncompressed length:", rawInflate.length);
    } catch (e2) {
      console.log("zlib.inflateRawSync failed:", e2.message);
    }
  }
}
