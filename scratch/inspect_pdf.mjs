import fs from 'fs';
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';

async function inspect() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1793905166091_27734990.pdf';
  const buf = fs.readFileSync(pdfPath);
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  console.log('Page count:', doc.getPageCount());
  
  for (let i = 0; i < doc.getPageCount(); i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    console.log(`\n--- Page ${i + 1} (${width} x ${height}) ---`);
    
    // Check annots
    const annotsRef = page.node.lookup(PDFName.of('Annots'));
    if (annotsRef && annotsRef.asArray) {
      const annots = annotsRef.asArray();
      console.log('Annots count:', annots.length);
      for (let j = 0; j < annots.length; j++) {
        const annotRef = annots[j];
        const annot = page.node.context.lookup(annotRef);
        if (annot instanceof PDFDict) {
          const subtype = annot.lookup(PDFName.of('Subtype'))?.toString();
          const ft = annot.lookup(PDFName.of('FT'))?.toString();
          const rect = annot.lookup(PDFName.of('Rect'))?.asArray?.()?.map(r => r.asNumber?.());
          const t = annot.lookup(PDFName.of('T'))?.toString();
          const v = annot.lookup(PDFName.of('V'));
          console.log(`Annot ${j}: Subtype=${subtype}, FT=${ft}, T=${t}, Rect=${JSON.stringify(rect)}`);
          if (v) {
            const vDict = page.node.context.lookup(v);
            if (vDict instanceof PDFDict) {
              const name = vDict.lookup(PDFName.of('Name'))?.toString();
              const m = vDict.lookup(PDFName.of('M'))?.toString();
              const contact = vDict.lookup(PDFName.of('ContactInfo'))?.toString();
              console.log(`   Signature V: Name=${name}, M=${m}, Contact=${contact}`);
            }
          }
        }
      }
    } else {
      console.log('No annots array on page', i + 1);
    }
  }

  // Also check AcroForm
  const acroForm = doc.catalog.lookup(PDFName.of('AcroForm'));
  if (acroForm && acroForm instanceof PDFDict) {
    const fields = acroForm.lookup(PDFName.of('Fields'));
    console.log('\nAcroForm Fields:', fields?.toString());
    if (fields && fields.asArray) {
      for (const fRef of fields.asArray()) {
        const f = doc.context.lookup(fRef);
        if (f instanceof PDFDict) {
          console.log('Field:', f.lookup(PDFName.of('T'))?.toString(), 'FT:', f.lookup(PDFName.of('FT'))?.toString(), 'Rect:', f.lookup(PDFName.of('Rect'))?.asArray?.()?.map(r => r.asNumber?.()));
        }
      }
    }
  }
}

inspect().catch(console.error);
