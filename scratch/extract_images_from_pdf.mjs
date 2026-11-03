import fs from "fs";
import { PDFDocument, PDFName } from "pdf-lib";

const pdfPath = "C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1792147510144_81aae404.pdf";
const buf = fs.readFileSync(pdfPath);
const doc = await PDFDocument.load(buf);

const pages = doc.getPages();
console.log("Pages count:", pages.length);

// In PDF, let's find all objects with Subtype Image
const str = buf.toString("latin1");
const imageMatches = [...str.matchAll(/(\d+)\s+0\s+obj\s*<<[\s\S]*?\/Subtype\s*\/Image[\s\S]*?>>\s*stream([\s\S]*?)endstream/g)];

console.log("Found image objects:", imageMatches.length);
imageMatches.forEach((m, idx) => {
  const objNum = m[1];
  const header = m[0].split("stream")[0];
  console.log(`\nImage ${idx + 1} (Obj ${objNum}):`);
  const filter = header.match(/\/Filter\s*(\/[a-zA-Z0-9]+)/)?.[1];
  const width = header.match(/\/Width\s*(\d+)/)?.[1];
  const height = header.match(/\/Height\s*(\d+)/)?.[1];
  const length = header.match(/\/Length\s*(\d+)/)?.[1];
  console.log(`  Filter: ${filter}, Size: ${width}x${height}, Stream length: ${length}`);
});
