import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream, extractVerticalLinesFromContentStream } from '../src/utils/dtrVectorPdf.js';

async function main() {
  const bytes = fs.readFileSync('scratch/test_dv_real.pdf');
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(0);
  const size = page.getSize();
  console.log('Size:', size);
  const sBytes = extractPageContentStreamBytes(doc, page);
  const cmaps = loadPageFontCMaps(doc, page);
  const items = extractTextItemsFromContentStream(sBytes, cmaps);
  console.log(`Extracted ${items.length} items from scratch/test_dv_real.pdf:`);
  items.sort((a, b) => b.y - a.y || a.x - b.x);
  for (const it of items) {
    console.log(`[x=${it.x.toFixed(1)}, y=${it.y.toFixed(1)}] "${it.text}"`);
  }

  const vLines = extractVerticalLinesFromContentStream(sBytes);
  console.log(`\nVertical lines count: ${vLines.length}`);
  for (const vl of vLines) {
    console.log(`  vLine at x=${vl.x.toFixed(1)}, y=${vl.minY.toFixed(1)} to ${vl.maxY.toFixed(1)}`);
  }
}

main().catch(console.error);
