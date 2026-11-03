import fs from "fs";
import { PDFDocument } from "pdf-lib";
import zlib from "zlib";

const dir = "C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/";
const files = [
  "media_1792146754498_709d256a.pdf",
  "media_1792146754505_0181b99c.pdf",
  "media_1792146754505_eda91b25.pdf",
  "media_1792147510132_24e68bb2.pdf",
  "media_1792147510144_81aae404.pdf",
  "media_1792148905764_429e9fc5.pdf",
  "media_1792148905769_9d48a41f.pdf"
];

for (const f of files) {
  const buf = fs.readFileSync(dir + f);
  const doc = await PDFDocument.load(buf);
  const page = doc.getPages()[0];
  const contents = page.node.Contents();
  let text = "";
  const size = contents.size ? contents.size() : 1;
  for (let i = 0; i < size; i++) {
    const sRef = contents.get ? contents.get(i) : contents;
    const sObj = doc.context.lookup(sRef);
    if (!sObj) continue;
    try {
      text += zlib.inflateSync(Buffer.from(sObj.getContents())).toString("latin1") + "\n";
    } catch {
      text += Buffer.from(sObj.getContents()).toString("latin1") + "\n";
    }
  }

  console.log(`\n=================== ${f} ===================`);
  // Look for any plain text in parentheses: ( ... )
  const textMatches = [...text.matchAll(/\(([^)]+)\)/g)].map(m => m[1]);
  const periods = textMatches.filter(t => t.toLowerCase().includes("sept") || t.toLowerCase().includes("2026"));
  console.log("Periods found:", periods);
  const names = textMatches.filter(t => t.includes("ACE") || t.includes("BUENA") || t.includes("RENE") || t.includes("MALTO"));
  console.log("Names found:", names);
}
