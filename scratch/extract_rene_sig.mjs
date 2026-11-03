import fs from "fs";
import zlib from "zlib";
import { PNG } from "pngjs";

const pdfPath = "C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1792147510144_81aae404.pdf";
const buf = fs.readFileSync(pdfPath);
const str = buf.toString("latin1");

const obj1031Match = str.match(/1031\s+0\s+obj([\s\S]*?)endobj/);
if (!obj1031Match) throw new Error("Could not find Obj 1031");

const body = obj1031Match[1];
const streamStart = body.indexOf("stream\r\n") !== -1 ? body.indexOf("stream\r\n") + 8 : body.indexOf("stream\n") + 7;
const streamEnd = body.indexOf("endstream");
const streamBuf = Buffer.from(body.substring(streamStart, streamEnd), "latin1");
const grayPixels = zlib.inflateSync(streamBuf);

console.log("Decompressed gray pixels length:", grayPixels.length);
const width = 512;
const height = 253;

const png = new PNG({ width, height });
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const gray = grayPixels[y * width + x];
    const idx = (width * y + x) << 2;
    // Gray is 0 for black (signature strokes) and 255 for white (background)
    // Make background transparent if desired or clean white
    if (gray > 240) {
      png.data[idx] = 255;
      png.data[idx + 1] = 255;
      png.data[idx + 2] = 255;
      png.data[idx + 3] = 0; // Transparent background
    } else {
      png.data[idx] = gray;
      png.data[idx + 1] = gray;
      png.data[idx + 2] = gray;
      png.data[idx + 3] = 255 - gray; // Alpha based on darkness
    }
  }
}

const pngBuf = PNG.sync.write(png);
console.log("Generated PNG buffer size:", pngBuf.length);

const outPath = "scratch/rene_signature_extracted.png";
fs.writeFileSync(outPath, pngBuf);
console.log("Saved extracted PNG to:", outPath);

// Also convert to data URL
const dataUrl = "data:image/png;base64," + pngBuf.toString("base64");
console.log("Data URL length:", dataUrl.length);
