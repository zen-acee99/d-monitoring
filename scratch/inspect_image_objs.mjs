import fs from "fs";
import zlib from "zlib";

const pdfPath = "C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1792147510144_81aae404.pdf";
const buf = fs.readFileSync(pdfPath);
const str = buf.toString("latin1");

const obj1031Match = str.match(/1031\s+0\s+obj([\s\S]*?)endobj/);
if (obj1031Match) {
  const body = obj1031Match[1];
  console.log("Obj 1031 header:", body.split("stream")[0]);
  const streamStart = body.indexOf("stream\r\n") !== -1 ? body.indexOf("stream\r\n") + 8 : body.indexOf("stream\n") + 7;
  const streamEnd = body.indexOf("endstream");
  const streamBuf = Buffer.from(body.substring(streamStart, streamEnd), "latin1");
  console.log("Stream compressed length:", streamBuf.length);

  try {
    const decompressed = zlib.inflateSync(streamBuf);
    console.log("Decompressed length:", decompressed.length);
  } catch (e) {
    console.log("Error decompressing:", e.message);
  }
}

// Let's also check Obj 971 and Obj 1019
for (const objNum of [971, 1019, 1031]) {
  const match = str.match(new RegExp(objNum + "\\s+0\\s+obj([\\s\\S]*?)endobj"));
  if (match) {
    console.log(`--- Obj ${objNum} Header ---`);
    console.log(match[1].split("stream")[0]);
  }
}
