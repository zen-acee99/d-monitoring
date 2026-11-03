import fs from "fs";
import { PDFDocument } from "pdf-lib";
import zlib from "zlib";

const dir = "C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/";
const files = fs.readdirSync(dir).filter(f => f.endsWith(".pdf"));

for (const f of files) {
  const buf = fs.readFileSync(dir + f);
  const doc = await PDFDocument.load(buf);
  const page = doc.getPages()[0];
  const contentsRef = page.node.Contents();

  let allText = "";
  if (contentsRef) {
    const size = contentsRef.size ? contentsRef.size() : 1;
    for (let i = 0; i < size; i++) {
      const streamRef = contentsRef.get ? contentsRef.get(i) : contentsRef;
      const streamObj = doc.context.lookup(streamRef);
      if (!streamObj) continue;
      const streamBytes = streamObj.getContents();
      try {
        allText += zlib.inflateSync(Buffer.from(streamBytes)).toString("latin1") + "\n";
      } catch {
        allText += Buffer.from(streamBytes).toString("latin1") + "\n";
      }
    }
  }

  // Extract month/period lines
  const periodMatches = [...allText.matchAll(/SEPTEMBER[^\n)]*/gi)].map(m => m[0]);
  console.log(`\n=== File: ${f} (${buf.length} bytes) ===`);
  console.log("Period matches:", periodMatches);
}
