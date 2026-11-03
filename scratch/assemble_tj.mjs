import fs from "fs";
import { PDFDocument } from "pdf-lib";
import zlib from "zlib";

function parseTjStream(text) {
  const result = [];
  // Match [(...)] TJ
  const tjRegex = /\[(.*?)\]\s*TJ/gs;
  let match;
  while ((match = tjRegex.exec(text)) !== null) {
    const inner = match[1];
    // extract all (...)
    const parts = [...inner.matchAll(/\((.*?)\)/g)].map(m => m[1]);
    result.push(parts.join(""));
  }
  return result;
}

const buf = fs.readFileSync("C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1792147510144_81aae404.pdf");
const doc = await PDFDocument.load(buf);
const page = doc.getPages()[0];
const contents = page.node.Contents();

let fullText = "";
for (let i = 0; i < contents.size(); i++) {
  const s = doc.context.lookup(contents.get(i));
  if (!s) continue;
  try {
    fullText += zlib.inflateSync(Buffer.from(s.getContents())).toString("latin1") + "\n";
  } catch {
    fullText += Buffer.from(s.getContents()).toString("latin1") + "\n";
  }
}

const assembled = parseTjStream(fullText);
console.log("Total assembled strings:", assembled.length);
console.log("All assembled strings:");
console.log(assembled);
