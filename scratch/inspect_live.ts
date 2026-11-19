import fs from 'fs';
import { PDFDocument, PDFName, PDFDict, PDFArray } from 'pdf-lib';

async function inspectLive() {
  const buf = fs.readFileSync('scratch/live_api_pass2.pdf');
  const doc = await PDFDocument.load(buf);
  console.log('Pages count:', doc.getPageCount());

  const af = doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  const fields = af?.lookupMaybe(PDFName.of("Fields"), PDFArray);
  console.log('AcroForm Fields count:', fields?.size());
  for (let i = 0; i < (fields?.size() || 0); i++) {
    const fRef = fields!.get(i);
    const f = doc.context.lookup(fRef) as PDFDict;
    const t = f.get(PDFName.of("T"))?.toString();
    const ft = f.get(PDFName.of("FT"))?.toString();
    const v = f.get(PDFName.of("V"))?.toString();
    console.log(`  Field ${i+1}: T=${t}, FT=${ft}, V=${v}`);
  }

  const annots = doc.getPages()[0].node.lookupMaybe(PDFName.of("Annots"), PDFArray);
  console.log('Page 0 Annots count:', annots?.size());
  for (let i = 0; i < (annots?.size() || 0); i++) {
    const a = doc.context.lookup(annots!.get(i)) as PDFDict;
    const subtype = a.get(PDFName.of("Subtype"))?.toString();
    const t = a.get(PDFName.of("T"))?.toString();
    const rect = a.get(PDFName.of("Rect"))?.toString();
    console.log(`  Annot ${i+1}: Subtype=${subtype}, T=${t}, Rect=${rect}`);
  }
}

inspectLive().catch(console.error);
