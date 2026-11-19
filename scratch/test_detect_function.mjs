import fs from 'fs';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFString, PDFHexString } from 'pdf-lib';

function detectExistingPdfSignatures(pdfDoc) {
  const detected = [];
  const pages = pdfDoc.getPages();

  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const page = pages[pIdx];
    let annotsArr = null;
    try {
      const a = page.node.lookup(PDFName.of("Annots"));
      if (a && a.asArray) annotsArr = a.asArray();
    } catch {}

    if (!annotsArr) continue;

    for (let i = 0; i < annotsArr.length; i++) {
      try {
        const annotRef = annotsArr[i];
        const annot = page.node.context.lookup(annotRef);
        if (!(annot instanceof PDFDict)) continue;

        const subtype = annot.lookup(PDFName.of("Subtype"))?.toString();
        const ft = annot.lookup(PDFName.of("FT"))?.toString();
        const vRef = annot.lookup(PDFName.of("V"));

        if ((subtype === "/Widget" && ft === "/Sig") || vRef) {
          let rect = null;
          const rectArr = annot.lookup(PDFName.of("Rect"));
          if (rectArr && rectArr.asArray) {
            rect = rectArr.asArray().map((r) => (r.asNumber ? r.asNumber() : Number(r)));
          }

          let signerName = "";
          let signDate = "";
          if (vRef) {
            const vDict = page.node.context.lookup(vRef);
            if (vDict instanceof PDFDict) {
              const nameObj = vDict.lookup(PDFName.of("Name"));
              if (nameObj) {
                signerName = nameObj.decodeText ? nameObj.decodeText() : nameObj.toString().replace(/[()]/g, "");
              }
              const dateObj = vDict.lookup(PDFName.of("M"));
              if (dateObj) {
                signDate = dateObj.decodeText ? dateObj.decodeText() : dateObj.toString().replace(/[()]/g, "");
              }
            }
          }

          const tObj = annot.lookup(PDFName.of("T"));
          const fieldName = tObj ? (tObj.decodeText ? tObj.decodeText() : tObj.toString().replace(/[()]/g, "")) : "";

          detected.push({
            pageIndex: pIdx,
            rect,
            signerName: signerName.trim(),
            signDate: signDate.trim(),
            fieldName: fieldName.trim(),
          });
        }
      } catch (err) {
        console.warn("Error inspecting annot:", err);
      }
    }
  }

  return detected;
}

async function test() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1793905166091_27734990.pdf';
  const buf = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const sigs = detectExistingPdfSignatures(pdfDoc);
  console.log('Result:', JSON.stringify(sigs, null, 2));
}

test().catch(console.error);
