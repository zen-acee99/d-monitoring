import fs from 'fs';
import { PDFDocument, PDFName, PDFArray } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';

async function main() {
  const dir = 'c:/Users/Ace/Downloads';
  const files = [
    'DTR_Form48_Ace_Mata_Malto_2026 (10).pdf',
    'DTR_Form48_Ace_Mata_Malto_2026 (9)_Signed_ReneJane.pdf',
    'DTR_Form48_Ace_Mata_Malto_2026 (9).pdf',
    'DTR_Form48_Ace_Mata_Malto_2026.pdf'
  ];

  for (const f of files) {
    const fullPath = `${dir}/${f}`;
    if (!fs.existsSync(fullPath)) continue;
    console.log(`\n=================== ${f} ===================`);
    const bytes = fs.readFileSync(fullPath);
    const pdfDoc = await PDFDocument.load(bytes);
    const page = pdfDoc.getPage(0);
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    const fontCMaps = loadPageFontCMaps(pdfDoc, page);
    const items = extractTextItemsFromContentStream(sBytes, fontCMaps);
    console.log(`Total extracted items: ${items.length}`);
    for (const it of items) {
      const u = it.text.toUpperCase();
      if (u.includes('DIGITALLY') || u.includes('DIGISIGNED') || u.includes('BUENA') || u.includes('RENE') || u.includes('ACE') || u.includes('MALTO')) {
        console.log(`  [x=${it.x.toFixed(1)}, y=${it.y.toFixed(1)}] "${it.text}"`);
      }
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
              if (str.includes('Digitally') || str.includes('Buena') || str.includes('Malto')) {
                apText += ` HAS TEXT: ${str.slice(0, 100).replace(/\r?\n/g, ' ')}`;
              }
            }
          }
        }
        console.log(`  Annot ${i}: ${t}, AP /N: ${apText}`);
      }
    }
  }
}

main().catch(console.error);
