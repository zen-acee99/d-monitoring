import fs from 'fs';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream } from 'pdf-lib';
import { decodePDFRawStream } from 'pdf-lib';

// Let's test the signature detection and user matching on the sample PDF!
const userList = [
  { name: 'Annabel C. Odoño-Calimpong', role: 'Regional Director' },
  { name: 'Leah B. Dy', role: 'Chief Administrative Officer' },
  { name: 'Ace Malto', role: 'Super Admin' },
  { name: 'Rene Jane R. Buena', role: 'Provincial Officer' },
  { name: 'DE LEON, KEN MATTHEW L.', role: 'ISA I' },
];

function normalizeNameForMatch(name) {
  return (name || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(ENGR\.?|ATTY\.?|DIR\.?|DR\.?)\s+/i, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
      } catch (err) {}
    }
  }

  return detected;
}

// Let's test matching against userList with sample PDF
async function testScan() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1793905166091_27734990.pdf';
  const buf = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  
  const existingSigs = detectExistingPdfSignatures(pdfDoc);
  console.log('Existing sigs:', existingSigs.length);
  for (const s of existingSigs) {
    console.log(`- Page ${s.pageIndex + 1}: Name="${s.signerName}", Rect=${JSON.stringify(s.rect)}`);
  }

  // Check matching against users
  // Balana Danrev -> not in userList
  // Cabredo Carla -> not in userList
  // Leah Dy -> in userList. Does she have a sig?
  const leahSig = existingSigs.find(s => normalizeNameForMatch(s.signerName).includes('LEAH') || normalizeNameForMatch(s.signerName).includes('DY'));
  console.log('Leah Dy existing signature:', leahSig ? 'FOUND (Already Signed)' : 'NOT FOUND');

  // Annabel -> in userList. Does she have a sig?
  const annabelSig = existingSigs.find(s => normalizeNameForMatch(s.signerName).includes('ANNABEL') || normalizeNameForMatch(s.signerName).includes('CALIMPONG'));
  console.log('Annabel existing signature:', annabelSig ? 'FOUND (Already Signed)' : 'NOT FOUND (Need to Sign)');
}

testScan().catch(console.error);
