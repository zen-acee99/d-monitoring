import fs from "fs";
import { PDFDocument, PDFName, PDFDict, PDFArray } from "pdf-lib";

async function main() {
  const buf = fs.readFileSync("scratch/test_dv_real.pdf");
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  pages.forEach((page, pIdx) => {
    console.log(`Page ${pIdx + 1} size:`, page.getSize());
    const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    if (!annots) {
      console.log("No annots on page", pIdx + 1);
      return;
    }
    console.log(`Page ${pIdx + 1} has ${annots.size()} annotations:`);
    for (let i = 0; i < annots.size(); i++) {
      const ref = annots.get(i);
      const dict = pdfDoc.context.lookup(ref, PDFDict);
      if (!dict) continue;
      const subtype = dict.lookupMaybe(PDFName.of("Subtype"), PDFName)?.asString();
      const ft = dict.lookupMaybe(PDFName.of("FT"), PDFName)?.asString();
      const t = dict.get(PDFName.of("T"))?.toString();
      const v = dict.get(PDFName.of("V"))?.toString();
      const rect = dict.lookupMaybe(PDFName.of("Rect"), PDFArray);
      let rectStr = "";
      if (rect) {
        rectStr = `[${rect.asArray().map(n => (n as any).asNumber?.()).join(", ")}]`;
      }
      console.log(`  Annot ${i}: Subtype=${subtype}, FT=${ft}, T=${t}, V=${v}, Rect=${rectStr}`);
    }
  });

  const str = buf.toString("latin1");
  const sigMatches = [...str.matchAll(/\/Type\s*\/Sig\b([\s\S]*?)(?=endobj|\/Type\s*\/Sig)/g)];
  console.log(`\nFound ${sigMatches.length} /Type /Sig objects in raw PDF:`);
  sigMatches.forEach((m, idx) => {
    const nameMatch = m[1].match(/\/Name\s*\(([^)]+)\)/);
    const reasonMatch = m[1].match(/\/Reason\s*\(([^)]+)\)/);
    const byteRangeMatch = m[1].match(/\/ByteRange\s*\[([^\]]+)\]/);
    console.log(`  Sig ${idx + 1}: Name=${nameMatch?.[1]}, Reason=${reasonMatch?.[1]}, ByteRange=${byteRangeMatch?.[1]}`);
  });
}
main();
