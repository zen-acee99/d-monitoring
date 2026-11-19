import fs from 'fs';
import { PDFDocument, PDFName, PDFArray } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';

async function checkFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.log('File does not exist:', filePath);
    return;
  }
  console.log(`\n=================== ${filePath} ===================`);
  const bytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(bytes);
  console.log('Page count:', pdfDoc.getPageCount());
  const page = pdfDoc.getPage(0);
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const fontCMaps = loadPageFontCMaps(pdfDoc, page);
  const items = extractTextItemsFromContentStream(sBytes, fontCMaps);
  console.log(`Extracted text items: ${items.length}`);
  
  const digi = items.filter(it => it.text.toLowerCase().includes('digitally') || it.text.toLowerCase().includes('digisigned') || it.text.toLowerCase().includes('malto') || it.text.toLowerCase().includes('buena'));
  console.log('Matching page content items:');
  for (const it of digi) {
    console.log(`  [x=${it.x.toFixed(1)}, y=${it.y.toFixed(1)}] "${it.text}"`);
  }

  const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (annots) {
    console.log(`Annots count: ${annots.size()}`);
    for (let i = 0; i < annots.size(); i++) {
      const a = pdfDoc.context.lookup(annots.get(i));
      const t = a.lookup(PDFName.of('T'))?.toString();
      const ap = a.lookup(PDFName.of('AP'));
      let apText = 'none';
      if (ap && ap.lookup) {
        const n = ap.lookup(PDFName.of('N'));
        if (n) {
          const stm = pdfDoc.context.lookup(n);
          if (stm && (stm as any).getContents) {
            const raw = Buffer.from((stm as any).getContents());
            apText = `${raw.length} bytes`;
            const str = raw.toString('latin1');
            apText += ` content: ${str.replace(/\r?\n/g, ' ')}`;
          }
        }
      }
      console.log(`  Annot ${i}: ${t}, AP /N: ${apText}`);
    }
  }
}

async function main() {
  await checkFile('c:/Users/Ace/Downloads/DTR_Malto-Nov(1-15) (1).pdf');
  await checkFile('c:/Users/Ace/Downloads/DTR_Malto-Nov(1-15).pdf');
}

main().catch(console.error);
