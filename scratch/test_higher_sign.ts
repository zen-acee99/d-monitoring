import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';
import { signPdfBuffer, decryptP12Password } from '../server/services/pnpkiSigningService';
import { RENE_JANE_SIGNATURE_BASE64 } from '../src/utils/reneJaneAutoSign';

async function testHigherSign() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1794696272616_577d24d5.pdf';
  const incomingBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(incomingBytes);
  const page = pdfDoc.getPage(0);
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const fontCMaps = loadPageFontCMaps(pdfDoc, page);
  const textItems = extractTextItemsFromContentStream(sBytes, fontCMaps);

  const buenaMatches = textItems.filter(it => it.text.toUpperCase().includes("BUEN") && it.y < 230 && it.y > 90);
  const bItem = buenaMatches[0];
  console.log(`bItem: "${bItem.text}" at x=${bItem.x}, y=${bItem.y}`);

  // Test with sig2Y moved higher:
  // bItem.y is 196.9. bItem letters top ~ 204.5.
  // If sig2Y = Math.round(bItem.y + 5) = 202:
  const sig2Y = Math.round(bItem.y + 5); // 202
  const sig2H = 26;
  const sig2W = 195;
  const sig2X = 310;

  console.log(`Testing Sig2: [${sig2X}, ${sig2Y}, ${sig2W}, ${sig2H}]`);
  console.log(`  Name baseline: ${bItem.y}`);
  console.log(`  Signature box bottom: ${sig2Y} (top of box: ${sig2Y + sig2H})`);
  console.log(`  Digitally signed by Y: ${sig2Y + 16}`);
  console.log(`  Buena Rene Jane Rosendo Y: ${sig2Y + 7}`);
  console.log(`  Distance from name baseline to lowest text line: ${(sig2Y + 7) - bItem.y} pt`);
}
testHigherSign().catch(console.error);
