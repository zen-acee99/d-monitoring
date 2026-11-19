import fs from 'fs';
import zlib from 'zlib';
import { safeLoadPdfDocument } from '../src/utils/dtrVectorPdf';
import { PDFName } from 'pdf-lib';

async function main() {
  const buf = fs.readFileSync('scratch/cert_test.pdf');
  const pdfDoc = await safeLoadPdfDocument(buf);
  const page = pdfDoc.getPages()[0];
  const resources = page.node.Resources();
  const xObject = resources?.lookup(PDFName.of('XObject'));
  const imgRef = (xObject as any).get(PDFName.of('Image5'));
  const imgStream = pdfDoc.context.lookup(imgRef);
  const dict = (imgStream as any).dict;
  const width = Number(dict.get(PDFName.of('Width'))?.toString());
  const height = Number(dict.get(PDFName.of('Height'))?.toString());
  const compressed = (imgStream as any).contents;
  console.log(`Decompressing ${width}x${height} image...`);
  const raw = zlib.inflateSync(Buffer.from(compressed));
  console.log('Decompressed size:', raw.length, 'expected:', width * height * 3);

  // Let's scan rows from row 1400 to row 1950 to find dark pixels/lines
  // In each row, calculate average brightness and find horizontal segments of dark pixels (underline)
  const rowStats: Array<{ row: number; pdfY: number; avgBrightness: number; darkCount: number }> = [];

  for (let r = 1400; r < 1950; r++) {
    let sumBrightness = 0;
    let darkCount = 0;
    const rowOffset = r * width * 3;
    for (let c = 0; c < width; c++) {
      const idx = rowOffset + c * 3;
      const red = raw[idx];
      const green = raw[idx + 1];
      const blue = raw[idx + 2];
      const brightness = 0.299 * red + 0.587 * green + 0.114 * blue;
      sumBrightness += brightness;
      if (brightness < 60) {
        darkCount++;
      }
    }
    const pdfY = (height - r) * 0.42095;
    rowStats.push({ row: r, pdfY, avgBrightness: sumBrightness / width, darkCount });
  }

  // Find rows with significant dark pixel clusters (text rows or horizontal lines)
  const candidateRows = rowStats.filter(s => s.darkCount > 15);
  console.log('Candidate rows with text or lines in bottom region:');
  for (const s of candidateRows) {
    if (s.darkCount > 80) { // prominent line or dense text
      console.log(`row=${s.row}, pdfY=${s.pdfY.toFixed(1)} pt, darkCount=${s.darkCount}, avg=${s.avgBrightness.toFixed(1)}`);
    }
  }

  // Also let's find the horizontal line: a continuous horizontal streak of dark pixels near center
  console.log('\n--- Searching for horizontal line segments ---');
  for (let r = 1600; r < 1900; r++) {
    const rowOffset = r * width * 3;
    let maxRun = 0;
    let currentRun = 0;
    let runStart = 0;
    let bestStart = 0;
    for (let c = 200; c < width - 200; c++) {
      const idx = rowOffset + c * 3;
      const b = 0.299 * raw[idx] + 0.587 * raw[idx + 1] + 0.114 * raw[idx + 2];
      if (b < 70) {
        if (currentRun === 0) runStart = c;
        currentRun++;
        if (currentRun > maxRun) {
          maxRun = currentRun;
          bestStart = runStart;
        }
      } else {
        currentRun = 0;
      }
    }
    if (maxRun > 150) {
      const pdfY = (height - r) * 0.42095;
      const pdfX1 = bestStart * 0.42099;
      const pdfX2 = (bestStart + maxRun) * 0.42099;
      console.log(`LINE DETECTED at row ${r}: pdfY=${pdfY.toFixed(1)} pt, runLen=${maxRun}px (${(maxRun * 0.42).toFixed(1)} pt), X: [${pdfX1.toFixed(1)}, ${pdfX2.toFixed(1)}]`);
    }
  }
}

main().catch(console.error);
