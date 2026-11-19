import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';

async function scanDirs() {
  const dirs = ['c:/Users/Ace/Downloads', 'c:/Users/Ace/Desktop', 'scratch', 'public'];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'));
    for (const f of files) {
      try {
        const fullPath = `${dir}/${f}`;
        const bytes = fs.readFileSync(fullPath);
        const pdfDoc = await PDFDocument.load(bytes);
        const page = pdfDoc.getPage(0);
        const sBytes = extractPageContentStreamBytes(pdfDoc, page);
        const fontCMaps = loadPageFontCMaps(pdfDoc, page);
        const items = extractTextItemsFromContentStream(sBytes, fontCMaps);
        const digiItems = items.filter(it => it.text.toLowerCase().includes('digitally') || it.text.toLowerCase().includes('digisigned'));
        if (digiItems.length >= 4) {
          const aceItems = items.filter(it => it.text.toUpperCase().includes('ACE') || it.text.toUpperCase().includes('MALTO'));
          const reneItems = items.filter(it => it.text.toUpperCase().includes('RENE') || it.text.toUpperCase().includes('BUENA'));
          console.log(`\nFound: ${fullPath} - Total digi items: ${digiItems.length}`);
          for (const it of digiItems) {
            console.log(`  Digi: [x=${it.x.toFixed(1)}, y=${it.y.toFixed(1)}] "${it.text}"`);
          }
        }
      } catch {}
    }
  }
}

scanDirs().catch(console.error);
