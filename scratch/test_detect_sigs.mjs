import fs from 'fs';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFString, PDFHexString } from 'pdf-lib';

function getExistingSignatures(pdfDoc) {
  const signatures = [];
  const pages = pdfDoc.getPages();

  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const page = pages[pIdx];
    const annotsRef = page.node.lookup(PDFName.of('Annots'));
    if (!annotsRef || !annotsRef.asArray) continue;
    const annots = annotsRef.asArray();

    for (let i = 0; i < annots.length; i++) {
      const annot = page.node.context.lookup(annots[i]);
      if (!(annot instanceof PDFDict)) continue;

      const subtype = annot.lookup(PDFName.of('Subtype'))?.toString();
      const ft = annot.lookup(PDFName.of('FT'))?.toString();

      // Check if it's a signature widget
      if (subtype === '/Widget' && ft === '/Sig') {
        const rectArr = annot.lookup(PDFName.of('Rect'));
        let rect = null;
        if (rectArr && rectArr.asArray) {
          rect = rectArr.asArray().map(r => r.asNumber ? r.asNumber() : Number(r));
        }

        let signerName = '';
        let signDate = '';
        const vRef = annot.lookup(PDFName.of('V'));
        if (vRef) {
          const vDict = page.node.context.lookup(vRef);
          if (vDict instanceof PDFDict) {
            const nameObj = vDict.lookup(PDFName.of('Name'));
            if (nameObj) {
              signerName = nameObj.decodeText ? nameObj.decodeText() : nameObj.toString().replace(/[()]/g, '');
            }
            const dateObj = vDict.lookup(PDFName.of('M'));
            if (dateObj) {
              signDate = dateObj.decodeText ? dateObj.decodeText() : dateObj.toString().replace(/[()]/g, '');
            }
          }
        }

        // Also check /T (field name)
        const tObj = annot.lookup(PDFName.of('T'));
        const fieldName = tObj ? (tObj.decodeText ? tObj.decodeText() : tObj.toString().replace(/[()]/g, '')) : '';

        signatures.push({
          pageIndex: pIdx,
          rect, // [llx, lly, urx, ury]
          signerName,
          signDate,
          fieldName,
        });
      }
    }
  }

  return signatures;
}

async function testSigs() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1793905166091_27734990.pdf';
  const buf = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const sigs = getExistingSignatures(pdfDoc);
  console.log('Detected existing signatures:', sigs);
}

testSigs().catch(console.error);
