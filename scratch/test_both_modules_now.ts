import fs from 'fs';
import { getSignedDtrVectorPdfBytes } from '../src/utils/dtrVectorPdf';
import { autoSignPdfWithReneJane } from '../src/utils/reneJaneAutoSign';
import { PDFDocument, PDFName, PDFArray, decodePDFRawStream } from 'pdf-lib';

async function inspectPdf(bytes: Uint8Array, label: string) {
  console.log(`\n=================== ${label} ===================`);
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPage(0);
  const contents = page.node.Contents();
  
  const streams: any[] = [];
  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) {
      streams.push(pdfDoc.context.lookup(contents.get(i)));
    }
  } else if (contents) {
    streams.push(pdfDoc.context.lookup(contents));
  }

  console.log(`Page 0 Contents streams count: ${streams.length}`);
  for (let i = 0; i < streams.length; i++) {
    const stm = streams[i];
    let decoded: Uint8Array;
    try {
      decoded = decodePDFRawStream(stm).decode();
    } catch {
      decoded = stm.getContents();
    }
    const txt = Buffer.from(decoded).toString('latin1');
    const matches = txt.split(/\r?\n/).filter(l => 
      l.includes('Digitally') || l.includes('DigiSigned') || l.includes('Malto') || l.includes('Buena')
    );
    if (matches.length > 0) {
      console.log(`  Stream ${i} (len ${decoded.length}) has text matches:`);
      for (const m of matches) {
        console.log(`    ${m.trim()}`);
      }
    }
  }

  const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (annots) {
    console.log(`Annots count: ${annots.size()}`);
    for (let i = 0; i < annots.size(); i++) {
      const a = pdfDoc.context.lookup(annots.get(i));
      const t = a.lookup(PDFName.of('T'))?.toString();
      const rect = a.lookup(PDFName.of('Rect'))?.toString();
      const ap = a.lookup(PDFName.of('AP'));
      let apText = 'none';
      if (ap && ap.lookup) {
        const n = ap.lookup(PDFName.of('N'));
        if (n) {
          const stm = pdfDoc.context.lookup(n);
          if (stm && (stm as any).getContents) {
            const raw = Buffer.from((stm as any).getContents());
            const str = raw.toString('latin1');
            apText = `${raw.length} bytes: ${str.replace(/\r?\n/g, ' ')}`;
          }
        }
      }
      console.log(`  Annot ${i}: ${t} rect=${rect} AP/N: ${apText}`);
    }
  }
}

async function run() {
  const config: any = {
    employeeName: "Ace M. Malto",
    employeeSignerName: "Ace M. Malto",
    supervisorName: "Rene Jane R. Buena",
    signerName: "Rene Jane R. Buena",
    year: "2026",
    month: "November 1-15, 2026",
    status: "Verified",
    department: "ICT Industry Development Bureau",
  };
  const rows: any[] = [];
  for (let d = 1; d <= 15; d++) {
    rows.push({
      day: d,
      amArrival: "08:00",
      amDeparture: "12:00",
      pmArrival: "13:00",
      pmDeparture: "17:00",
      underTimeHours: "",
      underTimeMinutes: "",
    });
  }

  console.log("Generating DTR via getSignedDtrVectorPdfBytes...");
  const dtrResult = await getSignedDtrVectorPdfBytes(config, rows);
  fs.writeFileSync('scratch/test_gen_dtr.pdf', dtrResult.bytes);
  await inspectPdf(dtrResult.bytes, "1. DTR Generator Output");

  console.log("\nPassing generated DTR into Combine DTR (autoSignPdfWithReneJane)...");
  const combineResult = await autoSignPdfWithReneJane(dtrResult.bytes, "test_dtr.pdf");
  fs.writeFileSync('scratch/test_combine_dtr.pdf', combineResult.signedPdfBytes);
  await inspectPdf(combineResult.signedPdfBytes, "2. Combine DTR Output");
}

run().catch(console.error);
