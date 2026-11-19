import fs from 'fs';
import { safeLoadPdfDocument } from '../src/utils/dtrVectorPdf';
import { PDFName, PDFRawStream } from 'pdf-lib';

async function decompressFlate(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    if (typeof process !== "undefined" && process.versions?.node) {
      const zlib = await import("node:zlib");
      return new Uint8Array(zlib.inflateSync(bytes));
    }
  } catch (e) {
    console.error('Node zlib error:', e);
  }
  return null;
}

async function main() {
  const buf = fs.readFileSync('scratch/cert_test.pdf');
  const pdfDoc = await safeLoadPdfDocument(buf);
  const page = pdfDoc.getPages()[0];
  const resources = page.node.Resources();
  const xObject = resources?.lookup(PDFName.of('XObject'));
  const imgRef = (xObject as any).get(PDFName.of('Image5'));
  const imgStream = pdfDoc.context.lookup(imgRef);
  const compressed = (imgStream as any).contents;
  const raw = await decompressFlate(compressed);
  console.log('Decompressed successfully, len:', raw?.length);
}
main().catch(console.error);
