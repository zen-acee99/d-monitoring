import fs from 'fs';
import { generateDtrVectorPdf, preloadFonts, extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';
import { signPdfBuffer } from '../server/services/pnpkiSigningService';
import { PDFDocument, PDFName, PDFArray } from 'pdf-lib';

async function test() {
  const config: any = {
    employeeName: "Ace M. Malto",
    employeeSignerName: "Ace M. Malto",
    supervisorName: "Rene Jane R. Buena",
    signerName: "Rene Jane R. Buena",
    year: "2026",
    month: "November 1-15, 2026",
    status: "Pending", // NOT verified/approved! Supervisor hasn't signed!
    employeeHasP12: true,
    supervisorHasP12: false, // Supervisor has NOT signed!
  };

  const rows: any[] = [{
    day: 1,
    amArrival: "08:00",
    amDeparture: "12:00",
    pmArrival: "13:00",
    pmDeparture: "17:00",
  }];

  const { doc, employeeSigRects, supervisorSigRects } = generateDtrVectorPdf(
    config,
    rows,
    undefined,
    true,
    null,
    "Ace M. Malto"
  );
  const pdfBytes = new Uint8Array(doc.output("arraybuffer"));
  fs.writeFileSync('scratch/fresh_pending_dtr.pdf', pdfBytes);
  console.log("Generated pending DTR (Supervisor signature box is visually EMPTY).");

  // Read supervisor p12
  const p12Buffer = fs.readFileSync('scratch/rene_jane.p12');
  
  // Now let's sign with Rene Jane (as Combine DTR would)
  console.log("Signing with Rene Jane via signPdfBuffer...");
  const { signedBuffer } = await signPdfBuffer(
    Buffer.from(pdfBytes),
    p12Buffer.toString('base64'),
    "1234567890Aa!",
    {
      signerName: "Buena Rene Jane Rosendo",
      reason: "Civil Service Form No. 48 Official Verification",
      sigRects: supervisorSigRects,
      fieldName: "Supervisor_Signature_Copy1",
    }
  );

  // Inspect the signed PDF
  const signedDoc = await PDFDocument.load(signedBuffer);
  const page = signedDoc.getPage(0);
  const sBytes = extractPageContentStreamBytes(signedDoc, page);
  const fontCMaps = loadPageFontCMaps(signedDoc, page);
  const textItems = extractTextItemsFromContentStream(sBytes, fontCMaps);
  const digiItems = textItems.filter(it => it.text.toLowerCase().includes('digitally') || it.text.toLowerCase().includes('buena'));
  console.log('Canvas items matching digitally/buena:');
  for (const it of digiItems) {
    console.log(`  [x=${it.x.toFixed(1)}, y=${it.y.toFixed(1)}] "${it.text}"`);
  }

  const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  console.log(`Signed document annots count: ${annots?.size()}`);
  for (let i = 0; i < (annots?.size() || 0); i++) {
    const a = signedDoc.context.lookup(annots!.get(i));
    const t = a.lookup(PDFName.of('T'))?.toString();
    const ap = a.lookup(PDFName.of('AP'));
    let apContent = 'none';
    if (ap && ap.lookup) {
      const n = ap.lookup(PDFName.of('N'));
      if (n) {
        const stm = signedDoc.context.lookup(n);
        if (stm && (stm as any).getContents) {
          const raw = Buffer.from((stm as any).getContents());
          apContent = `${raw.length} bytes: ${raw.toString('latin1').replace(/\r?\n/g, ' ')}`;
        }
      }
    }
    console.log(`  Annot ${i}: ${t} -> AP /N: ${apContent}`);
  }
}

test().catch(console.error);
