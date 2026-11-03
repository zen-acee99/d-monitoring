import fs from "fs";
import { PDFDocument } from "pdf-lib";
import zlib from "zlib";

const buf = fs.readFileSync("C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1792147510144_81aae404.pdf");
const doc = await PDFDocument.load(buf);
const page = doc.getPages()[0];
const contentsRef = page.node.Contents();

for (let i = 0; i < contentsRef.size(); i++) {
  const streamRef = contentsRef.get(i);
  const streamObj = doc.context.lookup(streamRef);
  const streamBytes = streamObj.getContents();
  let text = "";
  try {
    text = zlib.inflateSync(Buffer.from(streamBytes)).toString("latin1");
  } catch {
    text = Buffer.from(streamBytes).toString("latin1");
  }

  // Look for text operators like Tm, Td, Tj, TJ
  const lines = text.split("\n");
  const textLines = lines.filter(l => l.includes("Tj") || l.includes("TJ"));
  if (textLines.length > 0) {
    console.log(`Stream ${i} text lines count: ${textLines.length}`);
    textLines.forEach(l => console.log(l));
  }
}
