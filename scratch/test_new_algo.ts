import fs from 'fs';
import zlib from 'zlib';
import { safeLoadPdfDocument } from '../src/utils/dtrVectorPdf';
import { PDFName, PDFDict, PDFRawStream } from 'pdf-lib';

function detectRasterSignatureLine(pdfDoc: any, page: any) {
  try {
    const resources = page.node.Resources();
    if (!resources) return null;
    const xObject = resources.lookupMaybe(PDFName.of("XObject"), PDFDict);
    if (!xObject) return null;

    const { width: pageWidth, height: pageHeight } = page.getSize();
    const keys = xObject.keys();

    for (const key of keys) {
      const ref = xObject.get(key);
      const stream = pdfDoc.context.lookup(ref);
      if (!(stream instanceof PDFRawStream)) continue;

      const dict = stream.dict;
      const subtype = dict.lookup(PDFName.of("Subtype"))?.toString();
      if (subtype !== "/Image") continue;

      const imgW = Number(dict.lookup(PDFName.of("Width"))?.toString() || 0);
      const imgH = Number(dict.lookup(PDFName.of("Height"))?.toString() || 0);
      if (imgW < 400 || imgH < 400) continue;

      const filter = dict.lookup(PDFName.of("Filter"))?.toString();
      if (filter !== "/FlateDecode") continue;

      let raw: Uint8Array | null = null;
      try {
        raw = new Uint8Array(zlib.inflateSync(Buffer.from(stream.contents)));
      } catch (e) {
        console.error('zlib inflate error:', e);
      }

      if (!raw || raw.length < imgW * imgH) continue;

      const bytesPerPixel = Math.floor(raw.length / (imgW * imgH));
      if (bytesPerPixel < 1 || bytesPerPixel > 4) continue;

      const startRow = Math.floor(imgH * 0.65);
      const endRow = Math.floor(imgH * 0.94);

      let bestLine: any = null;
      let maxRunLen = 0;

      for (let r = startRow; r < endRow; r++) {
        const rowOffset = r * imgW * bytesPerPixel;
        let currentRun = 0;
        let runStart = 0;

        for (let c = 50; c < imgW - 50; c++) {
          const idx = rowOffset + c * bytesPerPixel;
          let brightness = 255;
          if (bytesPerPixel === 1) {
            brightness = raw[idx];
          } else if (bytesPerPixel === 3) {
            brightness = 0.299 * raw[idx] + 0.587 * raw[idx + 1] + 0.114 * raw[idx + 2];
          } else if (bytesPerPixel === 4) {
            brightness = 255 - raw[idx + 3];
          }

          if (brightness < 70) {
            if (currentRun === 0) runStart = c;
            currentRun++;
            if (currentRun > maxRunLen) {
              maxRunLen = currentRun;
              const pdfY = (imgH - r) * (pageHeight / imgH);
              const minX = runStart * (pageWidth / imgW);
              const maxX = (runStart + currentRun) * (pageWidth / imgW);
              bestLine = {
                y: Math.round(pdfY * 10) / 10,
                minX: Math.round(minX * 10) / 10,
                maxX: Math.round(maxX * 10) / 10,
                width: Math.round((maxX - minX) * 10) / 10,
                centerX: Math.round(((minX + maxX) / 2) * 10) / 10,
              };
            }
          } else {
            currentRun = 0;
          }
        }
      }

      if (bestLine && bestLine.width >= 80 && bestLine.y >= 70 && bestLine.y <= 150) {
        return bestLine;
      }
    }
  } catch (err) {
    console.error('detectRasterSignatureLine error:', err);
  }
  return null;
}

async function main() {
  const buf = fs.readFileSync('scratch/cert_test.pdf');
  const pdfDoc = await safeLoadPdfDocument(buf);
  const page = pdfDoc.getPages()[0];
  const detectedLine = detectRasterSignatureLine(pdfDoc, page);
  console.log('Detected raster signature line:', detectedLine);

  if (detectedLine) {
    const boxW = 152;
    const boxH = 28;
    const boxY = Math.round(detectedLine.y + 4); // 4pt above underline
    const boxX = Math.round(detectedLine.centerX - boxW / 2);
    console.log(`Single Signer: boxX=${boxX}, boxY=${boxY}, boxW=${boxW}, boxH=${boxH}`);
    console.log(`Top edge of single signer: ${boxY + boxH} (Safe gap below 165: ${165 - (boxY + boxH)} pt)`);

    // Two signers (e.g. Ace and Annabel):
    const signer1X = Math.round(detectedLine.centerX + 10);
    const signer2X = Math.round(detectedLine.centerX - boxW - 10);
    console.log(`Two Signers Side-by-side above line:`);
    console.log(`  Signer 1 (Mam Bhel): boxX=${signer1X}, boxY=${boxY}`);
    console.log(`  Signer 2 (Ace Malto): boxX=${signer2X}, boxY=${boxY}`);
  }
}

main().catch(console.error);
