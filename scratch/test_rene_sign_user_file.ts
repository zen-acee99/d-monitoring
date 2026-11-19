import fs from 'fs';
import { autoSignPdfWithReneJane } from '../src/utils/reneJaneAutoSign';
import { PDFDocument, PDFName, PDFArray } from 'pdf-lib';

async function test() {
  const bytes = fs.readFileSync('c:/Users/Ace/Downloads/DTR_Malto-Nov(1-15).pdf');
  console.log('Running autoSignPdfWithReneJane on DTR_Malto-Nov(1-15).pdf...');
  const res = await autoSignPdfWithReneJane(bytes, 'DTR_Malto-Nov(1-15).pdf');
  console.log('Result success:', res.success);
  console.log('isCryptographic:', res.isCryptographic);
  console.log('detectedReason:', res.detectedReason);

  const signedDoc = await PDFDocument.load(res.signedPdfBytes);
  const page = signedDoc.getPage(0);
  const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  console.log(`Signed document annots count: ${annots?.size()}`);
  for (let i = 0; i < (annots?.size() || 0); i++) {
    const a = signedDoc.context.lookup(annots!.get(i));
    const t = a.lookup(PDFName.of('T'))?.toString();
    const ap = a.lookup(PDFName.of('AP'));
    let apText = 'none';
    if (ap && ap.lookup) {
      const n = ap.lookup(PDFName.of('N'));
      if (n) {
        const stm = signedDoc.context.lookup(n);
        if (stm && (stm as any).getContents) {
          const raw = Buffer.from((stm as any).getContents());
          apText = `${raw.length} bytes: ${raw.toString('latin1').replace(/\r?\n/g, ' ')}`;
        }
      }
    }
    console.log(`  Annot ${i}: ${t} AP/N: ${apText}`);
  }
}

test().catch(console.error);
