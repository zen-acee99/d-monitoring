import fs from 'fs';
import { PDFDocument, PDFName, PDFArray, PDFDict, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';

export function refinedCheckVisualTypography(
  pdfDoc: PDFDocument,
  pageIndex: number,
  sigBox: { minX: number; minY: number; maxX: number; maxY: number },
  signerName?: string
): { exists: boolean; reason: string } {
  const pages = pdfDoc.getPages();
  const page = pages[pageIndex] || pages[0];
  if (!page) return { exists: false, reason: "No page" };

  const normSigner = (signerName || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. Check existing Widget annotations and their /AP /N streams
  const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
  if (annots) {
    for (let i = 0; i < annots.size(); i++) {
      const annot = pdfDoc.context.lookup(annots.get(i));
      if (!annot || !(annot instanceof PDFDict)) continue;

      const ap = annot.lookup(PDFName.of("AP"));
      if (ap && ap instanceof PDFDict) {
        const n = ap.lookup(PDFName.of("N"));
        if (n) {
          const stm: any = pdfDoc.context.lookup(n);
          if (stm && (stm instanceof PDFRawStream || stm.getContents || stm.decode)) {
            let decoded: Uint8Array;
            try {
              decoded = decodePDFRawStream(stm).decode();
            } catch {
              decoded = stm.getContents ? stm.getContents() : new Uint8Array(0);
            }
            const apStr = Buffer.from(decoded).toString("latin1").toLowerCase();
            const hasDigi = apStr.includes("digitally signed") || apStr.includes("digisigned");
            const hasSigner = !normSigner || apStr.replace(/[^a-z0-9]/g, "").includes(normSigner);

            if (hasDigi && hasSigner) {
              const rectArr = annot.lookupMaybe(PDFName.of("Rect"), PDFArray);
              if (rectArr && rectArr.size() === 4) {
                const rx1 = (rectArr.get(0) as any).asNumber ? (rectArr.get(0) as any).asNumber() : Number(rectArr.get(0));
                const ry1 = (rectArr.get(1) as any).asNumber ? (rectArr.get(1) as any).asNumber() : Number(rectArr.get(1));
                const rx2 = (rectArr.get(2) as any).asNumber ? (rectArr.get(2) as any).asNumber() : Number(rectArr.get(2));
                const ry2 = (rectArr.get(3) as any).asNumber ? (rectArr.get(3) as any).asNumber() : Number(rectArr.get(3));
                const ax = Math.min(rx1, rx2);
                const ay = Math.min(ry1, ry2);
                if (Math.abs(ay - sigBox.minY) < 35 && Math.abs(ax - sigBox.minX) < 65) {
                  return { exists: true, reason: `Found in annotation AP/N stream at (${ax}, ${ay})` };
                }
              } else {
                return { exists: true, reason: "Found in annotation AP/N stream" };
              }
            }
          }
        }
      }
    }
  }

  // 2. Check page canvas content streams (jsPDF or pre-drawn text)
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  if (sBytes.length === 0) return { exists: false, reason: "Empty content stream" };

  const fontCMaps = loadPageFontCMaps(pdfDoc, page);
  const textItems = extractTextItemsFromContentStream(sBytes, fontCMaps);

  // Signature box bounds: tight vertical tolerance to never invade preprinted signatory title below
  const minX = sigBox.minX - 35;
  const maxX = sigBox.maxX + 35;
  const minY = sigBox.minY - 4; // NEVER look below signature box into preprinted name line!
  const maxY = sigBox.maxY + 15;

  const inBoxItems = textItems.filter(it => it.x >= minX && it.x <= maxX && it.y >= minY && it.y <= maxY);

  const hasDigi = inBoxItems.some(it => {
    const l = it.text.toLowerCase();
    return l.includes("digitally signed") || l.includes("digisigned");
  });

  const hasSigner = !normSigner || inBoxItems.some(it => {
    return it.text.toLowerCase().replace(/[^a-z0-9]/g, "").includes(normSigner);
  });

  if (hasDigi && hasSigner) {
    const matched = inBoxItems.find(it => it.text.toLowerCase().includes("digitally") || it.text.toLowerCase().includes("digisigned"));
    return {
      exists: true,
      reason: `Found canvas digital signature "${matched?.text}" at (${matched?.x.toFixed(1)}, ${matched?.y.toFixed(1)})`
    };
  }

  return { exists: false, reason: "No matching visual typography in target box" };
}

async function testAll() {
  console.log("=== Testing DTR_Malto-Nov(1-15).pdf (Employee signed, Supervisor unsigned) ===");
  const b1 = fs.readFileSync('c:/Users/Ace/Downloads/DTR_Malto-Nov(1-15).pdf');
  const doc1 = await PDFDocument.load(b1);
  const empBox = { minX: 67, minY: 235, maxX: 252, maxY: 261 };
  const supBox = { minX: 66, minY: 187, maxX: 261, maxY: 219 };

  console.log("Emp Copy 1 (Malto):", refinedCheckVisualTypography(doc1, 0, empBox, "Malto"));
  console.log("Emp Copy 2 (Malto):", refinedCheckVisualTypography(doc1, 0, { minX: 361, minY: 235, maxX: 546, maxY: 261 }, "Malto"));
  console.log("Sup Copy 1 (Buena):", refinedCheckVisualTypography(doc1, 0, supBox, "Buena"));
  console.log("Sup Copy 2 (Buena):", refinedCheckVisualTypography(doc1, 0, { minX: 371, minY: 187, maxX: 566, maxY: 219 }, "Buena"));

  console.log("\n=== Testing DTR_Malto-Nov(1-15) (1).pdf (Both signed) ===");
  const b2 = fs.readFileSync('c:/Users/Ace/Downloads/DTR_Malto-Nov(1-15) (1).pdf');
  const doc2 = await PDFDocument.load(b2);

  console.log("Emp Copy 1 (Malto):", refinedCheckVisualTypography(doc2, 0, empBox, "Malto"));
  console.log("Emp Copy 2 (Malto):", refinedCheckVisualTypography(doc2, 0, { minX: 361, minY: 235, maxX: 546, maxY: 261 }, "Malto"));
  console.log("Sup Copy 1 (Buena):", refinedCheckVisualTypography(doc2, 0, supBox, "Buena"));
  console.log("Sup Copy 2 (Buena):", refinedCheckVisualTypography(doc2, 0, { minX: 371, minY: 187, maxX: 566, maxY: 219 }, "Buena"));
}

testAll().catch(console.error);
