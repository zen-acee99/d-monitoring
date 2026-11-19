import fs from 'fs';
import { PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';

async function main() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1793905166091_27734990.pdf';
  const bytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(bytes);

  const page = pdfDoc.getPage(0);
  const contentsNode = page.node.Contents();
  const arr = contentsNode.asArray();
  console.log('Array of streams length:', arr.length);

  for (let i = 0; i < arr.length; i++) {
    const sObj = pdfDoc.context.lookup(arr[i]);
    const dec = decodePDFRawStream(sObj).decode();
    const str = new TextDecoder('latin1').decode(dec);
    // Find any names or text
    const tjMatches = [...str.matchAll(/\(([^)]+)\)\s*Tj/g)].map(m => m[1]);
    const tjArrMatches = [...str.matchAll(/\[(.*?)\]\s*TJ/g)].map(m => m[1]);
    if (tjMatches.length > 0 || tjArrMatches.length > 0) {
      for (const t of tjMatches) {
        if (/ANNABEL|CALIMPONG|BALANA|CABREDO|DY|LEAH|DANREV|CARLA|MALTO/i.test(t)) {
          console.log(`Stream ${i} (${arr[i].toString()}) Tj:`, t);
        }
      }
      for (const t of tjArrMatches) {
        if (/ANNABEL|CALIMPONG|BALANA|CABREDO|DY|LEAH|DANREV|CARLA|MALTO/i.test(t)) {
          console.log(`Stream ${i} (${arr[i].toString()}) TJ:`, t);
        }
      }
    }
  }
}

main().catch(console.error);
