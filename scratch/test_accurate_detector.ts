import fs from 'fs';
import { PDFDocument, PDFName, PDFArray, PDFDict, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import {
  extractPageContentStreamBytes,
  loadPageFontCMaps,
  extractTextItemsFromContentStream,
  generateDtrVectorPdf
} from '../src/utils/dtrVectorPdf';

export function checkVisualTypographyOnPage(
  pdfDoc: PDFDocument,
  pageIndex: number,
  sigBox: { minX: number; minY: number; maxX: number; maxY: number },
  signerName?: string
): { exists: boolean; reason: string } {
  const pages = pdfDoc.getPages();
  const page = pages[pageIndex] || pages[0];
  if (!page) return { exists: false, reason: "No page" };

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
            if (apStr.includes("digitally signed") || apStr.includes("digisigned")) {
              // Also check rect proximity if available
              const rectArr = annot.lookupMaybe(PDFName.of("Rect"), PDFArray);
              if (rectArr && rectArr.size() === 4) {
                const ax = (rectArr.get(0) as any).asNumber ? (rectArr.get(0) as any).asNumber() : Number(rectArr.get(0));
                const ay = (rectArr.get(1) as any).asNumber ? (rectArr.get(1) as any).asNumber() : Number(rectArr.get(1));
                // If this annotation is near our target box (same copy / position)
                if (Math.abs(ay - sigBox.minY) < 30 && Math.abs(ax - sigBox.minX) < 60) {
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

  const normSigner = (signerName || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const it of textItems) {
    const textLower = it.text.toLowerCase();
    const isDigi = textLower.includes("digitally signed") || textLower.includes("digisigned");
    const isSignerMatch = normSigner.length > 4 && textLower.replace(/[^a-z0-9]/g, "").includes(normSigner);

    if (isDigi || isSignerMatch) {
      // Check if this text is within or adjacent to our signature bounding box
      // (sigBox x: [minX, maxX], y: [minY, maxY])
      // Allow +/- 35 pt vertical and horizontal tolerance to accommodate layout variations
      const xMatch = it.x >= (sigBox.minX - 35) && it.x <= (sigBox.maxX + 35);
      const yMatch = it.y >= (sigBox.minY - 20) && it.y <= (sigBox.maxY + 30);

      if (xMatch && yMatch) {
        return {
          exists: true,
          reason: `Found canvas text "${it.text}" at (x=${it.x.toFixed(1)}, y=${it.y.toFixed(1)}) within sigBox [${sigBox.minX}, ${sigBox.minY}, ${sigBox.maxX}, ${sigBox.maxY}]`
        };
      }
    }
  }

  return { exists: false, reason: "No matching visual typography in target box" };
}

async function run() {
  console.log("=== Testing checkVisualTypographyOnPage ===");

  // Test 1: User's DTR_Malto-Nov(1-15).pdf
  // Copy 1 Employee box: [68, 235, 238, 260]
  // Copy 1 Supervisor box: [68, 185, 238, 215]
  if (fs.existsSync('c:/Users/Ace/Downloads/DTR_Malto-Nov(1-15).pdf')) {
    const bytes = fs.readFileSync('c:/Users/Ace/Downloads/DTR_Malto-Nov(1-15).pdf');
    const pdfDoc = await PDFDocument.load(bytes);
    
    const empC1 = checkVisualTypographyOnPage(pdfDoc, 0, { minX: 68, minY: 235, maxX: 238, maxY: 260 }, "Malto Ace Mata");
    console.log("DTR_Malto-Nov(1-15).pdf - Employee Copy 1:", empC1);
    
    const empC2 = checkVisualTypographyOnPage(pdfDoc, 0, { minX: 362, minY: 235, maxX: 532, maxY: 260 }, "Malto Ace Mata");
    console.log("DTR_Malto-Nov(1-15).pdf - Employee Copy 2:", empC2);

    const supC1 = checkVisualTypographyOnPage(pdfDoc, 0, { minX: 68, minY: 185, maxX: 238, maxY: 215 }, "Buena Rene Jane Rosendo");
    console.log("DTR_Malto-Nov(1-15).pdf - Supervisor Copy 1 (should be FALSE!):", supC1);

    const supC2 = checkVisualTypographyOnPage(pdfDoc, 0, { minX: 362, minY: 185, maxX: 532, maxY: 215 }, "Buena Rene Jane Rosendo");
    console.log("DTR_Malto-Nov(1-15).pdf - Supervisor Copy 2 (should be FALSE!):", supC2);
  }

  // Test 2: Fresh Pending DTR (Employee signed, Supervisor NOT signed)
  if (fs.existsSync('scratch/fresh_pending_dtr.pdf')) {
    const bytes = fs.readFileSync('scratch/fresh_pending_dtr.pdf');
    const pdfDoc = await PDFDocument.load(bytes);

    const empRes = checkVisualTypographyOnPage(pdfDoc, 0, { minX: 68, minY: 235, maxX: 238, maxY: 260 }, "Ace M. Malto");
    console.log("\nFresh Pending DTR - Employee Copy 1 (should be TRUE):", empRes);

    const supRes = checkVisualTypographyOnPage(pdfDoc, 0, { minX: 68, minY: 185, maxX: 238, maxY: 215 }, "Buena Rene Jane Rosendo");
    console.log("Fresh Pending DTR - Supervisor Copy 1 (should be FALSE):", supRes);
  }
}

run().catch(console.error);
