import { safeLoadPdfDocument, extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream, extractVerticalLinesFromContentStream, extractHorizontalLinesFromContentStream, detectRasterSignatureLine } from '../src/utils/dtrVectorPdf';
import fs from 'fs';

(async () => {
  const bytes = fs.readFileSync('scratch/cert_test.pdf');
  const pdfDoc = await safeLoadPdfDocument(bytes);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();
  console.log('Page dims:', width, height);
  
  // Test raster line detection
  const rLine = detectRasterSignatureLine(pdfDoc, page);
  console.log('Raster line:', rLine);
})();
