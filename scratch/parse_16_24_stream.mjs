import fs from "fs";
import { PDFDocument } from "pdf-lib";
import zlib from "zlib";

const buf = fs.readFileSync("C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1792147510144_81aae404.pdf");
const doc = await PDFDocument.load(buf);
const page = doc.getPages()[0];
const contentsRef = page.node.Contents();

let fullTextStream = "";
for (let i = 0; i < contentsRef.size(); i++) {
  const streamRef = contentsRef.get(i);
  const streamObj = doc.context.lookup(streamRef);
  const streamBytes = streamObj.getContents();
  const decompressed = Buffer.from(streamBytes).toString("latin1");
  fullTextStream += decompressed + "\n";
}

console.log("Full text stream length:", fullTextStream.length);

// Extract text matches
const tjMatches = [...fullTextStream.matchAll(/\[?\s*\(([^)]+)\)\s*\]?\s*T[jJ]/g)].map(m => m[1]);
console.log("Found text elements:", tjMatches.length);
console.log("Sample texts:", tjMatches.slice(0, 50));

// Filter out days and times
const logTexts = tjMatches.filter(t => t.includes(":") || t.includes("SAT") || t.includes("SUN") || /^[123]?\d$/.test(t));
console.log("Log texts:", logTexts);
