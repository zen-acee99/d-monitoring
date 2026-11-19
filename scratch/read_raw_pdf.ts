import fs from 'fs';
import { safeLoadPdfDocument, extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';

(async () => {
  const filePath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1794462315678_2f794efa.pdf';
  const buf = fs.readFileSync(filePath);
  console.log('File size:', buf.length);

  const pdfDoc = await safeLoadPdfDocument(buf);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();
  console.log('Dimensions:', width, height);

  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  console.log('sBytes length:', sBytes.length);
  const str = new TextDecoder('latin1').decode(sBytes);
  console.log('First 500 chars of decoded stream:\n', str.slice(0, 500));

  const fontCMaps = loadPageFontCMaps(pdfDoc, page);
  console.log('fontCMaps size:', fontCMaps.size);

  const items = extractTextItemsFromContentStream(sBytes, fontCMaps);
  console.log('Extracted items count:', items.length);
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    console.log(`[${i}] x=${it.x.toFixed(1)}, y=${it.y.toFixed(1)}, text=${JSON.stringify(it.text)}`);
  }
})();
