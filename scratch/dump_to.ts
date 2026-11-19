import { db } from "../server/db.js";
import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from "../src/utils/dtrVectorPdf.js";

async function inspectTo() {
  const full = await db.execute({
    sql: "SELECT pdf_data FROM dtr_storage WHERE id = ?",
    args: ["doc-upload-1794223582282-6-zhyd"],
  });
  let b64 = full.rows[0].pdf_data as string;
  if (b64.startsWith("data:")) b64 = b64.split(",")[1];
  const buf = Buffer.from(b64, "base64");
  fs.writeFileSync("scratch/test_to_real.pdf", buf);

  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();
  console.log("Page size:", { width, height });

  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const cmaps = loadPageFontCMaps(pdfDoc, page);
  const items = extractTextItemsFromContentStream(sBytes, cmaps);

  console.log("Items on page 1 near bottom (y < 300):");
  for (const it of items) {
    if (it.y < 300) {
      console.log(`  "${it.text}" at x=${it.x.toFixed(1)}, y=${it.y.toFixed(1)}`);
    }
  }

  // Also check existing signature widget rect
  const str = buf.toString("latin1");
  const rects = [...str.matchAll(/\/Rect\s*\[([0-9\.\s]+)\]/g)];
  console.log("Signature Rects in TO:", rects.map(r => r[1]));
}

inspectTo().catch(console.error);
